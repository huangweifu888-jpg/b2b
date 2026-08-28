"""Meta OAuth trial readiness without exposing any credential.

Facebook and Instagram must use their official Meta OAuth flow.  This module is
purposefully limited to readiness checks for the local control plane; it does
not redirect users, exchange authorization codes or read secret values.
"""

from __future__ import annotations

import os
from typing import Final


META_PROVIDERS: Final[frozenset[str]] = frozenset({"facebook", "instagram"})


def normalize_meta_provider(provider: str) -> str:
    normalized = " ".join(provider.split()).strip().lower()
    if normalized not in META_PROVIDERS:
        raise ValueError("Only Facebook and Instagram are supported by the Meta trial")
    return normalized


def meta_oauth_readiness(*, application_active: bool) -> dict[str, bool]:
    """Return flags only; credential values are never read or returned."""
    callback_configured = bool(os.getenv("SOCIAL_OAUTH_CALLBACK_BASE_URL", "").strip())
    secrets_backend_configured = bool(os.getenv("SOCIAL_SECRETS_BACKEND", "").strip())
    client_id_configured = bool(os.getenv("SOCIAL_META_CLIENT_ID", "").strip())
    start_enabled = os.getenv("SOCIAL_META_OAUTH_START_ENABLED", "").strip().lower() in {"1", "true", "yes", "on"}
    ready = application_active and callback_configured and secrets_backend_configured and client_id_configured and start_enabled
    return {
        "application_active": application_active,
        "callback_configured": callback_configured,
        "secrets_backend_configured": secrets_backend_configured,
        "client_id_configured": client_id_configured,
        "start_enabled": start_enabled,
        "ready": ready,
    }
