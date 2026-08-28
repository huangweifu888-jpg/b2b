"""Run the release-critical tenant, content, and runtime acceptance matrix."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

from platform_runtime import resolve_platform_python


ROOT = Path(__file__).resolve().parents[1]
CHECKS = (
    "verify_tenant_end_to_end_matrix.py",
    "verify_content_download_security.py",
    "verify_platform_tenant_authorization.py",
    "verify_template_snapshot_tenant_controls.py",
    "verify_request_security_controls.py",
)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--report", type=Path, help="Optional credential-free JSON result")
    args = parser.parse_args()
    python = resolve_platform_python()
    outcomes: list[dict[str, str]] = []
    for check in CHECKS:
        completed = subprocess.run([python, str(ROOT / "tools" / check)], cwd=ROOT, text=True, capture_output=True)
        outcomes.append({"check": check, "status": "passed" if completed.returncode == 0 else "failed"})
        if completed.returncode:
            print(completed.stdout, end="")
            print(completed.stderr, end="", file=sys.stderr)
            if args.report:
                args.report.parent.mkdir(parents=True, exist_ok=True)
                args.report.write_text(json.dumps({"status": "failed", "checks": outcomes}, indent=2) + "\n", encoding="utf-8")
            return 1
    result = {"status": "passed", "checks": outcomes}
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(f"End-to-end release acceptance: OK ({len(outcomes)} checks)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
