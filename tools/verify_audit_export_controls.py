"""Verify tenant-scoped audit export and secret-redaction controls."""

from __future__ import annotations

import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from services.audit import redact_audit_detail  # noqa: E402


def main() -> int:
    policy = json.loads((ROOT / "deployment" / "policies" / "audit-export-governance.json").read_text(encoding="utf-8"))
    assert policy["schema_version"] == 1
    assert {"membership_changed", "role_changed", "release_rollout", "private_download", "data_export_requested", "data_delete_requested"} <= set(policy["required_events"])
    assert all(policy["export"][key] is True for key in ("tenant_scoped", "authenticated", "audited", "secret_redaction"))
    assert policy["export"]["max_rows_per_export"] <= 10000
    safe = redact_audit_detail({"token": "never-store", "nested": {"api_key": "never-store"}, "action": "export"})
    assert safe == {"token": "[redacted]", "nested": {"api_key": "[redacted]"}, "action": "export"}
    print("Audit export controls: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
