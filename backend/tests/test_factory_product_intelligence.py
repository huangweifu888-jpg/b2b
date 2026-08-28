import asyncio
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import models  # noqa: F401
from core.database import Base
from core.tenant_context import build_tenant_context
from models.factory_contract import FactoryCoreEventContract, FactoryCoreObjectContract
from services.factory_product_intelligence import FactoryProductIntelligenceService, SIGNAL_TYPES


def context(project_id: int):
    return build_tenant_context(agent_path=f"hq/client-product-{project_id}", tenant_id=f"tenant-product-{project_id}", client_id=f"client-product-{project_id}", plan_id=f"plan-{project_id}")


async def contracts(db):
    db.add(FactoryCoreObjectContract(id="product-opportunity-study", sequence=22, label="Product study", system_of_record="identity", identity_rule="tenant product and verified sources", minimum_fields_json="[]", lifecycle_status="frozen", schema_version=1, revision=1))
    db.add(FactoryCoreEventContract(id="product-opportunity-released", sequence=13, label="Product opportunity released", subject_id="product-opportunity-study", producer="identity", consumers_json="[]", required_fields_json="[]", compatibility="backward", lifecycle_status="frozen", schema_version=1, revision=1))
    await db.flush()


async def complete_signals(service, study, project_id, ctx):
    signals = []
    for index, signal_type in enumerate(SIGNAL_TYPES):
        item = await service.add_signal(study["id"], project_id=project_id, context=ctx, actor="researcher", signal_type=signal_type, normalized_score=Decimal(str(80 + index)), raw_value=Decimal(str(1000 + index)), measurement_unit="index", region="US", source_system="governed-connector", source_reference=f"SOURCE-{signal_type}", source_revision="2026.08", source_observed_at=datetime.now(timezone.utc))
        if index == 0:
            with pytest.raises(ValueError, match="independent verification"):
                await service.verify_signal(item["id"], project_id=project_id, actor="researcher", expected_revision=1, verification_reference="SELF")
        item = await service.verify_signal(item["id"], project_id=project_id, actor="source-reviewer", expected_revision=1, verification_reference=f"VERIFY-{signal_type}")
        signals.append(item)
    return signals


def test_product_intelligence_closes_verified_research_and_commercial_availability():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            await contracts(db)
            service = FactoryProductIntelligenceService(db)
            ctx = context(101)
            study = await service.create_study(project_id=101, context=ctx, actor="researcher", product_reference="ROBOT-CELL", product_name="Flexible Robot Cell", business_objective="Select a profitable overseas growth product", base_currency="USD")
            signals = await complete_signals(service, study, 101, ctx)
            assessment = await service.create_assessment(study["id"], project_id=101, context=ctx, actor="analyst", assumptions="Scores are normalized against the approved 2026 market baseline")
            with pytest.raises(ValueError, match="independent documented review"):
                await service.review_assessment(assessment["id"], project_id=101, actor="analyst", expected_revision=1, decision="approve", review_reference="SELF", review_note="Self review is invalid")
            assessment = await service.review_assessment(assessment["id"], project_id=101, actor="portfolio-owner", expected_revision=1, decision="approve", review_reference="PORTFOLIO-QA", review_note="Sources, weights and assumptions independently reviewed")
            release = await service.prepare_release(assessment["id"], project_id=101, context=ctx, actor="release-manager", release_version="2026.08.1", tenant_scope="tenant-product-101", region_scope=["US", "DE"], connector_scope=["governed-connector"], support_owner="growth-ops", support_until=datetime.now(timezone.utc) + timedelta(days=180), end_to_end_demo_reference="E2E-101", role_training_reference="TRAIN-101", issue_closure_reference="ISSUES-101", pilot_report_reference="PILOT-101", runtime_monitoring_reference="MONITOR-101", rollback_drill_reference="ROLLBACK-101")
            with pytest.raises(ValueError, match="independent approval"):
                await service.approve_release(release["id"], project_id=101, actor="release-manager", expected_revision=1, approval_reference="SELF")
            release = await service.approve_release(release["id"], project_id=101, actor="release-approver", expected_revision=1, approval_reference="GA-APPROVAL-101")
            workspace = await service.workspace(project_id=101)
            assert release["available"] is True and workspace["availability"]["status"] == "available"
            assert workspace["metrics"] == {"studies": 1, "verified_signal_percent": 100.0, "approved_assessments": 1, "available_releases": 1, "latest_opportunity_score": "81.70"}
            assert workspace["contract"]["plm_engineering_facts_mutated"] is False
            assert len(workspace["evidence"]) == 15
            assert (await service.workspace(project_id=102))["studies"] == []
            assert {item["signal_type"] for item in workspace["signals"]} == set(SIGNAL_TYPES)
            assert all(item["recorded_by"] != item["verified_by"] for item in workspace["signals"])
            assert {item["source_hash"] for item in signals} == {item["source_hash"] for item in workspace["signals"]}
        await engine.dispose()
    asyncio.run(scenario())


def test_product_intelligence_blocks_source_drift_and_expired_support():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            await contracts(db)
            service = FactoryProductIntelligenceService(db)
            ctx = context(103)
            study = await service.create_study(project_id=103, context=ctx, actor="researcher", product_reference="PUMP", product_name="Industrial Pump", business_objective="Validate a profitable export opportunity", base_currency="USD")
            await complete_signals(service, study, 103, ctx)
            assessment = await service.create_assessment(study["id"], project_id=103, context=ctx, actor="analyst", assumptions="Approved connector normalization applies")
            assessment = await service.review_assessment(assessment["id"], project_id=103, actor="owner", expected_revision=1, decision="approve", review_reference="QA", review_note="Independent source and scoring review complete")
            signal = (await service._signals(study["id"], 103))[0]
            signal.source_reference = "DRIFTED-SOURCE"
            await db.flush()
            with pytest.raises(ValueError, match="source signals changed"):
                await service.prepare_release(assessment["id"], project_id=103, context=ctx, actor="release", release_version="2026.08.1", tenant_scope="tenant-product-103", region_scope=["US"], connector_scope=["connector"], support_owner="ops", support_until=datetime.now(timezone.utc) - timedelta(days=1), end_to_end_demo_reference="E2E", role_training_reference="TRAIN", issue_closure_reference="ISSUES", pilot_report_reference="PILOT", runtime_monitoring_reference="MONITOR", rollback_drill_reference="ROLLBACK")
        await engine.dispose()
    asyncio.run(scenario())
