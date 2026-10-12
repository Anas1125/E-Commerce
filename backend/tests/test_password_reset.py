from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.routers import auth as auth_router


class FakeDB:
    def __init__(self, token):
        self.token = token

    def scalar(self, statement):
        return self.token


@pytest.mark.parametrize("use_naive_datetime", [False, True])
def test_valid_reset_token_accepts_future_expiry(
    monkeypatch, use_naive_datetime
):
    now = datetime(2026, 10, 12, 6, 0, tzinfo=timezone.utc)
    expires_at = now + timedelta(minutes=10)

    if use_naive_datetime:
        expires_at = expires_at.replace(tzinfo=None)

    token = SimpleNamespace(
        expires_at=expires_at,
        used=False,
    )

    monkeypatch.setattr(auth_router, "_utcnow", lambda: now)

    result = auth_router._get_valid_reset_token(
        FakeDB(token),
        "test-token",
    )

    assert result is token


@pytest.mark.parametrize("use_naive_datetime", [False, True])
def test_expired_reset_token_is_rejected(
    monkeypatch, use_naive_datetime
):
    now = datetime(2026, 10, 12, 6, 0, tzinfo=timezone.utc)
    expires_at = now - timedelta(seconds=1)

    if use_naive_datetime:
        expires_at = expires_at.replace(tzinfo=None)

    token = SimpleNamespace(
        expires_at=expires_at,
        used=False,
    )

    monkeypatch.setattr(auth_router, "_utcnow", lambda: now)

    with pytest.raises(HTTPException) as exc:
        auth_router._get_valid_reset_token(
            FakeDB(token),
            "test-token",
        )

    assert exc.value.status_code == 400
    assert "expired" in exc.value.detail.lower()


def test_used_reset_token_is_rejected(monkeypatch):
    token = SimpleNamespace(
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
        used=True,
    )

    monkeypatch.setattr(
        auth_router,
        "_utcnow",
        lambda: datetime.now(timezone.utc),
    )

    with pytest.raises(HTTPException) as exc:
        auth_router._get_valid_reset_token(
            FakeDB(token),
            "test-token",
        )

    assert exc.value.status_code == 400
    assert "already been used" in exc.value.detail.lower()
