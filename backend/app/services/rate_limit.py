"""Shared fixed-window API rate limits. No process-local counters."""
import hashlib
import hmac
import ipaddress
import logging
import os
import time
from dataclasses import dataclass

from sqlalchemy import delete
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.exc import SQLAlchemyError
from starlette.concurrency import run_in_threadpool
from starlette.responses import JSONResponse

from app.database import SessionLocal
from app.models.rate_limit import RateLimitBucket
from app.services.security import JWT_SECRET_KEY

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class Rule:
    scope: str
    limit: int
    seconds: int


GENERAL = Rule("api", 120, 60)
POST_RULES = {
    "/api/auth/login": Rule("login", 5, 900),
    "/api/auth/register": Rule("register", 5, 3600),
    "/api/auth/forgot-password": Rule("forgot", 3, 900),
    "/api/auth/reset-password": Rule("reset", 5, 900),
    "/api/auth/validate-reset-token": Rule("validate-reset", 20, 900),
    "/api/coupons/validate": Rule("coupon", 20, 60),
    "/api/orders": Rule("order", 10, 60),
    "/api/payments": Rule("payment-create", 10, 60),
    "/api/payments/complete": Rule("payment-complete", 20, 60),
    "/api/payments/fail": Rule("payment-fail", 20, 60),
    "/api/payments/status": Rule("payment-status", 30, 60),
}


def rate_limits_enabled():
    # Deploy the migration before switching this on in production.
    return os.getenv("RATE_LIMIT_ENABLED", "").strip().lower() in {"1", "true", "yes"}


def rules_for(method, path):
    path = path.rstrip("/")
    if method == "OPTIONS" or not path.startswith("/api/"):
        return ()
    if path == "/api/cron/expire-upi-orders":
        return ()  # Independently protected by CRON_SECRET.
    specific = POST_RULES.get(path) if method == "POST" else None
    return (GENERAL, specific) if specific else (GENERAL,)


def client_key(request):
    # Vercel sets x-vercel-forwarded-for at its trusted edge. Never
    # trust arbitrary forwarding headers when running locally.
    raw = (request.headers.get("x-vercel-forwarded-for") if os.getenv("VERCEL")
           else (request.client.host if request.client else None))
    try:
        ip = ipaddress.ip_address(raw or "")
        if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped:
            ip = ip.ipv4_mapped
        identity = (str(ipaddress.ip_network(f"{ip}/64", strict=False))
                    if ip.version == 6 else str(ip))
    except ValueError:
        # Unknown clients share a conservative bucket, not an arbitrary
        # caller-controlled key.
        identity = "unknown"
    return hmac.new(
        JWT_SECRET_KEY.encode(), ("api-rate-limit:" + identity).encode(), hashlib.sha256
    ).hexdigest()


def consume(db, rule, key, now):
    """Atomically consume one slot. Return seconds to retry, or zero."""
    start = (now // rule.seconds) * rule.seconds
    end = start + rule.seconds
    table = RateLimitBucket.__table__
    insert = sqlite_insert if db.get_bind().dialect.name == "sqlite" else pg_insert
    statement = insert(table).values(
        scope=rule.scope, client_key=key, window_start=start,
        expires_at=end, hits=1,
    )
    statement = statement.on_conflict_do_update(
        index_elements=[table.c.scope, table.c.client_key, table.c.window_start],
        set_={"hits": table.c.hits + 1},
        where=table.c.hits < rule.limit,
    ).returning(table.c.hits)
    allowed = db.scalar(statement)
    return 0 if allowed is not None else max(1, end - now)


def check_limits(rules, key):
    now = int(time.time())
    with SessionLocal() as db:
        retry = 0
        for rule in rules:
            retry = consume(db, rule, key, now)
            if retry:
                break
        db.commit()
        return retry


async def rate_limit_middleware(request, call_next):
    if not rate_limits_enabled():
        return await call_next(request)
    rules = rules_for(request.method, request.url.path)
    if not rules:
        return await call_next(request)
    try:
        retry = await run_in_threadpool(check_limits, rules, client_key(request))
    except SQLAlchemyError:
        logger.exception("Rate limiter database unavailable")
        return JSONResponse(
            {"detail": "Service temporarily unavailable. Please retry."},
            status_code=503, headers={"Retry-After": "30", "Cache-Control": "no-store"},
        )
    if retry:
        return JSONResponse(
            {"detail": "Too many requests. Please try again later."},
            status_code=429, headers={"Retry-After": str(retry), "Cache-Control": "no-store"},
        )
    return await call_next(request)


def cleanup_expired_buckets():
    """Called by the existing authenticated daily cron; no extra cron needed."""
    try:
        with SessionLocal() as db:
            db.execute(delete(RateLimitBucket).where(
                RateLimitBucket.expires_at < int(time.time()) - 3600
            ))
            db.commit()
    except SQLAlchemyError:
        logger.exception("Rate limiter cleanup failed")
