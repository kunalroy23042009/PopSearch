import json
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

from app.ai_reasoning import (
    FALLBACK_INSIGHT,
    _build_insight_prompt,
    _select_results_for_prompt,
    generate_insights,
)
from app.models import ChannelProfile, ContentResult, TopicInsight


NOW = datetime(2025, 6, 15, 12, 0, tzinfo=timezone.utc)


def _profile() -> ChannelProfile:
    return ChannelProfile(
        channel_id="UCsource1234567890123456",
        title="Budget Tech Daily",
        description="Affordable tech reviews for students.",
        subscriber_count=25_000,
        video_count=80,
        view_count=1_200_000,
        recent_video_titles=["Best $300 laptop", "Chromebook vs Windows"],
        niche="budget tech reviews",
        topics=["laptops", "chromebooks", "student tech"],
        content_style="concise, friendly how-to reviews",
        target_audience="budget-conscious students",
        ai_summary="Short-form reviews of affordable tech gear.",
    )


def _result(
    title: str,
    engagement: float,
    classification: str = "trending",
    platform: str = "youtube",
) -> ContentResult:
    return ContentResult(
        platform=platform,
        title=title,
        url=f"https://example.com/{title}",
        engagement_score=engagement,
        published_at=NOW,
        source="Tech Channel" if platform == "youtube" else "r/laptops",
        raw_metrics={"views": int(engagement), "likes": 10},
        classification=classification,
    )


def _valid_insight_json() -> str:
    return json.dumps({
        "summary": "Budget laptop content is surging on YouTube, especially comparisons under $400. Reddit threads focus on student use cases. TikTok shows high engagement for budget unboxings.",
        "content_angles": [
            {
                "title": "Best $300 Laptop for College 2025",
                "description": "Create a comparison video referencing the trending 'Acer Aspire review' in your concise review style.",
                "confidence_score": 0.85,
                "predicted_performance": "Above average — 50-100k views in first week",
                "seo_keywords": ["budget laptop", "college laptop"],
                "thumbnail_ideas": ["Side-by-side laptop comparison", "Price tag overlay"],
                "best_time_to_post": "Tuesday 3pm EST",
                "platform_focus": ["youtube", "tiktok"],
            },
            {
                "title": "Chromebook vs Windows for Students",
                "description": "Match your friendly how-to tone from recent titles. Reddit shows high demand for this comparison.",
                "confidence_score": 0.75,
                "seo_keywords": ["chromebook", "student laptop"],
                "thumbnail_ideas": ["Split screen comparison"],
                "platform_focus": ["youtube"],
            },
        ],
        "content_gaps": [
            {
                "gap_description": "No creator is covering refurbished laptop warranties under $250",
                "opportunity_score": 8.2,
                "competitor_coverage": ["Big channels focus on new laptops only"],
                "audience_overlap_pct": 75,
                "suggested_approach": "Create a 'Best Refurbished Laptops Under $250' guide",
            }
        ],
        "trend_velocities": [
            {
                "topic": "budget laptops",
                "current_velocity": 85.0,
                "previous_velocity": 62.0,
                "week_over_week_change": 37.0,
                "direction": "accelerating",
                "momentum_score": 8.0,
            }
        ],
        "platform_summary": {"youtube": 3, "reddit": 2},
        "confidence_overall": 0.82,
    })


def test_generate_insights_parses_valid_response():
    profile = _profile()
    results = [
        _result("Acer Aspire review", 12_000),
        _result("Best cheap laptop Reddit", 800, platform="reddit"),
    ]
    with patch("app.ai_reasoning.generate_ai_response", return_value=_valid_insight_json()):
        insight = generate_insights(profile, "budget laptop", results)

    assert isinstance(insight, TopicInsight)
    assert "Budget laptop content" in insight.summary
    assert len(insight.content_angles) == 2
    assert insight.content_angles[0].title == "Best $300 Laptop for College 2025"
    assert len(insight.content_gaps) == 1
    assert insight.content_gaps[0].opportunity_score == 8.2
    assert len(insight.trend_velocities) == 1
    assert insight.trend_velocities[0].direction == "accelerating"
    assert insight.confidence_overall == 0.82


def test_generate_insights_retries_then_succeeds():
    profile = _profile()
    results = [_result("Trending video", 5_000)]

    with patch("app.ai_reasoning.generate_ai_response") as mock:
        mock.side_effect = ["not json", _valid_insight_json()]
        insight = generate_insights(profile, "budget laptop", results)

    assert mock.call_count == 2
    assert len(insight.content_angles) == 2


def test_generate_insights_fallback_on_persistent_failure():
    profile = _profile()
    results = [_result("Trending video", 5_000)]

    with patch("app.ai_reasoning.generate_ai_response", return_value="not valid json"):
        insight = generate_insights(profile, "budget laptop", results)

    assert insight.summary == FALLBACK_INSIGHT.summary
    assert insight.content_angles == []


def test_generate_insights_fallback_on_exception():
    profile = _profile()
    results = [_result("Trending video", 5_000)]

    with patch("app.ai_reasoning.generate_ai_response", side_effect=RuntimeError("API down")):
        insight = generate_insights(profile, "budget laptop", results)

    assert insight.summary == FALLBACK_INSIGHT.summary


def test_select_results_for_prompt_prioritizes_classified():
    results = [
        _result("low none", 100, classification="none"),
        _result("high none", 9_000, classification="none"),
        _result("underrated gem", 2_000, classification="underrated"),
        _result("trending hit", 20_000, classification="trending"),
        _result("popular staple", 15_000, classification="popular"),
    ]
    selected = _select_results_for_prompt(results)
    titles = [r.title for r in selected]
    assert titles[0] == "trending hit"
    assert "underrated gem" in titles[:3]


def test_build_prompt_includes_profile_topic_and_results():
    profile = _profile()
    results = [
        _result("Acer Aspire review", 12_000),
        _result("Reddit budget thread", 500, platform="reddit"),
    ]
    prompt = _build_insight_prompt(profile, "budget laptop", results)
    assert "Budget Tech Daily" in prompt
    assert "budget laptop" in prompt
    assert "Acer Aspire review" in prompt
    assert '"content_angles"' in prompt
    assert '"content_gaps"' in prompt
