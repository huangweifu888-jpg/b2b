"""Verify customer closure and data-subject lifecycle controls."""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    policy = json.loads((ROOT / "deployment" / "policies" / "privacy-lifecycle.json").read_text(encoding="utf-8"))
    governance = json.loads((ROOT / "deployment" / "policies" / "data-governance.json").read_text(encoding="utf-8"))
    assert policy["schema_version"] == 1
    assert policy["requests"]["export"] == ["authenticated", "tenant_scoped", "audited"]
    assert policy["requests"]["delete"] == ["approved", "tenant_scoped", "backup_aware", "audited"]
    assert policy["customer_closure"]["access_disable_first"] is True
    assert policy["customer_closure"]["export_window_days"] > 0
    assert policy["customer_closure"]["backup_expiry_required"] is True
    assert {"cross_tenant_export", "public_backup", "secret_in_request_record"} <= set(policy["prohibitions"])
    assert "tenant-scoped" in governance["data_subject_requests"]["export"]
    assert "backup-aware" in governance["data_subject_requests"]["delete"]
    print("Privacy lifecycle controls: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
