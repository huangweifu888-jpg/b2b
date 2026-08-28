"""Exercise tenant-scoped CSV preview, rejection, and deterministic masking."""

from __future__ import annotations

import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from core.tenant_context import build_tenant_context  # noqa: E402
from services.controlled_import import preview_csv  # noqa: E402


def main() -> int:
    context = build_tenant_context(agent_path="hq/a1", tenant_id="tenant-a", client_id="client-a", plan_id="plan-a")
    preview = preview_csv(
        "agent_path,tenant_id,client_id,email,phone\nhq/a1,tenant-a,client-a,user@example.test,13800138000\nhq/a1,tenant-b,client-a,other@example.test,13900139000\n",
        context=context, non_production=True, masking_salt="test-only-mask-salt",
    )
    assert preview.accepted_rows == 1 and preview.rejected_rows == 1
    assert preview.masked_rows[0]["email"].startswith("masked:") and preview.masked_rows[0]["phone"].startswith("masked:")
    assert preview.errors == ("line 3: cross-tenant scope rejected",)
    print("Controlled importer: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
