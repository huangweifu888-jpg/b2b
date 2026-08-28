"""Verify tenant/plan quota decisions and billing guardrails."""

from __future__ import annotations

import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from services.quota_controls import evaluate_quota  # noqa: E402


def main() -> int:
    policy = json.loads((ROOT / "deployment" / "policies" / "quota-governance.json").read_text(encoding="utf-8"))
    assert set(policy["resources"]) == {"sites", "storage_gb", "ai_tokens", "members"}
    assert policy["scope"] == "tenant_and_plan" and policy["over_limit"] == "block_new_consumption"
    assert all(policy["changes"][key] is True for key in ("approval_required", "audit_event_required", "effective_at_required"))
    assert all(policy["billing"][key] is True for key in ("provider_callback_signature_required", "idempotency_key_required"))
    assert evaluate_quota("sites", used=5, limit=10).status == "available"
    assert evaluate_quota("sites", used=9, limit=10).status == "warning"
    assert evaluate_quota("sites", used=10, limit=10).status == "blocked"
    print("Quota controls: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
