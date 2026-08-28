"""Tenant-safe aggregation primitives for headquarters, agency, and client reports."""

from __future__ import annotations

from collections.abc import Iterable, Mapping


def aggregate_tenant_metrics(records: Iterable[Mapping[str, object]], *, tenant_id: str) -> dict[str, object]:
    inquiries = closed = ai_tokens = revenue_minor = 0
    for record in records:
        if record.get("tenant_id") != tenant_id:
            continue
        kind = str(record.get("kind", ""))
        if kind == "inquiry":
            inquiries += 1
            closed += int(record.get("closed") is True)
        elif kind == "ai_usage":
            ai_tokens += int(record.get("tokens", 0))
        elif kind == "ledger":
            revenue_minor += int(record.get("amount_minor", 0))
    return {"tenant_id": tenant_id, "inquiries": inquiries, "closed_inquiries": closed, "ai_tokens": ai_tokens, "net_revenue_minor": revenue_minor}
