from __future__ import annotations

import logging
from datetime import datetime, timezone

from app.config import settings
from app.models import (
    ChannelProfile, ChartDataPoint, CompetitorAnalysis, CompetitorChannel,
    ContentResult, DashboardData, RSSFeedItem, TrendData, TweetData,
    TwitchStreamData,
)

logger = logging.getLogger(__name__)


class ContentGatherer:
    def __init__(self) -> None:
        self.sources = []
        self._init_sources()

    def _init_sources(self) -> None:
        sources = []

        if settings.YOUTUBE_API_KEY:
            sources.append("youtube")
        if settings.REDDIT_CLIENT_ID:
            sources.append("reddit")
        if settings.TWITTER_API_KEY or settings.TWITTER_BEARER_TOKEN:
            sources.append("twitter")
        if settings.TWITCH_CLIENT_ID:
            sources.append("twitch")
        if settings.GEMINI_API_KEY:
            sources.append("trends")
        if settings.TIKTOK_API_KEY:
            sources.append("tiktok")
        if settings.INSTAGRAM_API_KEY:
            sources.append("instagram")
        sources.extend(["hn", "rss"])

        self.sources = list(set(sources))
        logger.info("Available content sources: %s", self.sources)

    def gather_all(
        self,
        topic: str,
        profile: ChannelProfile | None = None,
        max_per_source: int = 10,
        include_trends: bool = True,
    ) -> DashboardData:
        results: list[ContentResult] = []
        total_sources = 0
        trend_data = None

        if "youtube" in self.sources:
            try:
                from app.topic_search import search_youtube
                yt_results = search_youtube(topic, [])
                results.extend(yt_results)
                total_sources += 1
            except Exception as e:
                logger.warning("YouTube search failed: %s", e)

        if "reddit" in self.sources:
            try:
                from app.topic_search import search_reddit
                reddit_results = search_reddit(topic)
                results.extend(reddit_results)
                total_sources += 1
            except Exception as e:
                logger.warning("Reddit search failed: %s", e)

        if "twitter" in self.sources:
            try:
                from app.services.twitter_client import TwitterClient
                twitter = TwitterClient()
                tweets = twitter.search_recent(topic, max_results=max_per_source)
                for t in tweets:
                    results.append(ContentResult(
                        platform="twitter",
                        title=t.text[:200],
                        url=t.url,
                        engagement_score=float(t.likes + t.retweets * 2 + t.replies),
                        published_at=t.created_at or datetime.now(timezone.utc),
                        source=f"@{t.author}",
                        raw_metrics={"likes": t.likes, "retweets": t.retweets, "replies": t.replies, "followers": t.author_followers},
                    ))
                total_sources += 1
            except Exception as e:
                logger.warning("Twitter search failed: %s", e)

        if "twitch" in self.sources:
            try:
                from app.services.twitch_client import TwitchClient
                twitch = TwitchClient()
                streams = twitch.search_streams(topic, max_results=max_per_source)
                for s in streams:
                    results.append(ContentResult(
                        platform="twitch",
                        title=s.title,
                        url=s.url,
                        engagement_score=float(s.viewers),
                        published_at=s.started_at or datetime.now(timezone.utc),
                        source=s.broadcaster,
                        raw_metrics={"viewers": s.viewers, "language": s.language, "game": s.game},
                    ))
                total_sources += 1
            except Exception as e:
                logger.warning("Twitch search failed: %s", e)

        if "hn" in self.sources:
            try:
                from app.services.rss_client import RSSClient
                rss = RSSClient()
                hn_items = rss.search_topic_hacker_news(topic, max_results=max_per_source)
                for item in hn_items:
                    results.append(ContentResult(
                        platform="rss",
                        title=item.title,
                        url=item.url,
                        engagement_score=float(item.points + item.comments),
                        published_at=item.published_at or datetime.now(timezone.utc),
                        source=item.source,
                        raw_metrics={"points": item.points, "comments": item.comments, "author": item.author},
                    ))
                total_sources += 1
            except Exception as e:
                logger.warning("HN search failed: %s", e)

        if "rss" in self.sources:
            try:
                from app.services.rss_client import RSSClient
                rss = RSSClient()
                feed_urls = [
                    ("https://feeds.feedburner.com/TechCrunch", "TechCrunch"),
                    ("https://www.theverge.com/rss/index.xml", "The Verge"),
                    ("https://blog.youtube/feed/", "YouTube Blog"),
                    ("https://www.producthunt.com/feed", "Product Hunt"),
                ]
                for feed_url, source_name in feed_urls:
                    feed_items = rss.fetch_rss_feed(feed_url, source_name, max_results=3)
                    for item in feed_items:
                        if topic.lower() in item.title.lower() or topic.lower() in (item.source or "").lower():
                            results.append(ContentResult(
                                platform="rss",
                                title=item.title,
                                url=item.url,
                                engagement_score=float(item.points + item.comments),
                                published_at=item.published_at or datetime.now(timezone.utc),
                                source=item.source,
                                raw_metrics={"points": item.points, "comments": item.comments, "author": item.author},
                            ))
                total_sources += 1
            except Exception as e:
                logger.warning("RSS search failed: %s", e)

        if include_trends and "trends" in self.sources:
            try:
                from app.services.trends_client import TrendsClient
                trends = TrendsClient()
                trend_data = trends.search_topic(topic)
                if trend_data and trend_data.interest_over_time:
                    for point in trend_data.interest_over_time:
                        if point.value > 50:
                            results.append(ContentResult(
                                platform="trends",
                                title=f"Trending: {topic} ({point.label})",
                                url=f"https://trends.google.com/trends/explore?q={topic}",
                                engagement_score=point.value,
                                published_at=datetime.now(timezone.utc),
                                source="Google Trends",
                                raw_metrics={"interest": point.value, "time": point.label},
                            ))
                total_sources += 1
            except Exception as e:
                logger.warning("Trends search failed: %s", e)

        if "tiktok" in self.sources:
            try:
                from app.services.tiktok_client import TikTokClient
                tc = TikTokClient()
                tik_videos = tc.search(topic, limit=max_per_source)
                for v in tik_videos:
                    created = v.get("created_at", datetime.now(timezone.utc))
                    if isinstance(created, str):
                        try:
                            created = datetime.fromisoformat(created.replace("Z", "+00:00"))
                        except ValueError:
                            created = datetime.now(timezone.utc)
                    results.append(ContentResult(
                        platform="tiktok",
                        title=v.get("description", "")[:200],
                        url=v.get("url", ""),
                        engagement_score=float(v.get("likes", 0) + v.get("shares", 0) * 3 + v.get("comments", 0) * 2),
                        published_at=created,
                        source=v.get("author", "unknown"),
                        raw_metrics={"likes": v.get("likes", 0), "comments": v.get("comments", 0), "shares": v.get("shares", 0), "views": v.get("views", 0)},
                    ))
                total_sources += 1
            except Exception as e:
                logger.warning("TikTok search failed: %s", e)

        if "instagram" in self.sources:
            try:
                from app.services.instagram_client import InstagramClient
                ig = InstagramClient()
                ig_posts = ig.search(topic, limit=max_per_source)
                for p in ig_posts:
                    created = p.get("created_at", datetime.now(timezone.utc))
                    if isinstance(created, str):
                        try:
                            created = datetime.fromisoformat(created.replace("Z", "+00:00"))
                        except ValueError:
                            created = datetime.now(timezone.utc)
                    results.append(ContentResult(
                        platform="instagram",
                        title=p.get("caption", "")[:200],
                        url=p.get("url", ""),
                        engagement_score=float(p.get("likes", 0) + p.get("comments", 0) * 3),
                        published_at=created,
                        source=p.get("author", "unknown"),
                        raw_metrics={"likes": p.get("likes", 0), "comments": p.get("comments", 0)},
                    ))
                total_sources += 1
            except Exception as e:
                logger.warning("Instagram search failed: %s", e)

        try:
            from app.classifier import classify_results
            classified = classify_results(results)
        except Exception as e:
            logger.warning("Classification failed: %s", e)
            classified = results

        trending_now = [r for r in classified if r.classification == "trending"]

        if include_trends and "trends" in self.sources and trend_data is None:
            try:
                from app.services.trends_client import TrendsClient
                trends = TrendsClient()
                trend_data = trends.search_topic(topic)
            except Exception:
                pass

        return DashboardData(
            profile=profile or ChannelProfile(channel_id="", title="", description="", subscriber_count=0, video_count=0, view_count=0),
            competitors=CompetitorAnalysis(competitors=[]),
            trends=trend_data,
            cross_platform_content=classified,
            market_insights=f"Analyzed {len(self.sources)} content platforms for topic: {topic}",
            trending_now=trending_now[:10],
            total_sources_checked=total_sources,
        )
