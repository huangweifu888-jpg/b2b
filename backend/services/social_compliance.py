"""Deterministic, non-secret social compliance defaults and capability matrix."""

from __future__ import annotations

import os


MIN_RETENTION_DAYS = 30
MAX_RETENTION_DAYS = 3650
DEFAULT_RETENTION_DAYS = 180


def validate_retention_days(value: int) -> int:
    if not MIN_RETENTION_DAYS <= value <= MAX_RETENTION_DAYS:
        raise ValueError(f"Retention must be between {MIN_RETENTION_DAYS} and {MAX_RETENTION_DAYS} days")
    return value


def _enabled(name: str) -> bool:
    return os.getenv(name, "").strip().lower() in {"1", "true", "yes", "on"}


def social_capability_matrix() -> list[dict[str, object]]:
    """Expose only verified local capability states; never claim live platform support."""
    return [
        {"provider": "facebook", "connection": "oauth2", "availability": "connector_pending", "publish": False, "interactions": False, "note": "Requires an approved Meta app, callback and server-side credential reference."},
        {"provider": "instagram", "connection": "oauth2", "availability": "connector_pending", "publish": False, "interactions": False, "note": "Requires an approved Meta app, callback and server-side credential reference."},
        {"provider": "linkedin", "connection": "oauth2", "availability": "planned", "publish": False, "interactions": False, "note": "No connector is configured in this deployment."},
        {"provider": "tiktok", "connection": "oauth2", "availability": "planned", "publish": False, "interactions": False, "note": "No connector is configured in this deployment."},
        {"provider": "wechat", "connection": "official_api", "availability": "planned", "publish": False, "interactions": False, "note": "Requires the applicable official platform agreement and API review."},
        {"provider": "douyin", "connection": "official_api", "availability": "planned", "publish": False, "interactions": False, "note": "Requires the applicable official platform agreement and API review."},
    ]


def observability_readiness() -> dict[str, bool]:
    """Configuration-only readiness, deliberately excluding endpoints and secrets."""
    return {
        "audit_logging": True,
        "credential_reference_backend": _enabled("SOCIAL_SECRETS_BACKEND"),
        "oauth_start": _enabled("SOCIAL_META_OAUTH_START_ENABLED"),
        "publish_execution": _enabled("SOCIAL_PUBLISH_EXECUTION_ENABLED"),
        "crm_execution": _enabled("SOCIAL_CRM_HANDOFF_EXECUTION_ENABLED"),
    }
