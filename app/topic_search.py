from __future__ import annotations

import logging
from datetime import datetime, timezone

from googleapiclient.discovery import build

from app.config import settings
from app.db import get_cached_topic_search, save_topic_search
from app.models import ChannelProfile, ContentResult, TopicInsight

logger = logging.getLogger(__name__)

_YOUTUBE_GLOBAL_LIMIT = 20
_YOUTUBE_COMPETITOR_LIMIT = 5


def _build_youtube_client():
    if not settings.YOUTUBE_API_KEY:
        raise ValueError("YOUTUBE_API_KEY is not configured")
    return build("youtube", "v3", developerKey=settings.YOUTUBE_API_KEY)


def _parse_youtube_timestamp(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def search_youtube(topic: str, competitor_channel_ids: list[str]) -> list[ContentResult]:
    youtube = _build_youtube_client()
    snippets: dict[str, dict] = {}

    def _collect_search_results(**kwargs) -> None:
        try:
            response = (
                youtube.search()
                .list(part="snippet", q=topic, type="video", **kwargs)
                .execute()
            )
            for item in response.get("items", []):
                video_id = item["id"]["videoId"]
                snippets.setdefault(video_id, item["snippet"])
        except Exception as exc:
            logger.warning("YouTube search failed (%s): %s", kwargs, exc)

    _collect_search_results(maxResults=_YOUTUBE_GLOBAL_LIMIT)

    for channel_id in competitor_channel_ids:
        _collect_search_results(
            channelId=channel_id,
            maxResults=_YOUTUBE_COMPETITOR_LIMIT,
        )

    if not snippets:
        return []

    results: list[ContentResult] = []
    video_ids = list(snippets.keys())

    for i in range(0, len(video_ids), 50):
        batch = video_ids[i : i + 50]
        try:
            response = (
                youtube.videos()
                .list(part="snippet,statistics", id=",".join(batch))
                .execute()
            )
        except Exception as exc:
            logger.warning("YouTube video details fetch failed: %s", exc)
            continue

        for item in response.get("items", []):
            video_id = item["id"]
            snippet = item.get("snippet", snippets.get(video_id, {}))
            stats = item.get("statistics", {})
            views = int(stats.get("viewCount", 0))
            likes = int(stats.get("likeCount", 0))

            results.append(
                ContentResult(
                    platform="youtube",
                    title=snippet.get("title", ""),
                    url=f"https://www.youtube.com/watch?v={video_id}",
                    engagement_score=float(views),
                    published_at=_parse_youtube_timestamp(
                        snippet.get("publishedAt", "1970-01-01T00:00:00Z")
                    ),
                    source=snippet.get("channelTitle", "Unknown"),
                    raw_metrics={"views": views, "likes": likes},
                )
            )

    return results


def search_reddit(topic: str, subreddits: list[str] | None = None) -> list[ContentResult]:
    results: list[ContentResult] = []

    try:
        from app.services.reddit_client import RedditClient

        reddit = RedditClient()
        posts = reddit.search_subreddit(topic, subreddits=subreddits, limit=25)

        for post in posts:
            score = post.get("score", 0)
            num_comments = post.get("num_comments", 0)
            created = post.get("created_utc", datetime.now(timezone.utc))

            results.append(
                ContentResult(
                    platform="reddit",
                    title=post.get("title", ""),
                    url=post.get("url", ""),
                    engagement_score=float(score + num_comments * 3),
                    published_at=created,
                    source=f"r/{post.get('subreddit', 'unknown')}",
                    raw_metrics={
                        "upvotes": score,
                        "comments": num_comments,
                    },
                )
            )
    except Exception as exc:
        logger.warning("Reddit search failed: %s", exc)

    return results


def search_tiktok(topic: str) -> list[ContentResult]:
    results: list[ContentResult] = []

    try:
        from app.services.tiktok_client import TikTokClient
        client = TikTokClient()
        videos = client.search(topic, limit=15)
        for v in videos:
            created = v.get("created_at", datetime.now(timezone.utc))
            if isinstance(created, str):
                try:
                    created = datetime.fromisoformat(created.replace("Z", "+00:00"))
                except ValueError:
                    created = datetime.now(timezone.utc)

            results.append(
                ContentResult(
                    platform="tiktok",
                    title=v.get("description", "")[:200],
                    url=v.get("url", ""),
                    engagement_score=float(v.get("likes", 0) + v.get("shares", 0) * 3 + v.get("comments", 0) * 2),
                    published_at=created,
                    source=f"@{v.get('author', 'unknown')}",
                    raw_metrics={
                        "likes": v.get("likes", 0),
                        "comments": v.get("comments", 0),
                        "shares": v.get("shares", 0),
                        "views": v.get("views", 0),
                        "followers": v.get("author_followers", 0),
                    },
                )
            )
    except ImportError:
        logger.debug("TikTok client not available — skipping")
    except Exception as exc:
        logger.warning("TikTok search failed: %s", exc)

    return results


def search_instagram(topic: str) -> list[ContentResult]:
    results: list[ContentResult] = []

    try:
        from app.services.instagram_client import InstagramClient
        client = InstagramClient()
        posts = client.search(topic, limit=15)
        for p in posts:
            created = p.get("created_at", datetime.now(timezone.utc))
            if isinstance(created, str):
                try:
                    created = datetime.fromisoformat(created.replace("Z", "+00:00"))
                except ValueError:
                    created = datetime.now(timezone.utc)

            results.append(
                ContentResult(
                    platform="instagram",
                    title=p.get("caption", "")[:200],
                    url=p.get("url", ""),
                    engagement_score=float(p.get("likes", 0) + p.get("comments", 0) * 3),
                    published_at=created,
                    source=f"@{p.get('author', 'unknown')}",
                    raw_metrics={
                        "likes": p.get("likes", 0),
                        "comments": p.get("comments", 0),
                        "followers": p.get("author_followers", 0),
                    },
                )
            )
    except ImportError:
        logger.debug("Instagram client not available — skipping")
    except Exception as exc:
        logger.warning("Instagram search failed: %s", exc)

    return results


def search_topic(
    topic: str,
    competitor_channel_ids: list[str],
    subreddits: list[str] | None = None,
    include_tiktok: bool = True,
    include_instagram: bool = True,
) -> list[ContentResult]:
    results: list[ContentResult] = []

    try:
        results.extend(search_youtube(topic, competitor_channel_ids))
    except Exception as exc:
        logger.warning("YouTube topic search failed: %s", exc)

    try:
        results.extend(search_reddit(topic, subreddits))
    except Exception as exc:
        logger.warning("Reddit topic search failed: %s", exc)

    if include_tiktok:
        try:
            results.extend(search_tiktok(topic))
        except Exception as exc:
            logger.warning("TikTok topic search failed: %s", exc)

    if include_instagram:
        try:
            results.extend(search_instagram(topic))
        except Exception as exc:
            logger.warning("Instagram topic search failed: %s", exc)

    return results


def search_topic_with_insights(
    profile: ChannelProfile,
    topic: str,
    competitor_channel_ids: list[str],
    subreddits: list[str] | None = None,
    *,
    max_age_hours: int = 24,
    use_cache: bool = True,
    include_tiktok: bool = True,
    include_instagram: bool = True,
) -> tuple[list[ContentResult], TopicInsight]:
    from app.ai_reasoning import generate_insights
    from app.classifier import classify_results

    channel_id = profile.channel_id
    normalized_topic = topic.strip()

    if use_cache:
        cached = get_cached_topic_search(channel_id, normalized_topic, max_age_hours)
        if cached is not None:
            logger.info(
                "Topic search cache HIT for channel_id=%s topic=%r",
                channel_id,
                normalized_topic,
            )
            return cached

    logger.info(
        "Topic search cache MISS for channel_id=%s topic=%r — calling APIs",
        channel_id,
        normalized_topic,
    )

    raw_results = search_topic(
        normalized_topic,
        competitor_channel_ids,
        subreddits,
        include_tiktok=include_tiktok,
        include_instagram=include_instagram,
    )
    results = classify_results(raw_results)
    insight = generate_insights(profile, normalized_topic, results)

    if use_cache:
        save_topic_search(channel_id, normalized_topic, results, insight)

    return results, insight
