"""Create an immutable, reviewable manifest for a B2B release.

The tool writes metadata only. Packaging and remote deployment remain separate
operations so source development cannot accidentally alter production hosts.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import subprocess


ROOT = Path(__file__).resolve().parents[1]


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def git_revision(source: Path) -> str | None:
    """Return the last committed revision that changed the represented source."""
    try:
        relative = source.relative_to(ROOT)
        result = subprocess.run(
            ["git", "-C", str(ROOT), "log", "-1", "--format=%H", "--", str(relative)],
            check=True,
            capture_output=True,
            text=True,
        )
    except (OSError, subprocess.CalledProcessError):
        return None
    return result.stdout.strip() or None


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--role", choices=("hq", "agency", "client", "plan"), required=True)
    parser.add_argument("--version", required=True)
    parser.add_argument("--deployment-id", required=True)
    parser.add_argument("--source", type=Path, required=True, help="Source directory represented by this release")
    args = parser.parse_args()

    source = args.source.resolve()
    if not source.is_dir():
        raise SystemExit(f"Source directory does not exist: {source}")

    tracked = [path for path in source.rglob("*") if path.is_file() and ".git" not in path.parts]
    files = [
        {"path": path.relative_to(source).as_posix(), "sha256": sha256(path), "bytes": path.stat().st_size}
        for path in sorted(tracked)
    ]
    try:
        source_path = source.relative_to(ROOT).as_posix()
    except ValueError:
        source_path = None

    manifest = {
        "schemaVersion": 2,
        "role": args.role,
        "version": args.version,
        "deploymentId": args.deployment_id,
        "sourcePath": source_path,
        "sourceRevision": git_revision(source),
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "files": files,
    }
    output = ROOT / "release" / "manifests" / f"{args.role}-{args.version}.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Release manifest: {output}")
    print(f"Tracked files: {len(files)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
