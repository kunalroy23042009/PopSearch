from unittest.mock import MagicMock, patch

from app.competitor_finder import find_competitors, generate_search_queries
from app.models import ChannelProfile, CompetitorChannel


def _sample_profile(**overrides) -> ChannelProfile:
    defaults = {
        "channel_id": "UCsource1234567890123456",
        "title": "Tech Tips Daily",
        "description": "Short tech tutorials for beginners.",
        "subscriber_count": 50_000,
        "video_count": 120,
        "view_count": 2_000_000,
        "recent_video_titles": ["Best budget laptop 2025", "Windows tips"],
        "niche": "tech tutorials",
        "topics": ["laptops", "Windows", "budget tech"],
        "content_style": "concise how-to videos",
        "target_audience": "beginner PC users",
        "ai_summary": "A channel teaching practical tech skills.",
    }
    defaults.update(overrides)
    return ChannelProfile(**defaults)


def test_generate_search_queries_uses_gemini_response():
    profile = _sample_profile()
    mock_response = MagicMock()
    mock_response.text = '["budget laptop review", "windows tips for beginners"]'

    mock_client = MagicMock()
    mock_client.models.generate_content.return_value = mock_response

    with patch("app.competitor_finder._get_gemini_client", return_value=mock_client):
        queries = generate_search_queries(profile)

    assert queries == ["budget laptop review", "windows tips for beginners"]


def test_generate_search_queries_falls_back_when_gemini_fails():
    profile = _sample_profile()

    with patch("app.competitor_finder._get_gemini_client", side_effect=RuntimeError("offline")):
        queries = generate_search_queries(profile)

    assert "tech tutorials" in queries
    assert "laptops" in queries
    assert "channels like Tech Tips Daily" in queries


def test_find_competitors_excludes_source_and_returns_ranked_results():
    profile = _sample_profile(subscriber_count=10_000)
    source_id = profile.channel_id

    search_responses = [
        {"items": [
            {"snippet": {"channelId": source_id}},
            {"snippet": {"channelId": "UCcompetitor111111111111111"}},
            {"snippet": {"channelId": "UCcompetitor222222222222222"}},
        ]},
        {"items": [
            {"snippet": {"channelId": "UCcompetitor111111111111111"}},
            {"snippet": {"channelId": "UCcompetitor333333333333333"}},
        ]},
        {"items": []},  # recent_videos for channel 1
        {"items": []},  # recent_videos for channel 2
        {"items": []},  # recent_videos for channel 3
    ]

    channel_response = {
        "items": [
            {"id": "UCcompetitor111111111111111", "snippet": {"title": "Close Competitor", "description": "tech tutorials and laptop reviews"}, "statistics": {"subscriberCount": "12000", "videoCount": "50", "viewCount": "600000"}},
            {"id": "UCcompetitor222222222222222", "snippet": {"title": "Huge Channel", "description": "gaming"}, "statistics": {"subscriberCount": "1000000", "videoCount": "500", "viewCount": "50000000"}},
            {"id": "UCcompetitor333333333333333", "snippet": {"title": "Mid Competitor", "description": "tech reviews for everyone"}, "statistics": {"subscriberCount": "15000", "videoCount": "100", "viewCount": "1500000"}},
        ]
    }

    mock_youtube = MagicMock()
    mock_youtube.search.return_value.list.return_value.execute.side_effect = search_responses
    mock_youtube.channels.return_value.list.return_value.execute.return_value = channel_response

    with (
        patch("app.competitor_finder.generate_search_queries", return_value=["q1", "q2"]),
        patch("app.competitor_finder._build_youtube_client", return_value=mock_youtube),
    ):
        competitors = find_competitors(profile, exclude_channel_id=source_id)

    assert len(competitors) == 3
    assert all(isinstance(c, CompetitorChannel) for c in competitors)
    assert all(c.channel_id != source_id for c in competitors)
    assert all(c.title and c.relevance_note for c in competitors)
    assert all(hasattr(c, "content_overlap_pct") for c in competitors)
    assert all(hasattr(c, "growth_rate_pct") for c in competitors)
    assert all(hasattr(c, "what_they_do_better") for c in competitors)

    found_ids = [c.channel_id for c in competitors]
    assert "UCcompetitor111111111111111" in found_ids
    assert "UCcompetitor333333333333333" in found_ids


def test_find_competitors_returns_fewer_than_ten():
    profile = _sample_profile()
    search_response = {"items": [{"snippet": {"channelId": "UConlyone1111111111111111"}}]}
    channel_response = {"items": [{"id": "UConlyone1111111111111111", "snippet": {"title": "Solo Competitor", "description": ""}, "statistics": {"subscriberCount": "8000", "videoCount": "10", "viewCount": "80000"}}]}

    recent_video_response = {"items": [{"snippet": {"title": "test video", "channelTitle": "Solo Competitor"}}]}

    mock_youtube = MagicMock()
    mock_youtube.search.return_value.list.return_value.execute.side_effect = [search_response, recent_video_response]
    mock_youtube.channels.return_value.list.return_value.execute.return_value = channel_response

    with (
        patch("app.competitor_finder.generate_search_queries", return_value=["one query"]),
        patch("app.competitor_finder._build_youtube_client", return_value=mock_youtube),
    ):
        competitors = find_competitors(profile, exclude_channel_id=profile.channel_id)

    assert len(competitors) == 1
    assert competitors[0].title == "Solo Competitor"


def test_find_competitors_returns_empty_list_when_no_candidates():
    profile = _sample_profile()

    mock_youtube = MagicMock()
    mock_youtube.search.return_value.list.return_value.execute.return_value = {"items": []}

    with (
        patch("app.competitor_finder.generate_search_queries", return_value=["empty query"]),
        patch("app.competitor_finder._build_youtube_client", return_value=mock_youtube),
    ):
        competitors = find_competitors(profile, exclude_channel_id=profile.channel_id)

    assert competitors == []
