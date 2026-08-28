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
from models.factory_customer_asset import FactoryAssetServiceTicket, FactoryCustomerAsset
from models.factory_fulfillment import FactoryFulfillmentOrder
from models.factory_warranty_rma import FactoryWarrantyRmaCase
from services.factory_renewal_growth import FactoryRenewalGrowthService


def context(project_id: int):
    return build_tenant_context(
        agent_path="org-1/org-2", tenant_id="tenant-1",
        client_id="client-2", plan_id=f"plan-{project_id}",
    )


def source_records(project_id: int, *, suffix: str = "1", renewal_status: str = "action-required"):
    now = datetime.now(timezone.utc)
    asset = FactoryCustomerAsset(
        id=f"asset-renewal-{suffix}", project_id=project_id, agent_path="org-1/org-2",
        tenant_id="tenant-1", client_id="client-2", plan_id=f"plan-{project_id}",
        asset_number=f"ASSET-RENEWAL-{suffix}", order_id=f"original-order-{suffix}",
        order_number=f"SO-ORIGINAL-{suffix}", account_reference="BUYER-RENEWAL-1",
        product_reference="PUMP-001", sku_reference="PUMP-001-380V",
        serial_number=f"SN-RENEWAL-{suffix}", installation_location="Shanghai Plant / Line 1",
        installed_at=now - timedelta(days=300), warranty_until=now + timedelta(days=60),
        next_service_due_at=now + timedelta(days=30), status="active",
        renewal_status=renewal_status, renewal_owner="account-manager-1",
        renewal_action="Prepare an annual maintenance and capacity expansion proposal",
        service_count=2, emitted_events_json="[]", revision=6, updated_by="service",
    )
    tickets = [FactoryAssetServiceTicket(
        id=f"ticket-renewal-{suffix}-{index}", project_id=project_id,
        agent_path="org-1/org-2", tenant_id="tenant-1", client_id="client-2",
        plan_id=f"plan-{project_id}", ticket_number=f"SRV-RENEWAL-{suffix}-{index}",
        asset_id=asset.id, asset_number=asset.asset_number,
        issue_summary="Governed onsite service result for renewal value review",
        severity="medium", status="resolved", sla_due_at=now + timedelta(hours=24),
        resolution_reference=f"SERVICE-REPORT-{suffix}-{index}",
        resolution_note="Customer confirmed stable operation after repair",
        emitted_events_json="[]", revision=4, updated_by="service",
    ) for index in (1, 2)]
    rma = FactoryWarrantyRmaCase(
        id=f"rma-renewal-{suffix}", project_id=project_id, agent_path="org-1/org-2",
        tenant_id="tenant-1", client_id="client-2", plan_id=f"plan-{project_id}",
        rma_number=f"RMA-RENEWAL-{suffix}", claim_reference=f"CLAIM-RENEWAL-{suffix}",
        asset_id=asset.id, asset_number=asset.asset_number,
        service_ticket_id=tickets[0].id, service_ticket_number=tickets[0].ticket_number,
        order_id=asset.order_id, order_number=asset.order_number,
        account_reference=asset.account_reference, product_reference=asset.product_reference,
        sku_reference=asset.sku_reference, serial_number=asset.serial_number,
        warranty_until=asset.warranty_until, eligibility_status="eligible",
        claim_summary="Manufacturing defect repaired under governed RMA",
        requested_remedy="repair", lifecycle_status="closed",
        inspection_result="manufacturing-defect", responsibility="manufacturer",
        estimated_total_cost=Decimal("525"), milestones_json="[]", revision=8,
        updated_by="service", closed_at=now - timedelta(days=10),
    )
    original_quote = FactoryCpqQuote(
        id=f"original-quote-{suffix}", project_id=project_id, agent_path="org-1/org-2",
        tenant_id="tenant-1", client_id="client-2", plan_id=f"plan-{project_id}",
        quote_number=f"CPQ-ORIGINAL-{suffix}", account_reference=asset.account_reference,
        currency="USD", exchange_rate=Decimal("1"), valid_until=now + timedelta(days=30),
        lines_json=json.dumps([{"product_reference": "PUMP-002", "sku_reference": "PUMP-002-380V", "quantity": "2"}]),
        subtotal=Decimal("5000"), cost_total=Decimal("3500"), gross_margin_percent=Decimal("30"),
        status="accepted", order_intent_id=f"original-intent-{suffix}", emitted_events_json="[]",
        revision=5, updated_by="sales",
    )
    original_order = FactoryFulfillmentOrder(
        id=asset.order_id, project_id=project_id, agent_path="org-1/org-2",
        tenant_id="tenant-1", client_id="client-2", plan_id=f"plan-{project_id}",
        order_number=asset.order_number, quote_id=original_quote.id,
        quote_number=original_quote.quote_number, order_intent_id=original_quote.order_intent_id,
        account_reference=asset.account_reference, currency="USD", exchange_rate=Decimal("1"),
        lines_json=original_quote.lines_json, order_total=Decimal("5000"), status="delivered",
        authority_source="factory-oms", validation_json="{}", fulfillment_evidence_json="[]",
        emitted_events_json="[]", confirmed_by="oms", confirmed_at=now - timedelta(days=300),
        revision=8, updated_by="oms",
    )
    return asset, tickets, rma, original_quote, original_order


def accepted_quote(project_id: int, *, suffix: str, account: str = "BUYER-RENEWAL-1", sku: str = "PUMP-002-380V"):
    now = datetime.now(timezone.utc)
    return FactoryCpqQuote(
        id=f"renewal-quote-{suffix}", project_id=project_id, agent_path="org-1/org-2",
        tenant_id="tenant-1", client_id="client-2", plan_id=f"plan-{project_id}",
        quote_number=f"CPQ-RENEWAL-{suffix}", account_reference=account,
        currency="USD", exchange_rate=Decimal("1"), valid_until=now + timedelta(days=30),
        lines_json=json.dumps([{
            "product_reference": "PUMP-002", "sku_reference": sku, "quantity": "2",
            "moq": "1", "unit_price": "3200.00", "unit_cost": "2200.00",
            "lead_time_days": 30, "line_total": "6400.00",
        }]),
        subtotal=Decimal("6400"), cost_total=Decimal("4400"), gross_margin_percent=Decimal("31.25"),
        status="accepted", order_intent_id=f"renewal-intent-{suffix}",
        emitted_events_json="[]", revision=5, updated_by="sales",
    )


async def create_and_recommend(service: FactoryRenewalGrowthService, project_id: int):
    now = datetime.now(timezone.utc)
    item = await service.create(
        project_id=project_id, context=context(project_id), actor="success-manager",
        asset_id="asset-renewal-1", opportunity_reference=f"RENEWAL-CYCLE-{project_id}",
        owner="account-manager-1", next_action_at=now + timedelta(days=2),
    )
    item = await service.assess(
        item["id"], project_id=project_id, expected_revision=1, actor="success-manager",
        value_evidence_reference="QBR-VALUE-001",
        value_summary="Customer confirmed production stability and measurable downtime reduction",
    )
    item = await service.recommend(
        item["id"], project_id=project_id, expected_revision=2, actor="success-manager",
        motion="upsell", customer_goal="Increase pumping capacity while renewing annual maintenance",
        customer_confirmation_reference="CUSTOMER-DEMAND-001",
        recommendation_reference="RENEWAL-PLAN-001",
        recommended_product_reference="PUMP-002", recommended_sku_reference="PUMP-002-380V",
        recommended_quantity="2", currency="USD", estimated_unit_price="3200",
        estimated_unit_cost="2200",
        recommendation_rationale="Service history and confirmed capacity demand support a two-unit upgrade",
    )
    return item


def test_renewal_requires_actionable_asset_and_is_tenant_scoped():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            records = source_records(1)
            monitoring = source_records(1, suffix="monitoring", renewal_status="monitoring")
            db.add_all([records[0], *records[1], records[2], records[3], records[4], monitoring[0]])
            await db.flush()
            service = FactoryRenewalGrowthService(db)
            with pytest.raises(ValueError, match="approved renewal action"):
                await service.create(project_id=1, context=context(1), actor="sales", asset_id=monitoring[0].id, opportunity_reference="NOT-READY", owner="sales", next_action_at=datetime.now(timezone.utc) + timedelta(days=1))
            with pytest.raises(KeyError, match="tenant plan"):
                await service.create(project_id=2, context=context(2), actor="intruder", asset_id=records[0].id, opportunity_reference="CROSS-TENANT", owner="intruder", next_action_at=datetime.now(timezone.utc) + timedelta(days=1))
            item = await service.create(project_id=1, context=context(1), actor="sales", asset_id=records[0].id, opportunity_reference="RENEWAL-CYCLE-1", owner="account-manager-1", next_action_at=datetime.now(timezone.utc) + timedelta(days=1))
            assert item["health_score"] == 60
            assert item["risk_level"] == "medium"
            assert item["source_snapshot"]["manufacturerFaultCount"] == 1
            with pytest.raises(ValueError, match="already has an open"):
                await service.create(project_id=1, context=context(1), actor="sales", asset_id=records[0].id, opportunity_reference="RENEWAL-CYCLE-2", owner="account-manager-1", next_action_at=datetime.now(timezone.utc) + timedelta(days=1))
            assert (await service.list_workspace(project_id=2))["opportunities"] == []
        await engine.dispose()
    asyncio.run(scenario())


def test_renewal_cannot_skip_approval_or_reuse_unrelated_quote():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            records = source_records(2)
            db.add_all([records[0], *records[1], records[2], records[3], records[4]])
            await db.flush()
            service = FactoryRenewalGrowthService(db)
            item = await create_and_recommend(service, 2)
            with pytest.raises(ValueError, match="approved status"):
                await service.request_cpq(item["id"], project_id=2, expected_revision=3, actor="sales", cpq_handoff_reference="CPQ-HANDOFF-EARLY")
            item = await service.approve(item["id"], project_id=2, expected_revision=3, actor="sales-director", approval_reference="RENEWAL-APPROVAL-001", approval_note="Margin and customer demand evidence reviewed and approved")
            item = await service.request_cpq(item["id"], project_id=2, expected_revision=4, actor="sales", cpq_handoff_reference="CPQ-HANDOFF-001")
            with pytest.raises(ValueError, match="original asset order"):
                await service.link_accepted_quote(item["id"], project_id=2, expected_revision=5, actor="sales", quote_id=records[3].id)
            wrong = accepted_quote(2, suffix="wrong", account="OTHER-BUYER")
            db.add(wrong); await db.flush()
            with pytest.raises(ValueError, match="customer does not match"):
                await service.link_accepted_quote(item["id"], project_id=2, expected_revision=5, actor="sales", quote_id=wrong.id)
        await engine.dispose()
    asyncio.run(scenario())


def test_renewal_full_chain_requires_cpq_acceptance_and_oms_confirmation():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            records = source_records(3)
            db.add_all([records[0], *records[1], records[2], records[3], records[4]])
            await db.flush()
            service = FactoryRenewalGrowthService(db)
            item = await create_and_recommend(service, 3)
            item = await service.approve(item["id"], project_id=3, expected_revision=3, actor="sales-director", approval_reference="RENEWAL-APPROVAL-001", approval_note="Customer value, price floor and expansion margin are approved")
            item = await service.request_cpq(item["id"], project_id=3, expected_revision=4, actor="sales", cpq_handoff_reference="CPQ-HANDOFF-001")
            quote = accepted_quote(3, suffix="won")
            db.add(quote); await db.flush()
            item = await service.link_accepted_quote(item["id"], project_id=3, expected_revision=5, actor="sales", quote_id=quote.id)
            assert item["lifecycle_status"] == "quoted"
            order = FactoryFulfillmentOrder(
                id="renewal-order-won", project_id=3, agent_path="org-1/org-2",
                tenant_id="tenant-1", client_id="client-2", plan_id="plan-3",
                order_number="SO-RENEWAL-WON", quote_id=quote.id, quote_number=quote.quote_number,
                order_intent_id=quote.order_intent_id, account_reference=quote.account_reference,
                currency="USD", exchange_rate=Decimal("1"), lines_json=quote.lines_json,
                order_total=quote.subtotal, status="pending-validation", authority_source="factory-oms",
                validation_json="{}", fulfillment_evidence_json="[]", emitted_events_json="[]",
                revision=1, updated_by="oms",
            )
            db.add(order); await db.flush()
            with pytest.raises(ValueError, match="OMS-confirmed"):
                await service.confirm_won(item["id"], project_id=3, expected_revision=6, actor="sales", order_id=order.id)
            order.status = "confirmed"
            order.confirmed_by = "oms-authority"
            order.confirmed_at = datetime.now(timezone.utc)
            order.revision = 2
            await db.flush()
            item = await service.confirm_won(item["id"], project_id=3, expected_revision=6, actor="sales", order_id=order.id)
            assert item["lifecycle_status"] == "won"
            assert item["actual_value"] == "6400.00"
            assert item["order_number"] == "SO-RENEWAL-WON"
            assert item["revision"] == 7
            assert [row["evidence_type"] for row in item["evidence"]] == [
                "value-assessment", "customer-confirmation", "recommendation", "approval",
                "cpq-handoff", "quote-accepted", "order-confirmed",
            ]
            assert records[0].revision == 6
            assert records[3].status == "accepted"
            assert records[4].status == "delivered"
        await engine.dispose()
    asyncio.run(scenario())
