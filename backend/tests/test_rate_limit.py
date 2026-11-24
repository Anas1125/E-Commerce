import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.exc import OperationalError
from starlette.responses import JSONResponse

from app.models.rate_limit import RateLimitBucket
from app.services import rate_limit as service


@pytest.fixture
def engine():
    engine = create_engine("sqlite://")
    RateLimitBucket.__table__.create(engine)
    yield engine
    engine.dispose()


def request(path="/api/auth/login", method="POST", headers=None, host="192.0.2.1"):
    return SimpleNamespace(
        method=method, url=SimpleNamespace(path=path),
        headers=headers or {}, client=SimpleNamespace(host=host),
    )


def test_limit_persists_between_sessions_and_resets(engine):
    rule = service.Rule("test", 2, 60)
    with Session(engine) as db:
        assert service.consume(db, rule, "a", 121) == 0
        db.commit()
    with Session(engine) as db:
        assert service.consume(db, rule, "a", 122) == 0
        assert service.consume(db, rule, "a", 123) == 57
        assert service.consume(db, rule, "b", 123) == 0
        assert service.consume(db, rule, "a", 180) == 0
        db.commit()


@pytest.mark.parametrize("path,scope,limit", [
    ("/api/auth/login", "login", 5),
    ("/api/auth/register/", "register", 5),
    ("/api/auth/forgot-password", "forgot", 3),
    ("/api/auth/reset-password", "reset", 5),
    ("/api/coupons/validate", "coupon", 20),
    ("/api/orders/", "order", 10),
    ("/api/payments/", "payment-create", 10),
])
def test_sensitive_rules(path, scope, limit):
    general, specific = service.rules_for("POST", path)
    assert general.limit == 120
    assert (specific.scope, specific.limit) == (scope, limit)


def test_exemptions_and_general_rule():
    assert service.rules_for("OPTIONS", "/api/auth/login") == ()
    assert service.rules_for("GET", "/api/cron/expire-upi-orders") == ()
    assert service.rules_for("GET", "/uploads/example.webp") == ()
    assert service.rules_for("GET", "/api/products/") == (service.GENERAL,)


def test_local_ignores_spoofed_headers(monkeypatch):
    monkeypatch.delenv("VERCEL", raising=False)
    assert service.client_key(request()) == service.client_key(request(headers={
        "x-forwarded-for": "192.0.2.99", "x-vercel-forwarded-for": "192.0.2.99",
    }))
    assert service.client_key(request()) != service.client_key(request(host="192.0.2.2"))


def test_vercel_trusted_header_and_ipv6_grouping(monkeypatch):
    monkeypatch.setenv("VERCEL", "1")
    def key(ip):
        return service.client_key(request(headers={"x-vercel-forwarded-for": ip}))
    assert key("2001:db8:1:2::1") == key("2001:db8:1:2::99")
    assert key("192.0.2.1") != key("192.0.2.2")
    assert key("invalid") == key("also-invalid")


def test_middleware_rejects_over_limit(monkeypatch):
    monkeypatch.setenv("RATE_LIMIT_ENABLED", "true")
    monkeypatch.setattr(service, "check_limits", lambda *args: 45)
    downstream = AsyncMock()
    result = asyncio.run(service.rate_limit_middleware(request(), downstream))
    assert result.status_code == 429
    assert result.headers["retry-after"] == "45"
    downstream.assert_not_called()


def test_middleware_passes_allowed_and_disabled(monkeypatch):
    downstream = AsyncMock(return_value=JSONResponse({"ok": True}))
    monkeypatch.setenv("RATE_LIMIT_ENABLED", "false")
    assert asyncio.run(service.rate_limit_middleware(request(), downstream)).status_code == 200
    monkeypatch.setenv("RATE_LIMIT_ENABLED", "true")
    monkeypatch.setattr(service, "check_limits", lambda *args: 0)
    assert asyncio.run(service.rate_limit_middleware(request(), downstream)).status_code == 200


def test_database_failure_fails_closed(monkeypatch):
    monkeypatch.setenv("RATE_LIMIT_ENABLED", "true")
    def fail(*args):
        raise OperationalError("test", {}, Exception("unavailable"))
    monkeypatch.setattr(service, "check_limits", fail)
    downstream = AsyncMock()
    result = asyncio.run(service.rate_limit_middleware(request(), downstream))
    assert result.status_code == 503
    downstream.assert_not_called()
