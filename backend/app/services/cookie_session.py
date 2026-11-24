"""Trust the storefront proxy, not browser-supplied forwarding headers."""
import hmac
import os

from fastapi import HTTPException


def cookie_enabled():
    return len(os.getenv("STORE_PROXY_SECRET", "")) >= 32


def bearer_disabled():
    return os.getenv("DISABLE_BEARER_AUTH", "").lower() in {"true", "1", "yes"}


def trusted_proxy(request):
    secret = os.getenv("STORE_PROXY_SECRET", "")
    supplied = request.headers.get("x-store-proxy-secret", "")
    return len(secret) >= 32 and hmac.compare_digest(secret.encode(), supplied.encode())


def require_proxy(request):
    if not trusted_proxy(request):
        raise HTTPException(403, "Use the storefront API")


def session_role(request):
    role = request.headers.get("x-session-role")
    if role not in {"customer", "admin"}:
        raise HTTPException(400, "Invalid session role")
    return role


def cookie_name(role):
    return "__Host-store-" + role


def require_same_origin(request, *, always=False):
    if not always and request.method in {"GET", "HEAD", "OPTIONS"}:
        return
    allowed = {
        value.strip().rstrip("/") for value in
        os.getenv("COOKIE_AUTH_ORIGINS", "https://e-commerce-3q5.pages.dev").split(",")
        if value.strip()
    }
    if request.headers.get("origin") not in allowed:
        raise HTTPException(403, "Invalid request origin")
