"""Run pip-audit and permit only active, documented PyPI exceptions."""

from __future__ import annotations

import json
import subprocess
import sys
from datetime import date
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
REQUIREMENTS = ROOT / "backend" / "requirements.lock.txt"
POLICY = ROOT / "security" / "supply-chain-exceptions.json"


def main() -> int:
    completed = subprocess.run(
        [sys.executable, "-m", "pip_audit", "-r", str(REQUIREMENTS), "--format", "json"],
        check=False,
        capture_output=True,
        text=True,
    )
    try:
        findings = json.loads(completed.stdout)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"pip-audit did not return JSON: {completed.stderr.strip()}") from exc

    policy = json.loads(POLICY.read_text(encoding="utf-8"))
    exceptions = {
        (item["package"], item["vulnerability_id"]): item
        for item in policy["exceptions"]
        if item.get("ecosystem") == "pypi" and date.fromisoformat(item["expires_on"]) >= date.today()
    }
    blocked: list[str] = []
    permitted: list[str] = []
    for dependency in findings:
        for vulnerability in dependency.get("vulns", []):
            key = (dependency["name"], vulnerability["id"])
            label = f"{dependency['name']} ({vulnerability['id']})"
            if key in exceptions:
                permitted.append(label)
            else:
                blocked.append(label)

    if permitted:
        print("Documented temporary Python exceptions:", ", ".join(sorted(permitted)))
    if blocked:
        print("Unapproved Python dependency findings:", ", ".join(sorted(blocked)), file=sys.stderr)
        return 1
    if completed.returncode not in {0, 1}:
        print(completed.stderr.strip(), file=sys.stderr)
        return completed.returncode
    print("Backend dependency audit: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
