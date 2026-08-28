import asyncio
from datetime import datetime, timedelta, timezone
from decimal import Decimal
import json

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import models  # noqa: F401
from core.database import Base
from core.tenant_context import build_tenant_context
from models.factory_fulfillment import FactoryFulfillmentOrder
from models.factory_procurement import FactoryPurchaseOrder
from models.factory_product_passport import FactoryEngineeringVersion
from services.factory_planning import FactoryPlanningService


def context(project_id: int):
    return build_tenant_context(agent_path="org-1/org-2", tenant_id="tenant-1", client_id="client-2", plan_id=f"plan-{project_id}")


def engineering(project_id: int, suffix: str):
    return FactoryEngineeringVersion(
        id=f"engineering-{suffix}", project_id=project_id, agent_path="org-1/org-2", tenant_id="tenant-1",
        client_id="client-2", plan_id=f"plan-{project_id}", engineering_number=f"ENG-{suffix}",
        product_reference="PUMP-001", sku_reference="PUMP-001-380V", product_name="Industrial Pump",
        engineering_version="EV-1.0", specification_json="{}", bom_components_json=json.dumps([
            {"material_reference": "MAT-MOTOR-001", "material_name": "IE3 Motor", "quantity": "1", "unit": "EA"},
            {"material_reference": "MAT-SEAL-001", "material_name": "Mechanical Seal", "quantity": "2", "unit": "EA"},
        ]), lifecycle_status="released", release_reference="ECR-1", revision=2,
    )


def demand_order(project_id: int, suffix: str):
    return FactoryFulfillmentOrder(
        id=f"order-{suffix}", project_id=project_id, agent_path="org-1/org-2", tenant_id="tenant-1",
        client_id="client-2", plan_id=f"plan-{project_id}", order_number=f"SO-{suffix}", quote_id=f"quote-{suffix}",
        quote_number=f"CPQ-{suffix}", order_intent_id=f"intent-{suffix}", account_reference="BUYER-1",
        currency="USD", exchange_rate=Decimal("1"), lines_json=json.dumps([{
            "product_reference": "PUMP-001", "sku_reference": "PUMP-001-380V", "quantity": "10",
        }]), order_total=Decimal("1000"), status="confirmed", authority_source="factory-oms",
        validation_json="{}", fulfillment_evidence_json="[]", emitted_events_json="[]", revision=2,
    )


def received_purchase(project_id: int, suffix: str):
    return FactoryPurchaseOrder(
        id=f"purchase-{suffix}", project_id=project_id, agent_path="org-1/org-2", tenant_id="tenant-1",
        client_id="client-2", plan_id=f"plan-{project_id}", purchase_order_number=f"PO-{suffix}",
        supplier_id=f"supplier-{suffix}", supplier_number=f"SUP-{suffix}", supplier_reference=f"VENDOR-{suffix}",
        demand_order_id=f"order-{suffix}", demand_order_number=f"SO-{suffix}",
        engineering_version_id=f"engineering-{suffix}", engineering_number=f"ENG-{suffix}",
        product_reference="PUMP-001", sku_reference="PUMP-001-380V", currency="USD",
        lines_json="[]", subtotal=Decimal("630"), needed_by=datetime.now(timezone.utc) + timedelta(days=20),
        lifecycle_status="received", receiving_reference=f"GRN-{suffix}",
        received_quantities_json=json.dumps([
            {"material_reference": "MAT-MOTOR-001", "received_quantity": "10"},
            {"material_reference": "MAT-SEAL-001", "received_quantity": "20"},
        ]), milestones_json="[]", revision=6,
    )


async def approved_resource(service: FactoryPlanningService, project_id: int, suffix: str):
    item = await service.create_resource(
        project_id=project_id, context=context(project_id), actor="planner",
        resource_reference=f"LINE-{suffix}", resource_name="Pump Assembly Line",
        daily_capacity=Decimal("5"), shift_hours=Decimal("8"), efficiency_percent=Decimal("80"),
        calendar_evidence_reference=f"CALENDAR-{suffix}",
    )
    return await service.approve_resource(
        item["id"], project_id=project_id, expected_revision=item["revision"], actor="operations-manager",
        approval_reference=f"CAPACITY-APPROVAL-{suffix}", approval_note="Shift calendar and demonstrated capacity were reviewed",
    )


def test_capacity_resource_requires_approval_and_optimistic_revision():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            service = FactoryPlanningService(db)
            resource = await approved_resource(service, 1, "1")
            assert resource["lifecycle_status"] == "approved"
            assert Decimal(resource["daily_capacity"]) == Decimal("5")
            with pytest.raises(ValueError, match="changed"):
                await service.approve_resource(resource["id"], project_id=1, expected_revision=1, actor="manager", approval_reference="X", approval_note="Repeated approval is not valid")
            assert (await service.list_workspace(project_id=2))["resources"] == []
        await engine.dispose()
    asyncio.run(scenario())


def test_ready_materials_and_finite_capacity_release_work_order_intent():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            db.add_all([engineering(2, "2"), demand_order(2, "2"), received_purchase(2, "2")])
            await db.flush()
            service = FactoryPlanningService(db)
            resource = await approved_resource(service, 2, "2")
            item = await service.create_plan(project_id=2, context=context(2), actor="planner", demand_order_id="order-2", engineering_version_id="engineering-2", resource_id=resource["id"], due_at=datetime.now(timezone.utc) + timedelta(days=30))
            assert item["material_readiness_status"] == "ready"
            assert item["schedule_status"] == "on-time"
            assert item["capacity_days"] == 3
            assert item["shortages"] == []
            for action, kwargs in [
                ("submit", {"note": "Demand, material and finite capacity assumptions reviewed"}),
                ("approve", {"note": "Sales and operations review approved this schedule", "approval_reference": "PLAN-APPROVAL-2"}),
                ("release", {"release_reference": "PLAN-RELEASE-2"}),
            ]:
                item = await service.transition_plan(item["id"], project_id=2, expected_revision=item["revision"], actor="planner", action=action, **kwargs)
            assert item["lifecycle_status"] == "released"
            assert item["work_order_intent_reference"].startswith("WOI-PLAN-")
            assert [row["action"] for row in item["milestones"]] == ["submit", "approve", "release"]
        await engine.dispose()
    asyncio.run(scenario())


def test_shortage_blocks_release_until_receipt_and_recalculation_reset_approval():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            db.add_all([engineering(3, "3"), demand_order(3, "3")])
            await db.flush()
            service = FactoryPlanningService(db)
            resource = await approved_resource(service, 3, "3")
            item = await service.create_plan(project_id=3, context=context(3), actor="planner", demand_order_id="order-3", engineering_version_id="engineering-3", resource_id=resource["id"], due_at=datetime.now(timezone.utc) + timedelta(days=30))
            assert item["material_readiness_status"] == "shortage"
            item = await service.transition_plan(item["id"], project_id=3, expected_revision=item["revision"], actor="planner", action="submit", note="Shortage risk is explicit for review")
            item = await service.transition_plan(item["id"], project_id=3, expected_revision=item["revision"], actor="manager", action="approve", note="Conditional approval pending material receipt", approval_reference="PLAN-APPROVAL-3")
            with pytest.raises(ValueError, match="shortages are cleared"):
                await service.transition_plan(item["id"], project_id=3, expected_revision=item["revision"], actor="manager", action="release", release_reference="PLAN-RELEASE-3")
            db.add(received_purchase(3, "3"))
            await db.flush()
            item = await service.recalculate_plan(item["id"], project_id=3, expected_revision=item["revision"], actor="planner")
            assert item["material_readiness_status"] == "ready"
            assert item["lifecycle_status"] == "draft"
            assert item["approval_reference"] is None
        await engine.dispose()
    asyncio.run(scenario())
