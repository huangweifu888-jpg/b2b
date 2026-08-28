"""Verify data classification, retention, and request boundaries are explicit."""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    policy = json.loads((ROOT / "deployment" / "policies" / "data-governance.json").read_text(encoding="utf-8"))
    assert policy["schema_version"] == 1
    classification = policy["classification"]
    assert {"public", "internal", "confidential", "restricted"} <= set(classification)
    assert {"password", "secret", "token"} <= set(classification["restricted"])
    assert all(days > 0 for days in policy["retention_days"].values())
    assert "tenant-scoped" in policy["data_subject_requests"]["export"]
    assert "backup-aware" in policy["data_subject_requests"]["delete"]
    print("Data governance policy: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
