"""Run and independently inspect WebsiteBuildProgram migration reversibility."""

from pathlib import Path
import os
import sqlite3

from alembic import command
from alembic.config import Config


TARGET_REVISION = "a02b3c4d5e6f"
PREVIOUS_REVISION = "ff7b1d3e6a58"


def main() -> None:
    database_url = os.environ.get("DATABASE_URL", "")
    if not database_url.startswith("sqlite:///"):
        raise RuntimeError("Set DATABASE_URL to an isolated SQLite database before running this verifier")
    backend_dir = Path(__file__).resolve().parents[1]
    config = Config(str(backend_dir / "alembic.ini"))
    command.upgrade(config, TARGET_REVISION)
    command.downgrade(config, PREVIOUS_REVISION)
    command.upgrade(config, TARGET_REVISION)
    connection = sqlite3.connect(database_url.removeprefix("sqlite:///"))
    tables = {row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    required_tables = {"factory_website_build_programs", "factory_website_build_gates"}
    if not required_tables <= tables:
        raise AssertionError(f"Missing website-build tables after re-upgrade: {sorted(required_tables - tables)}")
    revision = connection.execute("SELECT version_num FROM alembic_version").fetchone()
    if revision != (TARGET_REVISION,):
        raise AssertionError(f"Unexpected migration revision: {revision}")
    print("Website build migration upgrade, rollback and re-upgrade verified")


if __name__ == "__main__":
    main()
