// Creator Content Radar — Backend Function (Upgraded)
// Implements: analyze-channel, find-competitors, search-topic (with Multi-Source Gather & AI Insights)
// Uses YouTube Data API v3 + Groq/OpenRouter for AI analysis

const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY") || (typeof process !== "undefined" ? process.env?.YOUTUBE_API_KEY : "") || "";
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") || (typeof process !== "undefined" ? process.env?.GROQ_API_KEY : "") || "";
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || (typeof process !== "undefined" ? process.env?.OPENROUTER_API_KEY : "") || "";

// ─── Helpers ───

function extractChannelIdentifier(urlOrId: string): { kind: string; value: string } {
  const text = urlOrId.trim().replace(/\/+$/, "");
  const channelIdMatch = text.match(/UC[\w-]{22}/);
  if (channelIdMatch) return { kind: "id", value: channelIdMatch[0] };
  const handleMatch = text.match(/@([\w.-]+)/);
  if (handleMatch) return { kind: "forHandle", value: "@" + handleMatch[1] };
  if (text.includes("/c/")) {
    const name = text.split("/c/")[1].split("/")[0].split("?")[0];
    return { kind: "forUsername", value: name };
  }
  if (text.includes("/user/")) {
    const name = text.split("/user/")[1].split("/")[0].split("?")[0];
    return { kind: "forUsername", value: name };
  }
  return { kind: "id", value: text };
}

function isoToSeconds(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return (parseInt(match[1] || "0") * 3600) + (parseInt(match[2] || "0") * 60) + parseInt(match[3] || "0");
}

async function youtubeAPI(endpoint: string, params: Record<string, string>) {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${endpoint}`);
  url.searchParams.set("key", YOUTUBE_API_KEY);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  const resp = await fetch(url.toString());
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`YouTube API error: ${resp.status} ${err}`);
  }
  return resp.json();
}

async function callAI(prompt: string): Promise<string> {
  const providers = [
    { url: "https://api.groq.com/openai/v1/chat/completions", key: GROQ_API_KEY, model: "llama-3.3-70b-versatile" },
    { url: "https://openrouter.ai/api/v1/chat/completions", key: OPENROUTER_API_KEY, model: "meta-llama/llama-3.3-70b-instruct" },
  ];
  for (const p of providers) {
    if (!p.key) continue;
    try {
      const resp = await fetch(p.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${p.key}` },
        body: JSON.stringify({ model: p.model, messages: [{ role: "user", content: prompt }], temperature: 0.7 }),
      });
      if (resp.ok) {
        const data = await resp.json();
        return data.choices[0].message.content;
      }
    } catch (e) { /* try next */ }
  }
  throw new Error("All AI providers failed");
}

function parseAIJson(text: string): any {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) cleaned = cleaned.split("\n").slice(1).join("\n");
  if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3);
  cleaned = cleaned.trim();
  if (cleaned.toLowerCase().startsWith("json")) {
    cleaned = cleaned.slice(4).trim();
  }
  return JSON.parse(cleaned);
}

// Timeout fetch helper for external sources
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 5000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

// Clean XML entities and CDATA for Google News RSS parsing
function cleanXMLText(text: string): string {
  let cleaned = text.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1").trim();
  cleaned = cleaned
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
  return cleaned;
}

function getChannelTier(subs: number): string {
  if (subs < 1000) return "Nano";
  if (subs < 10000) return "Micro";
  if (subs < 100000) return "Mid-Tier";
  if (subs < 1000000) return "Macro";
  return "Mega";
}

// ─── External Sources Fetchers ───

async function fetchHackerNews(topic: string): Promise<any[]> {
  const results: any[] = [];
  try {
    const resp = await fetchWithTimeout(`https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(topic)}&tags=story&hitsPerPage=10`);
    if (!resp.ok) return [];
    const data = await resp.json();
    for (const hit of data.hits || []) {
      const score = (hit.points || 0) + (hit.num_comments || 0) * 3;
      results.push({
        platform: "hackernews",
        title: hit.title || "",
        url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
        engagement_score: score,
        published_at: hit.created_at || "",
        source: hit.author || "Unknown",
        raw_metrics: { points: hit.points || 0, num_comments: hit.num_comments || 0 },
        classification: score > 150 ? "popular" : score > 50 ? "trending" : "underrated",
      });
    }
  } catch (_) {
    // Graceful degradation
  }
  return results;
}

async function fetchDevTo(topic: string): Promise<any[]> {
  const results: any[] = [];
  try {
    const resp = await fetchWithTimeout(`https://dev.to/api/articles?tag=${encodeURIComponent(topic)}&per_page=10`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    if (Array.isArray(data)) {
      for (const article of data) {
        const score = (article.positive_reactions_count || 0) + (article.comments_count || 0) * 2;
        results.push({
          platform: "devto",
          title: article.title || "",
          url: article.url || "",
          engagement_score: score,
          published_at: article.published_at || "",
          source: article.user?.username || "Dev.to",
          raw_metrics: { positive_reactions: article.positive_reactions_count || 0, comments: article.comments_count || 0 },
          classification: score > 100 ? "popular" : score > 30 ? "trending" : "underrated",
        });
      }
    }
  } catch (_) {
    // Graceful degradation
  }
  return results;
}

async function fetchGoogleNews(topic: string): Promise<any[]> {
  const results: any[] = [];
  try {
    const resp = await fetchWithTimeout(`https://news.google.com/rss/search?q=${encodeURIComponent(topic)}&hl=en-US&gl=US&ceid=US:en`);
    if (!resp.ok) return [];
    const xmlText = await resp.text();
    const items = xmlText.match(/<item>[\s\S]*?<\/item>/g) || [];
    for (const item of items.slice(0, 10)) {
      const titleMatch = item.match(/<title>([\s\S]*?)<\/title>/);
      const linkMatch = item.match(/<link>([\s\S]*?)<\/link>/);
      const pubDateMatch = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
      const sourceMatch = item.match(/<source[^>]*>([\s\S]*?)<\/source>/);

      const title = cleanXMLText(titleMatch ? titleMatch[1] : "");
      const url = cleanXMLText(linkMatch ? linkMatch[1] : "");
      
      let publishedAt = "";
      if (pubDateMatch) {
        try {
          publishedAt = new Date(pubDateMatch[1]).toISOString();
        } catch (_) {
          publishedAt = pubDateMatch[1];
        }
      }
      
      let source = "Google News";
      if (sourceMatch) {
        source = cleanXMLText(sourceMatch[1]);
      } else {
        const parts = title.split(" - ");
        if (parts.length > 1) {
          source = parts[parts.length - 1].trim();
        }
      }

      results.push({
        platform: "google_news",
        title,
        url,
        engagement_score: 0,
        published_at: publishedAt,
        source,
        raw_metrics: { views: 0 },
        classification: "trending"
      });
    }
  } catch (_) {
    // Graceful degradation
  }
  return results;
}

// ─── Analyze Channel ───

async function analyzeChannel(channelUrl: string) {
  const { kind, value } = extractChannelIdentifier(channelUrl);
  const channelResp = await youtubeAPI("channels", { part: "snippet,statistics", [kind]: value });

  if (!channelResp.items || channelResp.items.length === 0) {
    throw new Error(`No YouTube channel found for '${channelUrl}'`);
  }

  const ch = channelResp.items[0];
  const snippet = ch.snippet;
  const stats = ch.statistics;
  const channelId = ch.id;

  const subscriberCount = parseInt(stats.subscriberCount || "0");
  const videoCount = parseInt(stats.videoCount || "0");
  const viewCount = parseInt(stats.viewCount || "0");
  const avgViews = videoCount > 0 ? viewCount / videoCount : 0;

  const searchResp = await youtubeAPI("search", { part: "snippet", channelId, order: "date", maxResults: "50", type: "video" });
  const allItems = searchResp.items || [];
  const videoIds = allItems.map((item: any) => item.id.videoId).filter(Boolean);
  const recentTitles = allItems.slice(0, 15).map((item: any) => item.snippet.title);

  let videoDetails: any[] = [];
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    try {
      const videosResp = await youtubeAPI("videos", { part: "snippet,statistics,contentDetails", id: batch.join(",") });
      for (const item of videosResp.items || []) {
        const vstats = item.statistics || {};
        const vsnippet = item.snippet || {};
        const cd = item.contentDetails || {};
        videoDetails.push({
          id: item.id, title: vsnippet.title || "", publishedAt: vsnippet.publishedAt || "",
          viewCount: parseInt(vstats.viewCount || "0"), likeCount: parseInt(vstats.likeCount || "0"),
          commentCount: parseInt(vstats.commentCount || "0"), duration: cd.duration || "",
        });
      }
    } catch (e) { /* skip */ }
  }

  let totalLikes = 0, totalComments = 0, totalRecentViews = 0;
  for (const v of videoDetails) { totalLikes += v.likeCount; totalComments += v.commentCount; totalRecentViews += v.viewCount; }
  const engagementRate = totalRecentViews > 0 ? ((totalLikes + totalComments) / totalRecentViews) * 100 : 0;

  let totalDuration = 0, durationsCounted = 0;
  for (const v of videoDetails) {
    const dur = isoToSeconds(v.duration || "");
    if (dur > 0) { totalDuration += dur; durationsCounted++; }
  }
  const avgDuration = durationsCounted > 0 ? totalDuration / durationsCounted : 0;
  const recentAvgViews = videoDetails.length > 0 ? totalRecentViews / videoDetails.length : 0;

  const sortedByViews = [...videoDetails].sort((a, b) => b.viewCount - a.viewCount);
  const topVideos = sortedByViews.slice(0, 5).map(v => ({
    title: v.title, video_id: v.id, views: v.viewCount, likes: v.likeCount,
    comments: v.commentCount, published_at: v.publishedAt, duration: v.duration, performance_ratio: avgViews > 0 ? v.viewCount / avgViews : 0,
  }));
  const underperformers = sortedByViews.filter(v => v.viewCount < avgViews * 0.5).slice(-3).map(v => ({
    title: v.title, video_id: v.id, views: v.viewCount, likes: v.likeCount,
    comments: v.commentCount, published_at: v.publishedAt, performance_ratio: avgViews > 0 ? v.viewCount / avgViews : 0,
  }));

  const stopWords = new Set(["the", "a", "an", "to", "in", "of", "for", "and", "on", "with", "how", "your", "my", "is", "are", "you", "this", "that"]);
  const wordFreq: Record<string, number> = {};
  for (const v of topVideos) {
    const words = v.title.toLowerCase().match(/[a-zA-Z]+/g) || [];
    for (const w of words) { if (!stopWords.has(w) && w.length > 2) wordFreq[w] = (wordFreq[w] || 0) + 1; }
  }
  const titleWordFreq = Object.entries(wordFreq).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const topTitleLengths = topVideos.map(v => v.title.split(/\s+/).length);
  const avgTitleLength = topTitleLengths.length > 0 ? topTitleLengths.reduce((a, b) => a + b, 0) / topTitleLengths.length : 0;

  const topVideosText = topVideos.map((v, i) => `  ${i + 1}. "${v.title}" — ${v.views.toLocaleString()} views, ${v.likes.toLocaleString()} likes, ${v.comments.toLocaleString()} comments (${v.performance_ratio.toFixed(1)}x channel avg)`).join("\n");
  const underperformersText = underperformers.map((v, i) => `  ${i + 1}. "${v.title}" — ${v.views.toLocaleString()} views (${v.performance_ratio.toFixed(1)}x avg)`).join("\n");
  const titlePatternsText = titleWordFreq.length > 0 ? titleWordFreq.slice(0, 7).map(([word, count]) => `'${word}' (${count}x)`).join(", ") : "";

  let videoStatsText = "";
  if (videoDetails.length > 0) {
    const views = videoDetails.map(v => v.viewCount);
    const sortedViews = [...views].sort((a, b) => a - b);
    videoStatsText = `Recent video stats (last ${views.length} videos): max=${Math.max(...views).toLocaleString()}, min=${Math.min(...views).toLocaleString()}, median=${sortedViews[Math.floor(sortedViews.length / 2)].toLocaleString()} views`;
  }

  // ─── Upgraded Analytics Calculations ───

  // Posting frequency: calculate avg days between uploads
  const publishDates = videoDetails
    .map(v => new Date(v.publishedAt).getTime())
    .filter(t => !isNaN(t))
    .sort((a, b) => b - a);
  const gaps = [];
  for (let i = 1; i < publishDates.length; i++) {
    gaps.push(Math.abs(publishDates[i-1] - publishDates[i]) / (1000 * 60 * 60 * 24));
  }
  const postingFrequencyDays = gaps.length > 0 ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0;

  // View velocity: avg views per day since publish
  const now = Date.now();
  const velocities = videoDetails
    .map(v => {
      const pubTime = new Date(v.publishedAt).getTime();
      if (isNaN(pubTime)) return 0;
      const ageDays = Math.max((now - pubTime) / (1000 * 60 * 60 * 24), 1);
      return v.viewCount / ageDays;
    })
    .filter(val => !isNaN(val) && val >= 0);
  const viewVelocity = velocities.length > 0 ? velocities.reduce((a, b) => a + b, 0) / velocities.length : 0;

  // Like-to-view and comment-to-view ratios
  const likeViewRatio = totalRecentViews > 0 ? (totalLikes / totalRecentViews) * 100 : 0;
  const commentViewRatio = totalRecentViews > 0 ? (totalComments / totalRecentViews) * 100 : 0;

  // Thumbnail URLs from video IDs
  const thumbnailUrls = topVideos.map(v => `https://i.ytimg.com/vi/${v.video_id}/hqdefault.jpg`);

  // Best posting day (day with highest avg views)
  const dayViews: Record<string, number[]> = {};
  for (const v of videoDetails) {
    if (!v.publishedAt) continue;
    const pubDate = new Date(v.publishedAt);
    if (isNaN(pubDate.getTime())) continue;
    const day = pubDate.toLocaleDateString('en-US', { weekday: 'long' });
    if (!dayViews[day]) dayViews[day] = [];
    dayViews[day].push(v.viewCount);
  }
  let bestDay = 'Unknown';
  let bestAvgViews = 0;
  for (const [day, views] of Object.entries(dayViews)) {
    const avg = views.reduce((a, b) => a + b, 0) / views.length;
    if (avg > bestAvgViews) {
      bestAvgViews = avg;
      bestDay = day;
    }
  }

  // Optimal video length from top performers
  const topDurations = topVideos.map(v => isoToSeconds(v.duration || '')).filter(d => d > 0);
  let optimalLength = 'Unknown';
  if (topDurations.length > 0) {
    const avgDur = topDurations.reduce((a, b) => a + b, 0) / topDurations.length;
    const mins = avgDur / 60;
    if (mins < 5) optimalLength = 'Under 5 minutes';
    else if (mins < 10) optimalLength = '5-10 minutes';
    else if (mins < 20) optimalLength = '10-20 minutes';
    else optimalLength = '20+ minutes';
  }

  // Views timeline for charts
  const viewsTimeline = videoDetails
    .filter(v => {
      const pubTime = new Date(v.publishedAt).getTime();
      return v.publishedAt && !isNaN(pubTime);
    })
    .map(v => ({
      date: v.publishedAt,
      title: v.title,
      views: v.viewCount
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Engagement timeline
  const engagementTimeline = videoDetails
    .filter(v => {
      const pubTime = new Date(v.publishedAt).getTime();
      return v.publishedAt && !isNaN(pubTime);
    })
    .map(v => ({
      date: v.publishedAt,
      likes: v.likeCount,
      comments: v.commentCount
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Video duration data for scatter plot
  const videoDurationData = videoDetails
    .map(v => ({
      title: v.title,
      duration_seconds: isoToSeconds(v.duration || ''),
      views: v.viewCount
    }))
    .filter(v => v.duration_seconds > 0);

  // ─── Upgraded Prompt ───

  const prompt = `You are an expert YouTube strategist analyzing a channel for growth opportunities.

You have access to the channel's actual video performance data — use it to give specific, data-driven recommendations. Do NOT give generic advice.

Return ONLY a raw JSON object (no markdown, no code fences) with exactly these keys:

{
  "niche": "primary niche in 2-5 words",
  "topics": ["3-6 main content topics"],
  "content_style": "brief description of the channel's content style, tone, and format",
  "target_audience": "specific description of who watches",
  "ai_summary": "3-5 sentences analyzing the channel's strengths, weaknesses, content patterns. Reference actual video performance data.",
  "upload_frequency": "estimated upload frequency",
  "growth_potential": "rate as 'Very High', 'High', 'Medium', or 'Low' with brief reason",
  "best_topics": ["3-5 topics that drive the most engagement"],
  "title_patterns": ["3-5 patterns in best-performing titles"],
  "content_gaps": ["3-5 topics the channel has NOT covered but should"],
  "content_recommendations": ["5-7 specific content ideas based on the creator's ACTUAL content performance. Each must reference a specific top-performing video, explain why it worked, and give a concrete title suggestion."],
  "optimization_tips": ["5-7 specific optimization tips referencing actual data, numbers, and performance ratios."],
  "content_calendar_suggestions": ["7-day content plan (array of strings like 'Day 1 (Monday): [specific video idea]')"],
  "thumbnail_tips": ["array of specific thumbnail suggestions based on top performers"],
  "title_formulas": ["array of reusable title templates"],
  "competitive_advantage": "string describing what this channel does better than competitors"
}

Channel info:
- Title: ${snippet.title || ""}
- Description: ${(snippet.description || "").slice(0, 600)}
- Subscribers: ${subscriberCount.toLocaleString()}
- Total videos: ${videoCount}
- Total views: ${viewCount.toLocaleString()}
- Average views per video: ${avgViews.toFixed(0)}
- Average views per recent video: ${recentAvgViews.toFixed(0)}
- Engagement rate: ${engagementRate.toFixed(2)}%
- Channel tier: ${getChannelTier(subscriberCount)}
- Average video duration: ${(avgDuration / 60).toFixed(1)} minutes
- Average title length of top videos: ${Math.round(avgTitleLength)} words
- ${videoStatsText}

TOP 5 PERFORMING VIDEOS (by views):
${topVideosText || "  (no data)"}

UNDERPERFORMING VIDEOS (below 50% of average):
${underperformersText || "  (none)"}

COMMON WORDS IN TOP-PERFORMING TITLES:
${titlePatternsText || "  (no data)"}

Recent video titles:
${JSON.stringify(recentTitles)}

Critical requirements:
- Every recommendation MUST reference specific data from above.
- Content recommendations should be sequels to or variations of their best-performing videos.
- Title patterns should be actionable.`;

  let aiData: any = {};
  try {
    const aiText = await callAI(prompt);
    aiData = parseAIJson(aiText);
  } catch (e) {
    aiData = {
      niche: "unknown",
      ai_summary: "AI profiling unavailable.",
      upload_frequency: "unknown",
      growth_potential: "unknown",
      topics: [],
      content_style: "",
      target_audience: "",
      best_topics: [],
      title_patterns: [],
      content_gaps: [],
      content_recommendations: [],
      optimization_tips: [],
      content_calendar_suggestions: [],
      thumbnail_tips: [],
      title_formulas: [],
      competitive_advantage: "AI profiling unavailable.",
    };
  }

  return {
    channel_id: channelId, title: snippet.title || "", description: snippet.description || "",
    subscriber_count: subscriberCount, video_count: videoCount, view_count: viewCount,
    recent_video_titles: recentTitles, niche: aiData.niche || "", topics: aiData.topics || [],
    content_style: aiData.content_style || "", target_audience: aiData.target_audience || "",
    ai_summary: aiData.ai_summary || "", average_views_per_video: avgViews, engagement_rate: engagementRate,
    upload_frequency: aiData.upload_frequency || "unknown", channel_tier: getChannelTier(subscriberCount),
    growth_potential: aiData.growth_potential || "unknown", content_recommendations: aiData.content_recommendations || [],
    optimization_tips: aiData.optimization_tips || [], top_performing_videos: topVideos,
    underperforming_videos: underperformers, title_patterns: aiData.title_patterns || [],
    content_gaps: aiData.content_gaps || [], best_topics: aiData.best_topics || [],
    
    // New calculated metrics
    posting_frequency_days: postingFrequencyDays,
    view_velocity: viewVelocity,
    like_view_ratio: likeViewRatio,
    comment_view_ratio: commentViewRatio,
    thumbnail_urls: thumbnailUrls,
    best_posting_day: bestDay,
    optimal_video_length: optimalLength,
    views_timeline: viewsTimeline,
    engagement_timeline: engagementTimeline,
    video_duration_data: videoDurationData,

    // New AI generation outputs
    content_calendar_suggestions: aiData.content_calendar_suggestions || [],
    thumbnail_tips: aiData.thumbnail_tips || [],
    title_formulas: aiData.title_formulas || [],
    competitive_advantage: aiData.competitive_advantage || "unknown",
  };
}

// ─── Find Competitors ───

async function findCompetitors(channelId: string, channelTitle: string, niche: string, topics: string[], subs: number) {
  let queries: string[] = [];
  try {
    const queryPrompt = `You are a YouTube search expert. Generate 5 to 8 realistic YouTube search queries that a viewer interested in this niche would type to find similar content. Return ONLY a JSON array of strings — no markdown. Example: ["query one", "query two", ...]

Channel: ${channelTitle}, Niche: ${niche}, Topics: ${JSON.stringify(topics)}`;
    const queryText = await callAI(queryPrompt);
    let cleaned = queryText.trim();
    if (cleaned.startsWith("```")) cleaned = cleaned.split("\n").slice(1).join("\n");
    if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3);
    queries = JSON.parse(cleaned.trim());
    if (!Array.isArray(queries)) queries = [];
  } catch (e) {
    queries = [niche, ...(topics || []).slice(0, 4), `channels like ${channelTitle}`].filter(Boolean);
  }

  const candidateIds: Record<string, number> = {};
  for (const query of queries) {
    try {
      const resp = await youtubeAPI("search", { part: "snippet", q: query, type: "video", maxResults: "10" });
      for (const item of resp.items || []) {
        const cid = item.snippet.channelId;
        if (cid !== channelId) candidateIds[cid] = (candidateIds[cid] || 0) + 1;
      }
    } catch (e) { /* skip */ }
  }

  if (Object.keys(candidateIds).length === 0) return [];

  const allIds = Object.keys(candidateIds);
  const channelDetails: Record<string, any> = {};
  for (let i = 0; i < allIds.length; i += 50) {
    const batch = allIds.slice(i, i + 50);
    try {
      const resp = await youtubeAPI("channels", { part: "snippet,statistics", id: batch.join(",") });
      for (const ch of resp.items || []) channelDetails[ch.id] = ch;
    } catch (e) { /* skip */ }
  }

  const sourceSubs = Math.max(subs, 1);
  const competitors = Object.entries(channelDetails).map(([cid, ch]: [string, any]) => {
    const chSubs = parseInt(ch.statistics?.subscriberCount || "0");
    const logRatio = Math.abs(Math.log10(Math.max(chSubs, 1)) - Math.log10(sourceSubs));
    const occurrenceBonus = candidateIds[cid] || 1;
    const score = logRatio - occurrenceBonus * 0.15;
    let sizeNote: string;
    if (chSubs === 0) sizeNote = "subscriber count hidden";
    else if (logRatio < 0.2) sizeNote = "very similar size";
    else if (logRatio < 0.5) sizeNote = "similar size";
    else if (chSubs > sourceSubs) sizeNote = "larger channel";
    else sizeNote = "smaller channel";
    const relevanceParts = [sizeNote];
    if (occurrenceBonus > 1) relevanceParts.push(`appeared in ${occurrenceBonus} queries`);
    return { score, channel_id: cid, title: ch.snippet?.title || "Unknown", subscriber_count: chSubs, relevance_note: relevanceParts.join(", ") };
  });

  competitors.sort((a, b) => a.score - b.score);
  return competitors.slice(0, 10).map(({ score, ...rest }) => rest);
}

// ─── Search Topic (Upgraded) ───

async function searchTopic(topic: string, competitorChannelIds: string[]) {
  const snippets: Record<string, any> = {};
  try {
    const resp = await youtubeAPI("search", { part: "snippet", q: topic, type: "video", maxResults: "20" });
    for (const item of resp.items || []) { const vid = item.id.videoId; if (vid) snippets[vid] = item.snippet; }
  } catch (e) { /* skip */ }

  for (const channelId of competitorChannelIds) {
    try {
      const resp = await youtubeAPI("search", { part: "snippet", q: topic, channelId, type: "video", maxResults: "5" });
      for (const item of resp.items || []) { const vid = item.id.videoId; if (vid) snippets[vid] = item.snippet; }
    } catch (e) { /* skip */ }
  }

  const results: any[] = [];

  // Fetch YouTube details if any found
  const videoIds = Object.keys(snippets);
  if (videoIds.length > 0) {
    for (let i = 0; i < videoIds.length; i += 50) {
      const batch = videoIds.slice(i, i + 50);
      try {
        const resp = await youtubeAPI("videos", { part: "snippet,statistics", id: batch.join(",") });
        for (const item of resp.items || []) {
          const stats = item.statistics || {};
          const snippet = item.snippet || snippets[item.id] || {};
          const views = parseInt(stats.viewCount || "0");
          results.push({
            platform: "youtube", title: snippet.title || "", url: `https://www.youtube.com/watch?v=${item.id}`,
            engagement_score: views, published_at: snippet.publishedAt || "", source: snippet.channelTitle || "Unknown",
            raw_metrics: { views, likes: parseInt(stats.likeCount || "0") },
            classification: views > 1000000 ? "popular" : views > 100000 ? "trending" : "underrated",
          });
        }
      } catch (e) { /* skip */ }
    }
  }

  // Gather other platforms concurrently with 5-second timeouts
  const [hnResults, devtoResults, gnewsResults] = await Promise.all([
    fetchHackerNews(topic),
    fetchDevTo(topic),
    fetchGoogleNews(topic)
  ]);

  results.push(...hnResults, ...devtoResults, ...gnewsResults);

  // Source breakdown counts
  const source_breakdown = {
    youtube: results.filter(r => r.platform === "youtube").length,
    hackernews: results.filter(r => r.platform === "hackernews").length,
    google_news: results.filter(r => r.platform === "google_news").length,
    devto: results.filter(r => r.platform === "devto").length,
  };

  // Build AI analysis of search results
  const gatheredDataSummary = results.length > 0
    ? results.slice(0, 30).map((r, i) => `${i+1}. [${r.platform.toUpperCase()}] "${r.title}" (Source: ${r.source})`).join("\n")
    : "No search results found across any platform.";

  const insightPrompt = `You are an expert content strategist and researcher. We have searched multiple platforms (YouTube, Hacker News, Google News, Dev.to) for content related to the topic: "${topic}".

Here are the search results:
${gatheredDataSummary}

Analyze these results and return a raw JSON object (no markdown, no code fences) with exactly these keys:
{
  "summary": "A concise 2-3 sentence summary of what's currently happening, trending, or being discussed around this topic across different platforms.",
  "content_angles": ["3-5 unique, specific, and engaging content angles or video ideas for a content creator covering this topic."],
  "content_gap": "Identify 1-2 distinct content gaps (topics, perspectives, or formats that are currently underserved or missing from the search results).",
  "trending_score": a number from 0 to 100 representing the current search and discussion interest for this topic
}
`;

  let insights: any = {
    summary: "Failed to generate AI insights.",
    content_angles: [],
    content_gap: "N/A",
    trending_score: 50,
  };

  try {
    const aiText = await callAI(insightPrompt);
    const parsed = parseAIJson(aiText);
    insights = {
      summary: parsed.summary || "",
      content_angles: parsed.content_angles || [],
      content_gap: parsed.content_gap || "",
      trending_score: typeof parsed.trending_score === "number" ? parsed.trending_score : 50,
    };
  } catch (e) {
    // Graceful degradation
  }

  insights.source_breakdown = source_breakdown;

  return {
    results,
    insights
  };
}

// ─── Main Handler (Deno.serve) ───

Deno.serve(async (req: Request) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const action = body.action || "analyze";
    let result: any;

    if (action === "analyze") {
      result = await analyzeChannel(body.channel_url);
    } else if (action === "competitors") {
      result = await findCompetitors(body.channel_id, body.channel_title || "", body.niche || "", body.topics || [], body.subscriber_count || 0);
    } else if (action === "search-topic") {
      result = await searchTopic(body.topic, body.competitor_channel_ids || []);
    } else {
      return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});