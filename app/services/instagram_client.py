import logging
from datetime import datetime, timezone

from app.config import settings

logger = logging.getLogger(__name__)


class InstagramClient:
    def __init__(self):
        self.api_key = settings.INSTAGRAM_API_KEY or ""
        self.base_url = "https://api.apify.com/v2"

    def search(self, topic: str, limit: int = 15) -> list[dict]:
        if not self.api_key:
            logger.info("Instagram API key not configured — returning empty results")
            return []

        try:
            import httpx
            response = httpx.post(
                f"{self.base_url}/acts/epcxsc~instagram-scraper/run-sync-get-dataset-items",
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
                        "caption": item.get("caption", item.get("text", "")),
                        "author": item.get("author", item.get("owner", {}).get("username", "unknown")),
                        "author_followers": item.get("owner", {}).get("followers", 0) if isinstance(item.get("owner"), dict) else 0,
                        "likes": item.get("likes", item.get("stats", {}).get("likes", 0)),
                        "comments": item.get("comments", item.get("stats", {}).get("comments", 0)),
                        "url": item.get("url", item.get("displayUrl", "")),
                        "created_at": item.get("createdAt", datetime.now(timezone.utc).isoformat()),
                    })
                return results
            else:
                logger.warning("Instagram API returned status %d: %s", response.status_code, response.text[:200])
                return []
        except ImportError:
            logger.warning("httpx not installed — cannot call Instagram API")
            return []
        except Exception as exc:
            logger.warning("Instagram search failed: %s", exc)
            return []
