import asyncio
from datetime import date, datetime, timezone
from decimal import Decimal

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import models  # noqa: F401
from core.database import Base
from core.tenant_context import build_tenant_context
from models.factory_fulfillment import FactoryFulfillmentOrder
from services.factory_erp import FactoryErpService


def _context():
    return build_tenant_context(agent_path="hq/client-erp", tenant_id="tenant-erp",
                                client_id="client-erp", plan_id="plan-55")


async def _orders(db, context):
    now = datetime.now(timezone.utc)
    shared = dict(project_id=55, agent_path=context.agent_path, tenant_id=context.tenant_id,
                  client_id=context.client_id, plan_id=context.plan_id, exchange_rate=Decimal("1"),
                  lines_json="[]", authority_source="factory-oms", validation_json="{}",
                  fulfillment_evidence_json="[]", emitted_events_json="[]", created_at=now, updated_at=now)
    confirmed = FactoryFulfillmentOrder(id="erp-order-confirmed", order_number="SO-ERP-1",
        quote_id="erp-quote-1", quote_number="CPQ-ERP-1", order_intent_id="erp-intent-1",
        account_reference="BUYER-ERP", currency="USD", order_total=Decimal("1000"),
        status="confirmed", confirmed_by="order-approver", confirmed_at=now, revision=4, **shared)
    pending = FactoryFulfillmentOrder(id="erp-order-pending", order_number="SO-ERP-2",
        quote_id="erp-quote-2", quote_number="CPQ-ERP-2", order_intent_id="erp-intent-2",
        account_reference="BUYER-PENDING", currency="USD", order_total=Decimal("500"),
        status="pending-validation", revision=1, **shared)
    db.add_all([confirmed, pending]); await db.flush(); return confirmed, pending


async def _masters(service, context):
    unit = await service.create_unit(project_id=55, context=context, actor="master-author",
        unit_reference="ERP-UNIT-US", unit_code="US-FACTORY", unit_name="US Factory",
        unit_type="factory", base_currency="USD", manager="factory-manager")
    with pytest.raises(ValueError, match="independent"):
        await service.approve_unit(unit["id"], project_id=55, actor="master-author",
            expected_revision=unit["revision"], approval_reference="SELF")
    unit = await service.approve_unit(unit["id"], project_id=55, actor="master-approver",
        expected_revision=unit["revision"], approval_reference="ERP-UNIT-APPROVAL")
    center = await service.create_cost_center(project_id=55, context=context, actor="master-owner",
        operating_unit_id=unit["id"], center_reference="ERP-CENTER-PRODUCTION",
        center_code="PROD-01", center_name="Production Center", center_type="production",
        owner="production-owner")
    return unit, center


def test_erp_links_confirmed_order_and_closes_immutable_operating_period():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection: await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            context = _context(); confirmed, _ = await _orders(db, context)
            service = FactoryErpService(db); unit, center = await _masters(service, context)
            project = await service.register_order_project(project_id=55, context=context,
                actor="erp-project-owner", operating_unit_id=unit["id"], order_id=confirmed.id,
                project_reference="ERP-PROJECT-SO-1")
            assert project["order_number"] == confirmed.order_number and project["order_revision"] == 4
            assert confirmed.status == "confirmed" and confirmed.revision == 4
            period = await service.open_period(project_id=55, context=context, actor="period-owner",
                operating_unit_id=unit["id"], period_reference="ERP-PERIOD-2026-08", period_code="2026-08")
            revenue = await service.create_posting(project_id=55, context=context, actor="posting-author",
                posting_reference="ERP-POST-REVENUE", period_id=period["id"], order_project_id=project["id"],
                cost_center_id=center["id"], posting_date=date(2026, 8, 2), category="order-revenue",
                direction="inflow", amount="1000", description="Management order revenue recognition evidence",
                evidence_reference="OMS-SO-ERP-1")
            revenue = await service.submit_posting(revenue["id"], project_id=55, actor="posting-author",
                expected_revision=revenue["revision"], evidence_reference="ERP-POST-REVENUE-SUBMIT")
            with pytest.raises(ValueError, match="independent"):
                await service.approve_posting(revenue["id"], project_id=55, actor="posting-author",
                    expected_revision=revenue["revision"], approval_reference="SELF")
            revenue = await service.approve_posting(revenue["id"], project_id=55, actor="posting-approver",
                expected_revision=revenue["revision"], approval_reference="ERP-POST-REVENUE-APPROVE")
            cost = await service.create_posting(project_id=55, context=context, actor="posting-author",
                posting_reference="ERP-POST-MATERIAL", period_id=period["id"], order_project_id=project["id"],
                cost_center_id=center["id"], posting_date=date(2026, 8, 2), category="material",
                direction="outflow", amount="630", description="Management material consumption evidence",
                evidence_reference="PO-ERP-MATERIAL")
            cost = await service.submit_posting(cost["id"], project_id=55, actor="posting-author",
                expected_revision=cost["revision"], evidence_reference="ERP-POST-MATERIAL-SUBMIT")
            cost = await service.approve_posting(cost["id"], project_id=55, actor="posting-approver",
                expected_revision=cost["revision"], approval_reference="ERP-POST-MATERIAL-APPROVE")
            closing = await service.submit_period_close(period["id"], project_id=55, actor="period-owner",
                expected_revision=period["revision"], evidence_reference="ERP-CLOSE-RECONCILIATION")
            assert closing["period"]["total_inflow"] == "1000.00"
            assert closing["period"]["total_outflow"] == "630.00"
            assert closing["period"]["net_result"] == "370.00"
            assert closing["period"]["posting_count"] == 2
            assert len(closing["balances"]) == 1 and closing["balances"][0]["net_result"] == "370.00"
            with pytest.raises(ValueError, match="independent"):
                await service.close_period(period["id"], project_id=55, actor="period-owner",
                    expected_revision=closing["period"]["revision"], approval_reference="SELF")
            closed = await service.close_period(period["id"], project_id=55, actor="period-closer",
                expected_revision=closing["period"]["revision"], approval_reference="ERP-CLOSE-APPROVAL")
            assert closed["status"] == "closed"
            assert revenue["status"] == "posted" and cost["status"] == "posted"
            with pytest.raises(ValueError, match="open period"):
                await service.create_posting(project_id=55, context=context, actor="late-author",
                    posting_reference="ERP-POST-LATE", period_id=period["id"], order_project_id=project["id"],
                    cost_center_id=center["id"], posting_date=date(2026, 8, 3), category="overhead",
                    direction="outflow", amount="10", description="Late posting must remain blocked",
                    evidence_reference="LATE")
            workspace = await service.list_workspace(project_id=55)
            assert workspace["contract"]["formal_financial_general_ledger"] is False
            assert workspace["contract"]["posted_records_mutable"] is False
            assert (await service.list_workspace(project_id=56))["periods"] == []
        await engine.dispose()
    asyncio.run(scenario())


def test_erp_blocks_unconfirmed_orders_and_period_close_with_unposted_records():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection: await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            context = _context(); confirmed, pending = await _orders(db, context)
            service = FactoryErpService(db); unit, center = await _masters(service, context)
            with pytest.raises(ValueError, match="confirmed OMS order"):
                await service.register_order_project(project_id=55, context=context, actor="owner",
                    operating_unit_id=unit["id"], order_id=pending.id, project_reference="ERP-PENDING")
            project = await service.register_order_project(project_id=55, context=context, actor="owner",
                operating_unit_id=unit["id"], order_id=confirmed.id, project_reference="ERP-CONFIRMED")
            period = await service.open_period(project_id=55, context=context, actor="period-owner",
                operating_unit_id=unit["id"], period_reference="ERP-PERIOD-2026-09", period_code="2026-09")
            draft = await service.create_posting(project_id=55, context=context, actor="author",
                posting_reference="ERP-DRAFT", period_id=period["id"], order_project_id=project["id"],
                cost_center_id=center["id"], posting_date=date(2026, 9, 1), category="labor",
                direction="outflow", amount="100", description="Draft labor evidence blocks close",
                evidence_reference="LABOR-DRAFT")
            with pytest.raises(ValueError, match="unposted"):
                await service.submit_period_close(period["id"], project_id=55, actor="period-owner",
                    expected_revision=period["revision"], evidence_reference="PREMATURE-CLOSE")
            with pytest.raises(ValueError, match="revision conflict"):
                await service.submit_posting(draft["id"], project_id=55, actor="author",
                    expected_revision=999, evidence_reference="STALE")
        await engine.dispose()
    asyncio.run(scenario())
