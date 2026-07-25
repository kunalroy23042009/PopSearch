from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

from fastapi import BackgroundTasks

from app import db
from app.channel_analyzer import analyze_channel
from app.competitor_finder import find_competitors
from app.models import ChannelProfile, CompetitorAnalysis, DashboardData, SavedReport
from app.services.content_gatherer import ContentGatherer

logger = logging.getLogger(__name__)


async def run_analysis_job(
    job_id: str,
    channel_url: str,
    topic: str = "",
    user_id: int = 0,
) -> None:
    try:
        db.update_job(job_id, status="running", progress_pct=5, step="Fetching channel data...")

        profile = analyze_channel(channel_url)
        db.update_job(job_id, progress_pct=30, step="Channel analyzed — finding competitors...")

        competitors = find_competitors(profile, exclude_channel_id=profile.channel_id)
        db.update_job(job_id, progress_pct=50, step="Competitors found — gathering cross-platform content...")

        gatherer = ContentGatherer()
        search_topic = topic or profile.niche or (profile.topics[0] if profile.topics else "content creation")
        dashboard = gatherer.gather_all(topic=search_topic, profile=profile)
        db.update_job(job_id, progress_pct=80, step="Content gathered — building dashboard...")

        dashboard.competitors = CompetitorAnalysis(
            competitors=competitors,
            market_position=f"{profile.channel_tier} creator in {profile.niche}",
            competitive_advantage=profile.ai_summary[:200] if profile.ai_summary else "",
            threat_level="Medium" if len(competitors) > 5 else "Low",
        )
        db.update_job(job_id, progress_pct=95, step="Finalizing...")

        db.update_job(
            job_id,
            status="completed",
            progress_pct=100,
            step="Analysis complete",
            result_json=dashboard.model_dump_json(),
        )

        if user_id:
            db.save_report(SavedReport(
                report_id=job_id,
                user_id=user_id,
                channel_url=channel_url,
                channel_title=profile.title,
                topic=search_topic,
                created_at=datetime.now(timezone.utc),
                dashboard_data=dashboard,
            ))
            db.track_user_event(user_id, "analysis_completed", {
                "channel_id": profile.channel_id,
                "channel_title": profile.title,
                "topic": search_topic,
            })

    except Exception as exc:
        logger.exception("Analysis job %s failed", job_id)
        db.update_job(job_id, status="failed", error=str(exc))


def submit_analysis(
    channel_url: str,
    topic: str = "",
    user_id: int = 0,
) -> str:
    job = db.create_job(user_id)
    try:
        import asyncio
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.create_task(run_analysis_job(job.job_id, channel_url, topic, user_id))
        else:
            loop.run_until_complete(run_analysis_job(job.job_id, channel_url, topic, user_id))
    except RuntimeError:
        import asyncio
        asyncio.run(run_analysis_job(job.job_id, channel_url, topic, user_id))
    return job.job_id


def submit_analysis_sync(
    background_tasks: BackgroundTasks,
    channel_url: str,
    topic: str = "",
    user_id: int = 0,
) -> str:
    job = db.create_job(user_id)
    background_tasks.add_task(run_analysis_job, job.job_id, channel_url, topic, user_id)
    return job.job_id
