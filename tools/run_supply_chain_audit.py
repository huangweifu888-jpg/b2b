"""Run the frontend vulnerability audit and enforce documented exceptions."""

from __future__ import annotations

import json
import subprocess
import sys
from datetime import date
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "frontend"
POLICY = ROOT / "security" / "supply-chain-exceptions.json"
SEVERITY_RANK = {"info": 0, "low": 1, "moderate": 2, "high": 3, "critical": 4}


def load_active_exceptions(
    policy_path: Path = POLICY,
    *,
    ecosystem: str,
    today: date | None = None,
) -> dict[tuple[str, str], dict[str, object]]:
    current_date = today or date.today()
    return {
        (item["package"], item["severity"]): item
        for item in json.loads(policy_path.read_text(encoding="utf-8"))["exceptions"]
        if item.get("ecosystem") == ecosystem
        and date.fromisoformat(item["expires_on"]) >= current_date
    }


def main() -> int:
    npm = "npm.cmd" if sys.platform == "win32" else "npm"
    completed = subprocess.run(
        [npm, "audit", "--omit=dev", "--package-lock-only", "--json"],
        cwd=FRONTEND,
        check=False,
        capture_output=True,
        text=True,
    )
    try:
        report = json.loads(completed.stdout)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"npm audit did not return JSON: {completed.stderr.strip()}") from exc

    exceptions = load_active_exceptions(ecosystem="npm")
    blocked: list[str] = []
    permitted: list[str] = []
    for name, finding in report.get("vulnerabilities", {}).items():
        severity = finding.get("severity", "info")
        if SEVERITY_RANK.get(severity, 0) < SEVERITY_RANK["high"]:
            continue
        if (name, severity) in exceptions:
            permitted.append(f"{name} ({severity})")
        else:
            blocked.append(f"{name} ({severity})")

    if permitted:
        print("Documented temporary exceptions:", ", ".join(sorted(permitted)))
    if blocked:
        print("Unapproved high/critical npm audit findings:", ", ".join(sorted(blocked)), file=sys.stderr)
        return 1
    counts = report.get("metadata", {}).get("vulnerabilities", {})
    print(f"Frontend dependency audit: OK (high={counts.get('high', 0)}, critical={counts.get('critical', 0)})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
