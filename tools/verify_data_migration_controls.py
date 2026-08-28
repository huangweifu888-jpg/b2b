"""Validate migration safety policy without reading customer data."""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    policy = json.loads((ROOT / "deployment" / "policies" / "data-migration.json").read_text(encoding="utf-8"))
    assert policy["schema_version"] == 1
    assert policy["allowed_modes"] == ["dry_run", "controlled_execute"]
    assert {"source_inventory", "field_mapping", "isolated_restore_reference", "tenant_scope_approval", "rollback_reference"} <= set(policy["required_evidence"])
    assert {"agent_path", "tenant_id", "client_id"} <= set(policy["tenant_scope"]["required_fields"])
    assert policy["tenant_scope"]["cross_tenant_rows"] == "reject"
    assert {"email", "phone", "id_number"} <= set(policy["sensitive_fields"])
    execution = policy["execution"]
    assert execution["backup_before_write"] and execution["idempotency_key_required"] and execution["audit_event_required"]
    assert execution["row_error_policy"] == "stop_and_rollback"
    print("Data migration controls: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
