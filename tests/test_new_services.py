"""Tests for the new content source services (Trends, Twitter, Twitch, RSS)."""

from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

from app.services.trends_client import TrendsClient
from app.services.rss_client import RSSClient
from app.models import ChartDataPoint, RSSFeedItem, TrendData


# ===== Trends Client Tests =====

def test_trends_client_init():
    client = TrendsClient()
    assert hasattr(client, "client")


def test_trends_search_topic_returns_none_on_failure():
    client = TrendsClient()
    client.client = None
    result = client.search_topic("nonexistent")
    assert result is None


def test_trend_data_model():
    td = TrendData(
        topic="AI",
        interest_over_time=[ChartDataPoint(label="2025-01-01", value=100)],
        regional_interest={"US": 80, "IN": 60},
        related_queries=["machine learning", "deep learning"],
        rising_queries=["LLM", "GPT"],
    )
    assert td.topic == "AI"
    assert len(td.interest_over_time) == 1
    assert td.regional_interest["US"] == 80
    assert "LLM" in td.rising_queries


def test_trends_get_interest_over_time_empty_when_no_client():
    client = TrendsClient()
    client.client = None
    result = client.get_interest_over_time(["AI"])
    assert result == []


# ===== RSS/Feed Client Tests =====

def test_rss_client_init():
    client = RSSClient()
    assert client is not None


def test_hacker_news_search():
    client = RSSClient()
    with patch("requests.get") as mock_get:
        mock_top = MagicMock()
        mock_top.json.return_value = [1, 2, 3]
        mock_item = MagicMock()
        mock_item.json.return_value = {
            "title": "Test Story",
            "url": "https://example.com",
            "score": 100,
            "descendants": 20,
            "time": 1700000000,
            "by": "testuser",
            "type": "story",
        }
        mock_get.side_effect = [mock_top, mock_item, mock_item, mock_item]
        results = client.fetch_hacker_news(max_results=3)

    assert len(results) == 3
    assert all(isinstance(r, RSSFeedItem) for r in results)
    assert results[0].source == "Hacker News"
    assert results[0].points == 100


def test_hacker_news_topic_search():
    client = RSSClient()
    with patch("requests.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.json.return_value = {
            "hits": [
                {
                    "title": "AI News",
                    "url": "https://example.com/ai",
                    "points": 50,
                    "num_comments": 10,
                    "created_at": "2025-01-01T00:00:00Z",
                    "author": "test",
                    "objectID": "123",
                }
            ]
        }
        mock_get.return_value = mock_resp
        results = client.search_topic_hacker_news("AI")

    assert len(results) == 1
    assert results[0].title == "AI News"
    assert results[0].points == 50


def test_rss_feed_fetch():
    client = RSSClient()
    import time
    with patch("feedparser.parse") as mock_parse:
        mock_feed = MagicMock()
        mock_parse.return_value = mock_feed
        mock_feed.entries = [{
            "title": "Test Entry",
            "link": "https://example.com",
            "published_parsed": time.struct_time((2025, 1, 1, 0, 0, 0, 0, 0, 0)),
            "author": "author",
        }]
        results = client.fetch_rss_feed("https://example.com/rss", "Test Source")

    assert len(results) == 1
    assert results[0].title == "Test Entry"
    assert results[0].source == "Test Source"


def test_rss_feed_fetch_empty_on_failure():
    client = RSSClient()
    with patch("feedparser.parse", side_effect=Exception("Feed parse error")):
        results = client.fetch_rss_feed("https://bad.com/rss", "Bad")
    assert results == []


def test_reddit_rss_search():
    client = RSSClient()
    import time
    with patch("feedparser.parse") as mock_parse:
        mock_feed = MagicMock()
        mock_parse.return_value = mock_feed
        mock_feed.entries = [{
            "title": "Reddit Post",
            "link": "https://reddit.com/r/test",
            "published_parsed": time.struct_time((2025, 1, 1, 0, 0, 0, 0, 0, 0)),
        }]
        results = client.search_reddit_rss("test topic", "test")

    assert len(results) == 1
    assert results[0].title == "Reddit Post"


# ===== Dashboard Data Model Tests =====

def test_dashboard_data_model():
    from app.models import ChannelProfile, CompetitorAnalysis, DashboardData, TrendData

    profile = ChannelProfile(
        channel_id="UCtest123",
        title="Test",
        description="Test",
        subscriber_count=1000,
        video_count=100,
        view_count=100000,
    )
    dashboard = DashboardData(
        profile=profile,
        competitors=CompetitorAnalysis(competitors=[]),
        cross_platform_content=[],
        market_insights="Test",
        trending_now=[],
        total_sources_checked=5,
    )
    assert dashboard.profile.title == "Test"
    assert dashboard.total_sources_checked == 5
