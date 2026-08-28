"""Read-only verification for an isolated restored PostgreSQL B2B database."""

from __future__ import annotations

import argparse
import asyncio
import json
import os
from urllib.parse import urlsplit, urlunsplit

import asyncpg


REQUIRED_TABLES = ("organizations", "projects_platform", "memberships_platform", "alembic_version")


def postgres_dsn(value: str) -> str:
    parsed = urlsplit(value.strip())
    if parsed.scheme not in {"postgresql", "postgres", "postgresql+asyncpg"} or not parsed.hostname or not parsed.path.strip("/"):
        raise ValueError("restore drill requires a PostgreSQL database URL")
    if parsed.username is None or parsed.password is None:
        raise ValueError("restore drill database URL must be credentialed through the secret manager")
    return urlunsplit(("postgresql", parsed.netloc, parsed.path, parsed.query, ""))


async def inspect_restored_database(database_url: str, *, expected_revision: str | None = None) -> dict[str, object]:
    connection = await asyncpg.connect(postgres_dsn(database_url), timeout=10, command_timeout=15)
    try:
        await connection.execute("BEGIN READ ONLY")
        missing = [table for table in REQUIRED_TABLES if not await connection.fetchval("SELECT to_regclass($1)", f"public.{table}")]
        if missing:
            raise ValueError("restored database is missing required application tables")
        revision = await connection.fetchval("SELECT version_num FROM alembic_version LIMIT 1")
        if not revision:
            raise ValueError("restored database has no Alembic revision")
        if expected_revision and revision != expected_revision:
            raise ValueError("restored database Alembic revision differs from expected revision")
        orphan_projects = await connection.fetchval(
            "SELECT count(*) FROM projects_platform project LEFT JOIN organizations client ON client.id = project.client_org_id WHERE client.id IS NULL"
        )
        orphan_memberships = await connection.fetchval(
            "SELECT count(*) FROM memberships_platform membership LEFT JOIN organizations organization ON organization.id = membership.org_id WHERE organization.id IS NULL"
        )
        if orphan_projects or orphan_memberships:
            raise ValueError("restored database tenant relationships are inconsistent")
        counts = {
            "organizations": await connection.fetchval("SELECT count(*) FROM organizations"),
            "projects": await connection.fetchval("SELECT count(*) FROM projects_platform"),
            "memberships": await connection.fetchval("SELECT count(*) FROM memberships_platform"),
        }
        await connection.execute("ROLLBACK")
        return {"status": "passed", "mode": "read-only-isolated-restore", "alembic_revision": revision, "counts": counts}
    except Exception:
        try:
            await connection.execute("ROLLBACK")
        except Exception:
            pass
        raise
    finally:
        await connection.close()


def self_test() -> int:
    assert postgres_dsn("postgresql+asyncpg://user:password@restore.internal:5432/b2b") == "postgresql://user:password@restore.internal:5432/b2b"
    for unsafe in ("sqlite:///D:/Codex/sjk/khcssjk/platform.sqlite3", "postgresql://host/b2b", "postgresql://user:password@host"):
        try:
            postgres_dsn(unsafe)
        except ValueError:
            pass
        else:
            raise AssertionError("unsafe restore URL was accepted")
    print("PostgreSQL restore drill controls: OK")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database-url-env", default="B2B_RESTORE_DATABASE_URL", help="Environment-variable name containing the isolated restore URL")
    parser.add_argument("--expected-revision")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        return self_test()
    database_url = os.getenv(args.database_url_env, "")
    if not database_url:
        parser.error(f"{args.database_url_env} is not set")
    try:
        result = asyncio.run(inspect_restored_database(database_url, expected_revision=args.expected_revision))
        print(json.dumps(result, ensure_ascii=False))
    except (OSError, ValueError, asyncpg.PostgresError) as exc:
        print(json.dumps({"status": "failed", "reason": type(exc).__name__}, ensure_ascii=False))
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
