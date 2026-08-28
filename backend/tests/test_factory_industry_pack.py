import asyncio

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import models  # noqa: F401
from core.database import Base
from core.tenant_context import build_tenant_context
from models.factory_implementation import FactoryImplementationProgram
from services.factory_industry_pack import FactoryIndustryPackService, REQUIRED_CONFIGURATION, REQUIRED_EVIDENCE


def context(project_id: int):
    return build_tenant_context(agent_path="org-1/org-2", tenant_id="tenant-1", client_id="client-2", plan_id=f"plan-{project_id}")


def test_machinery_pack_requires_implementation_evidence_and_publishes_immutable_version():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            service = FactoryIndustryPackService(db)
            item = await service.create(project_id=7, context=context(7), actor="industry-owner", segment="industrial-pump-valve")
            with pytest.raises(ValueError, match="incomplete"):
                await service.validate(item["id"], project_id=7, expected_revision=1, actor="industry-owner")
            configuration = {key: f"evidence:{key}" for key in REQUIRED_CONFIGURATION}
            configuration["object-mapping"] = "product,sku,inquiry,quote,order,customer-asset,service-ticket"
            evidence = {key: f"evidence:{key}" for key in REQUIRED_EVIDENCE}
            item = await service.update(item["id"], project_id=7, expected_revision=1, actor="industry-owner", configuration=configuration, evidence=evidence)
            with pytest.raises(ValueError, match="implementation program"):
                await service.validate(item["id"], project_id=7, expected_revision=2, actor="industry-owner")
            db.add(FactoryImplementationProgram(id="implementation-complete", project_id=7, agent_path="org-1/org-2", tenant_id="tenant-1", client_id="client-2", plan_id="plan-7", title="完成实施", golden_flow="revenue", baseline_summary="基线", target_outcome="目标", current_stage="completed", status="completed", next_action="运营"))
            await db.flush()
            item = await service.validate(item["id"], project_id=7, expected_revision=2, actor="industry-owner")
            assert item["status"] == "validated"
            item = await service.publish(item["id"], project_id=7, expected_revision=3, actor="industry-owner")
            assert item["status"] == "published"
            assert item["revision"] == 4
            with pytest.raises(ValueError, match="read-only"):
                await service.update(item["id"], project_id=7, expected_revision=4, actor="industry-owner", configuration=configuration, evidence=evidence)
        await engine.dispose()
    asyncio.run(scenario())


def test_machinery_pack_is_plan_scoped_and_rejects_generic_segment():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            service = FactoryIndustryPackService(db)
            with pytest.raises(ValueError, match="industrial-pump-valve"):
                await service.create(project_id=3, context=context(3), actor="admin", segment="generic-machinery")
            item = await service.create(project_id=3, context=context(3), actor="admin", segment="industrial-pump-valve")
            assert await service.list(project_id=4) == []
            with pytest.raises(KeyError, match="tenant plan"):
                await service.validate(item["id"], project_id=4, expected_revision=1, actor="intruder")
        await engine.dispose()
    asyncio.run(scenario())
