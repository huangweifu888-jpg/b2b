"""Sensitive-route rate limiting and credential-free security response headers."""

from __future__ import annotations

import asyncio
from collections import defaultdict, deque
from dataclasses import dataclass
import hashlib
import os
import time
from typing import Deque

from fastapi import Request
from fastapi.responses import JSONResponse, Response
from starlette.middleware.base import BaseHTTPMiddleware


@dataclass(frozen=True)
class RateLimitRule:
    name: str
    limit: int
    window_seconds: int


def _limit_from_env(name: str, default: int) -> int:
    try:
        value = int(os.getenv(name, str(default)))
    except ValueError:
        return default
    return value if value > 0 else default


def _auth_rule() -> RateLimitRule:
    return RateLimitRule("auth", _limit_from_env("RATE_LIMIT_AUTH_PER_MINUTE", 10), 60)


def _download_rule() -> RateLimitRule:
    return RateLimitRule("download_ticket", _limit_from_env("RATE_LIMIT_DOWNLOAD_TICKETS_PER_MINUTE", 30), 60)


def _template_rule() -> RateLimitRule:
    return RateLimitRule("template_mutation", _limit_from_env("RATE_LIMIT_TEMPLATE_MUTATIONS_PER_MINUTE", 60), 60)


def resolve_rate_limit_rule(method: str, path: str) -> RateLimitRule | None:
    if path in {"/api/v1/auth/local/login", "/api/v1/auth/local/register", "/api/v1/auth/login"}:
        return _auth_rule()
    if method.upper() == "POST" and ("/tickets/" in path or path.endswith("/ticket")):
        return _download_rule()
    if path.startswith("/api/template-snapshot") and method.upper() in {"POST", "PUT", "PATCH", "DELETE"}:
        return _template_rule()
    return None


class InMemoryRateLimiter:
    """A process-local sliding-window limiter for development and single-process use."""

    def __init__(self) -> None:
        self._events: dict[str, Deque[float]] = defaultdict(deque)
        self._lock = asyncio.Lock()

    async def allow(self, key: str, rule: RateLimitRule, *, now: float | None = None) -> tuple[bool, int]:
        current = time.monotonic() if now is None else now
        async with self._lock:
            events = self._events[key]
            while events and events[0] <= current - rule.window_seconds:
                events.popleft()
            if len(events) >= rule.limit:
                retry_after = max(1, int(rule.window_seconds - (current - events[0])) + 1)
                return False, retry_after
            events.append(current)
            return True, 0


class RedisRateLimiter:
    """Shared fixed-window limiter. Keys hash client identity and never store raw IP addresses."""

    def __init__(self, client) -> None:
        self.client = client

    async def allow(self, identity: str, rule: RateLimitRule) -> tuple[bool, int]:
        now = int(time.time())
        bucket = now // rule.window_seconds
        identity_hash = hashlib.sha256(identity.encode("utf-8")).hexdigest()[:24]
        key = f"b2b:rate-limit:{rule.name}:{bucket}:{identity_hash}"
        count = await self.client.incr(key)
        if count == 1:
            await self.client.expire(key, rule.window_seconds + 1)
        retry_after = max(1, rule.window_seconds - (now % rule.window_seconds))
        return count <= rule.limit, retry_after


_redis_client = None
_redis_url: str | None = None


def rate_limit_backend() -> str:
    configured = os.getenv("RATE_LIMIT_BACKEND", "").strip().lower()
    if configured in {"memory", "redis"}:
        return configured
    return "redis" if os.getenv("ENVIRONMENT", "dev").lower() in {"staging", "production"} else "memory"


async def redis_rate_limiter() -> RedisRateLimiter:
    global _redis_client, _redis_url
    url = os.getenv("REDIS_URL", "").strip()
    if not url:
        raise RuntimeError("Redis URL is not configured")
    if _redis_client is None or _redis_url != url:
        import redis.asyncio as redis

        _redis_client = redis.from_url(url, encoding="utf-8", decode_responses=True, socket_connect_timeout=2, socket_timeout=2)
        _redis_url = url
    await _redis_client.ping()
    return RedisRateLimiter(_redis_client)


async def rate_limit_backend_health() -> str:
    backend = rate_limit_backend()
    if backend == "memory":
        return "memory-local"
    try:
        await redis_rate_limiter()
        return "redis-ready"
    except Exception:
        return "redis-unavailable"


def client_identity(request: Request) -> str:
    """Do not trust forwarded headers unless the deployment explicitly enables it."""
    if os.getenv("TRUST_PROXY_HEADERS", "").lower() in {"1", "true", "yes"}:
        forwarded = request.headers.get("x-forwarded-for", "").split(",", 1)[0].strip()
        if forwarded:
            return forwarded
    return request.client.host if request.client else "unknown"


def apply_security_headers(request: Request, response: Response) -> Response:
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    response.headers.setdefault("Permissions-Policy", "camera=(), geolocation=(), microphone=()")
    response.headers.setdefault("Content-Security-Policy", "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'")
    environment = os.getenv("ENVIRONMENT", "production").lower()
    forwarded_proto = request.headers.get("x-forwarded-proto", "").lower()
    if environment in {"staging", "production"} and forwarded_proto == "https":
        response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
    return response


class RequestSecurityMiddleware(BaseHTTPMiddleware):
    """Apply security headers globally and limit the high-risk request classes."""

    def __init__(self, app) -> None:
        super().__init__(app)
        self.memory_limiter = InMemoryRateLimiter()

    async def dispatch(self, request: Request, call_next):
        rule = resolve_rate_limit_rule(request.method, request.url.path)
        if rule:
            identity = client_identity(request)
            backend = rate_limit_backend()
            try:
                if backend == "redis":
                    allowed, retry_after = await (await redis_rate_limiter()).allow(identity, rule)
                else:
                    allowed, retry_after = await self.memory_limiter.allow(f"{rule.name}:{identity}", rule)
            except Exception:
                if os.getenv("ENVIRONMENT", "dev").lower() in {"staging", "production"}:
                    return apply_security_headers(
                        request,
                        JSONResponse(status_code=503, content={"detail": "Rate limit service is temporarily unavailable."}, headers={"Retry-After": "30"}),
                    )
                allowed, retry_after = await self.memory_limiter.allow(f"{rule.name}:{identity}", rule)
            if not allowed:
                return apply_security_headers(
                    request,
                    JSONResponse(
                        status_code=429,
                        content={"detail": "Too many requests. Please retry later."},
                        headers={"Retry-After": str(retry_after)},
                    ),
                )
        response = await call_next(request)
        return apply_security_headers(request, response)
