import asyncio

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import models  # noqa: F401
from core.database import Base
from core.tenant_context import build_tenant_context
from models.factory_contract import FactoryCoreEventContract, FactoryCoreObjectContract
from models.factory_product_content import FactoryProductContentVersion
from services.factory_product_content import FactoryProductContentService


def context(project_id: int): return build_tenant_context(agent_path=f"hq/product-content-{project_id}", tenant_id=f"tenant-{project_id}", client_id=f"client-{project_id}", plan_id=f"plan-{project_id}")
async def contracts(db):
    db.add_all([FactoryCoreObjectContract(id="product-content-version", sequence=31, label="Product content version", system_of_record="content", identity_rule="tenant", minimum_fields_json="[]", lifecycle_status="frozen", schema_version=1, revision=1), FactoryCoreEventContract(id="product-content-released", sequence=23, label="Product content released", subject_id="product-content-version", producer="content", consumers_json="[]", required_fields_json="[]", compatibility="backward", lifecycle_status="frozen", schema_version=1, revision=1)]); await db.flush()


def test_product_content_closes_independently_acknowledged_release():
    async def scenario():
        engine=create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection: await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            await contracts(db); service=FactoryProductContentService(db); tenant=context(904)
            asset=await service.create_asset(project_id=904, context=tenant, actor="owner", product_reference="PLM-904-R3", display_name="Precision Pump")
            version=await service.draft_version(asset["id"], project_id=904, context=tenant, actor="author", locale="en-US", content_document={"title":"Precision Pump","description":"Verified product content","channels":["website-product","sales-enablement"]}, product_fact_reference="PLM-904-R3#approved")
            with pytest.raises(ValueError,match="independent review"): await service.review_version(version["id"],project_id=904,actor="author",expected_revision=1,review_reference="SELF")
            version=await service.review_version(version["id"],project_id=904,actor="reviewer",expected_revision=1,review_reference="REVIEW-904")
            release=await service.prepare_publication(version["id"],project_id=904,context=tenant,actor="release-owner",target="website-product",rollback_reference="ROLLBACK-904")
            with pytest.raises(ValueError,match="independent approval"): await service.approve_publication(release["id"],project_id=904,actor="release-owner",expected_revision=1,approval_reference="SELF")
            release=await service.approve_publication(release["id"],project_id=904,actor="approver",expected_revision=1,approval_reference="APPROVE-904")
            with pytest.raises(ValueError,match="separate handoff actor"): await service.acknowledge_publication(release["id"],project_id=904,actor="approver",expected_revision=2,consumer_receipt_reference="SELF")
            release=await service.acknowledge_publication(release["id"],project_id=904,actor="consumer",expected_revision=2,consumer_receipt_reference="RECEIPT-904")
            workspace=await service.workspace(project_id=904)
            assert release["available"] and workspace["availability"]["status"] == "available"
            assert workspace["contract"]["product_master_mutated_directly"] is False and workspace["contract"]["engineering_facts_copied"] is False
            assert len(workspace["evidence"]) == 6 and (await service.workspace(project_id=905))["assets"] == []
        await engine.dispose()
    asyncio.run(scenario())


def test_product_content_rejects_sensitive_or_tampered_document():
    async def scenario():
        engine=create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection: await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            await contracts(db); service=FactoryProductContentService(db); tenant=context(906); asset=await service.create_asset(project_id=906,context=tenant,actor="owner",product_reference="PLM-906",display_name="Valve")
            with pytest.raises(ValueError,match="unsafe markup"):
                await service.draft_version(asset["id"],project_id=906,context=tenant,actor="author",locale="zh-CN",content_document={"title":"Valve","bom":"secret"},product_fact_reference="PLM-906#approved")
            version=await service.draft_version(asset["id"],project_id=906,context=tenant,actor="author",locale="zh-CN",content_document={"title":"Safe Valve"},product_fact_reference="PLM-906#approved")
            stored=await service._get(FactoryProductContentVersion,version["id"],906,"Version"); stored.content_document_json={"title":"tampered"}; await db.flush()
            with pytest.raises(ValueError,match="unchanged content"):
                await service.review_version(version["id"],project_id=906,actor="reviewer",expected_revision=1,review_reference="REVIEW")
        await engine.dispose()
    asyncio.run(scenario())
