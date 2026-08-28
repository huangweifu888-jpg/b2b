"""Compare a bounded health-load measurement with the approved local SLO."""

from __future__ import annotations

import argparse
import importlib.util
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def load_smoke_tool():
    spec = importlib.util.spec_from_file_location("health_load_smoke", ROOT / "tools" / "run_health_load_smoke.py")
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def evaluate(result: dict[str, object]) -> dict[str, object]:
    policy = json.loads((ROOT / "deployment" / "policies" / "capacity-model.json").read_text(encoding="utf-8"))
    slo = policy["slo"]
    passed = result["p95_ms"] <= slo["health_probe_p95_ms"] and result["error_rate_percent"] <= slo["health_probe_error_rate_percent"]
    return {"status": "passed" if passed else "failed", "measurement": result, "slo": slo}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--endpoint")
    parser.add_argument("--requests", type=int, default=100)
    parser.add_argument("--concurrency", type=int, default=10)
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    smoke = load_smoke_tool()
    if args.self_test:
        assert evaluate({"p95_ms": 999, "error_rate_percent": 1})["status"] == "passed"
        assert evaluate({"p95_ms": 1001, "error_rate_percent": 0})["status"] == "failed"
        print("Capacity baseline controls: OK")
        return 0
    if not args.endpoint:
        parser.error("--endpoint is required unless --self-test is used")
    result = evaluate(smoke.measure(args.endpoint, args.requests, args.concurrency, 5))
    print(json.dumps(result, ensure_ascii=False))
    return 0 if result["status"] == "passed" else 1


if __name__ == "__main__":
    raise SystemExit(main())
