"""Tenant boundary primitives shared by headquarters, agency, client, and plan APIs.

The current platform already stores organization hierarchy and projects.  This
module provides a small, dependency-free contract that new routers can use
before accessing tenant-owned data or assets.  Database-specific descendant
checks remain the responsibility of the calling service.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
import re
from typing import Optional


_IDENTIFIER = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$")


class TenantContextError(ValueError):
    """Raised when a request does not contain a safe tenant boundary."""


def _normalize_identifier(name: str, value: str) -> str:
    normalized = str(value or "").strip()
    if not _IDENTIFIER.fullmatch(normalized):
        raise TenantContextError(f"{name} must contain 1-64 letters, numbers, underscores, or hyphens")
    return normalized


def _normalize_agent_path(value: str) -> str:
    segments = [segment.strip() for segment in str(value or "").split("/") if segment.strip()]
    if not segments:
        raise TenantContextError("agent_path must contain at least one agent identifier")
    return "/".join(_normalize_identifier("agent_path segment", segment) for segment in segments)


@dataclass(frozen=True)
class TenantContext:
    """The minimum scope required for tenant-owned reads and writes."""

    agent_path: str
    tenant_id: str
    client_id: str
    plan_id: Optional[str] = None

    @property
    def asset_prefix(self) -> str:
        """Opaque storage prefix; callers must not derive filesystem paths from it."""
        base = f"tenants/{self.tenant_id}/clients/{self.client_id}"
        return f"{base}/plans/{self.plan_id}" if self.plan_id else base

    def as_dict(self) -> dict[str, Optional[str]]:
        return asdict(self)


def build_tenant_context(
    *, agent_path: str, tenant_id: str, client_id: str, plan_id: Optional[str] = None
) -> TenantContext:
    """Create a normalized context without touching the database.

    Authorization services should first create this object, then verify that
    the requester belongs to the supplied agent path and tenant before querying
    tenant-owned records.
    """
    return TenantContext(
        agent_path=_normalize_agent_path(agent_path),
        tenant_id=_normalize_identifier("tenant_id", tenant_id),
        client_id=_normalize_identifier("client_id", client_id),
        plan_id=_normalize_identifier("plan_id", plan_id) if plan_id else None,
    )
