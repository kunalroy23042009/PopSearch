"""Tests for multi-source content gathering."""

from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

from app.models import ChannelProfile, CompetitorAnalysis, ContentResult, DashboardData, TrendData
from app.services.content_gatherer import ContentGatherer


def _sample_profile(**overrides) -> ChannelProfile:
    defaults = {
        "channel_id": "UCtest1234567890123456",
        "title": "Test Creator",
        "description": "A test channel",
        "subscriber_count": 10000,
        "video_count": 50,
        "view_count": 500000,
        "recent_video_titles": ["Test video 1", "Test video 2"],
        "niche": "tech reviews",
        "topics": ["tech", "reviews"],
        "content_style": "informative",
        "target_audience": "tech enthusiasts",
        "ai_summary": "A test channel for tech reviews.",
    }
    defaults.update(overrides)
    return ChannelProfile(**defaults)


def test_content_gatherer_init():
    gatherer = ContentGatherer()
    assert hasattr(gatherer, "sources")
    assert isinstance(gatherer.sources, list)


def test_gather_all_returns_dashboard_data():
    profile = _sample_profile()
    gatherer = ContentGatherer()

    with (
        patch.object(gatherer, "sources", ["hn", "rss"]),
        patch("app.services.rss_client.RSSClient.search_topic_hacker_news", return_value=[]),
        patch("app.services.rss_client.RSSClient.fetch_rss_feed", return_value=[]),
    ):
        dashboard = gatherer.gather_all("test topic", profile=profile, include_trends=False)

    assert isinstance(dashboard, DashboardData)
    assert hasattr(dashboard, "profile")
    assert hasattr(dashboard, "cross_platform_content")
    assert hasattr(dashboard, "total_sources_checked")


def test_gather_all_classifies_results():
    profile = _sample_profile()
    gatherer = ContentGatherer()
    gatherer.sources = ["rss"]  # Only use RSS source to avoid YouTube API calls

    with patch("app.services.rss_client.RSSClient.fetch_rss_feed", return_value=[]):
        dashboard = gatherer.gather_all("tech", profile=profile, include_trends=False)

    assert isinstance(dashboard.cross_platform_content, list)


def test_content_result_supports_all_platforms():
    platforms = ["youtube", "reddit", "twitter", "twitch", "trends", "rss"]
    for p in platforms:
        result = ContentResult(
            platform=p,  # type: ignore
            title=f"Test {p}",
            url=f"https://example.com/{p}",
            engagement_score=100.0,
            published_at=datetime(2025, 1, 1, tzinfo=timezone.utc),
            source=p,
            raw_metrics={},
        )
        assert result.platform == p
        assert result.title == f"Test {p}"


def test_dashboard_data_complete():
    profile = _sample_profile()
    trend = TrendData(
        topic="tech",
        interest_over_time=[],
        regional_interest={},
        related_queries=["ai", "ml"],
        rising_queries=["gpu"],
    )
    dashboard = DashboardData(
        profile=profile,
        competitors=CompetitorAnalysis(competitors=[]),
        trends=trend,
        cross_platform_content=[],
        market_insights="Test insight",
        trending_now=[],
        total_sources_checked=3,
    )
    assert dashboard.market_insights == "Test insight"
    assert dashboard.total_sources_checked == 3
    assert dashboard.trends is not None
