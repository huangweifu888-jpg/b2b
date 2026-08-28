"""Verify tenant-isolated analytics aggregation."""

from __future__ import annotations

import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from services.tenant_analytics import aggregate_tenant_metrics  # noqa: E402


def main() -> int:
    result = aggregate_tenant_metrics([
        {"tenant_id": "t1", "kind": "inquiry", "closed": True}, {"tenant_id": "t1", "kind": "ai_usage", "tokens": 12},
        {"tenant_id": "t1", "kind": "ledger", "amount_minor": 1000}, {"tenant_id": "t2", "kind": "ledger", "amount_minor": 9999},
    ], tenant_id="t1")
    assert result == {"tenant_id": "t1", "inquiries": 1, "closed_inquiries": 1, "ai_tokens": 12, "net_revenue_minor": 1000}
    print("Tenant analytics: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
