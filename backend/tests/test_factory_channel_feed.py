import asyncio
from datetime import datetime, timezone

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import models  # noqa: F401
from core.database import Base
from core.tenant_context import build_tenant_context
from models.factory_structured_data import FactoryStructuredDataRelease
from services.factory_channel_feed import FactoryChannelFeedService, _hash


def context(project_id=65): return build_tenant_context(agent_path=f"hq/client-channel-{project_id}",tenant_id=f"tenant-channel-{project_id}",client_id=f"client-channel-{project_id}",plan_id=f"plan-{project_id}")


async def source_release(db, ctx, project_id=65):
    document={"@context":"https://schema.org","@graph":[{"@type":"Product","identifier":"KGE-PRODUCT-1","name":"Flexible Robot Cell"},{"@type":"Organization","name":"Future Robotics"}],"inLanguage":"en-US"};now=datetime.now(timezone.utc);item=FactoryStructuredDataRelease(id=f"structured-release-{project_id}",project_id=project_id,agent_path=ctx.agent_path,tenant_id=ctx.tenant_id,client_id=ctx.client_id,plan_id=ctx.plan_id,release_number=f"SDR-{project_id}",bundle_id=f"bundle-{project_id}",bundle_number=f"SDB-{project_id}",validation_id=f"validation-{project_id}",validation_number=f"SDV-{project_id}",version_number=1,document_json=document,document_hash=_hash(document),schema_types_json=["Organization","Product"],status="published",published_by="schema-publisher",published_at=now);db.add(item);await db.flush();return item


async def approved_account(service,ctx,project_id,platform,index):
    item=await service.create_account(project_id=project_id,context=ctx,actor="channel-owner",platform=platform,account_reference=f"ACCOUNT-{index}",credential_reference=f"vault://channels/{platform}/{index}",territory="GLOBAL",locale="en-US",currency="USD")
    return await service.approve_account(item["id"],project_id=project_id,actor="security-reviewer",expected_revision=1,reference=f"APPROVE-{platform}")


def test_channel_feed_publishes_validated_catalog_to_three_channels_and_acknowledges():
    async def scenario():
        engine=create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection: await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine,expire_on_commit=False)() as db:
            ctx=context();source=await source_release(db,ctx);service=FactoryChannelFeedService(db);accounts=[]
            for index,platform in enumerate(("google-merchant","amazon","alibaba"),1): accounts.append(await approved_account(service,ctx,65,platform,index))
            catalog=await service.create_catalog(project_id=65,context=ctx,actor="catalog-author",catalog_code="GLOBAL",catalog_name="Global product feed",source_release_id=source.id,default_locale="en-US")
            listings=[]
            for index,account in enumerate(accounts,1):
                listing=await service.add_listing(catalog["id"],project_id=65,context=ctx,actor="catalog-author",account_id=account["id"],external_sku=f"ROBOT-{index}",product_identifier="KGE-PRODUCT-1",price_mode="catalog-only",price_amount=None,currency=None,price_reference=None,inventory_mode="on-request",availability_status="on_request",inventory_reference=None,channel_attributes={"category":"industrial-robots"})
                listings.append(await service.validate_listing(listing["id"],project_id=65,actor="listing-reviewer",expected_revision=1,reference=f"VALIDATE-{index}"))
            run=await service.run_feed(catalog["id"],project_id=65,context=ctx,actor="feed-validator",expected_revision=1,reference="FEED-VALIDATOR")
            with pytest.raises(ValueError,match="independent publisher"): await service.publish_catalog(catalog["id"],project_id=65,context=ctx,actor="catalog-author",expected_revision=1,run_id=run["id"],remote_reference_prefix="SELF")
            published=await service.publish_catalog(catalog["id"],project_id=65,context=ctx,actor="feed-publisher",expected_revision=1,run_id=run["id"],remote_reference_prefix="CHANNEL-FEED-V1")
            for publication in published["publications"]: await service.acknowledge_publication(publication["id"],project_id=65,actor="channel-consumer",expected_revision=1,reference=f"ACK-{publication['account_number']}")
            workspace=await service.list_workspace(project_id=65);assert workspace["metrics"]=={"approved_channels":3,"channel_coverage_percent":75.0,"validated_listings":3,"listing_validation_percent":100.0,"passed_feed_runs":1,"publication_acknowledgement_percent":100.0};assert published["release"]["channel_count"]==3 and published["release"]["listing_count"]==3;assert all(item["consumer_mutated"] is False for item in published["publications"]);assert (await service.list_workspace(project_id=66))["catalogs"]==[]
        await engine.dispose()
    asyncio.run(scenario())


def test_channel_feed_blocks_self_approval_fabricated_commerce_and_source_drift():
    async def scenario():
        engine=create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection: await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine,expire_on_commit=False)() as db:
            ctx=context(66);source=await source_release(db,ctx,66);service=FactoryChannelFeedService(db);pending=await service.create_account(project_id=66,context=ctx,actor="owner",platform="google-merchant",account_reference="ACCOUNT",credential_reference="vault://channel/account",territory="US",locale="en-US",currency="USD")
            with pytest.raises(ValueError,match="independent"): await service.approve_account(pending["id"],project_id=66,actor="owner",expected_revision=1,reference="SELF")
            account=await service.approve_account(pending["id"],project_id=66,actor="security",expected_revision=1,reference="APPROVED");catalog=await service.create_catalog(project_id=66,context=ctx,actor="author",catalog_code="DRIFT",catalog_name="Drift feed",source_release_id=source.id,default_locale="en-US")
            with pytest.raises(ValueError,match="cannot fabricate"): await service.add_listing(catalog["id"],project_id=66,context=ctx,actor="author",account_id=account["id"],external_sku="SKU",product_identifier="KGE-PRODUCT-1",price_mode="catalog-only",price_amount=100,currency="USD",price_reference="MANUAL",inventory_mode="on-request",availability_status="on_request",inventory_reference=None,channel_attributes={"category":"robot"})
            listing=await service.add_listing(catalog["id"],project_id=66,context=ctx,actor="author",account_id=account["id"],external_sku="SKU",product_identifier="KGE-PRODUCT-1",price_mode="catalog-only",price_amount=None,currency=None,price_reference=None,inventory_mode="on-request",availability_status="on_request",inventory_reference=None,channel_attributes={"category":"robot"})
            with pytest.raises(ValueError,match="independent"): await service.validate_listing(listing["id"],project_id=66,actor="author",expected_revision=1,reference="SELF")
            source.document_json["@graph"][0]["name"]="Changed Product";await db.flush()
            stored=await service._get(__import__("models.factory_channel_feed",fromlist=["FactoryChannelListing"]).FactoryChannelListing,listing["id"],66,"Listing")
            with pytest.raises(ValueError,match="hash-valid"): await service._validate_listing_source(stored)
        await engine.dispose()
    asyncio.run(scenario())
