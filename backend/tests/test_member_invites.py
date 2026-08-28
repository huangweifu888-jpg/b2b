import asyncio

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import models  # noqa: F401
from core.database import Base
from models.platform import Organization
from services.membership_invites import claim_membership_invite, create_membership_invite
from services.organization_roles import ensure_default_roles


def test_member_invitation_is_one_time_role_bound_and_not_stored_in_plaintext():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        session_factory = async_sessionmaker(engine, expire_on_commit=False)
        async with session_factory() as db:
            agency = Organization(name="验收代理", code="TEST-AGENCY", org_type="agency", status="active", lineage_path="1")
            db.add(agency)
            await db.flush()
            roles = await ensure_default_roles(db, agency)
            assert len(roles) == 1
            invite, raw_code = await create_membership_invite(
                db,
                org_id=agency.id,
                role_id=roles[0].id,
                project_id=None,
                email="member@example.invalid",
                invited_by="tester",
                expires_in_hours=24,
            )
            assert raw_code not in invite.code_hash
            claimed = await claim_membership_invite(db, raw_code=raw_code, email="member@example.invalid")
            assert claimed.id == invite.id
            assert claimed.status == "accepted"
            try:
                await claim_membership_invite(db, raw_code=raw_code, email="member@example.invalid")
            except ValueError:
                pass
            else:
                raise AssertionError("A consumed invitation must not be reusable")
        await engine.dispose()

    asyncio.run(scenario())
