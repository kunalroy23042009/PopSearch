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


class NotificationPref(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", unique=True)
    email_digest: bool = True
    digest_frequency: str = "weekly"
    digest_competitors: bool = True
    digest_trends: bool = True
    digest_ideas: bool = True
    competitor_alerts: bool = True
    trend_alerts: bool = True


class WatchedCompetitor(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    channel_id: str = Field(index=True)
    channel_title: str = ""
    subscriber_count: int = 0
    added_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_checked: datetime | None = None


class CompetitorAlert(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    competitor_channel_id: str = ""
    alert_type: str = ""
    message: str = ""
    read: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class UserChannel(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    channel_id: str = Field(index=True)
    channel_title: str = ""
    channel_url: str = ""
    is_primary: bool = False
    added_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class EmailDigestConfig(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", unique=True)
    enabled: bool = True
    frequency: str = "weekly"
    include_competitors: bool = True
    include_trends: bool = True
    include_ideas: bool = True
    include_performance: bool = True
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ContentIdea(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    topic: str
    title: str = ""
    seo_keywords: str = ""
    thumbnail_ideas: str = ""
    best_posting_time: str = ""
    predicted_performance: str = ""
    platform_focus: str = ""
    saved: bool = False
    scheduled_date: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class CalendarEvent(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    title: str
    description: str = ""
    event_date: str
    event_time: str = ""
    event_type: str = "idea"
    related_channel_id: str = ""
    google_event_id: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class RepurposeTask(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    source_url: str
    source_title: str = ""
    target_platforms: str = ""
    scripts_json: str = ""
    status: str = "pending"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SeoScorecard(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    channel_id: str = Field(index=True)
    title_score: float = 0.0
    description_score: float = 0.0
    tags_score: float = 0.0
    overall_score: float = 0.0
    recommendations: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class CommentAnalysis(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    video_id: str = Field(index=True)
    video_title: str = ""
    total_comments: int = 0
    analyzed_count: int = 0
    sentiment_breakdown: str = ""
    topics: str = ""
    content_ideas: str = ""
    common_requests: str = ""
    negative_feedback: str = ""
    summary: str = ""
    raw_comments: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


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


def get_notification_prefs(user_id: int) -> NotificationPref | None:
    with Session(_get_engine()) as session:
        statement = select(NotificationPref).where(NotificationPref.user_id == user_id)
        return session.exec(statement).first()


def save_notification_prefs(user_id: int, prefs: dict) -> NotificationPref:
    with Session(_get_engine()) as session:
        existing = get_notification_prefs(user_id)
        if existing:
            for k, v in prefs.items():
                setattr(existing, k, v)
            session.add(existing)
            session.commit()
            session.refresh(existing)
            return existing
        pref = NotificationPref(user_id=user_id, **prefs)
        session.add(pref)
        session.commit()
        session.refresh(pref)
        return pref


def get_watched_competitors(user_id: int) -> list[WatchedCompetitor]:
    with Session(_get_engine()) as session:
        statement = select(WatchedCompetitor).where(WatchedCompetitor.user_id == user_id)
        return list(session.exec(statement).all())


def add_watched_competitor(user_id: int, channel_id: str, channel_title: str, subs: int = 0) -> WatchedCompetitor:
    with Session(_get_engine()) as session:
        existing = session.exec(
            select(WatchedCompetitor).where(
                WatchedCompetitor.user_id == user_id,
                WatchedCompetitor.channel_id == channel_id,
            )
        ).first()
        if existing:
            return existing
        wc = WatchedCompetitor(user_id=user_id, channel_id=channel_id, channel_title=channel_title, subscriber_count=subs)
        session.add(wc)
        session.commit()
        session.refresh(wc)
        return wc


def remove_watched_competitor(user_id: int, channel_id: str) -> None:
    with Session(_get_engine()) as session:
        existing = session.exec(
            select(WatchedCompetitor).where(
                WatchedCompetitor.user_id == user_id,
                WatchedCompetitor.channel_id == channel_id,
            )
        ).first()
        if existing:
            session.delete(existing)
            session.commit()


def get_competitor_alerts(user_id: int, unread_only: bool = False) -> list[CompetitorAlert]:
    with Session(_get_engine()) as session:
        statement = select(CompetitorAlert).where(CompetitorAlert.user_id == user_id)
        if unread_only:
            statement = statement.where(CompetitorAlert.read == False)
        statement = statement.order_by(CompetitorAlert.created_at.desc()).limit(20)
        return list(session.exec(statement).all())


def mark_alerts_read(user_id: int) -> None:
    with Session(_get_engine()) as session:
        statement = select(CompetitorAlert).where(CompetitorAlert.user_id == user_id, CompetitorAlert.read == False)
        for alert in session.exec(statement).all():
            alert.read = True
            session.add(alert)
        session.commit()


def get_user_channels(user_id: int) -> list[UserChannel]:
    with Session(_get_engine()) as session:
        statement = select(UserChannel).where(UserChannel.user_id == user_id)
        return list(session.exec(statement).all())


def add_user_channel(user_id: int, channel_id: str, title: str, url: str, is_primary: bool = False) -> UserChannel:
    with Session(_get_engine()) as session:
        existing = session.exec(
            select(UserChannel).where(UserChannel.user_id == user_id, UserChannel.channel_id == channel_id)
        ).first()
        if existing:
            existing.channel_title = title
            existing.channel_url = url
            existing.is_primary = is_primary
            session.add(existing)
            session.commit()
            session.refresh(existing)
            return existing
        uc = UserChannel(user_id=user_id, channel_id=channel_id, channel_title=title, channel_url=url, is_primary=is_primary)
        session.add(uc)
        session.commit()
        session.refresh(uc)
        return uc


def remove_user_channel(user_id: int, channel_id: str) -> None:
    with Session(_get_engine()) as session:
        existing = session.exec(
            select(UserChannel).where(UserChannel.user_id == user_id, UserChannel.channel_id == channel_id)
        ).first()
        if existing:
            session.delete(existing)
            session.commit()


def get_email_digest_config(user_id: int) -> EmailDigestConfig | None:
    with Session(_get_engine()) as session:
        statement = select(EmailDigestConfig).where(EmailDigestConfig.user_id == user_id)
        return session.exec(statement).first()


def save_email_digest_config(user_id: int, cfg: dict) -> EmailDigestConfig:
    with Session(_get_engine()) as session:
        existing = get_email_digest_config(user_id)
        if existing:
            for k, v in cfg.items():
                setattr(existing, k, v)
            existing.updated_at = _utc_now()
            session.add(existing)
            session.commit()
            session.refresh(existing)
            return existing
        config = EmailDigestConfig(user_id=user_id, **cfg)
        session.add(config)
        session.commit()
        session.refresh(config)
        return config


def save_content_idea(user_id: int, data: dict) -> ContentIdea:
    with Session(_get_engine()) as session:
        idea = ContentIdea(user_id=user_id, **data)
        session.add(idea)
        session.commit()
        session.refresh(idea)
        return idea


def get_content_ideas(user_id: int, saved_only: bool = False) -> list[ContentIdea]:
    with Session(_get_engine()) as session:
        statement = select(ContentIdea).where(ContentIdea.user_id == user_id)
        if saved_only:
            statement = statement.where(ContentIdea.saved == True)
        statement = statement.order_by(ContentIdea.created_at.desc()).limit(50)
        return list(session.exec(statement).all())


def delete_content_idea(idea_id: int, user_id: int) -> None:
    with Session(_get_engine()) as session:
        idea = session.get(ContentIdea, idea_id)
        if idea and idea.user_id == user_id:
            session.delete(idea)
            session.commit()


def get_calendar_events(user_id: int, month: str = "") -> list[CalendarEvent]:
    with Session(_get_engine()) as session:
        statement = select(CalendarEvent).where(CalendarEvent.user_id == user_id)
        if month:
            statement = statement.where(CalendarEvent.event_date.startswith(month))
        statement = statement.order_by(CalendarEvent.event_date)
        return list(session.exec(statement).all())


def save_calendar_event(user_id: int, data: dict) -> CalendarEvent:
    with Session(_get_engine()) as session:
        ev = CalendarEvent(user_id=user_id, **data)
        session.add(ev)
        session.commit()
        session.refresh(ev)
        return ev


def delete_calendar_event(event_id: int, user_id: int) -> None:
    with Session(_get_engine()) as session:
        ev = session.get(CalendarEvent, event_id)
        if ev and ev.user_id == user_id:
            session.delete(ev)
            session.commit()


def save_repurpose_task(user_id: int, data: dict) -> RepurposeTask:
    with Session(_get_engine()) as session:
        task = RepurposeTask(user_id=user_id, **data)
        session.add(task)
        session.commit()
        session.refresh(task)
        return task


def get_repurpose_tasks(user_id: int) -> list[RepurposeTask]:
    with Session(_get_engine()) as session:
        statement = select(RepurposeTask).where(RepurposeTask.user_id == user_id).order_by(RepurposeTask.created_at.desc())
        return list(session.exec(statement).all())


def save_seo_scorecard(user_id: int, data: dict) -> SeoScorecard:
    with Session(_get_engine()) as session:
        existing = session.exec(
            select(SeoScorecard).where(SeoScorecard.user_id == user_id, SeoScorecard.channel_id == data["channel_id"])
        ).first()
        if existing:
            for k, v in data.items():
                setattr(existing, k, v)
            session.add(existing)
            session.commit()
            session.refresh(existing)
            return existing
        sc = SeoScorecard(user_id=user_id, **data)
        session.add(sc)
        session.commit()
        session.refresh(sc)
        return sc


def get_seo_scorecard(user_id: int, channel_id: str) -> SeoScorecard | None:
    with Session(_get_engine()) as session:
        statement = select(SeoScorecard).where(
            SeoScorecard.user_id == user_id, SeoScorecard.channel_id == channel_id
        )
        return session.exec(statement).first()


def save_comment_analysis(user_id: int, data: dict) -> CommentAnalysis:
    with Session(_get_engine()) as session:
        existing = session.exec(
            select(CommentAnalysis).where(
                CommentAnalysis.user_id == user_id,
                CommentAnalysis.video_id == data["video_id"],
            )
        ).first()
        if existing:
            for k, v in data.items():
                setattr(existing, k, v)
            session.add(existing)
            session.commit()
            session.refresh(existing)
            return existing
        ca = CommentAnalysis(user_id=user_id, **data)
        session.add(ca)
        session.commit()
        session.refresh(ca)
        return ca


def get_comment_analysis(user_id: int, video_id: str) -> CommentAnalysis | None:
    with Session(_get_engine()) as session:
        return session.exec(
            select(CommentAnalysis).where(
                CommentAnalysis.user_id == user_id,
                CommentAnalysis.video_id == video_id,
            )
        ).first()


def list_comment_analyses(user_id: int, limit: int = 20) -> list[CommentAnalysis]:
    with Session(_get_engine()) as session:
        return session.exec(
            select(CommentAnalysis)
            .where(CommentAnalysis.user_id == user_id)
            .order_by(CommentAnalysis.created_at.desc())
            .limit(limit)
        ).all()
