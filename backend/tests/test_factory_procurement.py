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
from models.factory_product_passport import FactoryEngineeringVersion
from services.factory_procurement import FactoryProcurementService


def context(project_id: int):
    return build_tenant_context(agent_path="org-1/org-2", tenant_id="tenant-1", client_id="client-2", plan_id=f"plan-{project_id}")


def engineering(project_id: int, suffix: str = "1"):
    return FactoryEngineeringVersion(
        id=f"engineering-{suffix}", project_id=project_id, agent_path="org-1/org-2", tenant_id="tenant-1",
        client_id="client-2", plan_id=f"plan-{project_id}", engineering_number=f"ENG-{suffix}",
        product_reference="PUMP-001", sku_reference="PUMP-001-380V", product_name="Industrial Pump",
        engineering_version="EV-1.0", specification_json="{}", bom_components_json=json.dumps([
            {"material_reference": "MAT-MOTOR-001", "material_name": "IE3 Motor", "supplier_reference": "SOURCE-MOTOR", "quantity": "1", "unit": "EA", "origin_country": "CN"},
            {"material_reference": "MAT-SEAL-001", "material_name": "Mechanical Seal", "supplier_reference": "SOURCE-SEAL", "quantity": "2", "unit": "EA", "origin_country": "DE"},
        ]), lifecycle_status="released", release_reference="ECR-1", revision=2,
    )


def demand_order(project_id: int, suffix: str = "1"):
    return FactoryFulfillmentOrder(
        id=f"order-{suffix}", project_id=project_id, agent_path="org-1/org-2", tenant_id="tenant-1",
        client_id="client-2", plan_id=f"plan-{project_id}", order_number=f"SO-{suffix}", quote_id=f"quote-{suffix}",
        quote_number=f"CPQ-{suffix}", order_intent_id=f"intent-{suffix}", account_reference="BUYER-1",
        currency="USD", exchange_rate=Decimal("1"), lines_json=json.dumps([{
            "product_reference": "PUMP-001", "sku_reference": "PUMP-001-380V", "quantity": "10",
        }]), order_total=Decimal("1000"), status="confirmed", authority_source="factory-oms",
        validation_json="{}", fulfillment_evidence_json="[]", emitted_events_json="[]", revision=2,
    )


async def approved_supplier(service: FactoryProcurementService, project_id: int, suffix: str = "1", materials=None):
    item = await service.create_supplier(
        project_id=project_id, context=context(project_id), actor="buyer", supplier_reference=f"VENDOR-{suffix}",
        legal_name="Precision Components Ltd", country_code="CN", currency="USD", standard_lead_time_days=30,
        qualified_materials=materials or ["MAT-MOTOR-001", "MAT-SEAL-001"],
        qualification_evidence_reference=f"QUAL-{suffix}", risk_level="low",
    )
    return await service.approve_supplier(
        item["id"], project_id=project_id, expected_revision=item["revision"], actor="procurement-manager",
        approval_reference=f"SUP-APPROVAL-{suffix}", approval_note="Qualification evidence reviewed and approved",
    )


def test_supplier_qualification_is_tenant_scoped_and_revision_guarded():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            service = FactoryProcurementService(db)
            supplier = await approved_supplier(service, 1)
            assert supplier["lifecycle_status"] == "approved"
            assert supplier["qualified_materials"] == ["MAT-MOTOR-001", "MAT-SEAL-001"]
            with pytest.raises(ValueError, match="already exists"):
                await service.create_supplier(project_id=2, context=context(2), actor="buyer", supplier_reference="VENDOR-1", legal_name="Duplicate", country_code="CN", currency="USD", standard_lead_time_days=10, qualified_materials=["MAT-MOTOR-001"], qualification_evidence_reference="QUAL-X", risk_level="medium")
            with pytest.raises(ValueError, match="changed"):
                await service.approve_supplier(supplier["id"], project_id=1, expected_revision=1, actor="manager", approval_reference="X", approval_note="Repeated approval is invalid")
            assert (await service.list_workspace(project_id=2))["suppliers"] == []
        await engine.dispose()
    asyncio.run(scenario())


def test_purchase_order_requires_released_bom_and_approved_material_scope():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            db.add_all([engineering(2, "2"), demand_order(2, "2")])
            await db.flush()
            service = FactoryProcurementService(db)
            supplier = await approved_supplier(service, 2, "partial", ["MAT-MOTOR-001"])
            with pytest.raises(ValueError, match="cover every engineering BOM material"):
                await service.create_purchase_order(project_id=2, context=context(2), actor="buyer", supplier_id=supplier["id"], demand_order_id="order-2", engineering_version_id="engineering-2", needed_by=datetime.now(timezone.utc) + timedelta(days=60), unit_prices=[{"material_reference": "MAT-MOTOR-001", "unit_price": "55"}, {"material_reference": "MAT-SEAL-001", "unit_price": "8"}])
        await engine.dispose()
    asyncio.run(scenario())


def test_purchase_order_approval_acknowledgement_and_receipt_are_distinct_facts():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            db.add_all([engineering(3, "3"), demand_order(3, "3")])
            await db.flush()
            service = FactoryProcurementService(db)
            supplier = await approved_supplier(service, 3, "3")
            item = await service.create_purchase_order(project_id=3, context=context(3), actor="buyer", supplier_id=supplier["id"], demand_order_id="order-3", engineering_version_id="engineering-3", needed_by=datetime.now(timezone.utc) + timedelta(days=60), unit_prices=[{"material_reference": "MAT-MOTOR-001", "unit_price": "55"}, {"material_reference": "MAT-SEAL-001", "unit_price": "8"}])
            assert item["subtotal"] == "710.00"
            for action, kwargs in [
                ("submit", {"note": "Materials required for confirmed customer demand"}),
                ("approve", {"note": "Budget and supplier scope are approved", "approval_reference": "PO-APPROVAL-3"}),
                ("issue", {"issue_document_reference": "SIGNED-PO-3"}),
                ("acknowledge", {"acknowledgement_reference": "SUPPLIER-ACK-3", "promised_delivery_at": datetime.now(timezone.utc) + timedelta(days=30)}),
            ]:
                item = await service.transition_purchase_order(item["id"], project_id=3, expected_revision=item["revision"], actor="operator", action=action, **kwargs)
            assert item["lifecycle_status"] == "acknowledged"
            assert item["receiving_reference"] is None
            with pytest.raises(ValueError, match="exact ordered quantities"):
                await service.transition_purchase_order(item["id"], project_id=3, expected_revision=item["revision"], actor="warehouse", action="receive", receiving_reference="GRN-3", received_quantities=[{"material_reference": "MAT-MOTOR-001", "received_quantity": "9"}, {"material_reference": "MAT-SEAL-001", "received_quantity": "20"}])
            item = await service.transition_purchase_order(item["id"], project_id=3, expected_revision=item["revision"], actor="warehouse", action="receive", receiving_reference="GRN-3", received_quantities=[{"material_reference": "MAT-MOTOR-001", "received_quantity": "10"}, {"material_reference": "MAT-SEAL-001", "received_quantity": "20"}])
            assert item["lifecycle_status"] == "received"
            assert item["receiving_reference"] == "GRN-3"
            assert [milestone["action"] for milestone in item["milestones"]] == ["submit", "approve", "issue", "acknowledge", "receive"]
        await engine.dispose()
    asyncio.run(scenario())
