import asyncio
import json
from decimal import Decimal

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import models  # noqa: F401
from core.database import Base
from core.tenant_context import build_tenant_context
from models.factory_contract import FactoryCoreEventContract
from services.factory_revenue import EVENT_PRODUCERS, FactoryRevenueService


def _frozen_event(event_id: str, sequence: int) -> FactoryCoreEventContract:
    return FactoryCoreEventContract(
        id=event_id,
        sequence=sequence,
        label=event_id,
        subject_id="order",
        producer=EVENT_PRODUCERS[event_id],
        consumers_json=json.dumps(["decision"]),
        required_fields_json="[]",
        lifecycle_status="frozen",
    )


def test_revenue_flow_enforces_order_reconciliation_and_tenant_scope():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            db.add_all([_frozen_event(event_id, index) for index, event_id in enumerate(EVENT_PRODUCERS, start=1)])
            await db.flush()
            service = FactoryRevenueService(db)
            run = await service.create(
                project_id=7,
                context=build_tenant_context(agent_path="org-1/org-2", tenant_id="tenant-1", client_id="client-2", plan_id="plan-7"),
                actor="sales-owner",
                product_reference="MACHINE-001",
                account_reference="BUYER-001",
                currency="USD",
            )
            with pytest.raises(ValueError, match="expected inquiry-created"):
                await service.transition(run["id"], project_id=7, expected_revision=1, actor="sales-owner", event_type="quote-submitted", amount=Decimal("1000"))
            with pytest.raises(KeyError, match="tenant plan"):
                await service.transition(run["id"], project_id=8, expected_revision=1, actor="intruder", event_type="inquiry-created", amount=None)

            for event_type, amount in (
                ("inquiry-created", None),
                ("quote-submitted", Decimal("1000")),
                ("quote-accepted", None),
                ("order-confirmed", Decimal("950")),
                ("invoice-issued", Decimal("950")),
            ):
                run = await service.transition(run["id"], project_id=7, expected_revision=run["revision"], actor="sales-owner", event_type=event_type, amount=amount)
            with pytest.raises(ValueError, match="reconcile exactly"):
                await service.transition(run["id"], project_id=7, expected_revision=run["revision"], actor="sales-owner", event_type="payment-received", amount=Decimal("900"))
            run = await service.transition(run["id"], project_id=7, expected_revision=run["revision"], actor="finance-owner", event_type="payment-received", amount=Decimal("950"))
            assert run["current_stage"] == "payment-received"
            assert run["paid_amount"] == "950"
            assert len(run["emitted_events"]) == 6
            assert {event["tenantId"] for event in run["emitted_events"]} == {"tenant-1"}
            assert len({event["correlationId"] for event in run["emitted_events"]}) == 1
        await engine.dispose()

    asyncio.run(scenario())
