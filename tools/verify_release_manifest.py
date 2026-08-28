"""Verify that a release manifest matches its local source files and safe schema."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
VALID_ROLES = {"hq", "agency", "client", "plan"}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _safe_relative_path(value: object) -> str:
    if not isinstance(value, str) or not value or "\\" in value:
        raise ValueError("Manifest file paths must be non-empty POSIX relative paths")
    path = PurePosixPath(value)
    if path.is_absolute() or ".." in path.parts or path.as_posix() != value:
        raise ValueError("Manifest file path escapes its release source")
    return value


def validate_manifest_structure(manifest: object) -> tuple[dict[str, Any], str]:
    if not isinstance(manifest, dict) or manifest.get("schemaVersion") != 2:
        raise ValueError("Release manifest must use schemaVersion 2")
    if manifest.get("role") not in VALID_ROLES:
        raise ValueError("Release manifest role is invalid")
    if not isinstance(manifest.get("version"), str) or not manifest["version"].strip():
        raise ValueError("Release manifest version is required")
    if not isinstance(manifest.get("deploymentId"), str) or not manifest["deploymentId"].strip():
        raise ValueError("Release manifest deploymentId is required")
    source_path = _safe_relative_path(manifest.get("sourcePath"))
    files = manifest.get("files")
    if not isinstance(files, list) or not files:
        raise ValueError("Release manifest must contain at least one file")
    seen: set[str] = set()
    for item in files:
        if not isinstance(item, dict):
            raise ValueError("Release manifest file record is invalid")
        relative = _safe_relative_path(item.get("path"))
        if relative in seen:
            raise ValueError("Release manifest contains a duplicate file path")
        seen.add(relative)
        if not isinstance(item.get("bytes"), int) or item["bytes"] < 0:
            raise ValueError(f"Release manifest byte length is invalid: {relative}")
        digest = item.get("sha256")
        if not isinstance(digest, str) or len(digest) != 64 or any(char not in "0123456789abcdef" for char in digest.lower()):
            raise ValueError(f"Release manifest SHA-256 is invalid: {relative}")
    return manifest, source_path


def load_manifest(path: Path) -> tuple[dict[str, Any], Path]:
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"Cannot read release manifest: {exc}") from exc
    manifest, source_path = validate_manifest_structure(raw)
    source = (ROOT / source_path).resolve()
    if ROOT not in source.parents or not source.is_dir():
        raise ValueError("Release sourcePath must resolve to an existing directory under this repository")
    return manifest, source


def verify_manifest(path: Path) -> tuple[dict[str, Any], Path]:
    manifest, source = load_manifest(path)
    failures: list[str] = []
    for item in manifest["files"]:
        candidate = (source / item["path"]).resolve()
        if source not in candidate.parents or not candidate.is_file() or candidate.stat().st_size != item["bytes"] or sha256(candidate) != item["sha256"]:
            failures.append(item["path"])
    if failures:
        raise ValueError("Release manifest mismatch: " + ", ".join(failures))
    return manifest, source


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("manifest", type=Path)
    parser.add_argument("--print-digest", action="store_true", help="Print only the SHA-256 of the manifest file")
    args = parser.parse_args()
    try:
        verify_manifest(args.manifest)
    except ValueError as exc:
        print(str(exc))
        return 1
    if args.print_digest:
        print(sha256(args.manifest))
    else:
        print(f"Release manifest verified: {args.manifest}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
