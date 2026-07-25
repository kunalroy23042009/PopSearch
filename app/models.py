from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class VideoPerformance(BaseModel):
    title: str
    video_id: str = ""
    views: int = 0
    likes: int = 0
    comments: int = 0
    published_at: str = ""
    performance_ratio: float = 0.0
    duration_seconds: int = 0


class PerformanceSummary(BaseModel):
    avg_views_30d: float = 0.0
    avg_views_90d: float = 0.0
    avg_engagement_rate: float = 0.0
    views_growth: float = 0.0
    subs_gained_30d: int = 0
    top_video_views: int = 0
    total_watch_time_hours: float = 0.0


class ChartDataPoint(BaseModel):
    label: str
    value: float
    secondary_value: float | None = None


class ChannelAnalytics(BaseModel):
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
    performance_summary: PerformanceSummary | None = None
    analytics: ChannelAnalytics | None = None


class PlatformSource(BaseModel):
    name: str
    enabled: bool = True
    icon: str = ""
    color: str = ""


class TrendData(BaseModel):
    topic: str
    interest_over_time: list[ChartDataPoint] = []
    regional_interest: dict = {}
    related_queries: list[str] = []
    rising_queries: list[str] = []
    platform: Literal["trends"] = "trends"


class TweetData(BaseModel):
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
    title: str
    url: str
    source: str
    points: int = 0
    comments: int = 0
    published_at: datetime | None = None
    author: str = ""
    platform: Literal["rss"] = "rss"


class TikTokData(BaseModel):
    video_id: str = ""
    description: str
    author: str
    author_followers: int = 0
    likes: int = 0
    comments: int = 0
    shares: int = 0
    views: int = 0
    created_at: datetime | None = None
    url: str = ""
    platform: Literal["tiktok"] = "tiktok"


class InstagramData(BaseModel):
    post_id: str = ""
    caption: str
    author: str
    author_followers: int = 0
    likes: int = 0
    comments: int = 0
    created_at: datetime | None = None
    url: str = ""
    platform: Literal["instagram"] = "instagram"


class CompetitorChannel(BaseModel):
    channel_id: str
    title: str
    subscriber_count: int
    relevance_note: str
    overlap_topics: list[str] = []
    content_quality_score: float = 0.0
    growth_rate: str = ""
    avg_views: int = 0
    engagement_rate: float = 0.0
    posting_frequency: str = ""
    content_overlap_pct: float = 0.0
    growth_rate_pct: float = 0.0
    what_they_do_better: str = ""
    what_you_do_better: str = ""


class CompetitorAnalysis(BaseModel):
    competitors: list[CompetitorChannel] = []
    market_position: str = ""
    competitive_advantage: str = ""
    threat_level: str = ""
    untapped_niches: list[str] = []


class ContentResult(BaseModel):
    platform: Literal["youtube", "reddit", "twitter", "twitch", "trends", "rss", "tiktok", "instagram"]
    title: str
    url: str
    engagement_score: float
    published_at: datetime
    source: str
    raw_metrics: dict
    classification: Literal["trending", "popular", "underrated", "none"] = "none"
    thumbnail_url: str = ""
    duration_seconds: int = 0
    platform_icon: str = ""
    trend_velocity: float = 0.0
    velocity_direction: Literal["accelerating", "decelerating", "stable"] = "stable"


class ContentAngle(BaseModel):
    title: str
    description: str
    confidence_score: float
    predicted_performance: str = ""
    seo_keywords: list[str] = []
    thumbnail_ideas: list[str] = []
    best_time_to_post: str = ""
    platform_focus: list[str] = []


class ContentGapAnalysis(BaseModel):
    gap_description: str
    opportunity_score: float
    competitor_coverage: list[str] = []
    audience_overlap_pct: float = 0.0
    suggested_approach: str = ""


class TrendVelocity(BaseModel):
    topic: str
    current_velocity: float
    previous_velocity: float
    week_over_week_change: float
    direction: Literal["accelerating", "decelerating", "stable"]
    momentum_score: float


class TopicInsight(BaseModel):
    summary: str
    content_angles: list[ContentAngle] = []
    content_gaps: list[ContentGapAnalysis] = []
    trend_velocities: list[TrendVelocity] = []
    platform_summary: dict[str, int] = {}
    confidence_overall: float = 0.0


class DashboardData(BaseModel):
    profile: ChannelProfile
    competitors: CompetitorAnalysis
    trends: TrendData | None = None
    cross_platform_content: list[ContentResult] = []
    market_insights: str = ""
    trending_now: list[ContentResult] = []
    total_sources_checked: int = 0


class JobProgress(BaseModel):
    job_id: str
    status: Literal["pending", "running", "completed", "failed"]
    progress_pct: int = 0
    step: str = ""
    result: DashboardData | None = None
    error: str | None = None
    created_at: datetime
    updated_at: datetime


class SavedReport(BaseModel):
    report_id: str
    user_id: int
    channel_url: str
    channel_title: str = ""
    topic: str = ""
    created_at: datetime
    dashboard_data: DashboardData | None = None
