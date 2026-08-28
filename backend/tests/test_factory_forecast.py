import asyncio
from datetime import datetime, timedelta, timezone
from decimal import Decimal
import json

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import models  # noqa: F401
from core.database import Base
from core.tenant_context import build_tenant_context
from models.factory_cpq import FactoryCpqQuote
from models.factory_fulfillment import FactoryFulfillmentOrder
from models.factory_planning import FactoryPlanningResource, FactoryProductionPlan
from models.factory_procurement import FactoryPurchaseOrder
from models.factory_revenue import FactoryRevenueFlowRun
from services.factory_data_warehouse import FactoryDataWarehouseService
from services.factory_forecast import FactoryForecastService, SOURCE_CODES


def _context():
    return build_tenant_context(
        agent_path="hq/client-forecast", tenant_id="tenant-forecast",
        client_id="client-forecast", plan_id="plan-10",
    )


async def _authorities(db, context):
    recorded = datetime.now(timezone.utc) - timedelta(minutes=2)
    shared = dict(project_id=10, agent_path=context.agent_path, tenant_id=context.tenant_id,
                  client_id=context.client_id, plan_id=context.plan_id,
                  created_at=recorded, updated_at=recorded)
    quote_ordered = FactoryCpqQuote(
        id="forecast-quote-1", quote_number="CPQ-FC-1", account_reference="BUYER-FC",
        currency="USD", exchange_rate=Decimal("1"), valid_until=recorded + timedelta(days=30),
        lines_json="[]", subtotal=Decimal("1000"), cost_total=Decimal("600"),
        gross_margin_percent=Decimal("40"), status="accepted", order_intent_id="intent-fc-1",
        revision=4, **shared,
    )
    quote_pipeline = FactoryCpqQuote(
        id="forecast-quote-2", quote_number="CPQ-FC-2", account_reference="BUYER-PIPE",
        currency="USD", exchange_rate=Decimal("1"), valid_until=recorded + timedelta(days=45),
        lines_json="[]", subtotal=Decimal("500"), cost_total=Decimal("300"),
        gross_margin_percent=Decimal("40"), status="sent", order_intent_id=None,
        revision=2, **shared,
    )
    order = FactoryFulfillmentOrder(
        id="forecast-order-1", order_number="SO-FC-1", quote_id=quote_ordered.id,
        quote_number=quote_ordered.quote_number, order_intent_id="intent-fc-1",
        account_reference="BUYER-FC", currency="USD", exchange_rate=Decimal("1"),
        lines_json=json.dumps([{"product_reference": "PUMP-1", "sku_reference": "PUMP-1-A", "quantity": "10"}]),
        order_total=Decimal("1000"), status="confirmed", authority_source="factory-oms",
        validation_json="{}", fulfillment_evidence_json="[]", emitted_events_json="[]",
        revision=3, **shared,
    )
    revenue = FactoryRevenueFlowRun(
        id="forecast-revenue-1", correlation_id="corr-fc-1", product_reference="PUMP-1",
        account_reference="BUYER-FC", currency="USD", quoted_amount=Decimal("1000"),
        ordered_amount=Decimal("1000"), invoiced_amount=Decimal("1000"), paid_amount=Decimal("900"),
        current_stage="payment-received", revision=6, **shared,
    )
    resource = FactoryPlanningResource(
        id="forecast-resource-1", resource_number="RES-FC-1", resource_reference="LINE-FC-1",
        resource_name="Forecast assembly line", daily_capacity=Decimal("5"), shift_hours=Decimal("8"),
        efficiency_percent=Decimal("80"), calendar_evidence_reference="CAL-FC-1",
        lifecycle_status="approved", approval_reference="CAP-FC-APPROVAL", approved_by="capacity-approver",
        approved_at=recorded, revision=2, **shared,
    )
    plan = FactoryProductionPlan(
        id="forecast-plan-1", production_plan_number="PLAN-FC-1", demand_order_id=order.id,
        demand_order_number=order.order_number, engineering_version_id="engineering-fc-1",
        engineering_number="ENG-FC-1", product_reference="PUMP-1", sku_reference="PUMP-1-A",
        demand_quantity=Decimal("10"), resource_id=resource.id, resource_number=resource.resource_number,
        effective_daily_capacity=Decimal("4"), capacity_days=3, planned_start_at=recorded,
        planned_end_at=recorded + timedelta(days=3), due_at=recorded + timedelta(days=30),
        material_requirements_json="[]", shortage_json="[]", material_readiness_status="ready",
        schedule_status="on-time", lifecycle_status="released", release_reference="PLAN-FC-RELEASE",
        work_order_intent_reference="WOI-FC-1", milestones_json="[]", revision=4, **shared,
    )
    purchase = FactoryPurchaseOrder(
        id="forecast-purchase-1", purchase_order_number="PO-FC-1", supplier_id="supplier-fc-1",
        supplier_number="SUP-FC-1", supplier_reference="VENDOR-FC-1", demand_order_id=order.id,
        demand_order_number=order.order_number, engineering_version_id="engineering-fc-1",
        engineering_number="ENG-FC-1", product_reference="PUMP-1", sku_reference="PUMP-1-A",
        currency="USD", lines_json="[]", subtotal=Decimal("630"),
        needed_by=recorded + timedelta(days=20), lifecycle_status="issued",
        approval_reference="PO-FC-APPROVAL", issue_document_reference="PO-FC-DOC",
        milestones_json="[]", received_quantities_json="[]", revision=3, **shared,
    )
    db.add_all([quote_ordered, quote_pipeline, order, revenue, resource, plan, purchase])
    await db.flush()


async def _publish_sources(db, context):
    warehouse = FactoryDataWarehouseService(db)
    for code in SOURCE_CODES:
        source = await warehouse.create_source(
            project_id=10, context=context, actor="warehouse-owner",
            source_reference=f"FORECAST-{code}-SOURCE", source_code=code,
            owner="forecast-data-owner", purpose=f"Published {code} facts for governed rolling forecast",
            retention_days=730,
        )
        source = await warehouse.activate_source(
            source["id"], project_id=10, expected_revision=source["revision"],
            actor="warehouse-approver", schema_contract_reference=f"FORECAST-{code}-SCHEMA",
            approval_reference=f"FORECAST-{code}-APPROVAL",
        )
        run = await warehouse.extract(
            source["id"], project_id=10, expected_source_revision=source["revision"],
            actor="warehouse-operator", load_reference=f"FORECAST-{code}-LOAD",
            cutoff_at=datetime.now(timezone.utc),
        )
        run = await warehouse.validate(
            run["id"], project_id=10, expected_revision=run["revision"],
            actor="warehouse-validator", validation_reference=f"FORECAST-{code}-VALIDATE",
        )
        await warehouse.publish(
            run["id"], project_id=10, expected_revision=run["revision"],
            actor="warehouse-publisher", publication_reference=f"FORECAST-{code}-PUBLISH",
        )


async def _published_policy(service, context):
    created = await service.create_policy(
        project_id=10, context=context, actor="forecast-policy-author",
        policy_reference="FORECAST-POLICY-BASE", policy_code="forecast.rolling.base",
        owner="s-and-op-owner", purpose="Govern rolling demand capacity and cash assumptions without replacing formal finance",
        version_reference="FORECAST-POLICY-V1", label="90-day governed base scenario",
        model_type="weighted-pipeline-capacity-cash", horizon_days=90, bucket_days=30,
        demand_growth_percent="10", pipeline_probability_percent="40", collection_percent="80",
        capacity_buffer_percent="10", procurement_payment_percent="50",
        effective_from=datetime.now(timezone.utc),
        change_reason="Initial rolling forecast policy for independent approval and future runs",
    )
    submitted = await service.submit_policy_version(
        created["version"]["id"], project_id=10,
        expected_revision=created["version"]["revision"], actor="forecast-policy-author",
        evidence_reference="FORECAST-POLICY-V1-SUBMIT",
    )
    with pytest.raises(ValueError, match="independent"):
        await service.approve_policy_version(
            submitted["id"], project_id=10, expected_revision=submitted["revision"],
            actor="forecast-policy-author", evidence_reference="FORECAST-POLICY-V1-SELF",
        )
    return await service.approve_policy_version(
        submitted["id"], project_id=10, expected_revision=submitted["revision"],
        actor="forecast-policy-approver", evidence_reference="FORECAST-POLICY-V1-APPROVE",
    )


def test_forecast_pins_six_published_sources_and_requires_independent_publication():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            context = _context(); await _authorities(db, context); await _publish_sources(db, context)
            service = FactoryForecastService(db); policy = await _published_policy(service, context)
            result = await service.calculate(
                project_id=10, context=context, actor="forecast-calculator",
                policy_version_id=policy["version"]["id"], forecast_reference="FORECAST-RUN-BASE-1",
                as_of_at=datetime.now(timezone.utc),
            )
            run = result["run"]
            assert run["pipeline_demand_value"] == "220.00"
            assert run["confirmed_order_value"] == "1100.00"
            assert run["required_capacity_units"] == "12.1000"
            assert run["available_capacity_units"] == "360.0000"
            assert run["capacity_gap_units"] == "347.9000"
            assert run["expected_cash_in"] == "256.00"
            assert run["expected_cash_out"] == "315.00"
            assert run["net_cash_change"] == "-59.00"
            assert {item["source_code"] for item in result["input_edges"]} == set(SOURCE_CODES)
            assert len(result["input_edges"]) == 7 and len(result["buckets"]) == 3
            assert sum(Decimal(item["net_cash_change"]) for item in result["buckets"]) == Decimal("-59.00")
            with pytest.raises(ValueError, match="independent"):
                await service.verify(
                    run["id"], project_id=10, expected_revision=run["revision"], actor="forecast-calculator",
                    verification_reference="FORECAST-RUN-SELF", verification_note="Self review is prohibited",
                )
            published = await service.verify(
                run["id"], project_id=10, expected_revision=run["revision"], actor="forecast-verifier",
                verification_reference="FORECAST-RUN-PUBLISH",
                verification_note="Reconciled all six published source runs, assumptions, totals and bucket allocations",
            )
            assert published["status"] == "published"
            workspace = await service.list_workspace(project_id=10)
            assert workspace["contract"]["formal_financial_forecast"] is False
            assert workspace["contract"]["historical_recalculation"] is False
            assert all(item["ready"] for item in workspace["source_readiness"])
            assert (await service.list_workspace(project_id=11))["forecast_runs"] == []
        await engine.dispose()
    asyncio.run(scenario())


def test_forecast_blocks_missing_published_source_and_preserves_published_history():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            context = _context(); await _authorities(db, context)
            service = FactoryForecastService(db); policy = await _published_policy(service, context)
            with pytest.raises(ValueError, match="latest published warehouse sources"):
                await service.calculate(
                    project_id=10, context=context, actor="calculator",
                    policy_version_id=policy["version"]["id"], forecast_reference="FORECAST-MISSING",
                    as_of_at=datetime.now(timezone.utc),
                )
            version2 = await service.create_policy_version(
                policy["policy"]["id"], project_id=10,
                expected_policy_revision=policy["policy"]["revision"], actor="forecast-policy-author-v2",
                version_reference="FORECAST-POLICY-V2", label="Conservative next scenario",
                model_type="weighted-pipeline-capacity-cash", horizon_days=120, bucket_days=30,
                demand_growth_percent="0", pipeline_probability_percent="25", collection_percent="70",
                capacity_buffer_percent="15", procurement_payment_percent="60",
                effective_from=datetime.now(timezone.utc),
                change_reason="Future conservative assumptions must not rewrite any previously published run",
            )
            assert version2["version"]["version_number"] == 2
            assert policy["version"]["status"] == "published"
        await engine.dispose()
    asyncio.run(scenario())
