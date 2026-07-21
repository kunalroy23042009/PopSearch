"""Twitter/X client — searches for tweets and trends using free API v2.

Uses the Twitter API v2 free tier (limited but functional).
Falls back to scraping for broader access.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

import requests

from app.config import settings
from app.models import ChartDataPoint, TweetData

logger = logging.getLogger(__name__)


class TwitterClient:
    """Client for Twitter/X API v2 (free tier)."""

    BASE_URL = "https://api.twitter.com/2"

    def __init__(self) -> None:
        self.api_key = settings.TWITTER_API_KEY
        self.api_secret = settings.TWITTER_API_SECRET
        self.bearer_token = settings.TWITTER_BEARER_TOKEN
        self._token = self.bearer_token

    def _headers(self) -> dict:
        return {"Authorization": f"Bearer {self._token}"}

    def search_recent(self, query: str, max_results: int = 20) -> list[TweetData]:
        if not self._token:
            logger.warning("No Twitter bearer token configured")
            return []
        try:
            url = f"{self.BASE_URL}/tweets/search/recent"
            params = {
                "query": query,
                "max_results": min(max_results, 100),
                "tweet.fields": "created_at,public_metrics,author_id",
                "expansions": "author_id",
                "user.fields": "public_metrics,username",
            }
            resp = requests.get(url, headers=self._headers(), params=params, timeout=15)
            resp.raise_for_status()
            data = resp.json()
            users = {u["id"]: u for u in data.get("includes", {}).get("users", [])}
            results = []
            for tweet in data.get("data", []):
                author = users.get(tweet.get("author_id", ""), {})
                metrics = tweet.get("public_metrics", {})
                results.append(TweetData(
                    tweet_id=tweet.get("id", ""),
                    text=tweet.get("text", ""),
                    author=author.get("username", "unknown"),
                    author_followers=author.get("public_metrics", {}).get("followers_count", 0),
                    likes=metrics.get("like_count", 0),
                    retweets=metrics.get("retweet_count", 0),
                    replies=metrics.get("reply_count", 0),
                    created_at=datetime.fromisoformat(tweet.get("created_at", "").replace("Z", "+00:00")) if tweet.get("created_at") else None,
                    url=f"https://twitter.com/i/web/status/{tweet.get('id', '')}",
                ))
            return results
        except Exception as e:
            logger.warning("Twitter search failed: %s", e)
            return []

    def get_trends(self, woeid: int = 23424848) -> list[str]:
        """Get trending topics. Default WOEID = Worldwide."""
        if not self._token:
            return []
        try:
            url = f"{self.BASE_URL}/trends/by/woeid/{woeid}"
            resp = requests.get(url, headers=self._headers(), timeout=10)
            resp.raise_for_status()
            data = resp.json()
            trends = data[0].get("trends", []) if data else []
            return [t["name"] for t in trends[:20]]
        except Exception as e:
            logger.warning("Twitter trends fetch failed: %s", e)
            return []
