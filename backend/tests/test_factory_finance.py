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
from services.factory_finance import FactoryFinanceService


def _context():
    return build_tenant_context(agent_path="hq/client-finance", tenant_id="tenant-finance",
                                client_id="client-finance", plan_id="plan-56")


async def _authority_records(db, context):
    now = datetime.now(timezone.utc)
    order = FactoryFulfillmentOrder(id="finance-order", order_number="SO-FIN-1",
        project_id=56, agent_path=context.agent_path, tenant_id=context.tenant_id,
        client_id=context.client_id, plan_id=context.plan_id, quote_id="fin-quote",
        quote_number="CPQ-FIN-1", order_intent_id="fin-intent", account_reference="BUYER-FIN",
        currency="USD", exchange_rate=Decimal("1"), order_total=Decimal("1000"),
        lines_json="[]", status="confirmed", confirmed_by="order-approver", confirmed_at=now,
        authority_source="factory-oms", validation_json="{}", fulfillment_evidence_json="[]",
        emitted_events_json="[]", revision=3, created_at=now, updated_at=now)
    db.add(order); await db.flush()
    erp = FactoryErpService(db)
    unit = await erp.create_unit(project_id=56, context=context, actor="book-author",
        unit_reference="FINANCE-US-UNIT", unit_code="FIN-US", unit_name="Finance US Factory",
        unit_type="factory", base_currency="USD", manager="finance-manager")
    unit = await erp.approve_unit(unit["id"], project_id=56, actor="book-approver",
        expected_revision=unit["revision"], approval_reference="FIN-ERP-UNIT-APPROVAL")
    order_project = await erp.register_order_project(project_id=56, context=context,
        actor="erp-owner", operating_unit_id=unit["id"], order_id=order.id,
        project_reference="FINANCE-ORDER-PROJECT")
    return order, unit, order_project


async def _finance_masters(service, context, unit):
    book = await service.create_book(project_id=56, context=context, actor="finance-author",
        operating_unit_id=unit["id"], book_reference="FINANCE-BOOK-US",
        book_code="US-GAAP", book_name="US Accrual Book")
    with pytest.raises(ValueError, match="independent"):
        await service.approve_book(book["id"], project_id=56, actor="finance-author",
            expected_revision=book["revision"], approval_reference="SELF")
    book = await service.approve_book(book["id"], project_id=56, actor="finance-approver",
        expected_revision=book["revision"], approval_reference="FINANCE-BOOK-APPROVAL")
    period = await service.open_period(project_id=56, context=context, actor="period-owner",
        book_id=book["id"], period_reference="FINANCE-2026-08", period_code="2026-08")
    return book, period


def test_finance_posts_balanced_ar_cash_and_closes_independently():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection: await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            context = _context(); order, unit, order_project = await _authority_records(db, context)
            service = FactoryFinanceService(db); book, period = await _finance_masters(service, context, unit)
            invoice = await service.create_document(project_id=56, context=context, actor="finance-author",
                book_id=book["id"], period_id=period["id"], document_reference="AR-SO-FIN-1",
                document_type="ar-invoice", document_date=date(2026, 8, 2), due_date=date(2026, 9, 1),
                source_id=order_project["id"], settlement_of_document_id=None, amount="1000",
                description="Authoritative customer invoice for confirmed order",
                source_evidence_reference="OMS-SO-FIN-1")
            with pytest.raises(ValueError, match="independent"):
                await service.approve_document(invoice["id"], project_id=56, actor="finance-author",
                    expected_revision=invoice["revision"], approval_reference="SELF")
            invoice = await service.approve_document(invoice["id"], project_id=56, actor="finance-approver",
                expected_revision=invoice["revision"], approval_reference="AR-POST-APPROVAL")
            assert invoice["status"] == "posted"
            receipt = await service.create_document(project_id=56, context=context, actor="cash-author",
                book_id=book["id"], period_id=period["id"], document_reference="RCPT-SO-FIN-1",
                document_type="cash-receipt", document_date=date(2026, 8, 5), due_date=None,
                source_id=None, settlement_of_document_id=invoice["id"], amount="400",
                description="Customer cash receipt allocated to AR invoice",
                source_evidence_reference="BANK-RECEIPT-400")
            receipt = await service.approve_document(receipt["id"], project_id=56, actor="cash-approver",
                expected_revision=receipt["revision"], approval_reference="CASH-POST-APPROVAL")
            assert receipt["status"] == "posted"
            workspace = await service.list_workspace(project_id=56)
            invoice_after = next(x for x in workspace["documents"] if x["id"] == invoice["id"])
            assert invoice_after["status"] == "partially-settled" and invoice_after["settled_amount"] == "400.00"
            assert len(workspace["journals"]) == 2 and len(workspace["journal_lines"]) == 4
            for journal in workspace["journals"]:
                assert journal["total_debit"] == journal["total_credit"] and journal["status"] == "posted"
            closing = await service.submit_period_close(period["id"], project_id=56,
                actor="period-owner", expected_revision=period["revision"],
                evidence_reference="FINANCE-TRIAL-BALANCE-RECONCILED")
            assert closing["total_debit"] == "1400.00" and closing["total_credit"] == "1400.00"
            assert closing["journal_count"] == 2
            with pytest.raises(ValueError, match="independent"):
                await service.close_period(period["id"], project_id=56, actor="period-owner",
                    expected_revision=closing["revision"], approval_reference="SELF")
            closed = await service.close_period(period["id"], project_id=56, actor="period-closer",
                expected_revision=closing["revision"], approval_reference="FINANCE-CLOSE-APPROVAL")
            assert closed["status"] == "closed" and order.status == "confirmed" and order.revision == 3
            workspace = await service.list_workspace(project_id=56)
            assert workspace["contract"]["double_entry_required"] is True
            assert workspace["contract"]["posted_journals_mutable"] is False
            assert (await service.list_workspace(project_id=57))["books"] == []
        await engine.dispose()
    asyncio.run(scenario())


def test_finance_blocks_overbilling_and_close_with_draft_documents():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection: await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            context = _context(); _, unit, order_project = await _authority_records(db, context)
            service = FactoryFinanceService(db); book, period = await _finance_masters(service, context, unit)
            draft = await service.create_document(project_id=56, context=context, actor="finance-author",
                book_id=book["id"], period_id=period["id"], document_reference="AR-DRAFT",
                document_type="ar-invoice", document_date=date(2026, 8, 2), due_date=date(2026, 9, 1),
                source_id=order_project["id"], settlement_of_document_id=None, amount="700",
                description="Draft invoice must block finance period close",
                source_evidence_reference="AR-DRAFT-EVIDENCE")
            with pytest.raises(ValueError, match="exceed"):
                await service.create_document(project_id=56, context=context, actor="finance-author",
                    book_id=book["id"], period_id=period["id"], document_reference="AR-OVER",
                    document_type="ar-invoice", document_date=date(2026, 8, 2), due_date=date(2026, 9, 1),
                    source_id=order_project["id"], settlement_of_document_id=None, amount="400",
                    description="Overbilling must be rejected before posting",
                    source_evidence_reference="AR-OVER-EVIDENCE")
            with pytest.raises(ValueError, match="draft documents"):
                await service.submit_period_close(period["id"], project_id=56, actor="period-owner",
                    expected_revision=period["revision"], evidence_reference="PREMATURE-CLOSE")
            with pytest.raises(ValueError, match="revision conflict"):
                await service.approve_document(draft["id"], project_id=56, actor="finance-approver",
                    expected_revision=999, approval_reference="STALE")
        await engine.dispose()
    asyncio.run(scenario())
