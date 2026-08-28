"""Generate a deterministic CycloneDX SBOM from frontend/package-lock.json.

The lockfile, rather than node_modules, is the source of truth.  That keeps
the inventory reproducible on a release runner and makes missing lock updates
visible in code review.
"""

from __future__ import annotations

import argparse
import base64
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote


ROOT = Path(__file__).resolve().parents[1]
LOCKFILE = ROOT / "frontend" / "package-lock.json"
NAMESPACE = uuid.UUID("a2b456a3-8c32-4122-9417-6bfa8b139f5d")


def package_name(lock_path: str) -> str:
    marker = "node_modules/"
    return lock_path.rsplit(marker, 1)[1]


def component(lock_path: str, record: dict[str, object]) -> dict[str, object] | None:
    name = package_name(lock_path)
    version = record.get("version")
    if not isinstance(version, str) or not version:
        return None
    item: dict[str, object] = {
        "type": "library",
        "name": name,
        "version": version,
        # Package URL keeps the npm scope path separator while encoding '@'.
        "purl": f"pkg:npm/{quote(name, safe='/')}@{quote(version, safe='')}",
    }
    integrity = record.get("integrity")
    if isinstance(integrity, str) and integrity.startswith("sha512-"):
        try:
            item["hashes"] = [{"alg": "SHA-512", "content": base64.b64decode(integrity[7:]).hex()}]
        except ValueError:
            pass
    return item


def build_sbom() -> dict[str, object]:
    lock = json.loads(LOCKFILE.read_text(encoding="utf-8"))
    components = [
        item
        for lock_path, record in lock.get("packages", {}).items()
        if lock_path.startswith("node_modules/") and isinstance(record, dict)
        for item in [component(lock_path, record)]
        if item is not None
    ]
    components.sort(key=lambda item: (str(item["name"]), str(item["version"])))
    serial_basis = "|".join(f"{item['name']}@{item['version']}" for item in components)
    return {
        "bomFormat": "CycloneDX",
        "specVersion": "1.5",
        "serialNumber": f"urn:uuid:{uuid.uuid5(NAMESPACE, serial_basis)}",
        "version": 1,
        "metadata": {
            "timestamp": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
            "tools": [{"vendor": "B2B", "name": "generate_frontend_sbom.py"}],
            "component": {"type": "application", "name": "b2b-frontend"},
            "properties": [{"name": "b2b:lockfile", "value": "frontend/package-lock.json"}],
        },
        "components": components,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate the frontend CycloneDX SBOM")
    parser.add_argument("--output", required=True, type=Path, help="Output .cdx.json file")
    args = parser.parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(build_sbom(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Frontend SBOM: {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
