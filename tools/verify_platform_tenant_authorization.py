"""Verify organization and plan boundaries without touching local user data."""

from __future__ import annotations

import asyncio
import tempfile
from pathlib import Path
import sys


BACKEND = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(BACKEND))

import models  # noqa: F401 - registers every ORM table
from core.database import Base
from fastapi import HTTPException
from models.platform import Membership, Organization, Project
from schemas.auth import UserResponse
from services.tenant_access import (
    require_project_access,
    visible_organization_ids,
    visible_project_ids,
)
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine


async def expect_forbidden(coroutine) -> None:
    try:
        await coroutine
    except HTTPException as exc:
        assert exc.status_code == 403, exc.detail
        return
    raise AssertionError("cross-tenant access was unexpectedly allowed")


async def main() -> None:
    with tempfile.TemporaryDirectory(prefix="b2b-tenant-auth-") as directory:
        database_url = f"sqlite+aiosqlite:///{Path(directory, 'tenant-auth.sqlite3').as_posix()}"
        engine = create_async_engine(database_url)
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        try:
            async with engine.begin() as connection:
                await connection.run_sync(Base.metadata.create_all)

            async with sessions() as db:
                hq = Organization(name="HQ", code="HQ-AUTH", org_type="hq", lineage_path="")
                agency_a = Organization(name="Agency A", code="A-AUTH", org_type="agency", parent_id=1, lineage_path="1")
                agency_b = Organization(name="Agency B", code="B-AUTH", org_type="agency", parent_id=1, lineage_path="1")
                client_a = Organization(name="Client A", code="CA-AUTH", org_type="client", parent_id=2, lineage_path="1/2")
                client_b = Organization(name="Client B", code="CB-AUTH", org_type="client", parent_id=3, lineage_path="1/3")
                db.add_all([hq, agency_a, agency_b, client_a, client_b])
                await db.flush()
                project_a1 = Project(client_org_id=client_a.id, name="Plan A1", code="PA1", status="active")
                project_a2 = Project(client_org_id=client_a.id, name="Plan A2", code="PA2", status="active")
                project_b1 = Project(client_org_id=client_b.id, name="Plan B1", code="PB1", status="active")
                db.add_all([project_a1, project_a2, project_b1])
                await db.flush()
                db.add_all(
                    [
                        Membership(user_id="agency-user", org_id=agency_a.id, status="active"),
                        Membership(user_id="plan-user", org_id=client_a.id, project_id=project_a1.id, status="active"),
                    ]
                )
                await db.commit()

                agency_user = UserResponse(id="agency-user", email="agency@example.test", name="Agency", role="user")
                plan_user = UserResponse(id="plan-user", email="plan@example.test", name="Plan", role="user")

                assert {agency_a.id, client_a.id}.issubset(await visible_organization_ids(db, current_user=agency_user))
                assert client_b.id not in await visible_organization_ids(db, current_user=agency_user)
                assert {project_a1.id, project_a2.id}.issubset(await visible_project_ids(db, current_user=agency_user))
                assert project_b1.id not in await visible_project_ids(db, current_user=agency_user)
                await require_project_access(db, current_user=agency_user, project_id=project_a2.id)
                await expect_forbidden(require_project_access(db, current_user=agency_user, project_id=project_b1.id))

                assert await visible_project_ids(db, current_user=plan_user) == {project_a1.id}
                await require_project_access(db, current_user=plan_user, project_id=project_a1.id)
                await expect_forbidden(require_project_access(db, current_user=plan_user, project_id=project_a2.id))
        finally:
            await engine.dispose()

    print("Platform tenant authorization: OK")


if __name__ == "__main__":
    asyncio.run(main())
