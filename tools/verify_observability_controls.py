"""Fast checks for audit-data redaction and non-destructive restore tooling."""

from __future__ import annotations

import sqlite3
import subprocess
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
sys.path.insert(0, str(BACKEND))

from services.audit import audit_detail_from_json, redact_audit_detail  # noqa: E402


def main() -> int:
    redacted = redact_audit_detail(
        {"version": "1.2.3", "api_token": "do-not-store", "nested": {"password": "do-not-store"}}
    )
    if redacted["api_token"] != "[redacted]" or redacted["nested"]["password"] != "[redacted]":
        print("Audit detail redaction failed")
        return 1
    legacy = audit_detail_from_json('{"authorization":"Bearer value","event":"ok"}')
    if legacy["authorization"] != "[redacted]" or legacy["event"] != "ok":
        print("Legacy audit detail redaction failed")
        return 1

    with tempfile.TemporaryDirectory(prefix="b2b-restore-fixture-") as directory:
        backup = Path(directory) / "fixture.sqlite3"
        connection = sqlite3.connect(backup)
        try:
            connection.execute("CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL)")
            connection.execute("INSERT INTO alembic_version VALUES ('a84d6c21e35f')")
            connection.execute("CREATE TABLE projects_platform (id INTEGER PRIMARY KEY, name TEXT NOT NULL)")
            connection.execute("INSERT INTO projects_platform (name) VALUES ('restore drill fixture')")
            connection.commit()
        finally:
            connection.close()
        result = subprocess.run(
            [sys.executable, str(ROOT / "tools" / "verify_sqlite_restore_drill.py"), "--backup", str(backup)],
            cwd=ROOT,
            check=False,
            capture_output=True,
            text=True,
        )
    if result.returncode != 0 or '"status": "passed"' not in result.stdout:
        print("Restore drill verification failed")
        print(result.stdout)
        print(result.stderr)
        return 1
    print("Observability controls: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
