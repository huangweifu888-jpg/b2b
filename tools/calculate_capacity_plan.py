"""Calculate a conservative starting capacity plan from business traffic inputs."""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
POLICY = ROOT / "deployment" / "policies" / "capacity-model.json"


def calculate(*, agencies: int, clients: int, plans: int, peak_rps: int, jobs_per_minute: int) -> dict[str, object]:
    if min(agencies, clients, plans, peak_rps, jobs_per_minute) < 0:
        raise ValueError("capacity inputs cannot be negative")
    units = json.loads(POLICY.read_text(encoding="utf-8"))["planning_units"]
    api = max(units["minimum_api_replicas"], math.ceil(peak_rps / units["api_requests_per_second_per_replica"]))
    workers = max(units["minimum_worker_replicas"], math.ceil(jobs_per_minute / units["background_jobs_per_minute_per_worker"]))
    databases = max(1, math.ceil(plans / units["plans_per_database_unit"]))
    return {
        "inputs": {"agencies": agencies, "clients": clients, "plans": plans, "peak_rps": peak_rps, "jobs_per_minute": jobs_per_minute},
        "recommendation": {
            "api_replicas": api,
            "worker_replicas": workers,
            "database_units": databases,
            "redis": "managed Redis with a namespace per deployment stamp",
            "review_required": databases > 1 or clients > 100 or agencies > 10,
        },
        "note": "Planning estimate only; validate against staging load and production telemetry before resizing.",
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--agencies", type=int, default=1)
    parser.add_argument("--clients", type=int, default=1)
    parser.add_argument("--plans", type=int, default=1)
    parser.add_argument("--peak-rps", type=int, default=10)
    parser.add_argument("--jobs-per-minute", type=int, default=10)
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    result = calculate(agencies=args.agencies, clients=args.clients, plans=args.plans, peak_rps=args.peak_rps, jobs_per_minute=args.jobs_per_minute)
    if args.self_test:
        assert calculate(agencies=12, clients=101, plans=1001, peak_rps=81, jobs_per_minute=121)["recommendation"] == {"api_replicas": 3, "worker_replicas": 2, "database_units": 2, "redis": "managed Redis with a namespace per deployment stamp", "review_required": True}
        print("Capacity model: OK")
    else:
        print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
