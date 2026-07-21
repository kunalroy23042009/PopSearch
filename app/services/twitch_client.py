"""Twitch client — fetches stream data and game trends using Helix API."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

import requests

from app.config import settings
from app.models import TwitchStreamData

logger = logging.getLogger(__name__)


class TwitchClient:
    """Client for Twitch Helix API (requires OAuth token)."""

    TOKEN_URL = "https://id.twitch.tv/oauth2/token"
    BASE_URL = "https://api.twitch.tv/helix"

    def __init__(self) -> None:
        self.client_id = settings.TWITCH_CLIENT_ID
        self.client_secret = settings.TWITCH_CLIENT_SECRET
        self._token = None
        self._token_expires = 0

    def _get_token(self) -> str | None:
        if not self.client_id or not self.client_secret:
            return None
        try:
            resp = requests.post(self.TOKEN_URL, data={
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "grant_type": "client_credentials",
            }, timeout=10)
            resp.raise_for_status()
            data = resp.json()
            self._token = data.get("access_token")
            self._token_expires = datetime.now(timezone.utc).timestamp() + data.get("expires_in", 3600)
            return self._token
        except Exception as e:
            logger.warning("Twitch auth failed: %s", e)
            return None

    def _headers(self) -> dict:
        token = self._get_token()
        return {
            "Client-ID": self.client_id,
            "Authorization": f"Bearer {token}",
        } if token else {}

    def search_streams(self, query: str, max_results: int = 20) -> list[TwitchStreamData]:
        headers = self._headers()
        if not headers:
            return []
        try:
            params = {"query": query, "first": min(max_results, 100), "type": "search"}
            resp = requests.get(f"{self.BASE_URL}/streams", headers=headers, params=params, timeout=10)
            resp.raise_for_status()
            data = resp.json()
            results = []
            for stream in data.get("data", []):
                started = stream.get("started_at", "")
                results.append(TwitchStreamData(
                    stream_id=stream.get("id", ""),
                    title=stream.get("title", ""),
                    broadcaster=stream.get("user_name", ""),
                    viewers=stream.get("viewer_count", 0),
                    language=stream.get("language", ""),
                    started_at=datetime.fromisoformat(started.replace("Z", "+00:00")) if started else None,
                    game=stream.get("game_name", ""),
                    tags=stream.get("tags", []),
                    url=f"https://twitch.tv/{stream.get('user_login', '')}",
                ))
            return results
        except Exception as e:
            logger.warning("Twitch search failed: %s", e)
            return []

    def get_top_games(self) -> list[str]:
        headers = self._headers()
        if not headers:
            return []
        try:
            resp = requests.get(f"{self.BASE_URL}/games/top", headers=headers, params={"first": 20}, timeout=10)
            resp.raise_for_status()
            data = resp.json()
            return [g["name"] for g in data.get("data", [])]
        except Exception as e:
            logger.warning("Twitch top games fetch failed: %s", e)
            return []
