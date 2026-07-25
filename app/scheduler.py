from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

from sqlmodel import Session, select

from app import db
from app.config import settings
from app.email_templates import render_weekly_report, render_alert_email

logger = logging.getLogger(__name__)


async def run_daily_snapshots() -> None:
    logger.info("Running daily channel snapshots...")

    channels = []
    with Session(db._get_engine()) as session:
        statement = select(db.Channel)
        channels = list(session.exec(statement).all())[:50]

    for channel in channels:
        try:
            profile = db._deserialize_profile(channel.profile_json)
            db.save_channel_snapshot(
                channel_id=profile.channel_id,
                subscriber_count=profile.subscriber_count,
                view_count=profile.view_count,
                video_count=profile.video_count,
                engagement_rate=profile.engagement_rate,
            )
        except Exception as exc:
            logger.warning("Snapshot failed for %s: %s", channel.channel_id, exc)

    logger.info("Daily snapshots complete — %d channels processed", len(channels))


async def run_weekly_email_reports() -> None:
    logger.info("Running weekly email reports...")

    if not settings.SENDGRID_API_KEY:
        logger.info("SendGrid not configured — skipping email reports")
        return

    users = []
    with Session(db._get_engine()) as session:
        statement = select(db.User).where(db.User.plan.in_(["pro", "business"]))
        users = list(session.exec(statement).all())

    for user in users:
        try:
            reports = db.get_user_reports(user.id, limit=5)
            if not reports:
                continue

            email_data = []
            for report in reports:
                email_data.append({
                    "channel_url": report.channel_url,
                    "channel_title": report.channel_title,
                    "topic": report.topic,
                    "created_at": report.created_at.isoformat(),
                })

            _send_email(
                to_email=user.email,
                subject="Your Weekly Creator Content Radar Report",
                html_body=render_weekly_report({"reports": email_data, "plan": user.plan}),
            )
        except Exception as exc:
            logger.warning("Weekly report failed for user %d: %s", user.id, exc)

    logger.info("Weekly email reports sent to %d users", len(users))


def send_alert_email(to_email: str, alert_type: str, message: str) -> None:
    if not settings.SENDGRID_API_KEY:
        logger.info("Alert email not sent (SendGrid not configured): %s", alert_type)
        return
    html = render_alert_email(alert_type, message)
    _send_email(
        to_email=to_email,
        subject=f"Alert: {alert_type.replace('_', ' ').title()}",
        html_body=html,
    )


def _send_email(to_email: str, subject: str, html_body: str) -> None:
    if not settings.SENDGRID_API_KEY:
        logger.info("Email not sent (SendGrid not configured): %s -> %s", subject, to_email)
        return
    try:
        import httpx
        response = httpx.post(
            "https://api.sendgrid.com/v3/mail/send",
            headers={
                "Authorization": f"Bearer {settings.SENDGRID_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "personalizations": [{"to": [{"email": to_email}]}],
                "from": {"email": settings.FROM_EMAIL, "name": settings.FROM_NAME},
                "subject": subject,
                "content": [{"type": "text/html", "value": html_body}],
            },
            timeout=15.0,
        )
        if response.status_code not in (200, 201, 202):
            logger.warning("SendGrid returned %d: %s", response.status_code, response.text[:200])
    except Exception as exc:
        logger.warning("Failed to send email via SendGrid: %s", exc)
