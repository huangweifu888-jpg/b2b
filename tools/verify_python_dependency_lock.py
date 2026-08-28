"""Verify that the backend's direct requirements are pinned in its lock file."""

from __future__ import annotations

import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "backend" / "requirements.txt"
LOCK = ROOT / "backend" / "requirements.lock.txt"
NAME = re.compile(r"^([A-Za-z0-9_.-]+)(?:\[[^]]+\])?")


def package_names(path: Path, *, require_exact: bool) -> set[str]:
    names: set[str] = set()
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.split("#", 1)[0].strip()
        if not line:
            continue
        match = NAME.match(line)
        if not match:
            raise AssertionError(f"Cannot parse requirement: {raw}")
        if require_exact and "==" not in line:
            raise AssertionError(f"Lock entry must pin exactly: {raw}")
        names.add(match.group(1).lower().replace("_", "-"))
    return names


def main() -> int:
    direct = package_names(SOURCE, require_exact=False)
    locked = package_names(LOCK, require_exact=True)
    missing = sorted(direct - locked)
    assert not missing, f"Direct requirements missing from lock: {', '.join(missing)}"
    assert len(locked) > len(direct), "Lock file must include transitive dependencies"
    print(f"Python dependency lock: OK ({len(locked)} packages, {len(direct)} direct)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
