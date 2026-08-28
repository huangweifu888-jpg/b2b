"""Exercise hierarchy-aware plan access against an isolated temporary database."""

from __future__ import annotations

import asyncio
from pathlib import Path
import sys
import tempfile


BACKEND = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(BACKEND))

from core.database import Base  # noqa: E402
from models.auth import User  # noqa: E402
from models.platform import Membership, Organization, Project  # noqa: E402
from schemas.auth import UserResponse  # noqa: E402
from services.tenant_access import require_project_access  # noqa: E402
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine  # noqa: E402
from fastapi import HTTPException  # noqa: E402


async def main() -> int:
    with tempfile.TemporaryDirectory(prefix="b2b-tenant-") as temp_dir:
        db_path = Path(temp_dir) / "tenant-test.sqlite3"
        engine = create_async_engine(f"sqlite+aiosqlite:///{db_path.as_posix()}")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)

        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with sessions() as session:
            owner = User(id="owner", email="owner@example.test", role="user")
            stranger = User(id="stranger", email="stranger@example.test", role="user")
            hq = Organization(name="HQ", code="HQ", org_type="hq", status="active")
            session.add_all([owner, stranger, hq])
            await session.flush()
            agency = Organization(
                name="Agency", code="A001", org_type="agency", parent_id=hq.id,
                root_org_id=hq.id, root_agency_id=None, agent_level=1, lineage_path=f"{hq.id}", status="active",
            )
            session.add(agency)
            await session.flush()
            agency.root_agency_id = agency.id
            agency.lineage_path = f"{hq.id}/{agency.id}"
            client = Organization(
                name="Client", code="C001", org_type="client", parent_id=agency.id,
                root_org_id=hq.id, root_agency_id=agency.id, lineage_path=f"{hq.id}/{agency.id}", status="active",
            )
            session.add(client)
            await session.flush()
            client.lineage_path = f"{hq.id}/{agency.id}/{client.id}"
            project = Project(client_org_id=client.id, name="Plan", code="P001", status="active")
            session.add(project)
            await session.flush()
            session.add(Membership(user_id=owner.id, org_id=agency.id, project_id=None, status="active"))
            await session.commit()

            allowed = await require_project_access(
                session,
                current_user=UserResponse(id=owner.id, email=owner.email, role=owner.role),
                project_id=project.id,
            )
            assert allowed.context.client_id == f"client-{client.id}"
            assert allowed.context.plan_id == f"plan-{project.id}"
            try:
                await require_project_access(
                    session,
                    current_user=UserResponse(id=stranger.id, email=stranger.email, role=stranger.role),
                    project_id=project.id,
                )
            except HTTPException as exc:
                assert exc.status_code == 403
            else:
                raise AssertionError("Unrelated user unexpectedly accessed the plan")
        await engine.dispose()
    print("Multitenant runtime access: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
