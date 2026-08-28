"""Validate production rehearsal sequence and evidence requirements."""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    policy = json.loads((ROOT / "deployment" / "policies" / "production-rehearsal.json").read_text(encoding="utf-8"))
    assert policy["schema_version"] == 1
    assert policy["sequence"] == ["identity_mfa", "payment_callback", "provision_plan", "publish_site", "private_download", "backup_restore", "rollback"]
    assert policy["environment"] == "staging_only_until_approved"
    assert {"change_record", "tenant_scope", "signed_artifact", "restore_reference", "rollback_reference", "customer_communication"} <= set(policy["evidence"])
    assert policy["production_data_write"] == "forbidden_without_approved_change"
    print("Production rehearsal controls: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
