import asyncio

import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import models  # noqa: F401
from core.database import Base
from models.auth import User
from models.platform import Membership, Organization, Project
from schemas.auth import UserResponse
from services.tenant_access import require_project_access, visible_organization_ids, visible_project_ids


def test_agency_membership_sees_only_its_descendants_and_never_a_sibling_branch():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            user = User(id="agency-user", email="agency@example.test", role="user")
            hq = Organization(name="HQ", code="HQ", org_type="hq", status="active", lineage_path="1")
            db.add_all([user, hq])
            await db.flush()
            branch_a = Organization(name="A", code="A", org_type="agency", parent_id=hq.id, root_org_id=hq.id, root_agency_id=None, agent_level=1, status="active", lineage_path=f"{hq.id}")
            branch_b = Organization(name="B", code="B", org_type="agency", parent_id=hq.id, root_org_id=hq.id, root_agency_id=None, agent_level=1, status="active", lineage_path=f"{hq.id}")
            db.add_all([branch_a, branch_b])
            await db.flush()
            branch_a.root_agency_id, branch_b.root_agency_id = branch_a.id, branch_b.id
            client_a = Organization(name="Client A", code="CA", org_type="client", parent_id=branch_a.id, root_org_id=hq.id, root_agency_id=branch_a.id, status="active", lineage_path=f"{hq.id}/{branch_a.id}")
            client_b = Organization(name="Client B", code="CB", org_type="client", parent_id=branch_b.id, root_org_id=hq.id, root_agency_id=branch_b.id, status="active", lineage_path=f"{hq.id}/{branch_b.id}")
            db.add_all([client_a, client_b])
            await db.flush()
            client_a.lineage_path = f"{hq.id}/{branch_a.id}/{client_a.id}"
            client_b.lineage_path = f"{hq.id}/{branch_b.id}/{client_b.id}"
            plan_a, plan_b = Project(client_org_id=client_a.id, name="Plan A", code="PA", status="active"), Project(client_org_id=client_b.id, name="Plan B", code="PB", status="active")
            db.add_all([plan_a, plan_b, Membership(user_id=user.id, org_id=branch_a.id, status="active")])
            await db.commit()

            actor = UserResponse(id=user.id, email=user.email, role="user")
            assert await visible_organization_ids(db, current_user=actor) == {branch_a.id, client_a.id}
            assert await visible_project_ids(db, current_user=actor) == {plan_a.id}
            assert (await require_project_access(db, current_user=actor, project_id=plan_a.id)).project.id == plan_a.id
            with pytest.raises(HTTPException) as denied:
                await require_project_access(db, current_user=actor, project_id=plan_b.id)
            assert denied.value.status_code == 403
        await engine.dispose()

    asyncio.run(scenario())
