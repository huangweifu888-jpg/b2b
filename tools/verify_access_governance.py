"""Validate role scopes and release-approval segregation policy."""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    policy = json.loads((ROOT / "deployment" / "policies" / "access-governance.json").read_text(encoding="utf-8"))
    assert policy["schema_version"] == 1
    roles = policy["roles"]
    required = {"headquarters_administrator", "agency_operator", "customer_content_operator", "plan_operator", "technical_operations", "security_owner"}
    assert required <= set(roles)
    assert roles["headquarters_administrator"]["scope"] == "all_active_tenants"
    assert roles["agency_operator"]["scope"] == "own_descendant_organizations_and_plans"
    assert roles["plan_operator"]["scope"] == "assigned_plan_only"
    assert {"sibling_agency", "unrelated_tenant", "parentless_scope_escalation"} <= set(policy["deny_rules"])
    assert set(policy["release_approval_roles"]) == {"headquarters_administrator", "technical_operations", "security_owner"}
    assert policy["review"]["frequency_days"] <= 90
    print("Access governance policy: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
