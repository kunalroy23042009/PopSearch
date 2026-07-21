"""Models — Pydantic/SQLModel definitions for channels, competitors, searches, and cached results."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel


# ---------------------------------------------------------------------------
# Phase 4 — Channel analysis
# ---------------------------------------------------------------------------

class VideoPerformance(BaseModel):
    """Performance data for a single video from the channel."""

    title: str
    video_id: str = ""
    views: int = 0
    likes: int = 0
    comments: int = 0
    published_at: str = ""
    performance_ratio: float = 0.0
    duration_seconds: int = 0


class PerformanceSummary(BaseModel):
    """Aggregated performance summary for charts."""
    avg_views_30d: float = 0.0
    avg_views_90d: float = 0.0
    avg_engagement_rate: float = 0.0
    views_growth: float = 0.0
    subs_gained_30d: int = 0
    top_video_views: int = 0
    total_watch_time_hours: float = 0.0


class ChartDataPoint(BaseModel):
    """A single data point for a chart (time series)."""
    label: str
    value: float
    secondary_value: float | None = None


class ChannelAnalytics(BaseModel):
    """Rich channel analytics for dashboard visualizations."""
    views_over_time: list[ChartDataPoint] = []
    subs_over_time: list[ChartDataPoint] = []
    engagement_over_time: list[ChartDataPoint] = []
    top_videos_by_views: list[ChartDataPoint] = []
    top_videos_by_engagement: list[ChartDataPoint] = []
    upload_frequency_chart: list[ChartDataPoint] = []
    audience_demographics: dict = {}
    traffic_sources: list[ChartDataPoint] = []
    realtime_audience: int = 0


class ChannelProfile(BaseModel):
    """Structured profile of a YouTube channel produced by the analyzer."""

    channel_id: str
    title: str
    description: str
    subscriber_count: int
    video_count: int
    view_count: int
    recent_video_titles: list[str] = []
    niche: str = ""
    topics: list[str] = []
    content_style: str = ""
    target_audience: str = ""
    ai_summary: str = ""
    average_views_per_video: float = 0.0
    engagement_rate: float = 0.0
    upload_frequency: str = ""
    channel_tier: str = ""
    growth_potential: str = ""
    content_recommendations: list[str] = []
    optimization_tips: list[str] = []
    top_performing_videos: list[VideoPerformance] = []
    underperforming_videos: list[VideoPerformance] = []
    title_patterns: list[str] = []
    content_gaps: list[str] = []
    best_topics: list[str] = []
    posting_schedule: str = ""
    # New: Analytics & chart data for dashboard
    performance_summary: PerformanceSummary | None = None
    analytics: ChannelAnalytics | None = None


# ---------------------------------------------------------------------------
# Multi-source content platform models
# ---------------------------------------------------------------------------

class PlatformSource(BaseModel):
    """Represents a content platform/source."""
    name: str
    enabled: bool = True
    icon: str = ""
    color: str = ""


class TrendData(BaseModel):
    """Google Trends data for a topic."""
    topic: str
    interest_over_time: list[ChartDataPoint] = []
    regional_interest: dict = {}
    related_queries: list[str] = []
    rising_queries: list[str] = []
    platform: Literal["trends"] = "trends"


class TweetData(BaseModel):
    """Data from Twitter/X."""
    tweet_id: str = ""
    text: str
    author: str
    author_followers: int = 0
    likes: int = 0
    retweets: int = 0
    replies: int = 0
    created_at: datetime | None = None
    url: str = ""
    platform: Literal["twitter"] = "twitter"


class TwitchStreamData(BaseModel):
    """Data from Twitch."""
    stream_id: str = ""
    title: str
    broadcaster: str
    viewers: int = 0
    language: str = ""
    started_at: datetime | None = None
    game: str = ""
    tags: list[str] = []
    url: str = ""
    platform: Literal["twitch"] = "twitch"


class RSSFeedItem(BaseModel):
    """Item from RSS feed (HN, Product Hunt, blogs)."""
    title: str
    url: str
    source: str
    points: int = 0
    comments: int = 0
    published_at: datetime | None = None
    author: str = ""
    platform: Literal["rss"] = "rss"


# ---------------------------------------------------------------------------
# Phase 5 — Competitor discovery
# ---------------------------------------------------------------------------

class CompetitorChannel(BaseModel):
    """A competitor channel discovered for a given ChannelProfile."""

    channel_id: str
    title: str
    subscriber_count: int
    relevance_note: str
    overlap_topics: list[str] = []
    content_quality_score: float = 0.0
    growth_rate: str = ""
    avg_views: int = 0
    engagement_rate: float = 0.0


class CompetitorAnalysis(BaseModel):
    """Competitive landscape analysis."""
    competitors: list[CompetitorChannel] = []
    market_position: str = ""
    competitive_advantage: str = ""
    threat_level: str = ""
    untapped_niches: list[str] = []


# ---------------------------------------------------------------------------
# Phase 6 — Topic search
# ---------------------------------------------------------------------------

class ContentResult(BaseModel):
    """A single piece of content discovered from any platform."""

    platform: Literal["youtube", "reddit", "twitter", "twitch", "trends", "rss"]
    title: str
    url: str
    engagement_score: float
    published_at: datetime
    source: str
    raw_metrics: dict
    classification: Literal["trending", "popular", "underrated", "none"] = "none"
    # Visualization data
    thumbnail_url: str = ""
    duration_seconds: int = 0
    platform_icon: str = ""


# ---------------------------------------------------------------------------
# Phase 8 — AI reasoning
# ---------------------------------------------------------------------------

class TopicInsight(BaseModel):
    """AI-generated insights and content angles for a topic search."""

    summary: str
    content_angles: list[str]
    content_gap: str | None = None
    # Extended insights
    predicted_performance: str = ""
    best_time_to_post: str = ""
    seo_keywords: list[str] = []
    thumbnail_ideas: list[str] = []


# ---------------------------------------------------------------------------
# Dashboard / Analytics response
# ---------------------------------------------------------------------------

class DashboardData(BaseModel):
    """Aggregated dashboard data for the frontend."""
    profile: ChannelProfile
    competitors: CompetitorAnalysis
    trends: TrendData | None = None
    cross_platform_content: list[ContentResult] = []
    market_insights: str = ""
    trending_now: list[ContentResult] = []
    total_sources_checked: int = 0
