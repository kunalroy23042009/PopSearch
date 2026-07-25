import logging
from datetime import datetime, timezone

from app.config import settings

logger = logging.getLogger(__name__)


class TikTokClient:
    """TikTok content client powered by Apify TikTok Scraper.

    Requires TIKTOK_API_KEY in .env (Apify API token).
    Returns empty list gracefully when unconfigured or on error.
    """

    def __init__(self):
        self.api_key = settings.TIKTOK_API_KEY or ""
        self.base_url = "https://api.apify.com/v2"

    def search(self, topic: str, limit: int = 15) -> list[dict]:
        if not self.api_key:
            logger.info("TikTok API key not configured — returning empty results")
            return []

        try:
            import httpx
            response = httpx.post(
                f"{self.base_url}/acts/epcxsc~tiktok-scraper/run-sync-get-dataset-items",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={
                    "searchKeyword": topic,
                    "maxItems": limit,
                    "scrapeType": "search",
                },
                timeout=30.0,
            )
            if response.status_code == 200:
                data = response.json()
                results = []
                for item in data if isinstance(data, list) else data.get("items", []):
                    results.append({
                        "description": item.get("description", item.get("text", "")),
                        "author": item.get("author", item.get("authorMeta", {}).get("name", "unknown")),
                        "author_followers": item.get("authorMeta", {}).get("followers", 0) if isinstance(item.get("authorMeta"), dict) else 0,
                        "likes": item.get("likes", item.get("stats", {}).get("likes", 0)),
                        "comments": item.get("comments", item.get("stats", {}).get("comments", 0)),
                        "shares": item.get("shares", item.get("stats", {}).get("shares", 0)),
                        "views": item.get("views", item.get("stats", {}).get("views", 0)),
                        "url": item.get("url", item.get("webVideoUrl", "")),
                        "created_at": item.get("createdAt", datetime.now(timezone.utc).isoformat()),
                    })
                return results
            else:
                logger.warning("TikTok API returned status %d: %s", response.status_code, response.text[:200])
                return []
        except ImportError:
            logger.warning("httpx not installed — cannot call TikTok API")
            return []
        except Exception as exc:
            logger.warning("TikTok search failed: %s", exc)
            return []
