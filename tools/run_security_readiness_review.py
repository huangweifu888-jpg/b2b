"""Run the local security readiness review without reading real secrets."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from platform_runtime import resolve_platform_python


ROOT = Path(__file__).resolve().parents[1]
CHECKS = (
    "verify_secret_controls.py",
    "verify_platform_tenant_authorization.py",
    "verify_tenant_end_to_end_matrix.py",
    "verify_request_security_controls.py",
    "verify_audit_log_scope.py",
    "verify_supply_chain_controls.py",
    "verify_release_governance.py",
)


def main() -> int:
    python = resolve_platform_python()
    for check in CHECKS:
        command = [python, str(ROOT / "tools" / check)]
        if check == "verify_release_governance.py":
            command.append("--self-test")
        result = subprocess.run(command, cwd=ROOT, text=True, capture_output=True)
        if result.returncode:
            print(f"Security readiness failed: {check}")
            print(result.stdout, end="")
            print(result.stderr, end="", file=sys.stderr)
            return 1
    print(f"Security readiness review: OK ({len(CHECKS)} controls)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
