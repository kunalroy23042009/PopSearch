from __future__ import annotations

import json
import logging
import threading
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlmodel import Field, Session, SQLModel, create_engine, select, text

from app.config import settings
from app.models import ChannelProfile, ContentResult, DashboardData, JobProgress, SavedReport, TopicInsight

logger = logging.getLogger(__name__)

DB_DIR = Path("data")
DB_PATH = DB_DIR / "cache.db"

_engine = None
_engine_lock = threading.Lock()


class Channel(SQLModel, table=True):
    channel_id: str = Field(primary_key=True)
    url: str
    profile_json: str
    analyzed_at: datetime


class CompetitorList(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    channel_id: str = Field(foreign_key="channel.channel_id")
    competitors_json: str
    generated_at: datetime


class TopicSearch(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    channel_id: str = Field(foreign_key="channel.channel_id")
    topic: str
    results_json: str
    insight_json: str
    searched_at: datetime


class User(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    email: str = Field(unique=True, index=True)
    hashed_password: str
    plan: str = Field(default="free")
    analyses_this_month: int = Field(default=0)
    stripe_customer_id: str | None = Field(default=None)
    created_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    google_id: str | None = Field(default=None)


class ApiKey(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id")
    key_hash: str = Field(unique=True, index=True)
    label: str = Field(default="default")
    created_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ChannelSnapshot(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    channel_id: str = Field(index=True)
    subscriber_count: int = 0
    view_count: int = 0
    video_count: int = 0
    engagement_rate: float = 0.0
    snapshot_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class UserAnalyticsEvent(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(index=True)
    event_type: str = Field(index=True)
    event_data: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SavedReportModel(SQLModel, table=True):
    report_id: str = Field(primary_key=True)
    user_id: int = Field(index=True)
    channel_url: str
    channel_title: str = ""
    topic: str = ""
    dashboard_json: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class JobModel(SQLModel, table=True):
    job_id: str = Field(primary_key=True)
    user_id: int = Field(default=0, index=True)
    status: str = Field(default="pending")
    progress_pct: int = 0
    step: str = ""
    result_json: str = ""
    error: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


def _get_engine():
    global _engine
    if _engine is not None:
        return _engine
    with _engine_lock:
        if _engine is not None:
            return _engine
        db_url = getattr(settings, "DATABASE_URL", "") or f"sqlite:///{DB_PATH}"
        if db_url.startswith("postgresql") or db_url.startswith("postgres"):
            logger.info("Attempting PostgreSQL connection: %s", db_url.split("@")[-1] if "@" in db_url else db_url)
            try:
                from sqlalchemy import create_engine as _ce
                test_engine = _ce(db_url, pool_pre_ping=True)
                with test_engine.connect() as conn:
                    conn.execute(text("SELECT 1"))
                _engine = test_engine
                logger.info("Using PostgreSQL")
            except Exception as pg_exc:
                logger.warning("PostgreSQL unavailable (%s) — falling back to SQLite", str(pg_exc)[:80])
                db_url = f"sqlite:///{DB_PATH}"
                DB_DIR.mkdir(parents=True, exist_ok=True)
                _engine = create_engine(
                    db_url,
                    connect_args={"check_same_thread": False},
                )
        else:
            DB_DIR.mkdir(parents=True, exist_ok=True)
            _engine = create_engine(
                db_url,
                connect_args={"check_same_thread": False},
            )
    return _engine


def init_db() -> None:
    DB_DIR.mkdir(parents=True, exist_ok=True)
    SQLModel.metadata.create_all(_get_engine())
    logger.info("Database initialized")


def reset_engine() -> None:
    global _engine
    _engine = None


def get_session():
    with Session(_get_engine()) as session:
        yield session


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _ensure_aware(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _is_fresh(timestamp: datetime, max_age_hours: int) -> bool:
    age = _utc_now() - _ensure_aware(timestamp)
    return age < timedelta(hours=max_age_hours)


def _serialize_profile(profile: ChannelProfile) -> str:
    return profile.model_dump_json()


def _deserialize_profile(data: str) -> ChannelProfile:
    return ChannelProfile.model_validate_json(data)


def _serialize_results(results: list[ContentResult]) -> str:
    return json.dumps([r.model_dump(mode="json") for r in results])


def _deserialize_results(data: str) -> list[ContentResult]:
    payload = json.loads(data)
    return [ContentResult.model_validate(item) for item in payload]


def _serialize_insight(insight: TopicInsight) -> str:
    return insight.model_dump_json()


def _deserialize_insight(data: str) -> TopicInsight:
    return TopicInsight.model_validate_json(data)


def _ensure_channel_row(session: Session, channel_id: str) -> None:
    if session.get(Channel, channel_id) is None:
        session.add(
            Channel(
                channel_id=channel_id,
                url="",
                profile_json="{}",
                analyzed_at=_utc_now(),
            )
        )


def get_cached_channel_profile(
    channel_id: str,
    max_age_hours: int = 24,
) -> ChannelProfile | None:
    with Session(_get_engine()) as session:
        row = session.get(Channel, channel_id)
        if row is None or not _is_fresh(row.analyzed_at, max_age_hours):
            return None
        return _deserialize_profile(row.profile_json)


def get_cached_channel_profile_by_url(
    url: str,
    max_age_hours: int = 24,
) -> ChannelProfile | None:
    normalized = url.strip()
    with Session(_get_engine()) as session:
        statement = select(Channel).where(Channel.url == normalized)
        row = session.exec(statement).first()
        if row is None or not _is_fresh(row.analyzed_at, max_age_hours):
            return None
        return _deserialize_profile(row.profile_json)


def save_channel_profile(profile: ChannelProfile, url: str) -> None:
    now = _utc_now()
    with Session(_get_engine()) as session:
        existing = session.get(Channel, profile.channel_id)
        payload = _serialize_profile(profile)
        if existing is None:
            session.add(
                Channel(
                    channel_id=profile.channel_id,
                    url=url.strip(),
                    profile_json=payload,
                    analyzed_at=now,
                )
            )
        else:
            existing.url = url.strip()
            existing.profile_json = payload
            existing.analyzed_at = now
            session.add(existing)
        session.commit()


def get_cached_topic_search(
    channel_id: str,
    topic: str,
    max_age_hours: int = 24,
) -> tuple[list[ContentResult], TopicInsight] | None:
    normalized = topic.strip()
    with Session(_get_engine()) as session:
        statement = (
            select(TopicSearch)
            .where(TopicSearch.channel_id == channel_id)
            .where(TopicSearch.topic == normalized)
            .order_by(TopicSearch.searched_at.desc())
        )
        row = session.exec(statement).first()
        if row is None or not _is_fresh(row.searched_at, max_age_hours):
            return None
        return (
            _deserialize_results(row.results_json),
            _deserialize_insight(row.insight_json),
        )


def save_topic_search(
    channel_id: str,
    topic: str,
    results: list[ContentResult],
    insight: TopicInsight,
) -> None:
    normalized = topic.strip()
    now = _utc_now()
    with Session(_get_engine()) as session:
        _ensure_channel_row(session, channel_id)

        statement = (
            select(TopicSearch)
            .where(TopicSearch.channel_id == channel_id)
            .where(TopicSearch.topic == normalized)
        )
        existing = session.exec(statement).first()
        payload_results = _serialize_results(results)
        payload_insight = _serialize_insight(insight)

        if existing is None:
            session.add(
                TopicSearch(
                    channel_id=channel_id,
                    topic=normalized,
                    results_json=payload_results,
                    insight_json=payload_insight,
                    searched_at=now,
                )
            )
        else:
            existing.results_json = payload_results
            existing.insight_json = payload_insight
            existing.searched_at = now
            session.add(existing)
        session.commit()


def save_channel_snapshot(
    channel_id: str,
    subscriber_count: int,
    view_count: int,
    video_count: int,
    engagement_rate: float,
) -> None:
    with Session(_get_engine()) as session:
        session.add(
            ChannelSnapshot(
                channel_id=channel_id,
                subscriber_count=subscriber_count,
                view_count=view_count,
                video_count=video_count,
                engagement_rate=engagement_rate,
                snapshot_date=_utc_now(),
            )
        )
        session.commit()


def get_channel_history(
    channel_id: str,
    days: int = 30,
) -> list[ChannelSnapshot]:
    cutoff = _utc_now() - timedelta(days=days)
    with Session(_get_engine()) as session:
        statement = (
            select(ChannelSnapshot)
            .where(ChannelSnapshot.channel_id == channel_id)
            .where(ChannelSnapshot.snapshot_date >= cutoff)
            .order_by(ChannelSnapshot.snapshot_date)
        )
        return list(session.exec(statement).all())


def track_user_event(
    user_id: int,
    event_type: str,
    event_data: dict | None = None,
) -> None:
    with Session(_get_engine()) as session:
        session.add(
            UserAnalyticsEvent(
                user_id=user_id,
                event_type=event_type,
                event_data=json.dumps(event_data or {}),
            )
        )
        session.commit()


def get_user_analytics(
    user_id: int,
    event_type: str | None = None,
    days: int = 30,
) -> list[UserAnalyticsEvent]:
    cutoff = _utc_now() - timedelta(days=days)
    with Session(_get_engine()) as session:
        statement = (
            select(UserAnalyticsEvent)
            .where(UserAnalyticsEvent.user_id == user_id)
            .where(UserAnalyticsEvent.created_at >= cutoff)
        )
        if event_type:
            statement = statement.where(UserAnalyticsEvent.event_type == event_type)
        statement = statement.order_by(UserAnalyticsEvent.created_at.desc())
        return list(session.exec(statement).all())


def save_report(report: SavedReport) -> None:
    with Session(_get_engine()) as session:
        existing = session.get(SavedReportModel, report.report_id)
        payload = report.dashboard_data.model_dump_json() if report.dashboard_data else ""
        if existing is None:
            session.add(
                SavedReportModel(
                    report_id=report.report_id,
                    user_id=report.user_id,
                    channel_url=report.channel_url,
                    channel_title=report.channel_title,
                    topic=report.topic,
                    dashboard_json=payload,
                    created_at=report.created_at,
                )
            )
        else:
            existing.channel_title = report.channel_title
            existing.dashboard_json = payload
            existing.topic = report.topic
            session.add(existing)
        session.commit()


def get_user_reports(user_id: int, limit: int = 20) -> list[SavedReportModel]:
    with Session(_get_engine()) as session:
        statement = (
            select(SavedReportModel)
            .where(SavedReportModel.user_id == user_id)
            .order_by(SavedReportModel.created_at.desc())
            .limit(limit)
        )
        return list(session.exec(statement).all())


def get_report(report_id: str) -> SavedReportModel | None:
    with Session(_get_engine()) as session:
        return session.get(SavedReportModel, report_id)


def create_job(user_id: int) -> JobModel:
    job = JobModel(
        job_id=str(uuid.uuid4()),
        user_id=user_id,
        status="pending",
        progress_pct=0,
        step="Queued",
    )
    with Session(_get_engine()) as session:
        session.add(job)
        session.commit()
        session.refresh(job)
    return job


def update_job(
    job_id: str,
    status: str | None = None,
    progress_pct: int | None = None,
    step: str | None = None,
    result_json: str | None = None,
    error: str | None = None,
) -> None:
    with Session(_get_engine()) as session:
        job = session.get(JobModel, job_id)
        if job is None:
            return
        if status is not None:
            job.status = status
        if progress_pct is not None:
            job.progress_pct = progress_pct
        if step is not None:
            job.step = step
        if result_json is not None:
            job.result_json = result_json
        if error is not None:
            job.error = error
        job.updated_at = _utc_now()
        session.add(job)
        session.commit()


def get_job(job_id: str) -> JobModel | None:
    with Session(_get_engine()) as session:
        return session.get(JobModel, job_id)


def update_user_usage(user_id: int, increment: int = 1) -> None:
    with Session(_get_engine()) as session:
        user = session.get(User, user_id)
        if user:
            user.analyses_this_month = (user.analyses_this_month or 0) + increment
            session.add(user)
            session.commit()


def get_user_jobs(user_id: int, limit: int = 10) -> list[JobModel]:
    with Session(_get_engine()) as session:
        statement = (
            select(JobModel)
            .where(JobModel.user_id == user_id)
            .order_by(JobModel.created_at.desc())
            .limit(limit)
        )
        return list(session.exec(statement).all())
