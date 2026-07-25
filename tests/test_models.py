import pytest
from datetime import datetime, timezone
from app.models import (
    ChannelProfile, ContentResult, CompetitorChannel,
    TopicInsight, VideoPerformance, ContentAngle, ContentGapAnalysis,
)


def test_channel_profile_defaults():
    profile = ChannelProfile(
        channel_id="UC123",
        title="Test Channel",
        description="A test channel",
        subscriber_count=10_000,
        video_count=100,
        view_count=500_000,
    )
    assert profile.channel_id == "UC123"
    assert profile.niche == ""


def test_content_result_defaults():
    result = ContentResult(
        platform="youtube",
        title="Test Video",
        url="https://youtube.com/watch?v=test",
        engagement_score=1000.0,
        published_at=datetime.now(timezone.utc),
        source="Test Channel",
        raw_metrics={"views": 1000},
    )
    assert result.platform == "youtube"
    assert result.raw_metrics == {"views": 1000}
    assert result.classification == "none"


def test_competitor_channel():
    comp = CompetitorChannel(
        channel_id="UC456",
        title="Competitor Channel",
        subscriber_count=50_000,
        relevance_note="similar size",
    )
    assert comp.subscriber_count == 50000
    assert comp.relevance_note == "similar size"


def test_video_performance():
    vp = VideoPerformance(
        title="My Best Video",
        video_id="abc123",
        views=100_000,
        likes=5000,
        comments=300,
        performance_ratio=2.5,
    )
    assert vp.performance_ratio == 2.5


def test_topic_insight():
    insight = TopicInsight(
        summary="Python tutorials are trending.",
        content_angles=[
            ContentAngle(title="Beginner Python", description="Start with basics", confidence_score=0.8),
            ContentAngle(title="Advanced Python", description="Deep dive", confidence_score=0.6),
        ],
        confidence_overall=0.7,
    )
    assert len(insight.content_angles) == 2
    assert insight.content_angles[0].title == "Beginner Python"
    assert insight.confidence_overall == 0.7


def test_content_gap_analysis():
    gap = ContentGapAnalysis(
        gap_description="No one covers async patterns for beginners",
        opportunity_score=8.5,
        audience_overlap_pct=65.0,
        suggested_approach="Create a step-by-step async tutorial series",
    )
    assert gap.opportunity_score == 8.5
    assert gap.audience_overlap_pct == 65.0
