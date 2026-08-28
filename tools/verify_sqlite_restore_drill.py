"""Non-destructive SQLite backup restore drill for local and pre-release evidence."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sqlite3
import tempfile


def inspect_backup(backup_path: Path) -> dict[str, object]:
    if not backup_path.is_file():
        raise ValueError("backup file does not exist")
    if backup_path.suffix.lower() not in {".db", ".sqlite", ".sqlite3"}:
        raise ValueError("restore drill accepts only SQLite backup files")
    if backup_path.stat().st_size == 0:
        raise ValueError("backup file is empty")

    with tempfile.TemporaryDirectory(prefix="b2b-restore-drill-") as directory:
        restored_path = Path(directory) / "restored.sqlite3"
        source = sqlite3.connect(f"file:{backup_path.as_posix()}?mode=ro", uri=True)
        try:
            target = sqlite3.connect(restored_path)
            try:
                source.backup(target)
            finally:
                target.close()
        finally:
            source.close()

        restored = sqlite3.connect(f"file:{restored_path.as_posix()}?mode=ro", uri=True)
        try:
            integrity = restored.execute("PRAGMA integrity_check").fetchone()[0]
            tables = [
                row[0]
                for row in restored.execute(
                    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
                ).fetchall()
            ]
            alembic = restored.execute("SELECT version_num FROM alembic_version LIMIT 1").fetchone()
        finally:
            restored.close()

    if integrity.lower() != "ok":
        raise ValueError(f"restored database integrity check failed: {integrity}")
    if not tables:
        raise ValueError("restored database has no application tables")
    if not alembic:
        raise ValueError("restored database has no Alembic revision")
    return {
        "status": "passed",
        "source": str(backup_path.resolve()),
        "integrity": integrity,
        "table_count": len(tables),
        "alembic_revision": alembic[0],
        "restore_workspace": "temporary and automatically removed",
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Verify a SQLite backup can be restored without changing the source backup")
    parser.add_argument("--backup", required=True, type=Path, help="Path to the SQLite backup file")
    args = parser.parse_args()
    try:
        print(json.dumps(inspect_backup(args.backup), ensure_ascii=False))
    except (OSError, sqlite3.Error, ValueError) as exc:
        print(json.dumps({"status": "failed", "reason": str(exc)}, ensure_ascii=False))
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
