from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from fastapi import HTTPException, Response

from app.routers import auth
from app.services import cookie_session, dependencies, security, rate_limit

SECRET = "test-proxy-secret-value-" * 3
ORIGIN = "https://e-commerce-3q5.pages.dev"


@pytest.fixture(autouse=True)
def configure(monkeypatch):
    monkeypatch.setenv("STORE_PROXY_SECRET", SECRET)
    monkeypatch.setenv("COOKIE_AUTH_ORIGINS", ORIGIN)
    monkeypatch.delenv("DISABLE_BEARER_AUTH", raising=False)


def request(role="customer", origin=ORIGIN, secret=SECRET, method="POST", cookies=None):
    return SimpleNamespace(
        method=method, cookies=cookies or {},
        headers={"x-session-role": role, "origin": origin, "x-store-proxy-secret": secret},
    )


@pytest.mark.parametrize("role", ["customer", "admin"])
def test_login_cookie_flags_and_no_token_body(monkeypatch, role):
    user = SimpleNamespace(id=13, role=role, is_active=True)
    monkeypatch.setattr(auth, "_authenticate", lambda *args: user)
    response = Response()
    result = auth.login_session(
        auth.CookieLogin(email="test@example.com", password="dummy", role=role, remember=True),
        request(role), response, Mock(),
    )
    assert result is user
    cookie = response.headers["set-cookie"]
    assert cookie.startswith(cookie_session.cookie_name(role) + "=")
    assert "HttpOnly" in cookie and "Secure" in cookie and "SameSite=lax" in cookie
    assert "Path=/" in cookie and "Domain=" not in cookie
    assert ("Max-Age=" in cookie) == (role == "customer")


@pytest.mark.parametrize("origin,secret", [("https://other.example", SECRET), ("", SECRET), (ORIGIN, "wrong")])
def test_login_rejects_csrf_and_direct_access(origin, secret):
    with pytest.raises(HTTPException) as exc:
        auth.login_session(
            auth.CookieLogin(email="test@example.com", password="dummy", role="customer"),
            request(origin=origin, secret=secret), Response(), Mock(),
        )
    assert exc.value.status_code == 403


def test_wrong_role_cannot_login(monkeypatch):
    monkeypatch.setattr(auth, "_authenticate", lambda *args: SimpleNamespace(role="customer"))
    with pytest.raises(HTTPException) as exc:
        auth.login_session(
            auth.CookieLogin(email="test@example.com", password="dummy", role="admin"),
            request("admin"), Response(), Mock(),
        )
    assert exc.value.status_code == 403


def test_session_role_isolation():
    token = security.create_access_token(13, "customer", cookie=True)
    db = Mock()
    db.scalar.return_value = SimpleNamespace(role="customer", is_active=True)
    req = request(cookies={cookie_session.cookie_name("customer"): token})
    credentials = dependencies.resolve_credentials(req, None)
    assert dependencies.get_current_user(credentials, db) is db.scalar.return_value
    req.headers["x-session-role"] = "admin"
    with pytest.raises(HTTPException) as exc:
        dependencies.resolve_credentials(req, None)
    assert exc.value.status_code == 401


def test_cookie_token_cannot_be_used_as_bearer():
    token = security.create_access_token(13, "customer", cookie=True)
    from fastapi.security import HTTPAuthorizationCredentials
    with pytest.raises(HTTPException) as exc:
        dependencies.get_current_user(HTTPAuthorizationCredentials(scheme="Bearer", credentials=token), Mock())
    assert exc.value.status_code == 401


def test_cookie_mutation_rejects_wrong_origin():
    req = request(origin="https://other.example", cookies={"__Host-store-customer": "dummy"})
    with pytest.raises(HTTPException) as exc:
        dependencies.resolve_credentials(req, None)
    assert exc.value.status_code == 403


def test_logout_clears_only_selected_cookie():
    response = auth.logout_session(request("admin"))
    assert response.status_code == 204
    assert response.headers["set-cookie"].startswith("__Host-store-admin=")
    assert "Max-Age=0" in response.headers["set-cookie"]
    assert "__Host-store-customer" not in response.headers["set-cookie"]


def test_bearer_can_be_disabled(monkeypatch):
    monkeypatch.setenv("DISABLE_BEARER_AUTH", "true")
    from fastapi.security import HTTPAuthorizationCredentials
    with pytest.raises(HTTPException) as exc:
        dependencies.resolve_credentials(request(), HTTPAuthorizationCredentials(scheme="Bearer", credentials="dummy"))
    assert exc.value.status_code == 401


def test_proxy_ip_is_authenticated(monkeypatch):
    monkeypatch.setenv("VERCEL", "1")
    req = request()
    req.headers.update({"x-store-client-ip": "192.0.2.1", "x-vercel-forwarded-for": "192.0.2.2"})
    key = rate_limit.client_key(req)
    req.headers["x-store-proxy-secret"] = "wrong"
    assert rate_limit.client_key(req) != key
    assert rate_limit.rules_for("POST", "/api/auth/session/login")[1] == rate_limit.POST_RULES["/api/auth/login"]
