import asyncio
from datetime import datetime, timedelta, timezone
from decimal import Decimal
import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
import models  # noqa: F401
from core.database import Base
from core.tenant_context import build_tenant_context
from models.factory_contract import FactoryCoreEventContract, FactoryCoreObjectContract
from services.factory_competitive_pricing import FactoryCompetitivePricingService

def context(project): return build_tenant_context(agent_path=f"hq/client-price-{project}",tenant_id=f"tenant-price-{project}",client_id=f"client-price-{project}",plan_id=f"plan-{project}")
async def contracts(db):
    db.add(FactoryCoreObjectContract(id="competitive-price-watch",sequence=25,label="Price watch",system_of_record="identity",identity_rule="tenant product market channel",minimum_fields_json="[]",lifecycle_status="frozen",schema_version=1,revision=1))
    db.add(FactoryCoreEventContract(id="competitive-price-released",sequence=17,label="Price released",subject_id="competitive-price-watch",producer="identity",consumers_json="[]",required_fields_json="[]",compatibility="backward",lifecycle_status="frozen",schema_version=1,revision=1));await db.flush()
async def offers(service,watch,project,ctx):
    output=[]
    for index,price in enumerate((90,100,110)):
        item=await service.add_offer(watch["id"],project_id=project,context=ctx,actor="researcher",competitor_name=f"Competitor {index}",competitor_offer_reference=f"SKU-{index}",offer_type="list",offer_price=Decimal(price),freight_price=Decimal("5"),feature_summary="Comparable published configuration",source_system="governed-source",source_reference=f"SOURCE-{index}",source_revision="2026.08",source_observed_at=datetime.now(timezone.utc))
        if index==0:
            with pytest.raises(ValueError,match="independent verification"):await service.verify_offer(item["id"],project_id=project,actor="researcher",expected_revision=1,verification_reference="SELF")
        output.append(await service.verify_offer(item["id"],project_id=project,actor="source-reviewer",expected_revision=1,verification_reference=f"VERIFY-{index}"))
    return output
def test_competitive_pricing_closes_observation_to_available_release():
    async def scenario():
        engine=create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine,expire_on_commit=False)() as db:
            await contracts(db);service=FactoryCompetitivePricingService(db);ctx=context(301)
            watch=await service.create_watch(project_id=301,context=ctx,actor="researcher",product_reference="PUMP",product_name="Industrial Pump",market_country="US",channel="distributor",currency="USD",own_reference_price=Decimal("100"),scope_note="Compare published like-for-like offers; never create a customer quote")
            await offers(service,watch,301,ctx)
            decision=await service.create_decision(watch["id"],project_id=301,context=ctx,actor="analyst",boundary_note="Recommendation is intelligence only and must not update CPQ or finance price masters")
            with pytest.raises(ValueError,match="independent documented review"):await service.review_decision(decision["id"],project_id=301,actor="analyst",expected_revision=1,decision="approve",review_reference="SELF")
            decision=await service.review_decision(decision["id"],project_id=301,actor="price-owner",expected_revision=1,decision="approve",review_reference="PRICE-QA")
            release=await service.prepare_release(decision["id"],project_id=301,context=ctx,actor="release-manager",release_version="2026.08.1",support_owner="growth-ops",support_until=datetime.now(timezone.utc)+timedelta(days=180),customer_trial_reference="TRIAL-301",role_training_reference="TRAIN-301",issue_closure_reference="ISSUES-301",monitoring_reference="MONITOR-301",rollback_reference="ROLLBACK-301")
            with pytest.raises(ValueError,match="independent approval"):await service.approve_release(release["id"],project_id=301,actor="release-manager",expected_revision=1,approval_reference="SELF")
            release=await service.approve_release(release["id"],project_id=301,actor="release-approver",expected_revision=1,approval_reference="GA-301")
            workspace=await service.workspace(project_id=301)
            assert release["available"] and workspace["availability"]["status"]=="available"
            assert workspace["metrics"]=={"price_watches":1,"verified_offer_percent":100.0,"approved_decisions":1,"available_releases":1,"latest_price_index":"105.00"}
            assert workspace["contract"]["formal_quote_created"] is False and len(workspace["evidence"])==11 and (await service.workspace(project_id=302))["watches"]==[]
        await engine.dispose()
    asyncio.run(scenario())
def test_competitive_pricing_blocks_source_drift():
    async def scenario():
        engine=create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine,expire_on_commit=False)() as db:
            await contracts(db);service=FactoryCompetitivePricingService(db);ctx=context(303)
            watch=await service.create_watch(project_id=303,context=ctx,actor="researcher",product_reference="VALVE",product_name="Industrial Valve",market_country="DE",channel="direct",currency="EUR",own_reference_price=Decimal("100"),scope_note="Compare source-versioned public offers only")
            await offers(service,watch,303,ctx);decision=await service.create_decision(watch["id"],project_id=303,context=ctx,actor="analyst",boundary_note="Intelligence only, no quote or price master update")
            decision=await service.review_decision(decision["id"],project_id=303,actor="owner",expected_revision=1,decision="approve",review_reference="QA")
            offer=(await service._offers(watch["id"],303))[0];offer.source_reference="DRIFTED";await db.flush()
            with pytest.raises(ValueError,match="snapshots changed"):await service.prepare_release(decision["id"],project_id=303,context=ctx,actor="release",release_version="2026.08",support_owner="ops",support_until=datetime.now(timezone.utc)-timedelta(days=1),customer_trial_reference="TRIAL",role_training_reference="TRAIN",issue_closure_reference="ISSUES",monitoring_reference="MON",rollback_reference="ROLLBACK")
        await engine.dispose()
    asyncio.run(scenario())
