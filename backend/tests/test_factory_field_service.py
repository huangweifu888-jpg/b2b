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
from services.factory_field_service import FactoryFieldService


def context(project_id: int):
    return build_tenant_context(agent_path="org-1/org-2", tenant_id="tenant-1", client_id="client-2", plan_id=f"plan-{project_id}")


def delivered_order(project_id: int):
    return FactoryFulfillmentOrder(
        id=f"order-field-{project_id}", project_id=project_id, agent_path="org-1/org-2",
        tenant_id="tenant-1", client_id="client-2", plan_id=f"plan-{project_id}",
        order_number=f"SO-FIELD-{project_id}", quote_id=f"quote-field-{project_id}",
        quote_number=f"CPQ-FIELD-{project_id}", order_intent_id=f"intent-field-{project_id}",
        account_reference="BUYER-FIELD-1", currency="USD", exchange_rate=Decimal("1"),
        lines_json=json.dumps([{"product_reference": "PUMP-001", "sku_reference": "PUMP-001-380V", "quantity": "1", "unit_price": "100"}]),
        order_total=Decimal("100"), status="delivered", authority_source="factory-oms",
        validation_json="{}", fulfillment_evidence_json="[]", emitted_events_json="[]", revision=8,
    )


def frozen_event(event_id: str, sequence: int):
    subject = "service-ticket" if event_id == "service-resolved" else "customer-asset"
    return FactoryCoreEventContract(
        id=event_id, sequence=sequence, label=event_id, subject_id=subject, producer="care",
        consumers_json='["decision"]', required_fields_json='["eventId","tenantId"]',
        compatibility="backward", lifecycle_status="frozen", schema_version=1, revision=1,
    )


async def seeded_asset(db, project_id: int):
    order = delivered_order(project_id)
    db.add_all([order, frozen_event("customer-asset-created", project_id * 10), frozen_event("service-resolved", project_id * 10 + 1)])
    await db.flush()
    now = datetime.now(timezone.utc)
    return await FactoryCustomerAssetService(db).register_asset(
        project_id=project_id, context=context(project_id), actor="asset-admin", order_id=order.id,
        product_reference="PUMP-001", sku_reference="PUMP-001-380V",
        serial_number=f"SN-FIELD-{project_id}", installation_location="Shanghai Plant / Line 1",
        installed_at=now - timedelta(days=2), warranty_until=now + timedelta(days=60),
        next_service_due_at=now + timedelta(days=30),
    )


async def approved_technician(service: FactoryFieldService, project_id: int):
    item = await service.create_technician(
        project_id=project_id, context=context(project_id), actor="service-manager",
        technician_reference=f"TECH-REF-{project_id}", technician_name="East China Pump Engineer",
        skills=["pump-mechanical", "electrical-diagnostics"], service_regions=["east-china"],
    )
    return await service.approve_technician(
        item["id"], project_id=project_id, expected_revision=1, actor="service-manager",
        approval_reference=f"TECH-APPROVAL-{project_id}",
    )


def test_field_technician_requires_approval_and_tenant_revision_boundary():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            service = FactoryFieldService(db)
            technician = await service.create_technician(
                project_id=1, context=context(1), actor="manager", technician_reference="TECH-REF-1",
                technician_name="Pump Engineer", skills=["pump"], service_regions=["east-china"],
            )
            assert technician["lifecycle_status"] == "draft"
            with pytest.raises(ValueError, match="refresh"):
                await service.approve_technician(technician["id"], project_id=1, expected_revision=99, actor="manager", approval_reference="APPROVED-1")
            approved = await service.approve_technician(technician["id"], project_id=1, expected_revision=1, actor="manager", approval_reference="APPROVED-1")
            assert approved["lifecycle_status"] == "approved"
            assert approved["revision"] == 2
            with pytest.raises(KeyError, match="tenant plan"):
                await service.approve_technician(technician["id"], project_id=2, expected_revision=2, actor="intruder", approval_reference="NO")
        await engine.dispose()
    asyncio.run(scenario())


def test_field_dispatch_enforces_approved_skill_and_ordered_onsite_milestones():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            asset = await seeded_asset(db, 2)
            service = FactoryFieldService(db)
            ticket = (await service.create_ticket(asset["id"], project_id=2, context=context(2), actor="support", issue_summary="Pump vibration requires onsite diagnosis", severity="high"))["ticket"]
            draft = await service.create_technician(project_id=2, context=context(2), actor="manager", technician_reference="DRAFT-2", technician_name="Draft Engineer", skills=["pump"], service_regions=["east-china"])
            with pytest.raises(ValueError, match="approved technician"):
                await service.dispatch(ticket["id"], project_id=2, context=context(2), actor="dispatcher", technician_id=draft["id"], scheduled_for=datetime.now(timezone.utc) + timedelta(hours=1))
            technician = await approved_technician(service, 2)
            result = await service.dispatch(ticket["id"], project_id=2, context=context(2), actor="dispatcher", technician_id=technician["id"], scheduled_for=datetime.now(timezone.utc) + timedelta(hours=1))
            visit = result["visit"]
            assert visit["lifecycle_status"] == "dispatched"
            assert result["ticket"]["status"] == "scheduled"
            with pytest.raises(ValueError, match="advance"):
                await service.transition_visit(visit["id"], project_id=2, expected_revision=1, actor="engineer", action="arrive", evidence_reference="GPS-ARRIVE", arrival_location="Shanghai Plant")
            visit = (await service.transition_visit(visit["id"], project_id=2, expected_revision=1, actor="engineer", action="depart", evidence_reference="TRAVEL-ORDER-2"))["visit"]
            visit = (await service.transition_visit(visit["id"], project_id=2, expected_revision=2, actor="engineer", action="arrive", evidence_reference="GPS-ARRIVE-2", arrival_location="Shanghai Plant / Line 1"))["visit"]
            result = await service.transition_visit(visit["id"], project_id=2, expected_revision=3, actor="engineer", action="start", evidence_reference="CUSTOMER-CHECKIN-2")
            assert result["visit"]["lifecycle_status"] == "in-progress"
            assert result["ticket"]["status"] == "in-progress"
            assert [row["action"] for row in result["visit"]["milestones"]] == ["dispatch", "depart", "arrive", "start"]
            with pytest.raises(ValueError, match="open service ticket"):
                await service.dispatch(ticket["id"], project_id=2, context=context(2), actor="dispatcher", technician_id=technician["id"], scheduled_for=datetime.now(timezone.utc) + timedelta(hours=1))
        await engine.dispose()
    asyncio.run(scenario())


def test_field_work_evidence_customer_signoff_and_sla_complete_the_base_ticket():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            asset = await seeded_asset(db, 3)
            service = FactoryFieldService(db)
            ticket = (await service.create_ticket(asset["id"], project_id=3, context=context(3), actor="support", issue_summary="Bearing temperature and vibration exceed threshold", severity="medium"))["ticket"]
            technician = await approved_technician(service, 3)
            visit = (await service.dispatch(ticket["id"], project_id=3, context=context(3), actor="dispatcher", technician_id=technician["id"], scheduled_for=datetime.now(timezone.utc) + timedelta(hours=1)))["visit"]
            visit = (await service.transition_visit(visit["id"], project_id=3, expected_revision=1, actor="engineer", action="depart", evidence_reference="TRAVEL-3"))["visit"]
            visit = (await service.transition_visit(visit["id"], project_id=3, expected_revision=2, actor="engineer", action="arrive", evidence_reference="GPS-3", arrival_location="Shanghai Plant / Line 1"))["visit"]
            visit = (await service.transition_visit(visit["id"], project_id=3, expected_revision=3, actor="engineer", action="start", evidence_reference="CHECKIN-3"))["visit"]
            with pytest.raises(ValueError, match="diagnostic and labor"):
                await service.complete_visit(visit["id"], project_id=3, expected_revision=4, actor="engineer", resolution_reference="REPORT-3", resolution_note="Bearing replaced and retested", customer_signer="Customer QA", customer_signoff_reference="SIGN-3", next_service_due_at=datetime.now(timezone.utc) + timedelta(days=90))
            visit = (await service.add_entry(visit["id"], project_id=3, context=context(3), actor="engineer", entry_type="diagnostic", description="Measured bearing temperature and vibration above service threshold", evidence_reference="DIAG-3"))["visit"]
            visit = (await service.add_entry(visit["id"], project_id=3, context=context(3), actor="engineer", entry_type="labor", description="Removed bearing assembly, aligned shaft and completed load test", evidence_reference="LABOR-3", labor_minutes=90))["visit"]
            with pytest.raises(ValueError, match="stock evidence"):
                await service.add_entry(visit["id"], project_id=3, context=context(3), actor="engineer", entry_type="part", description="Replacement bearing kit issued for onsite repair", evidence_reference="PART-3", part_reference="BEARING-KIT-001", quantity=Decimal("1"), unit="EA")
            visit = (await service.add_entry(visit["id"], project_id=3, context=context(3), actor="engineer", entry_type="part", description="Replacement bearing kit installed and serial evidence attached", evidence_reference="PART-3", part_reference="BEARING-KIT-001", quantity=Decimal("1"), unit="EA", stock_evidence_reference="STOCK-ISSUE-3"))["visit"]
            result = await service.complete_visit(visit["id"], project_id=3, expected_revision=7, actor="engineer", resolution_reference="SERVICE-REPORT-3", resolution_note="Bearing replaced, shaft aligned and load test passed", customer_signer="Customer QA Manager", customer_signoff_reference="CUSTOMER-SIGN-3", next_service_due_at=datetime.now(timezone.utc) + timedelta(days=90))
            assert result["visit"]["lifecycle_status"] == "completed"
            assert result["visit"]["sla_status"] == "met"
            assert result["visit"]["total_labor_minutes"] == 90
            assert result["visit"]["parts_summary"][0]["stock_evidence_reference"] == "STOCK-ISSUE-3"
            assert result["ticket"]["status"] == "resolved"
            assert result["ticket"]["emitted_events"][0]["eventType"] == "service-resolved"
            assert result["asset"]["status"] == "active"
            assert result["asset"]["service_count"] == 1
        await engine.dispose()
    asyncio.run(scenario())
