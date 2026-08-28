import asyncio
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import models  # noqa: F401
from core.database import Base
from core.tenant_context import build_tenant_context
from models.factory_cpq import FactoryCpqQuote
from models.factory_data_warehouse import FactoryWarehouseLoadRun
from models.factory_revenue import FactoryRevenueFlowRun
from services.factory_data_warehouse import FactoryDataWarehouseService
from services.factory_revenue_profit import FactoryRevenueProfitService


async def _authorities_and_warehouse(db, context):
    recorded_at = datetime.now(timezone.utc) - timedelta(minutes=2)
    quote = FactoryCpqQuote(
        id="profit-quote-1", project_id=9, agent_path=context.agent_path,
        tenant_id=context.tenant_id, client_id=context.client_id, plan_id=context.plan_id,
        quote_number="CPQ-PROFIT-1", account_reference="BUYER-PROFIT", currency="USD",
        exchange_rate=Decimal("1"), valid_until=recorded_at + timedelta(days=30), lines_json="[]",
        subtotal=Decimal("1000"), cost_total=Decimal("600"), gross_margin_percent=Decimal("40"),
        status="accepted", order_intent_id="profit-order-intent-1", revision=6,
        created_at=recorded_at, updated_at=recorded_at,
    )
    revenue = FactoryRevenueFlowRun(
        id="profit-revenue-1", project_id=9, agent_path=context.agent_path,
        tenant_id=context.tenant_id, client_id=context.client_id, plan_id=context.plan_id,
        correlation_id="corr-profit-1", product_reference="PRODUCT-PROFIT",
        account_reference="BUYER-PROFIT", currency="USD", quoted_amount=Decimal("1000"),
        ordered_amount=Decimal("1000"), invoiced_amount=Decimal("1000"), paid_amount=Decimal("1000"),
        current_stage="payment-received", revision=7, created_at=recorded_at, updated_at=recorded_at,
    )
    db.add_all([quote, revenue]); await db.flush()
    warehouse = FactoryDataWarehouseService(db)
    published = {}
    for source_code in ("quotes", "revenue"):
        source = await warehouse.create_source(
            project_id=9, context=context, actor=f"{source_code}-owner",
            source_reference=f"PROFIT-{source_code.upper()}-SOURCE", source_code=source_code,
            owner=f"{source_code}-owner", purpose=f"Governed {source_code} source for contribution analysis",
            retention_days=730,
        )
        source = await warehouse.activate_source(
            source["id"], project_id=9, expected_revision=source["revision"],
            actor=f"{source_code}-approver", schema_contract_reference=f"PROFIT-{source_code.upper()}-SCHEMA",
            approval_reference=f"PROFIT-{source_code.upper()}-APPROVAL",
        )
        run = await warehouse.extract(
            source["id"], project_id=9, expected_source_revision=source["revision"],
            actor=f"{source_code}-operator", load_reference=f"PROFIT-{source_code.upper()}-LOAD",
            cutoff_at=datetime.now(timezone.utc),
        )
        run = await warehouse.validate(
            run["id"], project_id=9, expected_revision=run["revision"],
            actor=f"{source_code}-validator", validation_reference=f"PROFIT-{source_code.upper()}-VALIDATE",
        )
        result = await warehouse.publish(
            run["id"], project_id=9, expected_revision=run["revision"],
            actor=f"{source_code}-publisher", publication_reference=f"PROFIT-{source_code.upper()}-PUBLISH",
        )
        workspace = await warehouse.list_workspace(project_id=9)
        fact = next(item for item in workspace["facts"] if item["source_code"] == source_code)
        published[source_code] = {"source": result["source"], "run": result["run"], "fact": fact}
    return quote, revenue, published


async def _published_policy(service, context):
    created = await service.create_policy(
        project_id=9, context=context, actor="policy-author",
        policy_reference="POLICY-LINEAR", policy_code="revenue.linear",
        owner="finance-marketing-owner", purpose="Govern multi-touch contribution analysis without claiming formal accounting profit",
        version_reference="POLICY-LINEAR-V1", label="Linear contribution attribution",
        model_type="linear", lookback_days=30, effective_from=datetime.now(timezone.utc),
        change_reason="Initial independently governed attribution policy",
    )
    submitted = await service.submit_policy_version(
        created["version"]["id"], project_id=9, expected_revision=created["version"]["revision"],
        actor="policy-author", submission_reference="POLICY-LINEAR-SUBMIT",
    )
    with pytest.raises(ValueError, match="independent"):
        await service.approve_policy_version(
            submitted["id"], project_id=9, expected_revision=submitted["revision"],
            actor="policy-author", approval_reference="POLICY-LINEAR-SELF-APPROVAL",
        )
    return await service.approve_policy_version(
        submitted["id"], project_id=9, expected_revision=submitted["revision"],
        actor="policy-approver", approval_reference="POLICY-LINEAR-APPROVAL",
    )


def test_revenue_profit_requires_published_facts_evidence_and_independent_verification():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            context = build_tenant_context(
                agent_path="hq/client-profit", tenant_id="tenant-profit", client_id="client-profit", plan_id="plan-9",
            )
            quote, revenue, published = await _authorities_and_warehouse(db, context)
            service = FactoryRevenueProfitService(db)
            policy = await _published_policy(service, context)

            for index, (channel, campaign, spend) in enumerate((
                ("google", "SEARCH-PROFIT", "100"), ("linkedin", "ABM-PROFIT", "50"),
            ), start=1):
                await service.record_touchpoint(
                    project_id=9, context=context, actor="marketing-evidence-owner",
                    external_event_reference=f"TOUCH-PROFIT-{index}", correlation_id=revenue.correlation_id,
                    account_reference=revenue.account_reference, channel=channel,
                    campaign_reference=campaign, content_reference=f"CONTENT-{index}",
                    occurred_at=datetime.now(timezone.utc) - timedelta(days=3 - index),
                    spend_amount=spend, currency="USD", consent_reference=f"CONSENT-PROFIT-{index}",
                )
            binding = await service.create_binding(
                project_id=9, context=context, actor="binding-author", binding_reference="BIND-PROFIT-1",
                revenue_load_run_id=published["revenue"]["run"]["id"],
                revenue_fact_id=published["revenue"]["fact"]["id"],
                quote_load_run_id=published["quotes"]["run"]["id"],
                quote_fact_id=published["quotes"]["fact"]["id"],
            )
            with pytest.raises(ValueError, match="independent"):
                await service.verify_binding(
                    binding["id"], project_id=9, expected_revision=binding["revision"],
                    actor="binding-author", verification_reference="BIND-SELF-VERIFY",
                )
            binding = await service.verify_binding(
                binding["id"], project_id=9, expected_revision=binding["revision"],
                actor="binding-verifier", verification_reference="BIND-PROFIT-VERIFY",
            )
            result = await service.calculate(
                project_id=9, actor="analysis-calculator", binding_id=binding["id"],
                policy_version_id=policy["version"]["id"], analysis_reference="ANALYSIS-PROFIT-1",
            )
            run = result["run"]
            assert run["recognized_revenue"] == "1000.00"
            assert run["governed_sales_cost"] == "600.00"
            assert run["marketing_spend"] == "150.00"
            assert run["contribution_margin"] == "250.00"
            assert run["contribution_margin_percent"] == "25.0000"
            assert {item["channel"] for item in result["allocations"]} == {"google", "linkedin"}
            assert sum(Decimal(item["attributed_contribution"]) for item in result["allocations"]) == Decimal("250.00")
            with pytest.raises(ValueError, match="independent"):
                await service.verify_analysis(
                    run["id"], project_id=9, expected_revision=run["revision"], actor="analysis-calculator",
                    verification_reference="ANALYSIS-SELF-VERIFY", verification_note="Self review is prohibited",
                )
            published_run = await service.verify_analysis(
                run["id"], project_id=9, expected_revision=run["revision"], actor="analysis-verifier",
                verification_reference="ANALYSIS-PROFIT-VERIFY",
                verification_note="Reconciled payment, quote cost, touchpoint spend and linear allocations",
            )
            assert published_run["status"] == "published"
            workspace = await service.list_workspace(project_id=9)
            assert workspace["contract"]["formal_accounting_profit"] is False
            assert workspace["contract"]["historical_recalculation"] is False
            assert {item["source_code"] for item in workspace["warehouse_candidates"]} == {"quotes", "revenue"}
            assert (quote.status, quote.revision, revenue.current_stage, revenue.revision) == ("accepted", 6, "payment-received", 7)
        await engine.dispose()

    asyncio.run(scenario())


def test_revenue_profit_policy_versions_do_not_recalculate_published_history():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            context = build_tenant_context(
                agent_path="hq/client-profit", tenant_id="tenant-profit", client_id="client-profit", plan_id="plan-9",
            )
            await _authorities_and_warehouse(db, context)
            service = FactoryRevenueProfitService(db)
            first = await _published_policy(service, context)
            v2 = await service.create_policy_version(
                first["policy"]["id"], project_id=9,
                expected_policy_revision=first["policy"]["revision"], actor="policy-author-v2",
                version_reference="POLICY-LAST-V2", label="Last touch contribution attribution",
                model_type="last-touch", lookback_days=45, effective_from=datetime.now(timezone.utc),
                change_reason="Use last-touch for future analyses without rewriting prior results",
            )
            submitted = await service.submit_policy_version(
                v2["version"]["id"], project_id=9, expected_revision=v2["version"]["revision"],
                actor="policy-author-v2", submission_reference="POLICY-LAST-V2-SUBMIT",
            )
            second = await service.approve_policy_version(
                submitted["id"], project_id=9, expected_revision=submitted["revision"],
                actor="policy-approver-v2", approval_reference="POLICY-LAST-V2-APPROVE",
            )
            assert second["superseded_version"]["status"] == "superseded"
            assert second["policy"]["current_version_number"] == 2
            with pytest.raises(ValueError, match="retroactively"):
                await service.create_policy_version(
                    first["policy"]["id"], project_id=9,
                    expected_policy_revision=second["policy"]["revision"], actor="policy-author-v3",
                    version_reference="POLICY-PAST-V3", label="Invalid retroactive policy",
                    model_type="first-touch", lookback_days=10,
                    effective_from=datetime.now(timezone.utc) - timedelta(days=1),
                    change_reason="This retroactive policy must be blocked",
                )
        await engine.dispose()

    asyncio.run(scenario())


def test_revenue_profit_blocks_unpublished_or_unverified_inputs():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            context = build_tenant_context(
                agent_path="hq/client-profit", tenant_id="tenant-profit", client_id="client-profit", plan_id="plan-9",
            )
            _, _, published = await _authorities_and_warehouse(db, context)
            service = FactoryRevenueProfitService(db)
            policy = await _published_policy(service, context)
            binding = await service.create_binding(
                project_id=9, context=context, actor="binding-author", binding_reference="BIND-BLOCK-1",
                revenue_load_run_id=published["revenue"]["run"]["id"],
                revenue_fact_id=published["revenue"]["fact"]["id"],
                quote_load_run_id=published["quotes"]["run"]["id"],
                quote_fact_id=published["quotes"]["fact"]["id"],
            )
            with pytest.raises(ValueError, match="verified fact binding"):
                await service.calculate(
                    project_id=9, actor="calculator", binding_id=binding["id"],
                    policy_version_id=policy["version"]["id"], analysis_reference="BLOCK-UNVERIFIED",
                )
            revenue_run = await db.get(FactoryWarehouseLoadRun, published["revenue"]["run"]["id"])
            revenue_run.status = "validated"; await db.flush()
            with pytest.raises(ValueError, match="published warehouse run"):
                await service.create_binding(
                    project_id=9, context=context, actor="binding-author", binding_reference="BIND-BLOCK-2",
                    revenue_load_run_id=published["revenue"]["run"]["id"],
                    revenue_fact_id=published["revenue"]["fact"]["id"],
                    quote_load_run_id=published["quotes"]["run"]["id"],
                    quote_fact_id=published["quotes"]["fact"]["id"],
                )
        await engine.dispose()

    asyncio.run(scenario())
