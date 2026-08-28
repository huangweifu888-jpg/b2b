"""Deployment-readiness checks that expose configuration state without secrets."""

from __future__ import annotations

import os
from pathlib import Path, PurePosixPath, PureWindowsPath
from urllib.parse import urlparse
import re

from core.config import settings


_PRODUCTION_ENVIRONMENTS = {"production", "staging"}
_LOCAL_ENVIRONMENTS = {"dev", "development", "local", "test", "testing"}
_COMPONENTS = {"api", "worker"}
_OFFSITE_SCHEMES = {"s3", "gs", "az", "oss"}
_DEPLOYMENT_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$")
_SOURCE_ROOT = Path(__file__).resolve().parents[2]
_LOCAL_STORAGE_SUFFIXES = {
    "BACKUP_WORKER_ROOT": Path("local-data") / "backup-staging",
    "RELEASE_ARTIFACT_ROOT": Path("local-data") / "release-artifacts",
    "ASSET_STORAGE_ROOT": Path("local-data") / "objects" / "asset-private",
}


class RuntimeStorageConfigurationError(ValueError):
    """A filesystem-backed runtime root is missing or unsafe for this host."""


def runtime_environment() -> str:
    """Read the live environment so launch scripts and tests can override settings safely."""
    return os.getenv("ENVIRONMENT", settings.environment).strip().lower()


def is_absolute_runtime_path(value: str, *, platform: str | None = None) -> bool:
    """Validate absolute syntax for the OS that will actually process the path.

    A Windows drive path must not be accepted as a relative filename on Linux,
    and a POSIX path must not silently resolve against the current Windows drive.
    The optional platform argument keeps both flavours directly testable.
    """
    normalized = str(value or "").strip()
    target = (platform or ("windows" if os.name == "nt" else "posix")).strip().lower()
    if target in {"windows", "win32", "nt"}:
        return PureWindowsPath(normalized).is_absolute()
    if target in {"posix", "linux", "darwin"}:
        return PurePosixPath(normalized).is_absolute()
    raise ValueError(f"Unsupported runtime path platform: {platform}")


def development_storage_root(variable_name: str, *, source_root: Path | None = None) -> Path:
    """Derive local mutable storage from the parent of the active 00 source tree."""
    try:
        suffix = _LOCAL_STORAGE_SUFFIXES[variable_name]
    except KeyError as exc:
        raise ValueError(f"Unsupported runtime storage variable: {variable_name}") from exc
    active_source_root = Path(source_root or _SOURCE_ROOT).resolve()
    return (active_source_root.parent / suffix).resolve()


def resolve_runtime_storage_root(
    variable_name: str,
    configured_value: str | None,
    *,
    environment: str | None = None,
    source_root: Path | None = None,
) -> Path:
    """Resolve a configured storage mount, with source-relative defaults only locally."""
    value = str(configured_value or "").strip()
    active_environment = (environment or runtime_environment()).strip().lower()
    if value:
        if not is_absolute_runtime_path(value):
            raise RuntimeStorageConfigurationError(f"{variable_name}:absolute-path-required")
        return Path(value).resolve()
    if active_environment in _LOCAL_ENVIRONMENTS:
        return development_storage_root(variable_name, source_root=source_root)
    raise RuntimeStorageConfigurationError(f"{variable_name}:required-absolute-path")


def deployment_component() -> str:
    """Return the explicit runtime role, defaulting safely to the API process."""
    return settings.app_component.strip().lower() or "api"


def database_engine_label() -> str:
    url = settings.database_url.strip().lower()
    if url.startswith("postgresql"):
        return "postgresql"
    if url.startswith("sqlite"):
        return "sqlite"
    return "unknown"


def _is_offsite_uri(value: str) -> bool:
    return urlparse(value).scheme.lower() in _OFFSITE_SCHEMES


def production_runtime_configuration_errors() -> list[str]:
    """Return deployment-policy failures only; never return configured values."""
    if runtime_environment() not in _PRODUCTION_ENVIRONMENTS:
        return []

    errors: list[str] = []
    if deployment_component() not in _COMPONENTS:
        errors.append("APP_COMPONENT:must-be-api-or-worker")
    if not settings.database_url.strip().lower().startswith("postgresql+asyncpg://"):
        errors.append("DATABASE_URL:postgresql-asyncpg-required")
    if not settings.redis_url.strip():
        errors.append("REDIS_URL:required")
    elif urlparse(settings.redis_url.strip()).scheme.lower() != "rediss":
        errors.append("REDIS_URL:tls-rediss-required")
    if settings.rate_limit_backend.strip().lower() != "redis":
        errors.append("RATE_LIMIT_BACKEND:redis-required")
    asset_storage_root = settings.asset_storage_root.strip()
    if not asset_storage_root:
        errors.append("ASSET_STORAGE_ROOT:required-private-mount")
    elif not is_absolute_runtime_path(asset_storage_root):
        errors.append("ASSET_STORAGE_ROOT:absolute-path-required")
    for variable_name in ("BACKUP_WORKER_ROOT", "RELEASE_ARTIFACT_ROOT"):
        configured_root = os.getenv(variable_name, "").strip()
        if not configured_root:
            errors.append(f"{variable_name}:required-private-mount")
        elif not is_absolute_runtime_path(configured_root):
            errors.append(f"{variable_name}:absolute-path-required")
    if not _is_offsite_uri(settings.asset_storage_uri.strip()):
        errors.append("ASSET_STORAGE_URI:offsite-object-storage-required")
    if not _is_offsite_uri(settings.backup_target.strip()):
        errors.append("BACKUP_TARGET:offsite-object-storage-required")
    elif settings.backup_target.strip() == settings.asset_storage_uri.strip():
        errors.append("BACKUP_TARGET:must-be-separate-from-assets")
    if not settings.backup_schedule_id.strip():
        errors.append("BACKUP_SCHEDULE_ID:required")
    if not settings.restore_drill_reference.strip():
        errors.append("RESTORE_DRILL_REFERENCE:required")
    if not _DEPLOYMENT_ID.fullmatch(settings.deployment_id.strip()):
        errors.append("DEPLOYMENT_ID:invalid-or-missing")
    if urlparse(settings.public_base_url.strip()).scheme.lower() != "https":
        errors.append("PUBLIC_BASE_URL:https-required")
    origins = [item.strip() for item in settings.cors_allowed_origins.split(",") if item.strip()]
    if not origins or any(urlparse(origin).scheme.lower() != "https" for origin in origins):
        errors.append("CORS_ALLOWED_ORIGINS:https-origins-required")
    return errors


def deployment_readiness() -> dict[str, object]:
    """Safe operational summary used by the health endpoint and deployment probes."""
    errors = production_runtime_configuration_errors()
    return {
        "component": deployment_component(),
        "database_engine": database_engine_label(),
        "ready": not errors,
        "configuration_errors": errors,
    }
