from __future__ import annotations

import json
import logging
import math

from google import genai
from googleapiclient.discovery import build

from app.config import settings
from app.models import ChannelProfile, CompetitorChannel

logger = logging.getLogger(__name__)


def _build_youtube_client():
    if not settings.YOUTUBE_API_KEY:
        raise ValueError("YOUTUBE_API_KEY is not configured")
    return build("youtube", "v3", developerKey=settings.YOUTUBE_API_KEY)


def _get_gemini_client() -> genai.Client:
    return genai.Client(api_key=settings.GEMINI_API_KEY)


def generate_search_queries(profile: ChannelProfile) -> list[str]:
    prompt = f"""You are a YouTube search expert. Given the following channel profile,
generate 5 to 8 realistic YouTube search queries that a viewer interested in this
exact niche would type to find similar content or channels.

Return ONLY a JSON array of strings — no markdown, no code fences, no explanation.
Example: ["query one", "query two", ...]

Channel profile:
- Title: {profile.title}
- Niche: {profile.niche}
- Topics: {json.dumps(profile.topics)}
- Content style: {profile.content_style}
- Target audience: {profile.target_audience}
- Recent video titles: {json.dumps(profile.recent_video_titles[:8])}
"""

    try:
        client = _get_gemini_client()
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt,
        )
        text = response.text.strip()
        if text.startswith("```"):
            idx = text.find("\n")
            if idx != -1:
                text = text[idx + 1:]
        if text.endswith("```"):
            text = text.rsplit("```", 1)[0]
        text = text.strip()

        queries = json.loads(text)
        if isinstance(queries, list) and all(isinstance(q, str) for q in queries):
            return queries[:8]
    except Exception as exc:
        logger.warning("Gemini query generation failed: %s", exc)

    fallback = []
    if profile.niche:
        fallback.append(profile.niche)
    for topic in profile.topics[:4]:
        fallback.append(topic)
    if profile.title:
        fallback.append(f"channels like {profile.title}")
    return fallback or ["youtube creator"]


def _compute_content_overlap(
    profile: ChannelProfile,
    channel_data: dict,
) -> tuple[float, list[str]]:
    profile_topics = set(t.lower() for t in profile.topics if t)
    profile_title_words = set(profile.title.lower().split()) if profile.title else set()

    ch_snippet = channel_data.get("snippet", {})
    ch_title = ch_snippet.get("title", "")
    ch_desc = ch_snippet.get("description", "")
    ch_tags = ch_snippet.get("tags", [])
    ch_video_titles = [
        item["snippet"]["title"].lower()
        for item in channel_data.get("recent_videos", [])
    ]

    ch_text = f"{ch_title} {ch_desc} {' '.join(ch_tags)} {' '.join(ch_video_titles)}".lower()
    ch_words = set(ch_text.split())

    overlap_words = profile_title_words & ch_words
    overlap_topics = [t for t in profile_topics if t in ch_text]

    if len(profile_topics) > 0:
        topic_overlap_ratio = len(overlap_topics) / len(profile_topics)
    else:
        topic_overlap_ratio = 0.0

    word_overlap_ratio = len(overlap_words) / max(len(profile_title_words), 1)

    combined_overlap = (topic_overlap_ratio * 0.7 + word_overlap_ratio * 0.3) * 100.0
    combined_overlap = min(combined_overlap, 100.0)

    return combined_overlap, overlap_topics


def _estimate_growth_rate(channel_data: dict) -> tuple[str, float]:
    stats = channel_data.get("statistics", {})
    subs = int(stats.get("subscriberCount", 0))
    video_count = int(stats.get("videoCount", 0))
    view_count = int(stats.get("viewCount", 0))

    if video_count == 0 or subs == 0:
        return "unknown", 0.0

    views_per_video = view_count / video_count
    subs_per_video = subs / video_count

    growth_rate_pct = subs_per_video * 0.3 + (views_per_video / max(subs, 1)) * 100 * 0.7

    if growth_rate_pct > 10:
        label = "fast"
    elif growth_rate_pct > 3:
        label = "moderate"
    elif growth_rate_pct > 0.5:
        label = "slow"
    else:
        label = "minimal"

    return label, growth_rate_pct


def _compute_engagement_rate(channel_data: dict) -> float:
    stats = channel_data.get("statistics", {})
    views = int(stats.get("viewCount", 0))
    subs = int(stats.get("subscriberCount", 0))
    videos = int(stats.get("videoCount", 0))

    if views == 0 or videos == 0:
        return 0.0

    avg_views_per_video = views / videos
    if subs > 0:
        return (avg_views_per_video / subs) * 100.0
    return 0.0


def _estimate_posting_frequency(channel_data: dict) -> str:
    videos = int(channel_data.get("statistics", {}).get("videoCount", 0))
    if videos > 500:
        return "daily"
    elif videos > 100:
        return "weekly"
    elif videos > 24:
        return "monthly"
    else:
        return "infrequent"


def _get_avg_views(channel_data: dict) -> int:
    stats = channel_data.get("statistics", {})
    views = int(stats.get("viewCount", 0))
    videos = int(stats.get("videoCount", 0))
    if videos > 0:
        return views // videos
    return 0


def find_competitors(
    profile: ChannelProfile,
    exclude_channel_id: str,
    max_results: int = 10,
) -> list[CompetitorChannel]:
    youtube = _build_youtube_client()

    queries = generate_search_queries(profile)
    logger.info("Competitor search queries: %s", queries)

    candidate_ids: dict[str, int] = {}

    for query in queries:
        try:
            response = (
                youtube.search()
                .list(part="snippet", q=query, type="video", maxResults=10)
                .execute()
            )
            for item in response.get("items", []):
                cid = item["snippet"]["channelId"]
                if cid != exclude_channel_id:
                    candidate_ids[cid] = candidate_ids.get(cid, 0) + 1
        except Exception as exc:
            logger.warning("YouTube search failed for query '%s': %s", query, exc)

    if not candidate_ids:
        logger.info("No competitor candidates found.")
        return []

    all_ids = list(candidate_ids.keys())
    channel_details: dict[str, dict] = {}

    for i in range(0, len(all_ids), 50):
        batch = all_ids[i : i + 50]
        try:
            response = (
                youtube.channels()
                .list(part="snippet,statistics", id=",".join(batch))
                .execute()
            )
            for ch in response.get("items", []):
                channel_details[ch["id"]] = ch
        except Exception as exc:
            logger.warning("Channel details fetch failed: %s", exc)

    for cid in list(channel_details.keys()):
        try:
            response = (
                youtube.search()
                .list(
                    part="snippet",
                    channelId=cid,
                    order="date",
                    maxResults=5,
                )
                .execute()
            )
            channel_details[cid]["recent_videos"] = response.get("items", [])
        except Exception as exc:
            channel_details[cid]["recent_videos"] = []
            logger.debug("Could not fetch recent videos for %s: %s", cid, exc)

    source_subs = max(profile.subscriber_count, 1)
    competitors: list[tuple[float, CompetitorChannel]] = []

    for cid, ch in channel_details.items():
        subs = int(ch.get("statistics", {}).get("subscriberCount", 0))
        title = ch.get("snippet", {}).get("title", "Unknown")

        log_ratio = abs(math.log10(max(subs, 1)) - math.log10(source_subs))
        occurrence_bonus = candidate_ids.get(cid, 1)
        size_score = log_ratio - (occurrence_bonus * 0.15)

        content_overlap_pct, overlap_topics = _compute_content_overlap(profile, ch)

        growth_label, growth_rate_pct = _estimate_growth_rate(ch)
        engagement_rate = _compute_engagement_rate(ch)
        avg_views = _get_avg_views(ch)
        posting_frequency = _estimate_posting_frequency(ch)

        combined_score = (
            size_score * 0.3
            - (content_overlap_pct / 100.0) * 0.3
            + (engagement_rate / 10.0) * 0.2
            + (growth_rate_pct / 20.0) * 0.2
        )

        if subs == 0:
            size_note = "subscriber count hidden"
        elif log_ratio < 0.2:
            size_note = "very similar size"
        elif log_ratio < 0.5:
            size_note = "similar size"
        elif subs > source_subs:
            size_note = "larger channel"
        else:
            size_note = "smaller channel"

        relevance_parts = [size_note]
        if occurrence_bonus > 1:
            relevance_parts.append(f"appeared in {occurrence_bonus} queries")
        if content_overlap_pct > 30:
            relevance_parts.append(f"{content_overlap_pct:.0f}% content overlap")

        competitor = CompetitorChannel(
            channel_id=cid,
            title=title,
            subscriber_count=subs,
            relevance_note=", ".join(relevance_parts),
            overlap_topics=overlap_topics[:5],
            content_quality_score=min(engagement_rate * 2, 10.0),
            growth_rate=growth_label,
            avg_views=avg_views,
            engagement_rate=round(engagement_rate, 2),
            posting_frequency=posting_frequency,
            content_overlap_pct=round(content_overlap_pct, 1),
            growth_rate_pct=round(growth_rate_pct, 2),
            what_they_do_better=f"Higher posting frequency ({posting_frequency}), {growth_label} growth, {engagement_rate:.1f}% engagement rate" if engagement_rate > 0 else "Unknown",
            what_you_do_better="",
        )
        competitors.append((combined_score, competitor))

    competitors.sort(key=lambda x: x[0])

    result = [c for _, c in competitors[:max_results]]

    for i, comp in enumerate(result):
        our_eng = profile.engagement_rate
        their_eng = comp.engagement_rate
        if our_eng > their_eng and their_eng > 0:
            result[i].what_you_do_better = f"Higher engagement rate ({our_eng:.1f}% vs {their_eng:.1f}%)"
        elif their_eng > our_eng:
            result[i].what_you_do_better = ""
        else:
            result[i].what_you_do_better = "Comparable engagement rate"

    return result
