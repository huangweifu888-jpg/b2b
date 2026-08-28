"""Verify repository-local dependency supply-chain guardrails.

This check is intentionally offline.  The companion audit runner fetches the
current vulnerability database; this verifier makes sure that audit results
cannot be silently ignored through an untracked or expired exception.
"""

from __future__ import annotations

import json
import re
from datetime import date
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
LOCKFILE = ROOT / "frontend" / "package-lock.json"
PACKAGE = ROOT / "frontend" / "package.json"
POLICY = ROOT / "security" / "supply-chain-exceptions.json"
SECURITY_REQUIREMENTS = ROOT / "tools" / "requirements-security.txt"


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def main() -> int:
    require(SECURITY_REQUIREMENTS.is_file(), "Missing tools/requirements-security.txt")
    requirements = SECURITY_REQUIREMENTS.read_text(encoding="utf-8")
    require(re.search(r"^pip-audit[<>=!~]+", requirements, re.MULTILINE), "pip-audit must be version bounded")

    package = json.loads(PACKAGE.read_text(encoding="utf-8"))
    lock = json.loads(LOCKFILE.read_text(encoding="utf-8"))
    require(lock.get("lockfileVersion", 0) >= 3, "frontend lockfile must use npm lockfile version 3+")
    root_package = lock.get("packages", {}).get("", {})
    declared = set(package.get("dependencies", {})) | set(package.get("devDependencies", {}))
    locked = set(root_package.get("dependencies", {})) | set(root_package.get("devDependencies", {}))
    require(declared <= locked, "Every declared frontend dependency must be represented in package-lock.json")

    missing_integrity = []
    for key, record in lock.get("packages", {}).items():
        if key and "resolved" in record and not record.get("integrity"):
            missing_integrity.append(key)
    require(not missing_integrity, f"Lockfile packages without integrity: {', '.join(missing_integrity[:5])}")

    policy = json.loads(POLICY.read_text(encoding="utf-8"))
    require(policy.get("schema_version") == 1, "Unsupported supply-chain exception schema")
    exceptions = policy.get("exceptions")
    require(isinstance(exceptions, list), "Supply-chain exceptions must be a list")
    seen: set[tuple[str, str]] = set()
    for item in exceptions:
        require(isinstance(item, dict), "Each exception must be an object")
        package_name = item.get("package")
        severity = item.get("severity")
        key = (package_name, severity)
        require(isinstance(package_name, str) and package_name, "Exception package is required")
        require(severity in {"high", "critical"}, f"Unsupported exception severity for {package_name}")
        require(key not in seen, f"Duplicate exception for {package_name} ({severity})")
        seen.add(key)
        try:
            expires_on = date.fromisoformat(item["expires_on"])
        except (KeyError, TypeError, ValueError) as exc:
            raise AssertionError(f"Invalid expires_on for {package_name}") from exc
        require(expires_on >= date.today(), f"Expired supply-chain exception: {package_name} ({expires_on})")
        for field in ("owner", "reason", "mitigation"):
            require(isinstance(item.get(field), str) and item[field].strip(), f"{package_name} must document {field}")

    print(f"Supply-chain controls: OK ({len(exceptions)} time-limited high/critical exception(s))")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
