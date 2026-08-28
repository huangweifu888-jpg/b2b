"""Safe, structured audit-event helpers shared by tenant-aware endpoints."""

from __future__ import annotations

import hashlib
import json
from collections.abc import Mapping
from typing import Any

from models.platform import AuditLog
from sqlalchemy.ext.asyncio import AsyncSession


_SENSITIVE_KEY_PARTS = ("password", "secret", "token", "authorization", "cookie", "api_key", "private_key")
_REDACTED = "[redacted]"


def _is_sensitive_key(key: object) -> bool:
    normalized = str(key).strip().lower().replace("-", "_")
    return any(part in normalized for part in _SENSITIVE_KEY_PARTS)


def redact_audit_detail(value: Any) -> Any:
    """Remove credentials recursively before audit data is persisted or returned."""
    if isinstance(value, Mapping):
        return {
            str(key): _REDACTED if _is_sensitive_key(key) else redact_audit_detail(item)
            for key, item in value.items()
        }
    if isinstance(value, (list, tuple)):
        return [redact_audit_detail(item) for item in value]
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    return str(value)


def audit_detail_from_json(value: str | None) -> dict[str, Any]:
    """Read legacy audit JSON defensively and apply the same redaction policy."""
    if not value:
        return {}
    try:
        parsed = json.loads(value)
    except (TypeError, ValueError):
        return {"detail": "[unavailable]"}
    safe = redact_audit_detail(parsed)
    return safe if isinstance(safe, dict) else {"detail": safe}


def actor_reference(actor_user_id: str | None) -> str | None:
    """Expose an accountable but non-identifying reference in audit-list responses."""
    if not actor_user_id:
        return None
    return hashlib.sha256(actor_user_id.encode("utf-8")).hexdigest()[:12]


def record_audit_event(
    db: AsyncSession,
    *,
    action: str,
    actor_user_id: str | None = None,
    org_id: int | None = None,
    project_id: int | None = None,
    target_type: str | None = None,
    target_id: str | int | None = None,
    ip_address: str | None = None,
    detail: Mapping[str, Any] | None = None,
) -> AuditLog:
    """Queue an audit record in the caller's transaction without logging secrets."""
    entry = AuditLog(
        actor_user_id=actor_user_id,
        org_id=org_id,
        project_id=project_id,
        action=action,
        target_type=target_type,
        target_id=str(target_id) if target_id is not None else None,
        ip_address=ip_address,
        detail_json=json.dumps(redact_audit_detail(detail or {}), ensure_ascii=False, separators=(",", ":")),
    )
    db.add(entry)
    return entry
