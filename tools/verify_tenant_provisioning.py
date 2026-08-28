"""Exercise transactional agency-to-client-plan automatic provisioning."""

from __future__ import annotations

import asyncio
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

import models  # noqa: E402,F401
from core.database import Base  # noqa: E402
from models.platform import Organization, PlanRuntimeConfig, Project  # noqa: E402
from services.tenant_provisioning import provision_client_plan  # noqa: E402
from sqlalchemy import select  # noqa: E402
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine  # noqa: E402


async def verify() -> None:
    with tempfile.TemporaryDirectory(prefix="b2b-provision-") as directory:
        engine = create_async_engine(f"sqlite+aiosqlite:///{Path(directory, 'provision.sqlite3').as_posix()}")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        try:
            async with async_sessionmaker(engine, expire_on_commit=False)() as session:
                hq = Organization(name="HQ", code="HQ-PROVISION", org_type="hq", lineage_path="", status="active")
                session.add(hq)
                await session.flush()
                agency = Organization(name="Agency", code="A-PROVISION", org_type="agency", parent_id=hq.id, root_org_id=hq.id, root_agency_id=0, agent_level=1, lineage_path=str(hq.id), status="active")
                session.add(agency)
                await session.flush()
                provisioned = await provision_client_plan(session, agency_org_id=agency.id, client_name="Client", client_code="CLIENT-PROVISION", plan_name="Plan", plan_code="PLAN-PROVISION")
                client = await session.scalar(select(Organization).where(Organization.id == provisioned.client_org_id))
                project = await session.scalar(select(Project).where(Project.id == provisioned.project_id))
                runtime = await session.scalar(select(PlanRuntimeConfig).where(PlanRuntimeConfig.project_id == provisioned.project_id))
                assert client and client.parent_id == agency.id and client.lineage_path == f"{hq.id}/{agency.id}"
                assert project and runtime and runtime.deployment_id == "shared-stamp-a"
        finally:
            await engine.dispose()


def main() -> int:
    asyncio.run(verify())
    print("Tenant provisioning: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
