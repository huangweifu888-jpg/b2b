"""Compare the live frontend and backend developer target manifests.

This verifier is deliberately read-only. It consumes only the code-owned page
registry and fails when schema, normalized target identity, ordering, or the
final SHA-256 differs across the TypeScript/JavaScript and Python runtimes.
"""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = PROJECT_ROOT / "backend"
FRONTEND_EXPORTER = PROJECT_ROOT / "frontend" / "scripts" / "export-developer-target-manifest.mjs"


def _load_frontend_manifest() -> dict[str, Any]:
    node_command = shutil.which("node")
    if not node_command:
        raise RuntimeError("Node.js is required for developer target manifest parity")
    completed = subprocess.run(
        [node_command, str(FRONTEND_EXPORTER)],
        cwd=PROJECT_ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        shell=False,
        timeout=30,
        check=False,
    )
    if completed.returncode != 0:
        output = "\n".join(part for part in (completed.stdout, completed.stderr) if part).strip()
        raise RuntimeError(f"Frontend target manifest export failed: {output or 'unknown error'}")
    try:
        manifest = json.loads(completed.stdout)
    except json.JSONDecodeError as exc:
        raise RuntimeError("Frontend target manifest exporter returned invalid JSON") from exc
    if not isinstance(manifest, dict):
        raise RuntimeError("Frontend target manifest exporter returned an invalid payload")
    return manifest


def _load_backend_manifest() -> dict[str, Any]:
    sys.path.insert(0, str(BACKEND_ROOT))
    from routers import local_dev  # pylint: disable=import-outside-toplevel

    schema_version = getattr(local_dev, "DEVELOPER_WORKFLOW_TARGET_MANIFEST_SCHEMA_VERSION", None)
    if not isinstance(schema_version, int) or isinstance(schema_version, bool):
        raise RuntimeError("Backend target manifest schema version is unavailable")
    fingerprint, targets = local_dev._current_developer_target_manifest("global:global")
    return {
        "schemaVersion": schema_version,
        "targets": targets,
        "fingerprint": fingerprint,
    }


def main() -> int:
    frontend_manifest = _load_frontend_manifest()
    backend_manifest = _load_backend_manifest()
    mismatches = [
        field
        for field in ("schemaVersion", "targets", "fingerprint")
        if frontend_manifest.get(field) != backend_manifest.get(field)
    ]
    if mismatches:
        raise RuntimeError(
            "Developer target manifest parity failed for: " + ", ".join(mismatches)
        )
    targets = frontend_manifest.get("targets") or []
    print(
        "Developer target manifest parity passed: "
        f"{len(targets)} targets, {frontend_manifest['fingerprint']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
