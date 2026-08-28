import asyncio
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import models  # noqa: F401
from core.database import Base
from core.tenant_context import build_tenant_context
from models.factory_contract import FactoryCoreEventContract
from services.factory_cpq import FactoryCpqService


def context(project_id: int):
    return build_tenant_context(agent_path="org-1/org-2", tenant_id="tenant-1", client_id="client-2", plan_id=f"plan-{project_id}")


def line(quantity="10", moq="5", unit_price="100", unit_cost="70"):
    return {"product_reference": "PUMP-001", "sku_reference": "PUMP-001-380V", "quantity": quantity, "moq": moq, "unit_price": unit_price, "unit_cost": unit_cost, "lead_time_days": 30}


def frozen_event(event_id: str, sequence: int):
    return FactoryCoreEventContract(id=event_id, sequence=sequence, label=event_id, subject_id="quote", producer="convert", consumers_json='["fulfillment"]', required_fields_json='["eventId","tenantId"]', compatibility="backward", lifecycle_status="frozen", schema_version=1, revision=1)


def test_cpq_enforces_moq_margin_approval_and_creates_only_order_intent():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            service = FactoryCpqService(db)
            with pytest.raises(ValueError, match="MOQ"):
                await service.create(project_id=1, context=context(1), actor="sales", account_reference="BUYER-1", currency="USD", exchange_rate=Decimal("1"), valid_until=datetime.now(timezone.utc) + timedelta(days=30), lines=[line(quantity="2", moq="5")])
            with pytest.raises(ValueError, match="below cost"):
                await service.create(project_id=1, context=context(1), actor="sales", account_reference="BUYER-1", currency="USD", exchange_rate=Decimal("1"), valid_until=datetime.now(timezone.utc) + timedelta(days=30), lines=[line(unit_price="60", unit_cost="70")])
            quote = await service.create(project_id=1, context=context(1), actor="sales", account_reference="BUYER-1", currency="USD", exchange_rate=Decimal("1"), valid_until=datetime.now(timezone.utc) + timedelta(days=30), lines=[line()])
            assert quote["subtotal"] == "1000.00"
            assert quote["cost_total"] == "700.00"
            assert quote["gross_margin_percent"] == "30.0000"
            quote = await service.transition(quote["id"], project_id=1, expected_revision=1, actor="sales", action="submit")
            with pytest.raises(ValueError, match="review note"):
                await service.transition(quote["id"], project_id=1, expected_revision=2, actor="manager", action="approve")
            quote = await service.transition(quote["id"], project_id=1, expected_revision=2, actor="manager", action="approve", note="毛利和交期已审核")
            with pytest.raises(ValueError, match="frozen quote-submitted"):
                await service.transition(quote["id"], project_id=1, expected_revision=3, actor="sales", action="send")
            db.add_all([frozen_event("quote-submitted", 1), frozen_event("quote-accepted", 2)])
            await db.flush()
            quote = await service.transition(quote["id"], project_id=1, expected_revision=3, actor="sales", action="send")
            quote = await service.transition(quote["id"], project_id=1, expected_revision=4, actor="buyer", action="accept")
            assert quote["status"] == "accepted"
            assert quote["order_intent_id"].startswith("order-intent-")
            assert "order_id" not in quote
            assert [event["eventType"] for event in quote["emitted_events"]] == ["quote-submitted", "quote-accepted"]
        await engine.dispose()
    asyncio.run(scenario())


def test_cpq_is_project_scoped_and_rejects_stale_revision_or_expiry():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            service = FactoryCpqService(db)
            with pytest.raises(ValueError, match="future"):
                await service.create(project_id=3, context=context(3), actor="sales", account_reference="BUYER-3", currency="USD", exchange_rate=Decimal("1"), valid_until=datetime.now(timezone.utc) - timedelta(days=1), lines=[line()])
            quote = await service.create(project_id=3, context=context(3), actor="sales", account_reference="BUYER-3", currency="USD", exchange_rate=Decimal("1"), valid_until=datetime.now(timezone.utc) + timedelta(days=30), lines=[line()])
            assert await service.list(project_id=4) == []
            with pytest.raises(KeyError, match="tenant plan"):
                await service.transition(quote["id"], project_id=4, expected_revision=1, actor="intruder", action="submit")
            with pytest.raises(ValueError, match="refresh"):
                await service.transition(quote["id"], project_id=3, expected_revision=99, actor="sales", action="submit")
        await engine.dispose()
    asyncio.run(scenario())
