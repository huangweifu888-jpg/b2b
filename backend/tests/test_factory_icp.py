import asyncio
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import models  # noqa: F401
from core.database import Base
from core.tenant_context import build_tenant_context
from models.factory_cpq import FactoryCpqQuote
from services.factory_icp import FactoryIcpService


def context(project_id=61):
    return build_tenant_context(
        agent_path=f"hq/client-icp-{project_id}", tenant_id=f"tenant-icp-{project_id}",
        client_id=f"client-icp-{project_id}", plan_id=f"plan-{project_id}",
    )


async def authority(db, ctx, project_id=61):
    now = datetime.now(timezone.utc)
    item = FactoryCpqQuote(
        id=f"icp-quote-{project_id}", project_id=project_id, agent_path=ctx.agent_path, tenant_id=ctx.tenant_id,
        client_id=ctx.client_id, plan_id=ctx.plan_id, quote_number=f"CPQ-ICP-{project_id}", account_reference=f"BUYER-ICP-{project_id}",
        currency="USD", exchange_rate=Decimal("1"), valid_until=now + timedelta(days=90),
        lines_json='[{"product_reference":"ROBOT-CELL","sku_reference":"ROBOT-CELL-01"}]', subtotal=Decimal("350000"),
        cost_total=Decimal("210000"), gross_margin_percent=Decimal("40"), status="accepted", emitted_events_json="[]",
        revision=1, updated_by="sales", created_at=now, updated_at=now,
    )
    db.add(item); await db.flush(); return item


async def draft_profile(service, ctx, project_id=61):
    created = await service.create_profile(
        project_id=project_id, context=ctx, actor="strategist", profile_code="GLOBAL-AUTOMATION",
        profile_name="Global automation factories", market_mode="global", customer_type="b2b",
        objective="Find evidence-backed industrial automation accounts with repeatable buying demand.",
        countries=["US", "DE"], industries=["industrial-automation"], company_size_bands=["500-5000"],
        product_references=["ROBOT-CELL"], required_roles=["CFO", "CTO", "plant-manager"],
        buying_triggers=["capacity-expansion"], minimum_potential_value=Decimal("200000"), currency="USD",
        scoring_weights={"country": 10, "industry": 15, "company_size": 10, "product": 20, "role": 15, "trigger": 15, "value": 15},
    )
    profile = created["profile"]
    for code, name, influence in (("CFO", "Finance owner", "economic-buyer"), ("CTO", "Technology owner", "technical-buyer"), ("plant-manager", "Plant champion", "champion")):
        await service.add_role(profile["id"], project_id=project_id, context=ctx, actor="strategist", role_code=code, role_name=name,
                               influence_type=influence, pains=["capacity constraint"], proof_requirements=["verified ROI"], preferred_channels=["account-workshop"])
    for code in ("expansion", "replacement"):
        await service.add_scenario(profile["id"], project_id=project_id, context=ctx, actor="strategist", scenario_code=code,
                                   scenario_name=f"{code} program", job_to_be_done="Expand safe production capacity with measurable payback.",
                                   buying_trigger="capacity-expansion", product_references=["ROBOT-CELL"], success_outcomes=["higher throughput"], disqualifiers=["no executive sponsor"])
    return profile


def test_icp_closes_definition_evidence_fit_and_activation_without_mutating_source():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection: await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            ctx = context(); quote = await authority(db, ctx); service = FactoryIcpService(db); profile = await draft_profile(service, ctx)
            with pytest.raises(ValueError, match="independent"):
                await service.approve_profile(profile["id"], project_id=61, actor="strategist", expected_revision=1, approval_reference="SELF")
            profile = await service.approve_profile(profile["id"], project_id=61, actor="strategy-approver", expected_revision=1, approval_reference="ICP-COMMITTEE-61")
            evidence = await service.capture_account_evidence(
                profile["id"], project_id=61, context=ctx, actor="researcher", source_type="cpq-quote", source_id=quote.id,
                firmographic_country="US", firmographic_industry="industrial-automation", firmographic_company_size="500-5000",
                firmographic_evidence_reference="DNB-VERIFIED-61", observed_roles=["CFO", "CTO"],
                observed_triggers=["capacity-expansion"], observed_products=["ROBOT-CELL"],
            )
            with pytest.raises(ValueError, match="independent"):
                await service.verify_account_evidence(evidence["id"], project_id=61, actor="researcher", expected_revision=1, verification_reference="SELF")
            evidence = await service.verify_account_evidence(evidence["id"], project_id=61, actor="research-reviewer", expected_revision=1, verification_reference="EVIDENCE-QA-61")
            assessment = await service.assess_fit(profile["id"], project_id=61, context=ctx, actor="revenue-analyst", account_evidence_id=evidence["id"])
            assert assessment["total_score"] == "100.00" and assessment["fit_tier"] == "A" and quote.revision == 1
            with pytest.raises(ValueError, match="independent"):
                await service.verify_assessment(assessment["id"], project_id=61, actor="revenue-analyst", expected_revision=1, verification_reference="SELF")
            assessment = await service.verify_assessment(assessment["id"], project_id=61, actor="revenue-reviewer", expected_revision=1, verification_reference="FIT-QA-61")
            activation = await service.create_activation(profile["id"], project_id=61, context=ctx, actor="routing-publisher", consumer="lead-routing", minimum_fit_tier="B", delivery_reference="ICP-PAYLOAD-61")
            with pytest.raises(ValueError, match="independent"):
                await service.acknowledge_activation(activation["id"], project_id=61, actor="routing-publisher", expected_revision=1, acknowledgement_reference="SELF")
            activation = await service.acknowledge_activation(activation["id"], project_id=61, actor="routing-owner", expected_revision=1, acknowledgement_reference="ROUTING-ACK-61")
            workspace = await service.list_workspace(project_id=61)
            assert workspace["metrics"] == {"active_icps": 1, "assessed_accounts": 1, "high_fit_rate_percent": 100.0, "verified_evidence_coverage_percent": 100.0, "buying_role_coverage": 3, "activation_acknowledgement_percent": 100.0}
            assert workspace["contract"]["ai_autonomous_qualification"] is False and quote.status == "accepted"
            assert (await service.list_workspace(project_id=62))["profiles"] == []
        await engine.dispose()
    asyncio.run(scenario())


def test_icp_blocks_invalid_definition_duplicate_evidence_and_stale_source_revision():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection: await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            ctx = context(); quote = await authority(db, ctx); service = FactoryIcpService(db)
            with pytest.raises(ValueError, match="total 100"):
                await service.create_profile(project_id=61, context=ctx, actor="strategist", profile_code="BAD", profile_name="Bad weights", market_mode="global", customer_type="b2b", objective="Invalid scoring profile.", countries=["US"], industries=["automation"], company_size_bands=["large"], product_references=["P1"], required_roles=["CFO"], buying_triggers=["growth"], minimum_potential_value=Decimal("1"), currency="USD", scoring_weights={"country": 50})
            profile = await draft_profile(service, ctx)
            with pytest.raises(ValueError, match="at least two"):
                other = await service.create_profile(project_id=61, context=ctx, actor="other", profile_code="INCOMPLETE", profile_name="Incomplete", market_mode="global", customer_type="b2b", objective="Incomplete governed profile.", countries=["US"], industries=["automation"], company_size_bands=["large"], product_references=["P1"], required_roles=["CFO"], buying_triggers=["growth"], minimum_potential_value=Decimal("1"), currency="USD", scoring_weights={"country": 10, "industry": 15, "company_size": 10, "product": 20, "role": 15, "trigger": 15, "value": 15})
                await service.approve_profile(other["profile"]["id"], project_id=61, actor="approver", expected_revision=1, approval_reference="NO")
            profile = await service.approve_profile(profile["id"], project_id=61, actor="approver", expected_revision=1, approval_reference="APPROVED")
            with pytest.raises(ValueError, match="evidence reference"):
                await service.capture_account_evidence(profile["id"], project_id=61, context=ctx, actor="researcher", source_type="cpq-quote", source_id=quote.id, firmographic_country="US", firmographic_industry=None, firmographic_company_size=None, firmographic_evidence_reference=None, observed_roles=[], observed_triggers=[], observed_products=[])
            evidence = await service.capture_account_evidence(profile["id"], project_id=61, context=ctx, actor="researcher", source_type="cpq-quote", source_id=quote.id, firmographic_country="US", firmographic_industry="industrial-automation", firmographic_company_size="500-5000", firmographic_evidence_reference="FIRM-61", observed_roles=["CFO"], observed_triggers=["capacity-expansion"], observed_products=[])
            with pytest.raises(ValueError, match="already exists"):
                await service.capture_account_evidence(profile["id"], project_id=61, context=ctx, actor="researcher", source_type="cpq-quote", source_id=quote.id, firmographic_country=None, firmographic_industry=None, firmographic_company_size=None, firmographic_evidence_reference=None, observed_roles=[], observed_triggers=[], observed_products=[])
            quote.revision = 2
            with pytest.raises(ValueError, match="revision changed"):
                await service.verify_account_evidence(evidence["id"], project_id=61, actor="reviewer", expected_revision=1, verification_reference="STALE")
            with pytest.raises(ValueError, match="Revision conflict"):
                await service.verify_account_evidence(evidence["id"], project_id=61, actor="reviewer", expected_revision=99, verification_reference="STALE")
        await engine.dispose()
    asyncio.run(scenario())
