"""Exercise local backup creation and isolated restore verification without touching real data."""

from __future__ import annotations

import json
from pathlib import Path
import sqlite3
import subprocess
import sys
import tempfile


ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    with tempfile.TemporaryDirectory(prefix="b2b-backup-automation-") as directory:
        workspace = Path(directory)
        source = workspace / "source.sqlite3"
        backup_root = workspace / "backups"
        database = sqlite3.connect(source)
        try:
            database.execute("CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL)")
            database.execute("INSERT INTO alembic_version VALUES ('test-revision')")
            database.execute("CREATE TABLE application_data (id INTEGER PRIMARY KEY, value TEXT NOT NULL)")
            database.execute("INSERT INTO application_data (value) VALUES ('source-is-unchanged')")
            database.commit()
        finally:
            database.close()
        completed = subprocess.run(
            [sys.executable, str(ROOT / "tools" / "create_local_sqlite_backup.py"), "--database", str(source), "--backup-root", str(backup_root)],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=True,
        )
        record = json.loads(completed.stdout)
        artifact = backup_root / str(record["artifact"])
        assert artifact.is_file()
        assert (backup_root / f"{record['backup_id']}.json").is_file()
        assert record["restore_verification"]["status"] == "passed"
        source_read = sqlite3.connect(f"file:{source.as_posix()}?mode=ro", uri=True)
        try:
            assert source_read.execute("SELECT value FROM application_data").fetchone()[0] == "source-is-unchanged"
        finally:
            source_read.close()
    print("Backup automation controls: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
