import asyncio

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import models  # noqa: F401
from core.database import Base
from core.tenant_context import build_tenant_context
from models.factory_company_profile import FactoryCompanyProfileVersion
from models.factory_contract import FactoryCoreEventContract, FactoryCoreObjectContract
from services.factory_company_profile import FactoryCompanyProfileService


def context(project_id: int):
    return build_tenant_context(agent_path=f"hq/company-{project_id}", tenant_id=f"tenant-{project_id}", client_id=f"client-{project_id}", plan_id=f"plan-{project_id}")


async def contracts(db):
    db.add_all([
        FactoryCoreObjectContract(id="company-profile-version", sequence=29, label="Company profile version", system_of_record="content", identity_rule="tenant", minimum_fields_json="[]", lifecycle_status="frozen", schema_version=1, revision=1),
        FactoryCoreEventContract(id="company-profile-released", sequence=21, label="Company profile released", subject_id="company-profile-version", producer="content", consumers_json="[]", required_fields_json="[]", compatibility="backward", lifecycle_status="frozen", schema_version=1, revision=1),
    ])
    await db.flush()


def test_company_profile_closes_independently_acknowledged_release():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection: await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            await contracts(db); service = FactoryCompanyProfileService(db); tenant = context(801)
            profile = await service.create_profile(project_id=801, context=tenant, actor="profile-owner", profile_key="corporate-profile", display_name="Corporate profile")
            version = await service.draft_version(profile["id"], project_id=801, context=tenant, actor="author", locale="en-US", profile_manifest={"company_name": "Factory A", "markets": ["US"]}, source_reference="COMPANY-SOURCE-801")
            with pytest.raises(ValueError, match="independent verification"):
                await service.verify_version(version["id"], project_id=801, actor="author", expected_revision=1, verification_reference="SELF")
            version = await service.verify_version(version["id"], project_id=801, actor="verifier", expected_revision=1, verification_reference="VERIFY-801")
            release = await service.prepare_publication(version["id"], project_id=801, context=tenant, actor="release-owner", target="website-content", rollback_reference="ROLLBACK-801")
            with pytest.raises(ValueError, match="independent approval"):
                await service.approve_publication(release["id"], project_id=801, actor="release-owner", expected_revision=1, approval_reference="SELF")
            release = await service.approve_publication(release["id"], project_id=801, actor="approver", expected_revision=1, approval_reference="APPROVE-801")
            with pytest.raises(ValueError, match="separate handoff actor"):
                await service.acknowledge_publication(release["id"], project_id=801, actor="approver", expected_revision=2, consumer_receipt_reference="SELF")
            release = await service.acknowledge_publication(release["id"], project_id=801, actor="consumer", expected_revision=2, consumer_receipt_reference="RECEIPT-801")
            workspace = await service.workspace(project_id=801)
            assert release["available"] and workspace["availability"]["status"] == "available"
            assert workspace["contract"]["source_profile_mutated_directly"] is False
            assert workspace["contract"]["sensitive_profile_data_stored"] is False
            assert len(workspace["evidence"]) == 6
            assert (await service.workspace(project_id=802))["profiles"] == []
        await engine.dispose()
    asyncio.run(scenario())


def test_company_profile_rejects_sensitive_or_tampered_manifest():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection: await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            await contracts(db); service = FactoryCompanyProfileService(db); tenant = context(803)
            profile = await service.create_profile(project_id=803, context=tenant, actor="owner", profile_key="corporate-profile", display_name="Corporate profile")
            with pytest.raises(ValueError, match="secrets or credentials"):
                await service.draft_version(profile["id"], project_id=803, context=tenant, actor="author", locale="zh-CN", profile_manifest={"company_name": "Factory B", "api_key": "forbidden"}, source_reference="COMPANY-803")
            version = await service.draft_version(profile["id"], project_id=803, context=tenant, actor="author", locale="zh-CN", profile_manifest={"company_name": "Factory B"}, source_reference="COMPANY-803")
            stored = await service._get(FactoryCompanyProfileVersion, version["id"], 803, "Version"); stored.profile_manifest_json = {"company_name": "Tampered"}; await db.flush()
            with pytest.raises(ValueError, match="unchanged manifest"):
                await service.verify_version(version["id"], project_id=803, actor="verifier", expected_revision=1, verification_reference="VERIFY")
        await engine.dispose()
    asyncio.run(scenario())
