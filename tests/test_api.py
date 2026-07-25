from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app.db import init_db, reset_engine


# Ensure database is initialized before tests
reset_engine()
init_db()

client = TestClient(app)


def _register_and_get_token(email=None, password="testpass123"):
    import uuid
    email = email or f"test_{uuid.uuid4().hex[:8]}@test.com"
    resp = client.post(
        "/api/auth/register",
        json={"email": email, "password": password},
    )
    assert resp.status_code == 201
    return resp.json()["access_token"]


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_analyze_channel_invalid_url():
    token = _register_and_get_token()
    response = client.post(
        "/analyze-channel",
        json={"channel_url": "https://example.com/not-youtube"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 422


def test_analyze_channel_missing_url():
    token = _register_and_get_token()
    response = client.post(
        "/analyze-channel",
        json={},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 422


def test_find_competitors_no_profile():
    token = _register_and_get_token()
    response = client.post(
        "/find-competitors",
        json={"channel_id": "UCnonexistent12345678901234"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 400


def test_search_topic_no_profile():
    token = _register_and_get_token()
    response = client.post(
        "/search-topic",
        json={
            "channel_id": "UCnonexistent12345678901234",
            "topic": "test topic",
            "competitor_channel_ids": [],
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 400


def test_search_topic_missing_fields():
    token = _register_and_get_token()
    response = client.post(
        "/search-topic",
        json={"channel_id": "UCtest"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 422


def test_analyze_channel_without_auth():
    response = client.post(
        "/analyze-channel",
        json={"channel_url": "https://youtube.com/@test"},
    )
    assert response.status_code == 401


def test_find_competitors_without_auth():
    response = client.post(
        "/find-competitors",
        json={"channel_id": "UCtest123"},
    )
    assert response.status_code == 401


def test_search_topic_without_auth():
    response = client.post(
        "/search-topic",
        json={"channel_id": "UCtest123", "topic": "ai", "competitor_channel_ids": []},
    )
    assert response.status_code == 401


def test_auth_register_invalid_email():
    response = client.post(
        "/api/auth/register",
        json={"email": "not-an-email", "password": "testpass123"},
    )
    assert response.status_code == 422


def test_auth_register_valid():
    import uuid
    email = f"newuser_{uuid.uuid4().hex[:8]}@test.com"
    response = client.post(
        "/api/auth/register",
        json={"email": email, "password": "testpass123"},
    )
    assert response.status_code == 201
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == email
    assert data["user"]["plan"] == "free"


def test_auth_login_valid():
    import uuid
    email = f"login_{uuid.uuid4().hex[:8]}@test.com"
    client.post(
        "/api/auth/register",
        json={"email": email, "password": "testpass123"},
    )
    response = client.post(
        "/api/auth/login",
        json={"email": email, "password": "testpass123"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data


def test_auth_login_wrong_password():
    import uuid
    email = f"wrongpw_{uuid.uuid4().hex[:8]}@test.com"
    client.post(
        "/api/auth/register",
        json={"email": email, "password": "correctpass"},
    )
    response = client.post(
        "/api/auth/login",
        json={"email": email, "password": "wrongpass"},
    )
    assert response.status_code == 401


def test_auth_me_without_token():
    response = client.get("/api/auth/me")
    assert response.status_code == 401


def test_auth_me_with_token():
    import uuid
    email = f"meuser_{uuid.uuid4().hex[:8]}@test.com"
    reg = client.post(
        "/api/auth/register",
        json={"email": email, "password": "testpass123"},
    )
    token = reg.json()["access_token"]
    response = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert response.json()["email"] == email


def test_billing_usage_without_auth():
    response = client.get("/api/billing/usage")
    assert response.status_code == 401


def test_billing_usage_with_auth():
    token = _register_and_get_token()
    response = client.get(
        "/api/billing/usage",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["plan"] == "free"
    assert data["limit"] == 3
