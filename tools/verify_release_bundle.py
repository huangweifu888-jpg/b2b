"""Verify a release ZIP contains exactly the manifest-described payload."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
from zipfile import BadZipFile, ZipFile

from verify_release_manifest import validate_manifest_structure


def _sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def verify_bundle(path: Path) -> dict[str, object]:
    try:
        with ZipFile(path) as archive:
            names = archive.namelist()
            if len(names) != len(set(names)):
                raise ValueError("Release bundle contains duplicate paths")
            if any(PurePosixPath(name).is_absolute() or ".." in PurePosixPath(name).parts for name in names):
                raise ValueError("Release bundle contains unsafe paths")
            if "release-manifest.json" not in names or "bundle-metadata.json" not in names:
                raise ValueError("Release bundle metadata is missing")
            manifest_copy = archive.read("release-manifest.json")
            manifest, _ = validate_manifest_structure(json.loads(manifest_copy))
            metadata = json.loads(archive.read("bundle-metadata.json"))
            if metadata.get("manifestSha256") != _sha256_bytes(manifest_copy):
                raise ValueError("Release bundle manifest digest mismatch")
            expected = {"release-manifest.json", "bundle-metadata.json"}
            for item in manifest["files"]:
                name = f"payload/{item['path']}"
                expected.add(name)
                content = archive.read(name)
                if len(content) != item["bytes"] or _sha256_bytes(content) != item["sha256"]:
                    raise ValueError(f"Release bundle payload mismatch: {item['path']}")
            if set(names) != expected:
                raise ValueError("Release bundle contains files not listed in the manifest")
    except (OSError, BadZipFile, json.JSONDecodeError, KeyError) as exc:
        raise ValueError(f"Cannot verify release bundle: {type(exc).__name__}") from exc
    return {"status": "verified", "role": manifest["role"], "version": manifest["version"], "file_count": len(manifest["files"])}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("bundle", type=Path)
    args = parser.parse_args()
    try:
        print(json.dumps(verify_bundle(args.bundle), ensure_ascii=False))
    except ValueError as exc:
        print(json.dumps({"status": "failed", "reason": str(exc)}, ensure_ascii=False))
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
