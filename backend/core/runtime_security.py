"""Runtime security boundaries shared by the API and local development tools."""

from __future__ import annotations

import os

from fastapi import HTTPException, Request, status

from core.config import settings


_LOCAL_ORIGINS = ("http://127.0.0.1:3003", "http://localhost:3003")
_LOCAL_HOSTS = frozenset({"127.0.0.1", "::1", "localhost"})


def cors_allowed_origins() -> list[str]:
    """Return an explicit browser-origin allowlist; wildcards are never implied."""
    configured = os.getenv("CORS_ALLOWED_ORIGINS", "").strip()
    if configured:
        return [origin.strip().rstrip("/") for origin in configured.split(",") if origin.strip()]
    return list(_LOCAL_ORIGINS) if settings.is_development_environment else []


def cors_configuration_errors() -> list[str]:
    """Report only policy failures, never credentials or request metadata."""
    if settings.is_development_environment:
        return []
    origins = cors_allowed_origins()
    if not origins:
        return ["CORS_ALLOWED_ORIGINS:missing"]
    if "*" in origins:
        return ["CORS_ALLOWED_ORIGINS:wildcard-forbidden"]
    if any(not origin.startswith("https://") for origin in origins):
        return ["CORS_ALLOWED_ORIGINS:https-required"]
    return []


async def require_local_development_request(request: Request) -> None:
    """Keep filesystem and process-control tools unavailable beyond local development."""
    client_host = request.client.host if request.client else ""
    if not settings.is_development_environment or client_host not in _LOCAL_HOSTS:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
