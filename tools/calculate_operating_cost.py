"""Calculate a provider-neutral monthly operating-cost estimate from supplied prices."""

from __future__ import annotations

import argparse
import json


def calculate(*, api_replicas: int, workers: int, database_units: int, asset_gb: int, backup_gb: int, api_monthly: float, worker_monthly: float, database_monthly: float, storage_gb_monthly: float, budget_monthly: float) -> dict[str, object]:
    values = (api_replicas, workers, database_units, asset_gb, backup_gb, api_monthly, worker_monthly, database_monthly, storage_gb_monthly, budget_monthly)
    if any(value < 0 for value in values):
        raise ValueError("cost inputs cannot be negative")
    breakdown = {
        "api": round(api_replicas * api_monthly, 2),
        "worker": round(workers * worker_monthly, 2),
        "database": round(database_units * database_monthly, 2),
        "assets": round(asset_gb * storage_gb_monthly, 2),
        "backups": round(backup_gb * storage_gb_monthly, 2),
    }
    total = round(sum(breakdown.values()), 2)
    return {"currency": "provider-input", "monthly": breakdown, "total_monthly": total, "budget_monthly": round(budget_monthly, 2), "budget_status": "within_budget" if total <= budget_monthly else "review_required"}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--api-replicas", type=int, default=2)
    parser.add_argument("--workers", type=int, default=1)
    parser.add_argument("--database-units", type=int, default=1)
    parser.add_argument("--asset-gb", type=int, default=50)
    parser.add_argument("--backup-gb", type=int, default=100)
    parser.add_argument("--api-monthly", type=float, default=0)
    parser.add_argument("--worker-monthly", type=float, default=0)
    parser.add_argument("--database-monthly", type=float, default=0)
    parser.add_argument("--storage-gb-monthly", type=float, default=0)
    parser.add_argument("--budget-monthly", type=float, default=0)
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    result = calculate(**{key: value for key, value in vars(args).items() if key != "self_test"})
    if args.self_test:
        assert calculate(api_replicas=2, workers=1, database_units=1, asset_gb=50, backup_gb=100, api_monthly=20, worker_monthly=10, database_monthly=40, storage_gb_monthly=0.1, budget_monthly=100)["total_monthly"] == 105
        assert result["total_monthly"] == 0
        print("Operating cost model: OK")
    else:
        print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
