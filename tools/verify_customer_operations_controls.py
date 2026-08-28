"""Validate customer support, incident, and on-call operating controls."""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    policy = json.loads((ROOT / "deployment" / "policies" / "customer-operations.json").read_text(encoding="utf-8"))
    assert policy["schema_version"] == 1
    assert set(policy["severity"]) == {"sev1", "sev2", "sev3"}
    assert policy["severity"]["sev1"]["ack_minutes"] <= 15
    assert {"status_page", "incident_template", "affected_tenant_list", "post_incident_summary"} <= set(policy["customer_communication"])
    assert policy["escalation"] == ["support", "operations", "security", "release_manager"]
    assert all(policy["on_call"].values())
    print("Customer operations controls: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
