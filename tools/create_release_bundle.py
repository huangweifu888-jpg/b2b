"""Package exactly one verified manifest into a portable, inspectable ZIP artifact."""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import tempfile
from zipfile import ZIP_DEFLATED, ZipFile

from verify_release_manifest import sha256, verify_manifest


def create_bundle(manifest_path: Path, output: Path) -> dict[str, object]:
    manifest, source = verify_manifest(manifest_path)
    output = output.resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    metadata = {
        "schemaVersion": 1,
        "manifestSha256": sha256(manifest_path),
        "role": manifest["role"],
        "version": manifest["version"],
        "deploymentId": manifest["deploymentId"],
        "sourceRevision": manifest.get("sourceRevision"),
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "fileCount": len(manifest["files"]),
    }
    with tempfile.NamedTemporaryFile(prefix="b2b-release-", suffix=".zip", dir=output.parent, delete=False) as handle:
        temporary = Path(handle.name)
    try:
        with ZipFile(temporary, "w", compression=ZIP_DEFLATED) as archive:
            archive.writestr("release-manifest.json", manifest_path.read_bytes())
            archive.writestr("bundle-metadata.json", json.dumps(metadata, ensure_ascii=False, sort_keys=True, separators=(",", ":")))
            for item in manifest["files"]:
                archive.write(source / item["path"], arcname=f"payload/{item['path']}")
        temporary.replace(output)
    finally:
        temporary.unlink(missing_ok=True)
    return {"artifact": str(output), "sha256": sha256(output), **metadata}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    try:
        print(json.dumps(create_bundle(args.manifest, args.output), ensure_ascii=False))
    except (OSError, ValueError) as exc:
        print(json.dumps({"status": "failed", "reason": str(exc)}, ensure_ascii=False))
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
