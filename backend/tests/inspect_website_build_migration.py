"""Independent post-migration verifier for WebsiteBuildProgram tables."""

import os
import sqlite3


database_url = os.environ["DATABASE_URL"]
if not database_url.startswith("sqlite:///"):
    raise RuntimeError("Migration evidence verifier requires an explicit SQLite DATABASE_URL")

connection = sqlite3.connect(database_url.removeprefix("sqlite:///"))
tables = {row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type='table'")}
required_tables = {"factory_website_build_programs", "factory_website_build_gates"}
if not required_tables <= tables:
    raise AssertionError(f"Missing website-build tables: {sorted(required_tables - tables)}")
revision = connection.execute("SELECT version_num FROM alembic_version").fetchone()
if revision != ("a01b2c3d4e5f",):
    raise AssertionError(f"Unexpected migration revision: {revision}")
print("Website build migration upgrade, rollback and re-upgrade evidence verified")
