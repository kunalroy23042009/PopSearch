from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

from app.ai_provider import ComplexityLevel, generate_ai_response
from app.models import ChannelProfile, ContentAngle, ContentGapAnalysis, ContentResult, TopicInsight, TrendVelocity

logger = logging.getLogger(__name__)

MAX_RESULTS_FOR_PROMPT = 15
MAX_RETRY_ATTEMPTS = 2

FALLBACK_INSIGHT = TopicInsight(
    summary="AI insights could not be generated — try again in a moment.",
    confidence_overall=0.0,
)


def _strip_markdown_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        idx = text.find("\n")
        if idx != -1:
            text = text[idx + 1:]
    if text.endswith("```"):
        text = text.rsplit("```", 1)[0]
    return text.strip()


def _select_results_for_prompt(results: list[ContentResult]) -> list[ContentResult]:
    if not results:
        return []
    classification_rank = {"trending": 0, "popular": 1, "underrated": 2, "none": 3}
    ranked = sorted(
        results,
        key=lambda r: (
            classification_rank.get(r.classification, 3),
            -r.engagement_score,
        ),
    )
    return ranked[:MAX_RESULTS_FOR_PROMPT]


def _format_results_for_prompt(results: list[ContentResult]) -> str:
    if not results:
        return "No classified results available."
    lines = []
    for i, result in enumerate(results, start=1):
        metrics = result.raw_metrics or {}
        views = metrics.get("views", metrics.get("upvotes", 0))
        likes = metrics.get("likes", metrics.get("comments", 0))
        lines.append(
            f"{i}. [{result.platform.upper()}] {result.title}\n"
            f"   Classification: {result.classification}\n"
            f"   Engagement: {result.engagement_score:,.0f} (views/upvotes: {views:,}, likes/comments: {likes:,})\n"
            f"   Source: {result.source}\n"
            f"   Velocity: {result.trend_velocity:.1f} ({result.velocity_direction})\n"
            f"   URL: {result.url}"
        )
    return "\n".join(lines)


def _build_insight_prompt(
    profile: ChannelProfile,
    topic: str,
    results: list[ContentResult],
) -> str:
    selected = _select_results_for_prompt(results)
    results_block = _format_results_for_prompt(selected)

    trending_count = sum(1 for r in results if r.classification == "trending")
    popular_count = sum(1 for r in results if r.classification == "popular")
    underrated_count = sum(1 for r in results if r.classification == "underrated")

    platform_counts: dict[str, int] = {}
    for r in results:
        platform_counts[r.platform] = platform_counts.get(r.platform, 0) + 1

    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    return f"""You are an expert YouTube content strategist. Analyze the channel profile, topic, and classified multi-platform results below.
Return ONLY a raw JSON object (no markdown, no code fences) with this exact structure:

{{
  "summary": "3-4 sentence analysis of what is happening around this topic. Reference specific patterns — which platforms show the most activity, which content types are trending vs underrated, and what the engagement patterns reveal.",
  "content_angles": [
    {{
      "title": "Short, catchy video title idea",
      "description": "2-3 sentence explanation of this angle. Reference specific results and explain why it fits this channel's niche and audience.",
      "confidence_score": 0.0-1.0,
      "predicted_performance": "Expected performance estimate (e.g., 'Above average — 50-100k views in first week')",
      "seo_keywords": ["keyword1", "keyword2", "keyword3"],
      "thumbnail_ideas": ["Thumbnail concept 1", "Thumbnail concept 2"],
      "best_time_to_post": "Recommended posting day and time",
      "platform_focus": ["youtube", "tiktok", "instagram"]
    }}
  ],
  "content_gaps": [
    {{
      "gap_description": "Clear description of an untapped content opportunity",
      "opportunity_score": 0.0-10.0,
      "competitor_coverage": ["Competitor A covered X but missed Y"],
      "audience_overlap_pct": 0-100,
      "suggested_approach": "How to execute on this gap"
    }}
  ],
  "trend_velocities": [
    {{
      "topic": "Subtopic or angle being tracked",
      "current_velocity": 0.0,
      "previous_velocity": 0.0,
      "week_over_week_change": 0.0,
      "direction": "accelerating|decelerating|stable",
      "momentum_score": 0.0-10.0
    }}
  ],
  "platform_summary": {{"youtube": 5, "reddit": 3, "twitter": 2, "tiktok": 0, "instagram": 0}},
  "confidence_overall": 0.0-1.0
}}

Channel profile:
- Title: {profile.title}
- Niche: {profile.niche}
- Topics: {json.dumps(profile.topics)}
- Content style: {profile.content_style}
- Target audience: {profile.target_audience}
- AI summary: {profile.ai_summary}
- Subscribers: {profile.subscriber_count}
- Avg views per video: {profile.average_views_per_video:.0f}
- Recent video titles: {json.dumps(profile.recent_video_titles[:8])}

Searched topic: {topic}
Analysis timestamp: {now}

Result distribution: {trending_count} trending, {popular_count} popular, {underrated_count} underrated
Platform distribution: {json.dumps(platform_counts)}

Top classified results:
{results_block}

Critical requirements:
- Every content angle must reference specific data from the results.
- Provide confidence scores based on data quality — 0.9+ if multiple strong signals, 0.5-0.7 if limited data, <0.5 if speculative.
- Content gaps must identify specific topics/angles competitors have missed.
- Trend velocities should estimate momentum — use engagement velocity and recency as signals.
- If results are sparse, be honest — set confidence_overall appropriately low.
- platform_focus should list which platforms this angle works best on based on where related content performed well.
"""


def _parse_insight_response(text: str) -> TopicInsight:
    cleaned = _strip_markdown_fences(text)
    data = json.loads(cleaned)

    if not isinstance(data, dict):
        raise ValueError("Response is not a JSON object")

    summary = data.get("summary", "")
    if not isinstance(summary, str) or not summary.strip():
        raise ValueError("Missing or invalid summary")

    content_angles_data = data.get("content_angles", [])
    content_angles = []
    if isinstance(content_angles_data, list):
        for angle in content_angles_data:
            if isinstance(angle, dict):
                content_angles.append(ContentAngle(
                    title=angle.get("title", "Untitled angle"),
                    description=angle.get("description", ""),
                    confidence_score=min(max(float(angle.get("confidence_score", 0.5)), 0.0), 1.0),
                    predicted_performance=angle.get("predicted_performance", ""),
                    seo_keywords=angle.get("seo_keywords", []),
                    thumbnail_ideas=angle.get("thumbnail_ideas", []),
                    best_time_to_post=angle.get("best_time_to_post", ""),
                    platform_focus=angle.get("platform_focus", []),
                ))

    content_gaps_data = data.get("content_gaps", [])
    content_gaps = []
    if isinstance(content_gaps_data, list):
        for gap in content_gaps_data:
            if isinstance(gap, dict):
                content_gaps.append(ContentGapAnalysis(
                    gap_description=gap.get("gap_description", ""),
                    opportunity_score=min(max(float(gap.get("opportunity_score", 5.0)), 0.0), 10.0),
                    competitor_coverage=gap.get("competitor_coverage", []),
                    audience_overlap_pct=min(max(float(gap.get("audience_overlap_pct", 50)), 0.0), 100.0),
                    suggested_approach=gap.get("suggested_approach", ""),
                ))

    trend_velocities_data = data.get("trend_velocities", [])
    trend_velocities = []
    if isinstance(trend_velocities_data, list):
        for tv in trend_velocities_data:
            if isinstance(tv, dict):
                direction = tv.get("direction", "stable")
                if direction not in ("accelerating", "decelerating", "stable"):
                    direction = "stable"
                trend_velocities.append(TrendVelocity(
                    topic=tv.get("topic", ""),
                    current_velocity=float(tv.get("current_velocity", 0.0)),
                    previous_velocity=float(tv.get("previous_velocity", 0.0)),
                    week_over_week_change=float(tv.get("week_over_week_change", 0.0)),
                    direction=direction,
                    momentum_score=min(max(float(tv.get("momentum_score", 5.0)), 0.0), 10.0),
                ))

    platform_summary = data.get("platform_summary", {})
    if not isinstance(platform_summary, dict):
        platform_summary = {}

    confidence_overall = min(max(float(data.get("confidence_overall", 0.5)), 0.0), 1.0)

    return TopicInsight(
        summary=summary.strip(),
        content_angles=content_angles,
        content_gaps=content_gaps,
        trend_velocities=trend_velocities,
        platform_summary=platform_summary,
        confidence_overall=confidence_overall,
    )


def _fallback_insight() -> TopicInsight:
    return FALLBACK_INSIGHT


def generate_insights(
    profile: ChannelProfile,
    topic: str,
    results: list[ContentResult],
) -> TopicInsight:
    prompt = _build_insight_prompt(profile, topic, results)

    last_error: Exception | None = None
    for attempt in range(1, MAX_RETRY_ATTEMPTS + 1):
        try:
            response = generate_ai_response(
                prompt=prompt,
                complexity=ComplexityLevel.MEDIUM,
                response_format="json_object",
            )
            return _parse_insight_response(response)
        except Exception as exc:
            last_error = exc
            logger.warning(
                "AI insight generation failed (attempt %d/%d): %s",
                attempt,
                MAX_RETRY_ATTEMPTS,
                exc,
            )

    logger.warning("All AI insight attempts failed: %s", last_error)
    return _fallback_insight()
