"""Validate release quality gates and their evidence requirements."""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    policy = json.loads((ROOT / "deployment" / "policies" / "quality-gate.json").read_text(encoding="utf-8"))
    assert policy["schema_version"] == 1
    assert {"tenant_authorization", "api_contract", "browser_regression", "accessibility", "dependency_audit"} <= set(policy["release_blockers"])
    assert all(policy["browser"][key] is True for key in ("desktop_required", "mobile_required", "visual_baseline_review_required"))
    assert all(policy["api"][key] is True for key in ("versioned_contract_required", "error_schema_review_required"))
    assert all(policy["coverage"][key] is True for key in ("critical_path_required", "failure_evidence_required"))
    print("Quality gate controls: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
