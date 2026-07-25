from __future__ import annotations

import math
from datetime import datetime, timezone

from app.models import ContentResult

TRENDING_MAX_AGE_HOURS = 168
TRENDING_MIN_ENGAGEMENT = 100.0
TRENDING_VELOCITY_PERCENTILE = 60

POPULAR_TOP_PERCENT = 25
POPULAR_MIN_ENGAGEMENT = 500.0

UNDERRATED_TOP_PERCENT = 30
UNDERRATED_MIN_ENGAGEMENT = 5.0

HISTORICAL_VELOCITY_WINDOW_HOURS = 24


def _percentile(values: list[float], pct: float) -> float:
    if not values:
        return 0.0
    if len(values) == 1:
        return values[0]
    ordered = sorted(values)
    rank = (pct / 100.0) * (len(ordered) - 1)
    low = math.floor(rank)
    high = math.ceil(rank)
    if low == high:
        return ordered[low]
    weight = rank - low
    return ordered[low] * (1.0 - weight) + ordered[high] * weight


def _ensure_aware(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _age_hours(published_at: datetime, now: datetime) -> float:
    delta = _ensure_aware(now) - _ensure_aware(published_at)
    return max(delta.total_seconds() / 3600.0, 0.0)


def _engagement_velocity(result: ContentResult, now: datetime) -> float:
    age_h = _age_hours(result.published_at, now)
    if age_h < 1:
        age_h = 1.0
    return result.engagement_score / age_h


def _engagement_ratio(result: ContentResult) -> float | None:
    metrics = result.raw_metrics or {}
    if result.platform == "youtube":
        engagement = float(metrics.get("views", result.engagement_score))
        audience = metrics.get("channel_subscriber_count") or metrics.get("subscriber_count")
    else:
        engagement = float(metrics.get("upvotes", result.engagement_score))
        audience = metrics.get("subreddit_subscriber_count") or metrics.get("subscribers")
    if audience is not None and float(audience) > 0:
        return engagement / float(audience)
    if result.engagement_score < UNDERRATED_MIN_ENGAGEMENT:
        return None
    return float(result.engagement_score)


def _compute_velocity_direction(
    result: ContentResult,
    now: datetime,
    historical_snapshots: list[dict] | None = None,
) -> tuple[float, str]:
    current_velocity = _engagement_velocity(result, now)

    if not historical_snapshots:
        return current_velocity, "stable"

    channel_id = result.source
    matching = [s for s in historical_snapshots if s.get("source") == channel_id]
    if not matching:
        return current_velocity, "stable"

    recent_snapshot = matching[-1]
    snapshot_time_str = recent_snapshot.get("timestamp", "")
    try:
        snapshot_time = datetime.fromisoformat(snapshot_time_str.replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return current_velocity, "stable"

    age_h = _age_hours(result.published_at, snapshot_time)
    if age_h < 1:
        age_h = 1.0
    previous_velocity = recent_snapshot.get("engagement_score", 0) / age_h

    if current_velocity > previous_velocity * 1.15:
        direction = "accelerating"
    elif current_velocity < previous_velocity * 0.85:
        direction = "decelerating"
    else:
        direction = "stable"

    return current_velocity, direction


def _percentile_per_platform(
    results: list[ContentResult],
    velocities: list[float],
    scores: list[float],
    pct_velocity: float,
    pct_popular: float,
) -> tuple[dict[str, float], dict[str, float]]:
    platform_groups: dict[str, dict[str, list[float]]] = {}
    for i, r in enumerate(results):
        p = r.platform
        if p not in platform_groups:
            platform_groups[p] = {"velocities": [], "scores": []}
        platform_groups[p]["velocities"].append(velocities[i])
        platform_groups[p]["scores"].append(scores[i])

    velocity_floors: dict[str, float] = {}
    popular_floors: dict[str, float] = {}

    for platform, data in platform_groups.items():
        v = [x for x in data["velocities"] if x > 0]
        velocity_floors[platform] = _percentile(v, pct_velocity) if v else 0.0
        popular_floors[platform] = _percentile(data["scores"], 100 - pct_popular) if data["scores"] else 0.0

    return velocity_floors, popular_floors


def classify_results(
    results: list[ContentResult],
    *,
    now: datetime | None = None,
    historical_snapshots: list[dict] | None = None,
) -> list[ContentResult]:
    if not results:
        return []

    now = now or datetime.now(timezone.utc)

    velocities_and_directions = [
        _compute_velocity_direction(r, now, historical_snapshots) for r in results
    ]
    velocities = [v for v, _ in velocities_and_directions]
    scores = [r.engagement_score for r in results]

    velocity_floors, popular_floors = _percentile_per_platform(
        results, velocities, scores,
        TRENDING_VELOCITY_PERCENTILE, POPULAR_TOP_PERCENT,
    )

    ratios: list[float | None] = [_engagement_ratio(r) for r in results]

    labeled: list[ContentResult] = []
    pending_underrated: list[tuple[int, float]] = []

    for i, result in enumerate(results):
        age_h = _age_hours(result.published_at, now)
        velocity, direction = velocities_and_directions[i]

        trending_velocity_floor = velocity_floors.get(result.platform, 0.0)
        popular_floor = popular_floors.get(result.platform, 0.0)

        is_trending = (
            age_h <= TRENDING_MAX_AGE_HOURS
            and result.engagement_score >= TRENDING_MIN_ENGAGEMENT
            and velocity >= trending_velocity_floor
        )

        is_popular = result.engagement_score >= max(popular_floor, POPULAR_MIN_ENGAGEMENT)

        if is_trending:
            classification = "trending"
        elif is_popular:
            classification = "popular"
        else:
            classification = "none"
            ratio = ratios[i]
            if ratio is not None and ratio > 0:
                pending_underrated.append((i, ratio))

        labeled.append(result.model_copy(update={
            "classification": classification,
            "trend_velocity": velocity,
            "velocity_direction": direction,
        }))

    if pending_underrated:
        ratio_values = [r for _, r in pending_underrated]
        underrated_floor = _percentile(ratio_values, 100 - UNDERRATED_TOP_PERCENT)
        for idx, ratio in pending_underrated:
            if ratio >= underrated_floor:
                labeled[idx] = labeled[idx].model_copy(
                    update={"classification": "underrated"}
                )

    return labeled


def compute_velocity_delta(
    current_results: list[ContentResult],
    previous_results: list[ContentResult],
) -> dict[str, float]:
    deltas: dict[str, float] = {}
    prev_lookup: dict[str, float] = {}
    for r in previous_results:
        if r.engagement_score > 0:
            prev_lookup[r.title] = r.engagement_score

    for r in current_results:
        prev = prev_lookup.get(r.title)
        if prev is not None and prev > 0:
            deltas[r.title] = (r.engagement_score - prev) / prev * 100.0
        else:
            deltas[r.title] = 0.0

    return deltas
