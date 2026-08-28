import asyncio
from datetime import datetime, timedelta, timezone
from decimal import Decimal
import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
import models  # noqa: F401
from core.database import Base
from core.tenant_context import build_tenant_context
from models.factory_contract import FactoryCoreEventContract, FactoryCoreObjectContract
from services.factory_market_radar import FactoryMarketRadarService, SIGNAL_TYPES

def context(project_id): return build_tenant_context(agent_path=f"hq/client-market-{project_id}", tenant_id=f"tenant-market-{project_id}", client_id=f"client-market-{project_id}", plan_id=f"plan-{project_id}")
async def contracts(db):
    db.add(FactoryCoreObjectContract(id="market-entry-scan", sequence=24, label="Market scan", system_of_record="identity", identity_rule="tenant product country", minimum_fields_json="[]", lifecycle_status="frozen", schema_version=1, revision=1))
    db.add(FactoryCoreEventContract(id="market-entry-released", sequence=16, label="Market released", subject_id="market-entry-scan", producer="identity", consumers_json="[]", required_fields_json="[]", compatibility="backward", lifecycle_status="frozen", schema_version=1, revision=1)); await db.flush()
async def signals(service, scan, project_id, ctx):
    for index, signal_type in enumerate(SIGNAL_TYPES):
        item = await service.add_signal(scan["id"], project_id=project_id, context=ctx, actor="researcher", signal_type=signal_type, normalized_score=Decimal(str(75 + index * 2)), raw_value=Decimal(str(1000 + index)), measurement_unit="index", source_system="governed-source", source_reference=f"SOURCE-{signal_type}", source_revision="2026.08", source_observed_at=datetime.now(timezone.utc))
        if index == 0:
            with pytest.raises(ValueError, match="independent verification"): await service.verify_signal(item["id"], project_id=project_id, actor="researcher", expected_revision=1, verification_reference="SELF")
        await service.verify_signal(item["id"], project_id=project_id, actor="source-reviewer", expected_revision=1, verification_reference=f"VERIFY-{signal_type}")

def test_market_radar_closes_country_entry_and_availability():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection: await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            await contracts(db); service = FactoryMarketRadarService(db); ctx = context(201)
            scan = await service.create_scan(project_id=201, context=ctx, actor="researcher", product_reference="ROBOT-CELL", product_name="Flexible Robot Cell", target_country="US", target_channel="distributor", objective="Validate a profitable country entry")
            await signals(service, scan, 201, ctx)
            decision = await service.create_decision(scan["id"], project_id=201, context=ctx, actor="analyst", entry_gate_note="Tariff, certification, service and distributor gates documented")
            with pytest.raises(ValueError, match="independent documented review"): await service.review_decision(decision["id"], project_id=201, actor="analyst", expected_revision=1, decision="approve", review_reference="SELF")
            decision = await service.review_decision(decision["id"], project_id=201, actor="market-owner", expected_revision=1, decision="approve", review_reference="MARKET-QA")
            release = await service.prepare_release(decision["id"], project_id=201, context=ctx, actor="release-manager", release_version="2026.08.1", support_owner="growth-ops", support_until=datetime.now(timezone.utc) + timedelta(days=180), customer_trial_reference="CUSTOMER-TRIAL-201", role_training_reference="TRAIN-201", issue_closure_reference="ISSUES-201", monitoring_reference="MONITOR-201", rollback_reference="ROLLBACK-201")
            with pytest.raises(ValueError, match="independent approval"): await service.approve_release(release["id"], project_id=201, actor="release-manager", expected_revision=1, approval_reference="SELF")
            release = await service.approve_release(release["id"], project_id=201, actor="release-approver", expected_revision=1, approval_reference="GA-201")
            workspace = await service.workspace(project_id=201)
            assert release["available"] and workspace["availability"]["status"] == "available"
            assert workspace["metrics"] == {"market_scans": 1, "verified_signal_percent": 100.0, "approved_decisions": 1, "available_releases": 1, "latest_opportunity_score": "78.80"}
            assert len(workspace["evidence"]) == 15 and (await service.workspace(project_id=202))["scans"] == []
        await engine.dispose()
    asyncio.run(scenario())

def test_market_radar_blocks_signal_drift():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection: await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            await contracts(db); service = FactoryMarketRadarService(db); ctx = context(203)
            scan = await service.create_scan(project_id=203, context=ctx, actor="researcher", product_reference="PUMP", product_name="Industrial Pump", target_country="DE", target_channel="direct", objective="Validate entry opportunity")
            await signals(service, scan, 203, ctx); decision = await service.create_decision(scan["id"], project_id=203, context=ctx, actor="analyst", entry_gate_note="All regulatory and service gates documented")
            decision = await service.review_decision(decision["id"], project_id=203, actor="owner", expected_revision=1, decision="approve", review_reference="QA")
            signal = (await service._signals(scan["id"], 203))[0]; signal.source_reference = "DRIFTED"; await db.flush()
            with pytest.raises(ValueError, match="signals changed"): await service.prepare_release(decision["id"], project_id=203, context=ctx, actor="release", release_version="2026.08", support_owner="ops", support_until=datetime.now(timezone.utc) - timedelta(days=1), customer_trial_reference="TRIAL", role_training_reference="TRAIN", issue_closure_reference="ISSUES", monitoring_reference="MON", rollback_reference="ROLLBACK")
        await engine.dispose()
    asyncio.run(scenario())
