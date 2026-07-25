from __future__ import annotations

import asyncio
import json
import logging
import re
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from starlette.requests import Request

from app.auth import get_current_user, require_plan, create_access_token
from app.config import settings
from app.channel_analyzer import analyze_channel
from app.competitor_finder import find_competitors
from app.db import (
    get_cached_channel_profile, get_session, get_user_reports,
    get_report, init_db, get_job, track_user_event, update_user_usage,
)
from app.models import (
    ChannelProfile, CompetitorChannel, CompetitorAnalysis,
    ContentResult, DashboardData, SavedReport,
)
from app.tasks import submit_analysis_sync
from app.topic_search import search_topic_with_insights, search_topic
from app.classifier import classify_results
from app.db import User
from app.routers.auth import router as auth_router
from app.routers.billing import router as billing_router

logger = logging.getLogger(__name__)

_VALID_YOUTUBE_RE = re.compile(
    r"^(https?://)?(www\.)?(youtube\.com|youtu\.be)/.+|@[\w.-]+|UC[\w-]{22}$",
    re.IGNORECASE,
)

PLAN_LIMITS = {"free": 3, "pro": 50, "business": -1}


def _validate_youtube_url(url: str) -> None:
    if not url or not url.strip():
        raise ValueError("Channel URL is required")
    if not _VALID_YOUTUBE_RE.match(url.strip()):
        raise ValueError(
            "Invalid YouTube URL. Use formats like: "
            "https://www.youtube.com/@handle, "
            "https://www.youtube.com/channel/UC..., or "
            "https://www.youtube.com/c/Name"
        )


def _get_user_key_func(request: Request) -> str:
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
        try:
            from jose import JWTError, jwt
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            email = payload.get("sub")
            if email:
                return f"user:{email}"
        except JWTError:
            pass
    return get_remote_address(request)


limiter = Limiter(key_func=_get_user_key_func)


def _check_usage_limit(user: User) -> None:
    limit = PLAN_LIMITS.get(user.plan or "free", 3)
    if limit != -1 and (user.analyses_this_month or 0) >= limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Monthly analysis limit reached ({limit}). Upgrade your plan at /api/billing/checkout.",
        )


class AnalyzeChannelRequest(BaseModel):
    channel_url: str = Field(..., description="YouTube channel URL or ID")


class AnalyzeChannelResponse(BaseModel):
    job_id: str
    status_url: str = ""
    profile: ChannelProfile | None = None


class FindCompetitorsRequest(BaseModel):
    channel_id: str = Field(..., description="YouTube channel ID")


class SearchTopicRequest(BaseModel):
    channel_id: str = Field(..., description="YouTube channel ID")
    topic: str = Field(..., description="Topic to search for")
    competitor_channel_ids: list[str] = Field(
        default_factory=list,
        description="List of competitor channel IDs",
    )


class SearchTopicResponse(BaseModel):
    results: list[ContentResult]
    insight: dict


class MultiSourceSearchRequest(BaseModel):
    channel_id: str
    topic: str
    include_trends: bool = True
    include_twitter: bool = True
    include_twitch: bool = True
    include_hn: bool = True
    include_rss: bool = True
    include_tiktok: bool = True
    include_instagram: bool = True


class DashboardRequest(BaseModel):
    channel_url: str
    topic: str = ""


class AnalyzeRequest(BaseModel):
    channel_url: str
    topic: str = ""


class AnalyzeResponse(BaseModel):
    job_id: str
    status_url: str = ""


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()

    scheduler = None
    if settings.SCHEDULER_ENABLED:
        try:
            from apscheduler.schedulers.asyncio import AsyncIOScheduler
            from app.scheduler import run_daily_snapshots, run_weekly_email_reports

            scheduler = AsyncIOScheduler()
            scheduler.add_job(run_daily_snapshots, "cron", hour=2, minute=0, id="daily_snapshots")
            scheduler.add_job(run_weekly_email_reports, "cron", day_of_week="mon", hour=8, minute=0, id="weekly_reports")
            scheduler.start()
            logger.info("APScheduler started — daily snapshots + weekly reports")
        except ImportError:
            logger.info("APScheduler not installed — scheduler disabled")

    if settings.SENTRY_DSN:
        try:
            import sentry_sdk
            sentry_sdk.init(
                dsn=settings.SENTRY_DSN,
                traces_sample_rate=0.1,
                environment="production" if not settings.DEBUG else "development",
            )
            logger.info("Sentry initialized")
        except ImportError:
            logger.info("sentry_sdk not installed — Sentry disabled")

    if settings.POSTHOG_API_KEY:
        try:
            import posthog
            posthog.api_key = settings.POSTHOG_API_KEY
            posthog.host = settings.POSTHOG_HOST or "https://app.posthog.com"
            logger.info("PostHog initialized")
        except ImportError:
            logger.info("posthog not installed — PostHog disabled")

    yield

    if scheduler:
        scheduler.shutdown()


app = FastAPI(
    title="Creator Content Radar",
    description="AI-powered YouTube channel analyzer and cross-platform content discovery tool",
    version="0.4.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

ALLOWED_ORIGINS = [
    "https://creator-content-radar.onrender.com",
    "https://www.creatorcontentradar.com",
    "http://localhost:8000",
    "http://localhost:3000",
    "http://127.0.0.1:8000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-API-Key"],
)

app.include_router(auth_router)
app.include_router(billing_router)

try:
    from prometheus_fastapi_instrumentator import Instrumentator
    Instrumentator().instrument(app).expose(app, endpoint="/metrics")
except ImportError:
    logger.info("prometheus-fastapi-instrumentator not installed — /metrics disabled")


@app.post("/analyze-channel", response_model=AnalyzeChannelResponse)
@limiter.limit("10/minute")
async def analyze_channel_endpoint(
    request: Request,
    body: AnalyzeChannelRequest,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
) -> AnalyzeChannelResponse:
    try:
        _validate_youtube_url(body.channel_url)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    _check_usage_limit(user)

    job_id = submit_analysis_sync(background_tasks, body.channel_url, "", user.id)
    update_user_usage(user.id, 1)

    track_user_event(user.id, "analysis_started", {
        "channel_url": body.channel_url,
    })

    return AnalyzeChannelResponse(
        job_id=job_id,
        status_url=f"/api/jobs/{job_id}",
    )


@app.post("/find-competitors", response_model=list[CompetitorChannel])
@limiter.limit("20/minute")
async def find_competitors_endpoint(
    request: Request,
    body: FindCompetitorsRequest,
    user: User = Depends(get_current_user),
) -> list[CompetitorChannel]:
    logger.info("POST /find-competitors - channel_id=%s, user=%d", body.channel_id, user.id)

    try:
        profile = await asyncio.to_thread(get_cached_channel_profile, body.channel_id)
        if profile is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Channel profile not found for channel_id={body.channel_id}. "
                "Please analyze the channel first using /analyze-channel.",
            )

        competitors = await asyncio.to_thread(find_competitors, profile, exclude_channel_id=body.channel_id)
        track_user_event(user.id, "competitors_found", {
            "channel_id": body.channel_id,
            "count": len(competitors),
        })
        return competitors
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("POST /find-competitors ERROR - %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred: {str(exc)}",
        ) from exc


@app.post("/search-topic", response_model=SearchTopicResponse)
@limiter.limit("20/minute")
async def search_topic_endpoint(
    request: Request,
    body: SearchTopicRequest,
    user: User = Depends(get_current_user),
) -> SearchTopicResponse:
    _check_usage_limit(user)

    logger.info(
        "POST /search-topic - channel_id=%s, topic=%s, user=%d",
        body.channel_id, body.topic, user.id,
    )

    try:
        profile = await asyncio.to_thread(get_cached_channel_profile, body.channel_id)
        if profile is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Channel profile not found for channel_id={body.channel_id}. "
                "Please analyze the channel first using /analyze-channel.",
            )

        classified_results, insight = await asyncio.to_thread(
            search_topic_with_insights,
            profile, body.topic, body.competitor_channel_ids, None,
        )

        update_user_usage(user.id, 1)
        track_user_event(user.id, "topic_search", {
            "channel_id": body.channel_id,
            "topic": body.topic,
            "results": len(classified_results),
        })

        return SearchTopicResponse(
            results=classified_results,
            insight=insight.model_dump(),
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("POST /search-topic ERROR - %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error. Please try again later.",
        ) from exc


@app.get("/health")
async def health_check():
    return {"status": "ok"}


@app.post("/multi-source-search", response_model=DashboardData)
@limiter.limit("10/minute")
async def multi_source_search_endpoint(
    request: Request,
    body: MultiSourceSearchRequest,
    user: User = Depends(get_current_user),
) -> DashboardData:
    _check_usage_limit(user)

    logger.info(
        "POST /multi-source-search - channel_id=%s, topic=%s, user=%d",
        body.channel_id, body.topic, user.id,
    )

    try:
        profile = await asyncio.to_thread(get_cached_channel_profile, body.channel_id)
        if profile is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Channel profile not found for channel_id={body.channel_id}.",
            )

        from app.services.content_gatherer import ContentGatherer
        gatherer = ContentGatherer()
        dashboard = await asyncio.to_thread(
            gatherer.gather_all,
            topic=body.topic, profile=profile, include_trends=body.include_trends,
        )

        update_user_usage(user.id, 1)
        track_user_event(user.id, "multi_source_search", {
            "channel_id": body.channel_id,
            "topic": body.topic,
            "sources": dashboard.total_sources_checked,
        })

        return dashboard

    except HTTPException:
        raise
    except Exception as exc:
        logger.error("POST /multi-source-search ERROR - %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error. Please try again later.",
        ) from exc


@app.post("/dashboard", response_model=DashboardData)
@limiter.limit("10/minute")
async def dashboard_endpoint(
    request: Request,
    body: DashboardRequest,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
) -> DashboardData:
    _check_usage_limit(user)
    logger.info("POST /dashboard - channel_url=%s, user=%d", body.channel_url, user.id)

    try:
        profile = await asyncio.to_thread(analyze_channel, body.channel_url)
        from app.services.content_gatherer import ContentGatherer
        gatherer = ContentGatherer()

        topic = body.topic or profile.niche or (profile.topics[0] if profile.topics else "content creation")
        dashboard = await asyncio.to_thread(gatherer.gather_all, topic=topic, profile=profile)

        from app.competitor_finder import find_competitors
        competitors = await asyncio.to_thread(find_competitors, profile, exclude_channel_id=profile.channel_id)
        dashboard.competitors = CompetitorAnalysis(
            competitors=competitors,
            market_position=f"{profile.channel_tier} creator in {profile.niche}",
            competitive_advantage=profile.ai_summary[:200] if profile.ai_summary else "",
            threat_level="Medium" if len(competitors) > 5 else "Low",
        )

        update_user_usage(user.id, 1)
        track_user_event(user.id, "dashboard_viewed", {
            "channel_id": profile.channel_id,
            "channel_title": profile.title,
        })

        return dashboard

    except HTTPException:
        raise
    except Exception as exc:
        logger.error("POST /dashboard ERROR - %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error. Please try again later.",
        ) from exc


@app.post("/api/analyze/async", response_model=AnalyzeResponse)
async def analyze_async(
    body: AnalyzeRequest,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
):
    try:
        _validate_youtube_url(body.channel_url)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    _check_usage_limit(user)

    job_id = submit_analysis_sync(background_tasks, body.channel_url, body.topic, user.id)
    update_user_usage(user.id, 1)

    return AnalyzeResponse(
        job_id=job_id,
        status_url=f"/api/jobs/{job_id}",
    )


@app.get("/api/jobs/{job_id}")
async def get_job_status(job_id: str, user: User = Depends(get_current_user)):
    job = get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return {
        "job_id": job.job_id,
        "status": job.status,
        "progress_pct": job.progress_pct,
        "step": job.step,
        "error": job.error or None,
        "created_at": job.created_at.isoformat(),
        "updated_at": job.updated_at.isoformat(),
    }


@app.get("/api/reports")
async def list_reports(user: User = Depends(get_current_user)):
    reports = get_user_reports(user.id)
    return [
        {
            "report_id": r.report_id,
            "channel_url": r.channel_url,
            "channel_title": r.channel_title,
            "topic": r.topic,
            "created_at": r.created_at.isoformat(),
        }
        for r in reports
    ]


@app.get("/api/reports/{report_id}")
async def get_report_detail(report_id: str, user: User = Depends(get_current_user)):
    report = get_report(report_id)
    if report is None:
        raise HTTPException(status_code=404, detail="Report not found")
    return {
        "report_id": report.report_id,
        "channel_url": report.channel_url,
        "channel_title": report.channel_title,
        "topic": report.topic,
        "data": json.loads(report.dashboard_json) if report.dashboard_json else None,
        "created_at": report.created_at.isoformat(),
    }


@app.get("/api/analyze/{channel_id}/export")
async def export_analysis(
    channel_id: str,
    format: str = "csv",
    user: User = Depends(get_current_user),
):
    if user.plan not in ("pro", "business"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Export requires Pro or Business plan",
        )

    profile = get_cached_channel_profile(channel_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="Analysis not found")

    if format == "csv":
        import csv
        import io
        from fastapi.responses import StreamingResponse

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Field", "Value"])
        writer.writerow(["Channel", profile.title])
        writer.writerow(["Subscribers", profile.subscriber_count])
        writer.writerow(["Niche", profile.niche])
        writer.writerow(["Content Style", profile.content_style])
        writer.writerow(["Target Audience", profile.target_audience])
        writer.writerow(["Engagement Rate", f"{profile.engagement_rate:.2f}%"])
        for i, rec in enumerate(profile.content_recommendations, 1):
            writer.writerow([f"Recommendation {i}", rec])

        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=analysis_{channel_id}.csv"},
        )

    elif format == "pdf":
        try:
            from fastapi.responses import StreamingResponse
            import io
            from reportlab.lib.pagesizes import letter
            from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
            from reportlab.lib.styles import getSampleStyleSheet

            buffer = io.BytesIO()
            doc = SimpleDocTemplate(buffer, pagesize=letter)
            styles = getSampleStyleSheet()
            story = []

            story.append(Paragraph(f"Channel: {profile.title}", styles["Title"]))
            story.append(Spacer(1, 12))
            story.append(Paragraph(f"<b>Niche:</b> {profile.niche}", styles["Normal"]))
            story.append(Paragraph(f"<b>Subscribers:</b> {profile.subscriber_count:,}", styles["Normal"]))
            story.append(Paragraph(f"<b>Content Style:</b> {profile.content_style}", styles["Normal"]))
            story.append(Paragraph(f"<b>Target Audience:</b> {profile.target_audience}", styles["Normal"]))
            story.append(Paragraph(f"<b>AI Summary:</b> {profile.ai_summary}", styles["Normal"]))
            story.append(Paragraph(f"<b>Engagement Rate:</b> {profile.engagement_rate:.2f}%", styles["Normal"]))
            story.append(Spacer(1, 12))

            if profile.content_recommendations:
                story.append(Paragraph("<b>Content Recommendations:</b>", styles["Heading2"]))
                for rec in profile.content_recommendations:
                    story.append(Paragraph(f"&bull; {rec}", styles["Normal"]))

            doc.build(story)
            buffer.seek(0)

            return StreamingResponse(
                buffer,
                media_type="application/pdf",
                headers={"Content-Disposition": f"attachment; filename=analysis_{channel_id}.pdf"},
            )
        except ImportError:
            raise HTTPException(
                status_code=501,
                detail="PDF export requires reportlab. Install with: pip install reportlab",
            )

    else:
        raise HTTPException(status_code=400, detail="Format must be 'csv' or 'pdf'")


static_dir = Path(__file__).parent.parent / "static"


@app.get("/app")
async def serve_app(user: User = Depends(get_current_user)):
    return FileResponse(str(static_dir / "index.html"))


app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="static")
