"""RSS/Feed client — fetches from Hacker News, Product Hunt, and custom RSS feeds."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

import feedparser
import requests

from app.models import RSSFeedItem

logger = logging.getLogger(__name__)


class RSSClient:
    """Client for RSS feeds, Hacker News, and Product Hunt."""

    HN_TOP_STORIES = "https://hacker-news.firebaseio.com/v0/topstories.json"
    HN_ITEM = "https://hacker-news.firebaseio.com/v0/item/{}.json"
    PRODUCT_HUNT_API = "https://api.producthunt.com/v2/api/graphql"

    def __init__(self) -> None:
        self.ph_token = ""  # Optional: Product Hunt API token

    def fetch_hacker_news(self, max_results: int = 15) -> list[RSSFeedItem]:
        try:
            resp = requests.get(self.HN_TOP_STORIES, timeout=10)
            resp.raise_for_status()
            story_ids = resp.json()[:max_results]
            results = []
            for sid in story_ids:
                try:
                    item_resp = requests.get(self.HN_ITEM.format(sid), timeout=5)
                    item = item_resp.json()
                    if item and item.get("type") == "story" and item.get("title"):
                        results.append(RSSFeedItem(
                            title=item.get("title", ""),
                            url=item.get("url", f"https://news.ycombinator.com/item?id={sid}"),
                            source="Hacker News",
                            points=item.get("score", 0),
                            comments=item.get("descendants", 0),
                            published_at=datetime.fromtimestamp(item.get("time", 0), tz=timezone.utc) if item.get("time") else None,
                            author=item.get("by", ""),
                        ))
                except Exception as e:
                    logger.warning("Failed to fetch HN item %s: %s", sid, e)
                    continue
            return results
        except Exception as e:
            logger.warning("Failed to fetch Hacker News: %s", e)
            return []

    def fetch_rss_feed(self, feed_url: str, source_name: str = "RSS", max_results: int = 10) -> list[RSSFeedItem]:
        try:
            feed = feedparser.parse(feed_url)
            results = []
            for entry in feed.entries[:max_results]:
                published = entry.get("published_parsed") or entry.get("updated_parsed")
                dt = None
                if published and hasattr(published, "__getitem__"):
                    try:
                        dt = datetime(*published[:6], tzinfo=timezone.utc)
                    except (TypeError, ValueError):
                        dt = None
                results.append(RSSFeedItem(
                    title=entry.get("title", ""),
                    url=entry.get("link", ""),
                    source=source_name,
                    points=0,
                    comments=0,
                    published_at=dt,
                    author=entry.get("author", ""),
                ))
            return results
        except Exception as e:
            logger.warning("Failed to fetch RSS feed %s: %s", feed_url, e)
            return []

    def search_topic_hacker_news(self, topic: str, max_results: int = 10) -> list[RSSFeedItem]:
        try:
            url = f"https://hn.algolia.com/api/v1/search"
            params = {"query": topic, "hitsPerPage": max_results, "tags": "story"}
            resp = requests.get(url, params=params, timeout=10)
            resp.raise_for_status()
            data = resp.json()
            results = []
            for hit in data.get("hits", []):
                results.append(RSSFeedItem(
                    title=hit.get("title", ""),
                    url=hit.get("url", hit.get("story_url", f"https://news.ycombinator.com/item?id={hit.get('objectID', '')}")),
                    source="Hacker News",
                    points=hit.get("points", 0),
                    comments=hit.get("num_comments", 0),
                    published_at=datetime.fromisoformat(hit.get("created_at", "").replace("Z", "+00:00")) if hit.get("created_at") else None,
                    author=hit.get("author", ""),
                ))
            return results
        except Exception as e:
            logger.warning("HN topic search failed: %s", e)
            return []

    def search_reddit_rss(self, topic: str, subreddit: str = "all", max_results: int = 10) -> list[RSSFeedItem]:
        """Alternative Reddit access via RSS (no PRAW needed)."""
        try:
            feed_url = f"https://www.reddit.com/r/{subreddit}/search.rss?q={topic}&sort=top&t=week"
            feed = feedparser.parse(feed_url)
            results = []
            for entry in feed.entries[:max_results]:
                results.append(RSSFeedItem(
                    title=entry.get("title", ""),
                    url=entry.get("link", ""),
                    source=f"r/{subreddit}",
                    points=0,
                    comments=0,
                    published_at=(
                        datetime(*entry.get("published_parsed")[:6], tzinfo=timezone.utc)
                        if entry.get("published_parsed") and isinstance(entry.get("published_parsed"), (tuple, list))
                        else None
                    ),
                ))
            return results
        except Exception as e:
            logger.warning("Reddit RSS search failed: %s", e)
            return []
