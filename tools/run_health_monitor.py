"""Poll the credential-free operations health endpoint and alert on state transitions."""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen


DEFAULT_ENDPOINT = "http://127.0.0.1:8000/api/v1/operations/health"
SOURCE_ROOT = Path(__file__).resolve().parents[1]
WORKSPACE_ROOT = SOURCE_ROOT.parent
DEFAULT_STATE_FILE = WORKSPACE_ROOT / "local-runtime" / "state" / "health-monitor" / "health-state.json"


def safe_endpoint(value: str) -> str:
    parsed = urlsplit(value.strip())
    if parsed.scheme not in {"http", "https"} or not parsed.netloc or parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise ValueError("health endpoint must be a plain HTTP(S) URL without credentials, query, or fragment")
    return f"{parsed.scheme}://{parsed.netloc}{parsed.path or '/'}"


def load_state(path: Path) -> dict[str, Any]:
    try:
        parsed = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {"consecutive_failures": 0, "alert_active": False}
    return parsed if isinstance(parsed, dict) else {"consecutive_failures": 0, "alert_active": False}


def write_state(path: Path, state: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary.replace(path)


def health_result(endpoint: str, timeout_seconds: int) -> tuple[bool, int | None]:
    try:
        with urlopen(Request(endpoint, headers={"Accept": "application/json"}), timeout=timeout_seconds) as response:
            status = response.status
            payload = json.loads(response.read().decode("utf-8"))
            return status == 200 and payload.get("status") == "healthy", status
    except HTTPError as exc:
        return False, exc.code
    except (OSError, URLError, TimeoutError, ValueError):
        return False, None


def send_alert(webhook_url: str, event: str, failures: int, status_code: int | None) -> bool:
    parsed = urlsplit(webhook_url.strip())
    if parsed.scheme != "https" or not parsed.netloc or parsed.username or parsed.password:
        raise ValueError("B2B_ALERT_WEBHOOK_URL must be a credential-free HTTPS URL")
    body = json.dumps({
        "service": "b2b",
        "event": event,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "consecutive_failures": failures,
        "http_status": status_code,
    }).encode("utf-8")
    try:
        with urlopen(Request(webhook_url, data=body, headers={"Content-Type": "application/json"}, method="POST"), timeout=5):
            return True
    except (OSError, URLError, TimeoutError):
        return False


def monitor_once(endpoint: str, state_file: Path, threshold: int, webhook_url: str = "") -> dict[str, Any]:
    if threshold < 1:
        raise ValueError("threshold must be at least 1")
    endpoint = safe_endpoint(endpoint)
    healthy, status_code = health_result(endpoint, timeout_seconds=5)
    previous = load_state(state_file)
    was_alerting = bool(previous.get("alert_active"))
    failures = 0 if healthy else int(previous.get("consecutive_failures", 0)) + 1
    event = "recovered" if healthy and was_alerting else "unhealthy" if not healthy and failures >= threshold and not was_alerting else None
    alert_active = not healthy and (was_alerting or failures >= threshold)
    state = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "healthy": healthy,
        "http_status": status_code,
        "consecutive_failures": failures,
        "alert_active": alert_active,
        "last_event": event,
    }
    if event and webhook_url:
        state["webhook_delivery"] = "sent" if send_alert(webhook_url, event, failures, status_code) else "failed"
    write_state(state_file, state)
    return state


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--endpoint", default=os.getenv("B2B_HEALTH_ENDPOINT", DEFAULT_ENDPOINT))
    parser.add_argument("--state-file", type=Path, default=Path(os.getenv("B2B_HEALTH_STATE_FILE", str(DEFAULT_STATE_FILE))))
    parser.add_argument("--threshold", type=int, default=int(os.getenv("B2B_HEALTH_FAILURE_THRESHOLD", "3")))
    args = parser.parse_args()
    try:
        print(json.dumps(monitor_once(args.endpoint, args.state_file, args.threshold, os.getenv("B2B_ALERT_WEBHOOK_URL", "")), ensure_ascii=False))
    except (OSError, ValueError) as exc:
        print(json.dumps({"status": "monitor-error", "reason": str(exc)}, ensure_ascii=False))
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
