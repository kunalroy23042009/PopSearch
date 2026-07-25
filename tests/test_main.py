"""Smoke tests for the FastAPI app."""

import pytest
from unittest.mock import patch
import httpx

from app.main import app


@pytest.mark.asyncio
async def test_health_endpoint():
    """GET /health should return 200 with status ok."""
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_analyze_channel_returns_job_id():
    """POST /analyze-channel now returns a job_id for async processing."""
    from app.auth import create_access_token
    from app.db import get_session, User
    from sqlmodel import select

    import uuid
    email = f"analyze_async_{uuid.uuid4().hex[:8]}@test.com"
    token = create_access_token({"sub": email})

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        with next(get_session()) as session:
            existing = session.exec(select(User).where(User.email == email)).first()
            if not existing:
                session.add(User(email=email, hashed_password="fake", plan="free"))
                session.commit()

        response = await client.post(
            "/analyze-channel",
            json={"channel_url": "https://www.youtube.com/@test"},
            headers={"Authorization": f"Bearer {token}"},
        )
        # Returns job_id immediately (async)
        assert response.status_code == 200
        data = response.json()
        assert "job_id" in data
        assert "status_url" in data


@pytest.mark.asyncio
async def test_search_topic_missing_fields():
    """POST /search-topic with missing required fields should return 422."""
    from app.auth import create_access_token

    import uuid
    email = f"search_fields_{uuid.uuid4().hex[:8]}@test.com"
    token = create_access_token({"sub": email})

    from app.db import get_session, User
    from sqlmodel import select
    with next(get_session()) as session:
        existing = session.exec(select(User).where(User.email == email)).first()
        if not existing:
            session.add(User(email=email, hashed_password="fake", plan="free"))
            session.commit()

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        headers = {"Authorization": f"Bearer {token}"}

        # Missing channel_id
        response = await client.post("/search-topic", json={"topic": "test"}, headers=headers)
        assert response.status_code == 422

        # Missing topic
        response = await client.post("/search-topic", json={"channel_id": "UC123"}, headers=headers)
        assert response.status_code == 422

        # Missing both
        response = await client.post("/search-topic", json={}, headers=headers)
        assert response.status_code == 422


@pytest.mark.asyncio
async def test_protected_endpoints_without_auth():
    """Protected endpoints should return 401 without auth token."""
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/analyze-channel", json={"channel_url": "https://www.youtube.com/@test"})
        assert response.status_code == 401

        response = await client.post("/find-competitors", json={"channel_id": "UCtest"})
        assert response.status_code == 401

        response = await client.post("/search-topic", json={"channel_id": "UCtest", "topic": "ai", "competitor_channel_ids": []})
        assert response.status_code == 401

        response = await client.post("/multi-source-search", json={"channel_id": "UCtest", "topic": "ai"})
        assert response.status_code == 401

        response = await client.post("/dashboard", json={"channel_url": "https://www.youtube.com/@test"})
        assert response.status_code == 401
