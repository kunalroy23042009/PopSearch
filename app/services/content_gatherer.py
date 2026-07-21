"""Unified content gatherer — aggregates content from all available platforms.

Coordinates YouTube, Reddit, Google Trends, Twitter/X, Twitch, and RSS/HN
into a single unified feed with deduplication and scoring.
"""

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
    """Orchestrates content gathering from all available platforms."""

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
        """Gather content from all available sources for a topic."""
        results: list[ContentResult] = []
        trending_now: list[ContentResult] = []
        total_sources = 0
        trend_data = None

        # 1. YouTube
        if "youtube" in self.sources:
            try:
                from app.topic_search import search_youtube
                yt_results = search_youtube(topic, [c for c in (profile.recent_video_titles if profile else [])])
                results.extend(yt_results)
                trending_now.extend([r for r in yt_results if r.classification == "trending"])
                total_sources += 1
            except Exception as e:
                logger.warning("YouTube search failed: %s", e)

        # 2. Reddit (direct via PRAW)
        if "reddit" in self.sources:
            try:
                from app.topic_search import search_reddit
                reddit_results = search_reddit(topic)
                results.extend(reddit_results)
                trending_now.extend([r for r in reddit_results if r.classification == "trending"])
                total_sources += 1
            except Exception as e:
                logger.warning("Reddit search failed: %s", e)

        # 3. Twitter/X
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

        # 4. Twitch
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

        # 5. Hacker News
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

        # 6. RSS feeds (custom tech/creator feeds)
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

        # 7. Google Trends
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

        # Classify all results
        try:
            from app.classifier import classify_results
            classified = classify_results(results)
        except Exception as e:
            logger.warning("Classification failed: %s", e)
            classified = results

        trending_now = [r for r in classified if r.classification == "trending"]

        # Build trend data
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
