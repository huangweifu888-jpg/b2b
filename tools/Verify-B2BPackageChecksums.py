#!/usr/bin/env python3
"""Verify a B2B portable package against PACKAGE_SHA256SUMS.txt."""

from __future__ import annotations

import argparse
import hashlib
from pathlib import Path
import re
import sys


LINE_PATTERN = re.compile(r"^(?P<hash>[0-9a-f]{64})  (?P<path>.+)$")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("package_root", type=Path)
    parser.add_argument(
        "--refresh-path",
        action="append",
        default=[],
        help="Recalculate a changed package-relative file or directory before verification.",
    )
    parser.add_argument(
        "--refresh-only",
        action="store_true",
        help="Update requested entries without re-reading unchanged files.",
    )
    args = parser.parse_args()

    root = args.package_root.resolve(strict=True)
    manifest = root / "PACKAGE_SHA256SUMS.txt"
    if not manifest.is_file():
        raise SystemExit(f"checksum manifest missing: {manifest}")

    expected: dict[str, str] = {}
    for number, line in enumerate(
        manifest.read_text(encoding="utf-8-sig").splitlines(), start=1
    ):
        if not line.strip():
            continue
        match = LINE_PATTERN.fullmatch(line)
        if not match:
            raise SystemExit(f"invalid checksum line {number}: {line}")
        expected[match.group("path").replace("\\", "/")] = match.group("hash")

    if args.refresh_path:
        refreshed = 0
        for requested in args.refresh_path:
            requested_path = (root / requested).resolve(strict=True)
            try:
                requested_path.relative_to(root)
            except ValueError as exc:
                raise SystemExit(f"refresh path escapes package root: {requested}") from exc
            candidates = (
                [requested_path]
                if requested_path.is_file()
                else sorted(path for path in requested_path.rglob("*") if path.is_file())
            )
            for file_path in candidates:
                relative = file_path.relative_to(root).as_posix()
                if file_path == manifest:
                    continue
                expected[relative] = sha256(file_path)
                refreshed += 1
        lines = [f"{expected[path]}  {path.replace('/', chr(92))}" for path in sorted(expected)]
        manifest.write_text("\n".join(lines) + "\n", encoding="utf-8")
        print(f"refreshed={refreshed} manifest_entries={len(expected)}", flush=True)
        if args.refresh_only:
            return 0

    verified = 0
    for relative, expected_hash in expected.items():
        file_path = (root / Path(relative)).resolve(strict=False)
        try:
            file_path.relative_to(root)
        except ValueError as exc:
            raise SystemExit(f"path escapes package root: {relative}") from exc
        if not file_path.is_file():
            raise SystemExit(f"missing file: {relative}")
        actual_hash = sha256(file_path)
        if actual_hash != expected_hash:
            raise SystemExit(
                f"checksum mismatch: {relative}\n"
                f"expected {expected_hash}\nactual   {actual_hash}"
            )
        verified += 1
        if verified % 2000 == 0:
            print(f"verified {verified}/{len(expected)}", flush=True)

    actual = {
        path.relative_to(root).as_posix()
        for path in root.rglob("*")
        if path.is_file() and path != manifest
    }
    unexpected = sorted(actual.difference(expected))
    if unexpected:
        preview = "\n".join(unexpected[:20])
        raise SystemExit(f"unexpected files ({len(unexpected)}):\n{preview}")

    print(f"OK verified={verified} unexpected=0 root={root}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
