"""Verify the staging cutover runner validates resources before release preflight."""

from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    script = (ROOT / "tools" / "run-staging-cutover.ps1").read_text(encoding="utf-8")
    required = ("ResourceContract", "verify_staging_resource_contract.py", "run-staging-release-drill.ps1", "$arguments.Probe", "Staging cutover gate: OK")
    missing = [item for item in required if item not in script]
    assert not missing, f"Staging cutover runner missing: {', '.join(missing)}"
    print("Staging cutover controls: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
