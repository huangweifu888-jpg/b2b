import asyncio
from datetime import datetime, timedelta, timezone
from decimal import Decimal
import json

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import models  # noqa: F401
from core.database import Base
from core.tenant_context import build_tenant_context
from models.factory_contract import FactoryCoreEventContract
from models.factory_fulfillment import FactoryFulfillmentOrder
from services.factory_customer_asset import FactoryCustomerAssetService


def context(project_id: int):
    return build_tenant_context(agent_path="org-1/org-2", tenant_id="tenant-1", client_id="client-2", plan_id=f"plan-{project_id}")


def delivered_order(project_id: int, suffix: str = "1", quantity: str = "1"):
    return FactoryFulfillmentOrder(
        id=f"order-{suffix}", project_id=project_id, agent_path="org-1/org-2", tenant_id="tenant-1", client_id="client-2", plan_id=f"plan-{project_id}",
        order_number=f"SO-{suffix}", quote_id=f"quote-{suffix}", quote_number=f"CPQ-{suffix}", order_intent_id=f"intent-{suffix}", account_reference="BUYER-1",
        currency="USD", exchange_rate=Decimal("1"), lines_json=json.dumps([{"product_reference": "PUMP-001", "sku_reference": "PUMP-001-380V", "quantity": quantity, "unit_price": "100"}]),
        order_total=Decimal("100"), status="delivered", authority_source="factory-oms", validation_json="{}", fulfillment_evidence_json="[]", emitted_events_json="[]", revision=8,
    )


def frozen_event(event_id: str, sequence: int):
    subject = "service-ticket" if event_id == "service-resolved" else "customer-asset"
    return FactoryCoreEventContract(id=event_id, sequence=sequence, label=event_id, subject_id=subject, producer="care", consumers_json='["decision"]', required_fields_json='["eventId","tenantId"]', compatibility="backward", lifecycle_status="frozen", schema_version=1, revision=1)


def asset_payload(order_id: str):
    now = datetime.now(timezone.utc)
    return dict(order_id=order_id, product_reference="PUMP-001", sku_reference="PUMP-001-380V", serial_number="SN-PUMP-001", installation_location="Shanghai Plant / Line 1", installed_at=now - timedelta(days=2), warranty_until=now + timedelta(days=60), next_service_due_at=now + timedelta(days=30))


def test_customer_asset_requires_delivered_order_line_and_frozen_event():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            service = FactoryCustomerAssetService(db)
            with pytest.raises(ValueError, match="delivered authoritative order"):
                await service.register_asset(project_id=1, context=context(1), actor="service", **asset_payload("missing"))
            order = delivered_order(1)
            db.add(order)
            await db.flush()
            with pytest.raises(ValueError, match="frozen customer-asset-created"):
                await service.register_asset(project_id=1, context=context(1), actor="service", **asset_payload(order.id))
            db.add(frozen_event("customer-asset-created", 1))
            await db.flush()
            asset = await service.register_asset(project_id=1, context=context(1), actor="service", **asset_payload(order.id))
            assert asset["order_id"] == order.id
            assert asset["serial_number"] == "SN-PUMP-001"
            assert asset["emitted_events"][0]["eventType"] == "customer-asset-created"
            another = asset_payload(order.id)
            another["serial_number"] = "SN-PUMP-002"
            with pytest.raises(ValueError, match="cannot exceed"):
                await service.register_asset(project_id=1, context=context(1), actor="service", **another)
            assert (await service.list_workspace(project_id=2))["assets"] == []
        await engine.dispose()
    asyncio.run(scenario())


def test_service_ticket_and_warranty_action_preserve_ordered_evidence():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            order = delivered_order(3, "3", quantity="2")
            db.add_all([order, frozen_event("customer-asset-created", 1), frozen_event("service-resolved", 2), frozen_event("warranty-expiring", 3)])
            await db.flush()
            service = FactoryCustomerAssetService(db)
            asset = await service.register_asset(project_id=3, context=context(3), actor="service", **asset_payload(order.id))
            workspace = await service.create_ticket(asset["id"], project_id=3, context=context(3), actor="service", issue_summary="Pump vibration requires inspection", severity="high")
            ticket = workspace["ticket"]
            assert workspace["asset"]["status"] == "service-open"
            with pytest.raises(ValueError, match="must advance"):
                await service.transition_ticket(ticket["id"], project_id=3, expected_revision=1, actor="engineer", action="start")
            workspace = await service.transition_ticket(ticket["id"], project_id=3, expected_revision=1, actor="dispatcher", action="schedule", assigned_to="engineer-1", scheduled_for=datetime.now(timezone.utc) + timedelta(days=1))
            workspace = await service.transition_ticket(ticket["id"], project_id=3, expected_revision=2, actor="engineer-1", action="start")
            workspace = await service.transition_ticket(ticket["id"], project_id=3, expected_revision=3, actor="engineer-1", action="resolve", resolution_reference="SERVICE-REPORT-001", resolution_note="Bearing alignment corrected and vibration retested", next_service_due_at=datetime.now(timezone.utc) + timedelta(days=90))
            assert workspace["ticket"]["status"] == "resolved"
            assert workspace["ticket"]["emitted_events"][0]["eventType"] == "service-resolved"
            assert workspace["asset"]["status"] == "active"
            assert workspace["asset"]["service_count"] == 1
            asset = await service.flag_warranty(asset["id"], project_id=3, expected_revision=3, actor="renewal", renewal_owner="account-manager-1", renewal_action="Prepare maintenance renewal quote")
            assert asset["renewal_status"] == "action-required"
            assert [event["eventType"] for event in asset["emitted_events"]] == ["customer-asset-created", "warranty-expiring"]
            with pytest.raises(ValueError, match="already exists"):
                await service.flag_warranty(asset["id"], project_id=3, expected_revision=4, actor="renewal", renewal_owner="account-manager-1", renewal_action="Duplicate")
        await engine.dispose()
    asyncio.run(scenario())


def test_customer_assets_and_tickets_are_project_scoped_and_revision_guarded():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            order = delivered_order(5, "5")
            db.add_all([order, frozen_event("customer-asset-created", 1)])
            await db.flush()
            service = FactoryCustomerAssetService(db)
            asset = await service.register_asset(project_id=5, context=context(5), actor="service", **asset_payload(order.id))
            with pytest.raises(KeyError, match="tenant plan"):
                await service.create_ticket(asset["id"], project_id=6, context=context(6), actor="intruder", issue_summary="Cross tenant attempt", severity="low")
            with pytest.raises(ValueError, match="refresh"):
                await service.flag_warranty(asset["id"], project_id=5, expected_revision=99, actor="renewal", renewal_owner="owner", renewal_action="Review warranty")
        await engine.dispose()
    asyncio.run(scenario())
