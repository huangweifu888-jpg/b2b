"""Validate the staged disaster-recovery policy without contacting infrastructure."""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    policy = json.loads((ROOT / "deployment" / "policies" / "disaster-recovery.json").read_text(encoding="utf-8"))
    assert policy["schema_version"] == 1
    assert policy["objectives"]["initial_rpo_hours"] > 0 and policy["objectives"]["initial_rto_hours"] > 0
    assert {"application_runtime", "primary_database", "private_assets", "offsite_backup"} <= set(policy["required_separation"])
    assert policy["recovery_sequence"] == ["declare_incident", "contain", "restore_isolated", "verify_tenant_integrity", "approve_cutover", "communicate"]
    assert policy["drill"]["production_overwrite"] == "forbidden"
    assert policy["drill"]["frequency_days"] <= 90
    assert {"restore_reference", "revision", "tenant_integrity", "health_probe", "owner"} <= set(policy["drill"]["evidence_required"])
    print("Disaster recovery controls: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
