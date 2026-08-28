"""Verify high-risk route classification, rate limits, and security headers."""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from fastapi import Request  # noqa: E402
from fastapi.responses import JSONResponse  # noqa: E402
from middlewares.request_security import InMemoryRateLimiter, RedisRateLimiter, apply_security_headers, resolve_rate_limit_rule  # noqa: E402


def request_for_headers() -> Request:
    return Request({"type": "http", "method": "GET", "path": "/health", "headers": [], "client": ("127.0.0.1", 12345)})


async def verify_limiter() -> None:
    auth = resolve_rate_limit_rule("POST", "/api/v1/auth/local/login")
    download = resolve_rate_limit_rule("POST", "/api/v1/content-downloads/assets/a/ticket")
    template = resolve_rate_limit_rule("PUT", "/api/template-snapshot/templates/a")
    assert auth and auth.limit == 10
    assert download and download.limit == 30
    assert template and template.limit == 60
    assert resolve_rate_limit_rule("GET", "/api/v1/platform/tree") is None
    limiter = InMemoryRateLimiter()
    for index in range(auth.limit):
        assert (await limiter.allow("auth:127.0.0.1", auth, now=float(index)))[0]
    allowed, retry_after = await limiter.allow("auth:127.0.0.1", auth, now=10.0)
    assert not allowed and retry_after > 0

    class FakeRedis:
        def __init__(self): self.values = {}
        async def incr(self, key): self.values[key] = self.values.get(key, 0) + 1; return self.values[key]
        async def expire(self, key, seconds): return True

    shared = RedisRateLimiter(FakeRedis())
    shared_rule = resolve_rate_limit_rule("POST", "/api/v1/auth/local/login")
    assert shared_rule
    for _ in range(shared_rule.limit):
        assert (await shared.allow("client-a", shared_rule))[0]
    assert not (await shared.allow("client-a", shared_rule))[0]


def main() -> int:
    asyncio.run(verify_limiter())
    response = apply_security_headers(request_for_headers(), JSONResponse({"ok": True}))
    for name in ("X-Content-Type-Options", "X-Frame-Options", "Referrer-Policy", "Permissions-Policy", "Content-Security-Policy"):
        assert name in response.headers
    print("Request security controls: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
