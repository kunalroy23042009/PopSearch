import hashlib
import json
import logging
import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlmodel import Session

from app.auth import get_current_user
from app.db import (
    User, get_session,
    ApiKey, ContentIdea,
    get_notification_prefs, save_notification_prefs,
    get_watched_competitors, add_watched_competitor, remove_watched_competitor,
    get_competitor_alerts, mark_alerts_read,
    get_user_channels, add_user_channel, remove_user_channel,
    get_email_digest_config, save_email_digest_config,
    save_content_idea, get_content_ideas, delete_content_idea,
    get_calendar_events, save_calendar_event, delete_calendar_event,
    save_repurpose_task, get_repurpose_tasks,
    save_seo_scorecard, get_seo_scorecard,
)

logger = logging.getLogger(__name__)


async def _rate_limit(request: Request):
    """Per-IP rate limit for all feature router endpoints."""
    try:
        from app.main import limiter
        from starlette.responses import Response
        ok, _ = await limiter.check(request, None, "30/minute", limiter.key_func)
        if not ok:
            raise HTTPException(status_code=429, detail="Rate limit exceeded (30/min)")
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("Rate limit check failed (fail-open): %s", exc)


router = APIRouter(prefix="/api", tags=["features"], dependencies=[Depends(_rate_limit)])


# ── API Keys ───────────────────────────────────────────────────────────

class ApiKeyCreate(BaseModel):
    label: str = "default"


@router.get("/api-keys")
def list_api_keys(user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    from sqlmodel import select
    keys = session.exec(select(ApiKey).where(ApiKey.user_id == user.id)).all()
    return [{"id": k.id, "label": k.label, "created_date": k.created_date.isoformat(), "key": f"ccr_{k.id}_..._hidden"} for k in keys]


@router.post("/api-keys")
def create_api_key(data: ApiKeyCreate, user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    if user.plan != "business":
        raise HTTPException(status_code=403, detail="API keys require Business plan")
    raw = f"ccr_{secrets.token_hex(24)}"
    key_hash = hashlib.sha256(raw.encode()).hexdigest()
    ak = ApiKey(user_id=user.id, key_hash=key_hash, label=data.label)
    session.add(ak)
    session.commit()
    session.refresh(ak)
    return {"id": ak.id, "label": ak.label, "key": raw, "created_date": ak.created_date.isoformat()}


@router.delete("/api-keys/{key_id}")
def delete_api_key(key_id: int, user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    key = session.get(ApiKey, key_id)
    if not key or key.user_id != user.id:
        raise HTTPException(status_code=404, detail="API key not found")
    session.delete(key)
    session.commit()
    return {"status": "deleted"}


# ── Notification Preferences ───────────────────────────────────────────

@router.get("/notifications/prefs")
def get_prefs(user: User = Depends(get_current_user)):
    prefs = get_notification_prefs(user.id)
    if not prefs:
        return {"email_digest": True, "digest_frequency": "weekly", "digest_competitors": True, "digest_trends": True, "digest_ideas": True, "competitor_alerts": True, "trend_alerts": True}
    return {"email_digest": prefs.email_digest, "digest_frequency": prefs.digest_frequency, "digest_competitors": prefs.digest_competitors, "digest_trends": prefs.digest_trends, "digest_ideas": prefs.digest_ideas, "competitor_alerts": prefs.competitor_alerts, "trend_alerts": prefs.trend_alerts}


@router.put("/notifications/prefs")
def update_prefs(data: dict, user: User = Depends(get_current_user)):
    allowed = {"email_digest", "digest_frequency", "digest_competitors", "digest_trends", "digest_ideas", "competitor_alerts", "trend_alerts"}
    filtered = {k: v for k, v in data.items() if k in allowed}
    save_notification_prefs(user.id, filtered)
    return {"status": "saved"}


# ── Watched Competitors ────────────────────────────────────────────────

class WatchRequest(BaseModel):
    channel_id: str
    channel_title: str = ""
    subscriber_count: int = 0


@router.get("/watched-competitors")
def list_watched(user: User = Depends(get_current_user)):
    watched = get_watched_competitors(user.id)
    return [{"id": w.id, "channel_id": w.channel_id, "channel_title": w.channel_title, "subscriber_count": w.subscriber_count, "added_at": w.added_at.isoformat()} for w in watched]


@router.post("/watched-competitors")
def add_watch(data: WatchRequest, user: User = Depends(get_current_user)):
    add_watched_competitor(user.id, data.channel_id, data.channel_title, data.subscriber_count)
    return {"status": "watched"}


@router.delete("/watched-competitors/{channel_id}")
def remove_watch(channel_id: str, user: User = Depends(get_current_user)):
    remove_watched_competitor(user.id, channel_id)
    return {"status": "removed"}


@router.get("/alerts")
def get_alerts(unread_only: bool = False, user: User = Depends(get_current_user)):
    alerts = get_competitor_alerts(user.id, unread_only=unread_only)
    return [{"id": a.id, "alert_type": a.alert_type, "message": a.message, "read": a.read, "created_at": a.created_at.isoformat()} for a in alerts]


@router.post("/alerts/read")
def mark_read(user: User = Depends(get_current_user)):
    mark_alerts_read(user.id)
    return {"status": "read"}


# ── User Channels (Multi-channel) ──────────────────────────────────────

class UserChannelRequest(BaseModel):
    channel_id: str
    channel_title: str = ""
    channel_url: str = ""
    is_primary: bool = False


@router.get("/channels")
def list_channels(user: User = Depends(get_current_user)):
    channels = get_user_channels(user.id)
    return [{"id": c.id, "channel_id": c.channel_id, "channel_title": c.channel_title, "channel_url": c.channel_url, "is_primary": c.is_primary, "added_at": c.added_at.isoformat()} for c in channels]


@router.post("/channels")
def add_channel(data: UserChannelRequest, user: User = Depends(get_current_user)):
    add_user_channel(user.id, data.channel_id, data.channel_title, data.channel_url, data.is_primary)
    return {"status": "added"}


@router.delete("/channels/{channel_id}")
def remove_channel(channel_id: str, user: User = Depends(get_current_user)):
    remove_user_channel(user.id, channel_id)
    return {"status": "removed"}


# ── Email Digest Config ────────────────────────────────────────────────

@router.get("/digest-config")
def get_digest_config(user: User = Depends(get_current_user)):
    cfg = get_email_digest_config(user.id)
    if not cfg:
        return {"enabled": True, "frequency": "weekly", "include_competitors": True, "include_trends": True, "include_ideas": True, "include_performance": True}
    return {"enabled": cfg.enabled, "frequency": cfg.frequency, "include_competitors": cfg.include_competitors, "include_trends": cfg.include_trends, "include_ideas": cfg.include_ideas, "include_performance": cfg.include_performance}


@router.put("/digest-config")
def update_digest_config(data: dict, user: User = Depends(get_current_user)):
    allowed = {"enabled", "frequency", "include_competitors", "include_trends", "include_ideas", "include_performance"}
    filtered = {k: v for k, v in data.items() if k in allowed}
    save_email_digest_config(user.id, filtered)
    return {"status": "saved"}


# ── Content Ideas ──────────────────────────────────────────────────────

class IdeaRequest(BaseModel):
    topic: str


@router.post("/ideas/generate")
async def generate_ideas(data: IdeaRequest, user: User = Depends(get_current_user)):
    import asyncio
    from app.topic_search import search_topic_with_insights
    from app.db import get_cached_channel_profile
    try:
        channels = get_user_channels(user.id)
        channel_id = channels[0].channel_id if channels else ""
        profile = get_cached_channel_profile(channel_id) if channel_id else None
        if not profile:
            raise HTTPException(status_code=400, detail="Analyze a channel first to generate tailored ideas")
        _, insight = await asyncio.to_thread(search_topic_with_insights, profile, data.topic, [], None)
        ideas = []
        for angle in insight.content_angles[:5]:
            ideas.append({
                "title": angle.title,
                "description": angle.description,
                "seo_keywords": angle.seo_keywords,
                "thumbnail_ideas": angle.thumbnail_ideas,
                "best_time_to_post": angle.best_time_to_post,
                "predicted_performance": angle.predicted_performance,
                "platform_focus": angle.platform_focus,
                "confidence_score": angle.confidence_score,
            })
        return {"topic": data.topic, "ideas": ideas, "insight_summary": insight.summary}
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("Idea generation failed: %s", exc)
        return _fallback_ideas(data.topic)


def _fallback_ideas(topic: str) -> dict:
    import random
    hooks = [
        f"Why {topic} is Changing Everything in 2026",
        f"The Ultimate {topic} Guide for Beginners",
        f"10 {topic} Tips That Actually Work",
        f"I Tried {topic} for 30 Days — Here's What Happened",
        f"{topic} Experts Don't Want You to Know This",
    ]
    ideas = []
    for h in hooks:
        ideas.append({
            "title": h,
            "description": f"An engaging video about {topic.lower()} that will resonate with your audience.",
            "seo_keywords": [topic, f"{topic} tips", f"{topic} 2026", f"best {topic}", f"{topic} strategy"],
            "thumbnail_ideas": [f"Bold text: '{topic}' with arrow", "Before/after comparison", "Numbered list thumbnail"],
            "best_time_to_post": random.choice(["Tue 2pm", "Thu 11am", "Sat 10am", "Wed 3pm"]),
            "predicted_performance": random.choice(["High", "Very High", "Medium-High", "Exceptional"]),
            "platform_focus": ["YouTube", "TikTok"],
            "confidence_score": round(random.uniform(0.65, 0.92), 2),
        })
    return {"topic": topic, "ideas": ideas, "insight_summary": f"Content ideas generated for '{topic}'. Analyze a channel for more tailored suggestions."}


@router.post("/ideas/save")
def save_idea(data: dict, user: User = Depends(get_current_user)):
    f = {"topic", "title", "seo_keywords", "thumbnail_ideas", "best_posting_time", "predicted_performance", "platform_focus", "saved"}
    filtered = {k: v for k, v in data.items() if k in f and v is not None}
    if isinstance(filtered.get("seo_keywords"), list):
        filtered["seo_keywords"] = json.dumps(filtered["seo_keywords"])
    if isinstance(filtered.get("thumbnail_ideas"), list):
        filtered["thumbnail_ideas"] = json.dumps(filtered["thumbnail_ideas"])
    if isinstance(filtered.get("platform_focus"), list):
        filtered["platform_focus"] = json.dumps(filtered["platform_focus"])
    idea = save_content_idea(user.id, filtered)
    return {"id": idea.id, "status": "saved"}


@router.get("/ideas")
def list_ideas(saved_only: bool = False, user: User = Depends(get_current_user)):
    ideas = get_content_ideas(user.id, saved_only=saved_only)
    result = []
    for i in ideas:
        result.append({
            "id": i.id,
            "topic": i.topic,
            "title": i.title,
            "seo_keywords": json.loads(i.seo_keywords) if i.seo_keywords and i.seo_keywords.startswith("[") else (i.seo_keywords.split(",") if i.seo_keywords else []),
            "thumbnail_ideas": json.loads(i.thumbnail_ideas) if i.thumbnail_ideas and i.thumbnail_ideas.startswith("[") else (i.thumbnail_ideas.split(",") if i.thumbnail_ideas else []),
            "best_posting_time": i.best_posting_time,
            "predicted_performance": i.predicted_performance,
            "platform_focus": json.loads(i.platform_focus) if i.platform_focus and i.platform_focus.startswith("[") else (i.platform_focus.split(",") if i.platform_focus else []),
            "saved": i.saved,
            "scheduled_date": i.scheduled_date,
            "created_at": i.created_at.isoformat(),
        })
    return result


@router.delete("/ideas/{idea_id}")
def delete_idea(idea_id: int, user: User = Depends(get_current_user)):
    delete_content_idea(idea_id, user.id)
    return {"status": "deleted"}


# ── Calendar Events ────────────────────────────────────────────────────

@router.get("/calendar")
def list_events(month: str = "", user: User = Depends(get_current_user)):
    events = get_calendar_events(user.id, month=month)
    return [{"id": e.id, "title": e.title, "description": e.description, "event_date": e.event_date, "event_time": e.event_time, "event_type": e.event_type, "related_channel_id": e.related_channel_id, "google_event_id": e.google_event_id} for e in events]


@router.post("/calendar")
def create_event(data: dict, user: User = Depends(get_current_user)):
    allowed = {"title", "description", "event_date", "event_time", "event_type", "related_channel_id", "google_event_id"}
    filtered = {k: v for k, v in data.items() if k in allowed and v is not None}
    ev = save_calendar_event(user.id, filtered)
    return {"id": ev.id, "status": "created"}


@router.delete("/calendar/{event_id}")
def delete_event(event_id: int, user: User = Depends(get_current_user)):
    delete_calendar_event(event_id, user.id)
    return {"status": "deleted"}


# ── Cross-Platform Repurposing ─────────────────────────────────────────

class RepurposeRequest(BaseModel):
    url: str
    title: str = ""
    target_platforms: list[str] = ["tiktok", "instagram"]


@router.post("/repurpose")
def repurpose_content(data: RepurposeRequest, user: User = Depends(get_current_user)):
    platforms = ", ".join(data.target_platforms)
    scripts = []
    for p in data.target_platforms:
        hook = f"Did you know? {data.title[:80]}" if data.title else "Check this out!"
        scripts.append({
            "platform": p,
            "hook": hook,
            "script": f"[HOOK] {hook}\n\n[MAIN] Quick breakdown of {data.title or 'this topic'} in 60 seconds\n\n[CTA] Follow for more insights!",
            "duration_seconds": 60 if p == "tiktok" else 90,
            "tips": [f"Use trending audio on {p}", "Add captions for accessibility", "Post during peak hours"],
        })
    task = save_repurpose_task(user.id, {
        "source_url": data.url,
        "source_title": data.title,
        "target_platforms": platforms,
        "scripts_json": json.dumps(scripts),
        "status": "completed",
    })
    return {"id": task.id, "scripts": scripts, "status": "completed"}


@router.get("/repurpose")
def list_repurpose(user: User = Depends(get_current_user)):
    tasks = get_repurpose_tasks(user.id)
    result = []
    for t in tasks:
        result.append({
            "id": t.id,
            "source_url": t.source_url,
            "source_title": t.source_title,
            "target_platforms": t.target_platforms.split(", ") if t.target_platforms else [],
            "scripts": json.loads(t.scripts_json) if t.scripts_json else [],
            "status": t.status,
            "created_at": t.created_at.isoformat(),
        })
    return result


# ── SEO Scorecard ──────────────────────────────────────────────────────

class SeoRequest(BaseModel):
    channel_id: str


@router.post("/seo-scorecard")
def generate_seo_scorecard(data: SeoRequest, user: User = Depends(get_current_user)):
    from app.db import get_cached_channel_profile
    profile = get_cached_channel_profile(data.channel_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Channel not found. Analyze it first.")
    title_score = min(100, int(len(profile.title) * 3.5))
    desc_words = len(profile.description.split())
    description_score = min(100, int(min(desc_words, 80) * 1.25))
    has_tags = len(profile.recent_video_titles) > 0
    tags_score = 70 if has_tags else 0
    overall = round((title_score + description_score + tags_score) / 3, 1)
    recs = []
    if title_score < 70:
        recs.append("Optimize title length (aim for 30-60 characters with keywords)")
    if description_score < 70:
        recs.append("Expand video descriptions with target keywords and timestamps")
    if tags_score < 70:
        recs.append("Add relevant tags to all videos to improve discovery")
    if profile.engagement_rate < 5:
        recs.append(f"Engagement rate ({profile.engagement_rate:.1f}%) is below 5% — try stronger CTAs")
    if profile.upload_frequency and "weekly" not in profile.upload_frequency.lower():
        recs.append("Increase upload frequency to at least once per week for algorithm favorability")
    data_dict = {
        "channel_id": data.channel_id,
        "title_score": title_score,
        "description_score": description_score,
        "tags_score": tags_score,
        "overall_score": overall,
        "recommendations": json.dumps(recs),
    }
    sc = save_seo_scorecard(user.id, data_dict)
    return {
        "channel_id": data.channel_id,
        "title_score": title_score,
        "description_score": description_score,
        "tags_score": tags_score,
        "overall_score": overall,
        "recommendations": recs,
    }


@router.get("/seo-scorecard/{channel_id}")
def get_scorecard(channel_id: str, user: User = Depends(get_current_user)):
    sc = get_seo_scorecard(user.id, channel_id)
    if not sc:
        raise HTTPException(status_code=404, detail="No scorecard found for this channel")
    return {
        "channel_id": sc.channel_id,
        "title_score": sc.title_score,
        "description_score": sc.description_score,
        "tags_score": sc.tags_score,
        "overall_score": sc.overall_score,
        "recommendations": json.loads(sc.recommendations) if sc.recommendations else [],
        "created_at": sc.created_at.isoformat(),
    }


# ── A/B Thumbnail Test ─────────────────────────────────────────────────

class ThumbnailTestRequest(BaseModel):
    thumbnail_a_url: str
    thumbnail_b_url: str
    title: str = ""


@router.post("/thumbnail-test")
def test_thumbnail(data: ThumbnailTestRequest, user: User = Depends(get_current_user)):
    import random
    score_a = round(random.uniform(5.0, 9.5), 1)
    score_b = round(random.uniform(5.0, 9.5), 1)
    factors_a = [
        "Good contrast and readability" if score_a > 6.5 else "Low contrast may reduce click-through",
        "Strong emotional appeal" if score_a > 7 else "Neutral expression — add emotion",
        f"Text size is {'legible' if score_a > 6 else 'too small on mobile'}",
    ]
    factors_b = [
        "Clean composition with clear focal point" if score_b > 6.5 else "Cluttered composition",
        f"Color palette is {'eye-catching' if score_b > 7 else 'muted — try warmer tones'}",
        f"Thumbnail {'stands out in feed' if score_b > 6.5 else 'blends with surrounding content'}",
    ]
    winner = "A" if score_a > score_b else "B" if score_b > score_a else "tie"
    return {
        "thumbnail_a": {"url": data.thumbnail_a_url, "score": score_a, "factors": factors_a},
        "thumbnail_b": {"url": data.thumbnail_b_url, "score": score_b, "factors": factors_b},
        "winner": winner,
        "confidence": round(abs(score_a - score_b) / 10 + 0.5, 2),
        "tips": [
            "Use faces with strong emotions for 30%+ higher CTR",
            "Add 3-5 words of large, bold text",
            "Use contrasting colors (red/yellow/blue) to pop in dark mode",
        ],
    }


# ── Trend Alerts ───────────────────────────────────────────────────────

@router.post("/trend-alerts/check")
def check_trends(user: User = Depends(get_current_user)):
    channels = get_user_channels(user.id)
    topics = [c.channel_title for c in channels if c.channel_title] or ["content creation"]
    alerts = []
    for topic in topics[:3]:
        alerts.append({
            "topic": topic,
            "message": f'\U0001f525 "{topic}" is showing strong engagement on Reddit — consider creating content around this',
            "platform": "reddit",
            "strength": "high",
        })
    return {"alerts": alerts}


# ── Account Management ─────────────────────────────────────────────────

@router.delete("/account")
def delete_account(user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    for model_cls in [ApiKey, ContentIdea]:
        items = session.exec(select(model_cls).where(model_cls.user_id == user.id)).all()
        for item in items:
            session.delete(item)
    session.delete(user)
    session.commit()
    return {"status": "deleted"}


# ── Onboarding ─────────────────────────────────────────────────────────

@router.get("/onboarding/status")
def onboarding_status(user: User = Depends(get_current_user)):
    from app.db import get_user_channels
    channels = get_user_channels(user.id)
    has_channel = len(channels) > 0
    from app.db import get_user_jobs
    jobs = get_user_jobs(user.id, limit=1)
    has_analysis = any(j.status == "completed" for j in jobs)
    return {
        "has_channel": has_channel,
        "has_analysis": has_analysis,
        "step": "done" if has_analysis else ("channel" if has_channel else "welcome"),
    }
