import asyncio
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import models  # noqa: F401
from core.database import Base
from core.tenant_context import build_tenant_context
from models.factory_contract import FactoryCoreEventContract, FactoryCoreObjectContract
from models.factory_digital_assets import FactoryDigitalAssetRegister, FactoryDigitalAssetSuggestion
from services.factory_digital_assets import FactoryDigitalAssetService


def context(project_id: int):
    return build_tenant_context(agent_path=f"hq/digital-{project_id}", tenant_id=f"tenant-{project_id}", client_id=f"client-{project_id}", plan_id=f"plan-{project_id}")


async def contracts(db):
    db.add_all([
        FactoryCoreObjectContract(id="digital-asset-plan", sequence=27, label="Digital asset plan", system_of_record="identity", identity_rule="tenant", minimum_fields_json="[]", lifecycle_status="frozen", schema_version=1, revision=1),
        FactoryCoreEventContract(id="digital-assets-released", sequence=19, label="Released", subject_id="digital-asset-plan", producer="identity", consumers_json="[]", required_fields_json="[]", compatibility="backward", lifecycle_status="frozen", schema_version=1, revision=1),
    ])
    await db.flush()


async def draft(service, project_id, tenant_context):
    return await service.create_plan(project_id=project_id, context=tenant_context, actor="planner", business_goal="Launch a verified B2B automation site", target_market="Germany", target_audience="Industrial automation procurement teams", site_scope="Product, proof, localization and contact content")


def test_digital_assets_closes_ai_plan_to_available_controlled_handoff():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            await contracts(db)
            service = FactoryDigitalAssetService(db)
            tenant_context = context(601)
            plan = await draft(service, 601, tenant_context)
            suggestion = await service.generate_suggestion(plan["id"], project_id=601, context=tenant_context, actor="planner", suggestion_type="site-map", recommendation={"pages": ["home", "products", "proof"]}, source_reference="RESEARCH-601")
            with pytest.raises(ValueError, match="independent review"):
                await service.review_suggestion(suggestion["id"], project_id=601, actor="planner", expected_revision=1, review_reference="SELF")
            suggestion = await service.review_suggestion(suggestion["id"], project_id=601, actor="reviewer", expected_revision=1, review_reference="AI-QA-601")
            asset = await service.register_asset(plan["id"], project_id=601, context=tenant_context, actor="planner", asset_kind="domain", asset_identifier="forgeflow.example", ownership_reference="DOMAIN-OWNER-601", rights_scope="Global B2B marketing use")
            with pytest.raises(ValueError, match="independent approval"):
                await service.approve_asset(asset["id"], project_id=601, actor="planner", expected_revision=1, approval_reference="SELF")
            asset = await service.approve_asset(asset["id"], project_id=601, actor="rights-owner", expected_revision=1, approval_reference="RIGHTS-QA-601")
            with pytest.raises(ValueError, match="independent approver"):
                await service.approve_plan(plan["id"], project_id=601, actor="planner", expected_revision=1, approval_reference="SELF")
            plan = await service.approve_plan(plan["id"], project_id=601, actor="plan-owner", expected_revision=1, approval_reference="PLAN-QA-601")
            handoff = await service.prepare_handoff(plan["id"], project_id=601, context=tenant_context, actor="release-manager", release_version="2026.08.1", support_owner="digital-ops", support_until=datetime.now(timezone.utc) + timedelta(days=180), customer_trial_reference="TRIAL-601", role_training_reference="TRAIN-601", issue_closure_reference="ISSUE-601", monitoring_reference="MON-601", rollback_reference="ROLLBACK-601")
            with pytest.raises(ValueError, match="independent approval"):
                await service.approve_handoff(handoff["id"], project_id=601, actor="release-manager", expected_revision=1, approval_reference="SELF")
            handoff = await service.approve_handoff(handoff["id"], project_id=601, actor="ga-owner", expected_revision=1, approval_reference="GA-601")
            workspace = await service.workspace(project_id=601)
            assert handoff["available"] and workspace["availability"]["status"] == "available"
            assert workspace["contract"]["website_published"] is False
            assert workspace["contract"]["registrar_secret_stored"] is False
            assert workspace["contract"]["ai_can_approve"] is False
            assert len(workspace["evidence"]) == 8
            assert (await service.workspace(project_id=602))["plans"] == []
        await engine.dispose()

    asyncio.run(scenario())


def test_digital_assets_blocks_tampered_ai_or_secret_register():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            await contracts(db)
            service = FactoryDigitalAssetService(db)
            tenant_context = context(603)
            plan = await draft(service, 603, tenant_context)
            suggestion = await service.generate_suggestion(plan["id"], project_id=603, context=tenant_context, actor="planner", suggestion_type="site-map", recommendation={"page": "home"}, source_reference="SRC")
            stored_suggestion = await service._get(FactoryDigitalAssetSuggestion, suggestion["id"], 603, "Suggestion")
            stored_suggestion.recommendation_json = {"page": "tampered"}
            await db.flush()
            with pytest.raises(ValueError, match="unchanged output"):
                await service.review_suggestion(suggestion["id"], project_id=603, actor="reviewer", expected_revision=1, review_reference="QA")
            asset = await service.register_asset(plan["id"], project_id=603, context=tenant_context, actor="planner", asset_kind="domain", asset_identifier="guarded.example", ownership_reference="OWNER", rights_scope="Marketing")
            stored_asset = await service._get(FactoryDigitalAssetRegister, asset["id"], 603, "Asset")
            stored_asset.registrar_secret_stored = True
            await db.flush()
            with pytest.raises(ValueError, match="no registrar secret"):
                await service.approve_asset(asset["id"], project_id=603, actor="rights-owner", expected_revision=1, approval_reference="QA")
        await engine.dispose()

    asyncio.run(scenario())
