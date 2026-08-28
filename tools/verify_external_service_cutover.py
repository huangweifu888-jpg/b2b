"""Verify the external-service topology and release gate without contacting infrastructure."""

from __future__ import annotations

import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))

from verify_release_readiness import self_test  # noqa: E402


def main() -> int:
    topology = (ROOT / "deployment" / "topology" / "service-units.yaml").read_text(encoding="utf-8")
    required = ("managed-postgresql", "object-storage-uri", "private-read-only-mount", "separate-offsite-object-storage")
    missing = [item for item in required if item not in topology]
    if missing:
        print(f"External service topology missing: {missing}")
        return 1
    if self_test() != 0:
        return 1
    print("External service cutover controls: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
