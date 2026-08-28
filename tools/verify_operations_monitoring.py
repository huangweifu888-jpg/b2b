"""Verify monitoring policy is actionable and never routes sensitive fields."""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    policy = json.loads((ROOT / "deployment" / "policies" / "operations-slo.json").read_text(encoding="utf-8"))
    assert policy["schema_version"] == 1
    assert policy["health"]["endpoint"] == "/api/v1/operations/health"
    assert policy["health"]["interval_seconds"] == 60
    assert policy["health"]["alert_after_consecutive_failures"] == 3
    assert {"database_unhealthy", "redis_or_worker_unhealthy", "backup_or_restore_drill_failed"} <= set(policy["alerts"])
    assert policy["performance"]["health_probe_p95_ms"] > 0
    assert policy["performance"]["max_smoke_concurrency"] <= 50
    forbidden = set(policy["privacy"]["forbid"])
    assert {"secret", "token", "authorization"} <= forbidden
    print("Operations monitoring policy: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
