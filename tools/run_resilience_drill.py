"""Exercise failure recovery controls without touching external infrastructure."""

from __future__ import annotations

import json
import sqlite3
import subprocess
import tempfile
from pathlib import Path

from platform_runtime import resolve_platform_python


ROOT = Path(__file__).resolve().parents[1]


def run(script: str, *arguments: str) -> None:
    completed = subprocess.run([resolve_platform_python(), str(ROOT / "tools" / script), *arguments], cwd=ROOT, text=True, capture_output=True)
    if completed.returncode:
        raise RuntimeError(f"{script} failed: {completed.stdout}{completed.stderr}")


def main() -> int:
    run("verify_health_monitor.py")
    run("verify_background_job_queue.py")
    run("verify_job_worker.py")
    run("verify_postgres_restore_drill.py", "--self-test")
    with tempfile.TemporaryDirectory(prefix="b2b-resilience-drill-") as directory:
        backup = Path(directory) / "representative.sqlite3"
        database = sqlite3.connect(backup)
        try:
            database.execute("CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL)")
            database.execute("INSERT INTO alembic_version VALUES ('resilience-test')")
            database.execute("CREATE TABLE representative_plan (id INTEGER PRIMARY KEY, name TEXT NOT NULL)")
            database.execute("INSERT INTO representative_plan (name) VALUES ('client-plan')")
            database.commit()
        finally:
            database.close()
        run("verify_sqlite_restore_drill.py", "--backup", str(backup))
    print(json.dumps({"status": "passed", "drills": ["health-failure-recovery", "queue-retry", "worker-recovery", "postgres-policy", "sqlite-restore"]}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
