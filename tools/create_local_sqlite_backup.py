"""Create a verified, immutable local SQLite backup without touching the source database."""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import uuid

from verify_sqlite_restore_drill import inspect_backup


LOCAL_ENVIRONMENTS = {"dev", "development", "local", "test", "testing"}


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def create_backup(source: Path, backup_root: Path) -> dict[str, object]:
    """Snapshot a local SQLite database, verify restoreability, then publish it atomically."""
    source = source.resolve()
    backup_root = backup_root.resolve()
    if not source.is_file() or source.suffix.lower() not in {".db", ".sqlite", ".sqlite3"}:
        raise ValueError("source must be an existing SQLite database file")
    if source.parent == backup_root or source.is_relative_to(backup_root):
        raise ValueError("source database must not be stored inside the backup root")

    backup_root.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backup_id = f"sqlite-{stamp}-{uuid.uuid4().hex[:8]}"
    partial = backup_root / f".{backup_id}.partial.sqlite3"
    artifact = backup_root / f"{backup_id}.sqlite3"
    manifest = backup_root / f"{backup_id}.json"

    try:
        source_connection = sqlite3.connect(f"file:{source.as_posix()}?mode=ro", uri=True)
        try:
            target_connection = sqlite3.connect(partial)
            try:
                source_connection.backup(target_connection)
            finally:
                target_connection.close()
        finally:
            source_connection.close()
        verification = inspect_backup(partial)
        checksum = _sha256(partial)
        partial.replace(artifact)
        record = {
            "backup_id": backup_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "source_name": source.name,
            "artifact": artifact.name,
            "sha256": checksum,
            "size_bytes": artifact.stat().st_size,
            "restore_verification": {key: value for key, value in verification.items() if key != "source"},
            "immutable": True,
        }
        manifest.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8")
        return record
    except Exception:
        partial.unlink(missing_ok=True)
        raise


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database", required=True, type=Path, help="Explicit local SQLite database to snapshot")
    parser.add_argument("--backup-root", required=True, type=Path, help="Backup directory, outside source tree and database root")
    args = parser.parse_args()
    if os.getenv("ENVIRONMENT", "dev").strip().lower() not in LOCAL_ENVIRONMENTS:
        parser.error("This SQLite backup tool is for local development only; production uses managed PostgreSQL backups")
    try:
        print(json.dumps(create_backup(args.database, args.backup_root), ensure_ascii=False))
    except (OSError, sqlite3.Error, ValueError) as exc:
        print(json.dumps({"status": "failed", "reason": str(exc)}, ensure_ascii=False))
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
