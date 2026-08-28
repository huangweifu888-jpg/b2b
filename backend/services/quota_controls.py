"""Provider-neutral quota evaluation shared by plans and billing integrations."""

from __future__ import annotations

from dataclasses import dataclass


ALLOWED_RESOURCES = frozenset({"sites", "storage_gb", "ai_tokens", "members", "agencies", "sub_agencies", "clients", "plans"})


@dataclass(frozen=True)
class QuotaDecision:
    resource: str
    used: int
    limit: int
    status: str


def evaluate_quota(resource: str, *, used: int, limit: int, warning_ratio: float = 0.9) -> QuotaDecision:
    if resource not in ALLOWED_RESOURCES:
        raise ValueError("unsupported quota resource")
    if used < 0 or limit < 0 or not 0 < warning_ratio < 1:
        raise ValueError("invalid quota inputs")
    if used >= limit:
        status = "blocked"
    elif used >= limit * warning_ratio:
        status = "warning"
    else:
        status = "available"
    return QuotaDecision(resource=resource, used=used, limit=limit, status=status)
