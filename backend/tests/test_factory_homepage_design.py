import asyncio

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import models  # noqa: F401
from core.database import Base
from core.tenant_context import build_tenant_context
from models.factory_contract import FactoryCoreEventContract, FactoryCoreObjectContract
from models.factory_homepage_design import FactoryHomepageDesignVersion
from services.factory_homepage_design import FactoryHomepageDesignService


def context(project_id: int): return build_tenant_context(agent_path=f"hq/homepage-{project_id}", tenant_id=f"tenant-{project_id}", client_id=f"client-{project_id}", plan_id=f"plan-{project_id}")
async def contracts(db):
    db.add_all([FactoryCoreObjectContract(id="homepage-composition-version", sequence=30, label="Homepage composition version", system_of_record="content", identity_rule="tenant", minimum_fields_json="[]", lifecycle_status="frozen", schema_version=1, revision=1), FactoryCoreEventContract(id="homepage-composition-released", sequence=22, label="Homepage composition released", subject_id="homepage-composition-version", producer="content", consumers_json="[]", required_fields_json="[]", compatibility="backward", lifecycle_status="frozen", schema_version=1, revision=1)]); await db.flush()


def test_homepage_design_closes_independently_acknowledged_release():
    async def scenario():
        engine=create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection: await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            await contracts(db); service=FactoryHomepageDesignService(db); tenant=context(901)
            design=await service.create_design(project_id=901, context=tenant, actor="owner", design_key="homepage", display_name="Homepage")
            version=await service.draft_version(design["id"], project_id=901, context=tenant, actor="author", locale="en-US", composition_manifest={"navigation":{"items":["home"]},"banner":{"items":["hero"]},"recommend":{"note":"Factory"}}, source_reference="HOMEPAGE-901")
            with pytest.raises(ValueError,match="independent validation"): await service.validate_version(version["id"],project_id=901,actor="author",expected_revision=1,validation_reference="SELF")
            version=await service.validate_version(version["id"],project_id=901,actor="validator",expected_revision=1,validation_reference="VALIDATE-901")
            release=await service.prepare_publication(version["id"],project_id=901,context=tenant,actor="release-owner",target="website-homepage",rollback_reference="ROLLBACK-901")
            with pytest.raises(ValueError,match="independent approval"): await service.approve_publication(release["id"],project_id=901,actor="release-owner",expected_revision=1,approval_reference="SELF")
            release=await service.approve_publication(release["id"],project_id=901,actor="approver",expected_revision=1,approval_reference="APPROVE-901")
            with pytest.raises(ValueError,match="separate handoff actor"): await service.acknowledge_publication(release["id"],project_id=901,actor="approver",expected_revision=2,consumer_receipt_reference="SELF")
            release=await service.acknowledge_publication(release["id"],project_id=901,actor="consumer",expected_revision=2,consumer_receipt_reference="RECEIPT-901")
            workspace=await service.workspace(project_id=901)
            assert release["available"] and workspace["availability"]["status"] == "available"
            assert workspace["contract"]["customer_site_mutated_directly"] is False and workspace["contract"]["plugin_locks_overwritten"] is False
            assert len(workspace["evidence"]) == 6 and (await service.workspace(project_id=902))["designs"] == []
        await engine.dispose()
    asyncio.run(scenario())


def test_homepage_design_rejects_unsafe_or_tampered_composition():
    async def scenario():
        engine=create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection: await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            await contracts(db); service=FactoryHomepageDesignService(db); tenant=context(903); design=await service.create_design(project_id=903,context=tenant,actor="owner",design_key="homepage",display_name="Homepage")
            with pytest.raises(ValueError,match="unsafe markup"):
                await service.draft_version(design["id"],project_id=903,context=tenant,actor="author",locale="zh-CN",composition_manifest={"hero":"<script>bad()</script>"},source_reference="HOMEPAGE-903")
            version=await service.draft_version(design["id"],project_id=903,context=tenant,actor="author",locale="zh-CN",composition_manifest={"hero":"safe"},source_reference="HOMEPAGE-903")
            stored=await service._get(FactoryHomepageDesignVersion,version["id"],903,"Version"); stored.composition_manifest_json={"hero":"tampered"}; await db.flush()
            with pytest.raises(ValueError,match="unchanged composition"): await service.validate_version(version["id"],project_id=903,actor="validator",expected_revision=1,validation_reference="VALIDATE")
        await engine.dispose()
    asyncio.run(scenario())
