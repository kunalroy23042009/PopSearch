"""Google Trends client — fetches trending topic data and interest over time."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from pytrends.request import TrendReq

from app.models import ChartDataPoint, TrendData

logger = logging.getLogger(__name__)


class TrendsClient:
    """Client for Google Trends data via pytrends."""

    def __init__(self) -> None:
        try:
            self.client = TrendReq(hl="en-US", tz=360, timeout=10)
        except Exception as e:
            logger.warning("Failed to initialize pytrends client: %s", e)
            self.client = None

    def get_interest_over_time(self, keywords: list[str], timeframe: str = "now 7-d") -> list[ChartDataPoint]:
        if not self.client or not keywords:
            return []
        try:
            self.client.build_payload(keywords, cat=0, timeframe=timeframe, geo="", gprop="")
            data = self.client.interest_over_time()
            if data.empty:
                return []
            points = []
            for timestamp, row in data.iterrows():
                val = int(row[keywords[0]]) if keywords[0] in row else 0
                points.append(ChartDataPoint(
                    label=timestamp.strftime("%Y-%m-%d %H:00"),
                    value=float(val),
                ))
            return points
        except Exception as e:
            logger.warning("Failed to fetch interest over time: %s", e)
            return []

    def get_related_queries(self, keyword: str) -> dict:
        if not self.client:
            return {"top": [], "rising": []}
        try:
            self.client.build_payload([keyword], timeframe="now 7-d")
            related = self.client.related_queries()
            kw_data = related.get(keyword, {})
            top = [q["query"] for q in kw_data.get("top", [])[:10]] if kw_data.get("top") is not None else []
            rising = [q["query"] for q in kw_data.get("rising", [])[:10]] if kw_data.get("rising") is not None else []
            return {"top": top, "rising": rising}
        except Exception as e:
            logger.warning("Failed to fetch related queries: %s", e)
            return {"top": [], "rising": []}

    def get_regional_interest(self, keyword: str) -> dict:
        if not self.client:
            return {}
        try:
            self.client.build_payload([keyword])
            geo = self.client.geo
            if geo is None or geo.empty:
                return {}
            top_regions = geo.head(10)
            return {
                row["geoName"]: int(row[keyword])
                for _, row in top_regions.iterrows()
                if keyword in row
            }
        except Exception as e:
            logger.warning("Failed to fetch regional interest: %s", e)
            return {}

    def search_topic(self, topic: str) -> TrendData | None:
        if not self.client:
            return None
        try:
            interest = self.get_interest_over_time([topic])
            related = self.get_related_queries(topic)
            regional = self.get_regional_interest(topic)
            return TrendData(
                topic=topic,
                interest_over_time=interest,
                regional_interest=regional,
                related_queries=related.get("top", []),
                rising_queries=related.get("rising", []),
            )
        except Exception as e:
            logger.warning("Trends search failed: %s", e)
            return None
