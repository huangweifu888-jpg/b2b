"""Verify health-monitor threshold and recovery transitions without external services."""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import tempfile
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("run_health_monitor", ROOT / "tools" / "run_health_monitor.py")
assert SPEC and SPEC.loader
monitor = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(monitor)


def main() -> int:
    expected_default = ROOT.parent / "local-runtime" / "state" / "health-monitor" / "health-state.json"
    assert monitor.DEFAULT_STATE_FILE == expected_default
    with tempfile.TemporaryDirectory(prefix="b2b-health-monitor-") as directory:
        state_file = Path(directory) / "state.json"
        with patch.object(monitor, "health_result", return_value=(False, 503)):
            first = monitor.monitor_once("http://127.0.0.1:8000/api/v1/operations/health", state_file, 3)
            second = monitor.monitor_once("http://127.0.0.1:8000/api/v1/operations/health", state_file, 3)
            third = monitor.monitor_once("http://127.0.0.1:8000/api/v1/operations/health", state_file, 3)
        assert first["last_event"] is None and second["last_event"] is None
        assert third["last_event"] == "unhealthy" and third["alert_active"]
        with patch.object(monitor, "health_result", return_value=(True, 200)):
            recovered = monitor.monitor_once("http://127.0.0.1:8000/api/v1/operations/health", state_file, 3)
        assert recovered["last_event"] == "recovered" and not recovered["alert_active"]
        recorded = json.loads(state_file.read_text(encoding="utf-8"))
        assert "endpoint" not in recorded and "webhook" not in recorded
    print("Health monitor controls: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
