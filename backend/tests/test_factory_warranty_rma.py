import asyncio
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import models  # noqa: F401
from core.database import Base
from core.tenant_context import build_tenant_context
from models.factory_customer_asset import FactoryAssetServiceTicket, FactoryCustomerAsset
from services.factory_warranty_rma import FactoryWarrantyRmaService


def context(project_id: int):
    return build_tenant_context(
        agent_path="org-1/org-2", tenant_id="tenant-1",
        client_id="client-2", plan_id=f"plan-{project_id}",
    )


def asset_and_ticket(project_id: int, *, suffix: str = "1", warranty_days: int = 60, ticket_status: str = "resolved"):
    now = datetime.now(timezone.utc)
    asset = FactoryCustomerAsset(
        id=f"asset-rma-{suffix}", project_id=project_id, agent_path="org-1/org-2",
        tenant_id="tenant-1", client_id="client-2", plan_id=f"plan-{project_id}",
        asset_number=f"ASSET-RMA-{suffix}", order_id=f"order-rma-{suffix}",
        order_number=f"SO-RMA-{suffix}", account_reference="BUYER-RMA-1",
        product_reference="PUMP-001", sku_reference="PUMP-001-380V",
        serial_number=f"SN-RMA-{suffix}", installation_location="Shanghai Plant / Line 1",
        installed_at=now - timedelta(days=30), warranty_until=now + timedelta(days=warranty_days),
        next_service_due_at=now + timedelta(days=90), status="active", service_count=2,
        emitted_events_json="[]", revision=6, updated_by="service",
    )
    ticket = FactoryAssetServiceTicket(
        id=f"ticket-rma-{suffix}", project_id=project_id, agent_path="org-1/org-2",
        tenant_id="tenant-1", client_id="client-2", plan_id=f"plan-{project_id}",
        ticket_number=f"SRV-RMA-{suffix}", asset_id=asset.id, asset_number=asset.asset_number,
        issue_summary="Bearing vibration and temperature require warranty assessment",
        severity="medium", status=ticket_status, sla_due_at=now + timedelta(hours=24),
        assigned_to="field-engineer", scheduled_for=now - timedelta(days=1),
        resolution_reference="SERVICE-REPORT-RMA", resolution_note="Onsite diagnosis recommends return inspection",
        emitted_events_json="[]", revision=4, updated_by="service",
    )
    return asset, ticket


def test_rma_requires_same_resolved_asset_ticket_and_unique_tenant_claim():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            asset, ticket = asset_and_ticket(1)
            open_asset, open_ticket = asset_and_ticket(1, suffix="open", ticket_status="open")
            db.add_all([asset, ticket, open_asset, open_ticket])
            await db.flush()
            service = FactoryWarrantyRmaService(db)
            with pytest.raises(ValueError, match="resolved service ticket"):
                await service.create_case(project_id=1, context=context(1), actor="support", asset_id=open_asset.id, service_ticket_id=open_ticket.id, claim_reference="CLAIM-OPEN", claim_summary="Return requested without resolved diagnosis", requested_remedy="repair")
            with pytest.raises(KeyError, match="tenant plan"):
                await service.create_case(project_id=2, context=context(2), actor="intruder", asset_id=asset.id, service_ticket_id=ticket.id, claim_reference="CLAIM-CROSS", claim_summary="Cross tenant return attempt must fail", requested_remedy="repair")
            item = await service.create_case(project_id=1, context=context(1), actor="support", asset_id=asset.id, service_ticket_id=ticket.id, claim_reference="CLAIM-001", claim_summary="Customer requests governed warranty return after onsite diagnosis", requested_remedy="repair")
            assert item["lifecycle_status"] == "draft"
            assert item["eligibility_status"] == "unchecked"
            with pytest.raises(ValueError, match="already has an RMA"):
                await service.create_case(project_id=1, context=context(1), actor="support", asset_id=asset.id, service_ticket_id=ticket.id, claim_reference="CLAIM-002", claim_summary="Duplicate return claim for same service ticket", requested_remedy="replace")
            assert (await service.list_workspace(project_id=2))["cases"] == []
        await engine.dispose()
    asyncio.run(scenario())


def test_expired_warranty_requires_goodwill_and_return_steps_cannot_be_skipped():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            asset, ticket = asset_and_ticket(2, warranty_days=-1)
            db.add_all([asset, ticket]); await db.flush()
            service = FactoryWarrantyRmaService(db)
            item = await service.create_case(project_id=2, context=context(2), actor="support", asset_id=asset.id, service_ticket_id=ticket.id, claim_reference="CLAIM-EXPIRED", claim_summary="Expired asset considered for goodwill repair", requested_remedy="repair")
            item = await service.submit_case(item["id"], project_id=2, expected_revision=1, actor="support", submission_reference="CLAIM-PACK-EXPIRED")
            assert item["eligibility_status"] == "expired"
            with pytest.raises(ValueError, match="goodwill"):
                await service.authorize_case(item["id"], project_id=2, expected_revision=2, actor="manager", authorization_reference="AUTH-EXPIRED", return_instructions="Return to service depot with original serial label")
            item = await service.authorize_case(item["id"], project_id=2, expected_revision=2, actor="manager", authorization_reference="AUTH-EXPIRED", goodwill_reference="GOODWILL-APPROVAL-2", return_instructions="Return to service depot with original serial label")
            assert item["lifecycle_status"] == "authorized"
            with pytest.raises(ValueError, match="return-in-transit"):
                await service.receive_return(item["id"], project_id=2, expected_revision=3, actor="warehouse", warehouse_receipt_reference="WH-RECEIPT-2", received_condition="Package sealed and serial label intact")
        await engine.dispose()
    asyncio.run(scenario())


def test_rma_full_evidence_chain_closes_without_mutating_inventory_or_finance_facts():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            asset, ticket = asset_and_ticket(3)
            db.add_all([asset, ticket]); await db.flush()
            service = FactoryWarrantyRmaService(db)
            item = await service.create_case(project_id=3, context=context(3), actor="support", asset_id=asset.id, service_ticket_id=ticket.id, claim_reference="CLAIM-FULL-3", claim_summary="Bearing defect requires controlled depot return and root-cause inspection", requested_remedy="repair")
            item = await service.submit_case(item["id"], project_id=3, expected_revision=1, actor="support", submission_reference="CLAIM-PACK-3")
            assert item["eligibility_status"] == "eligible"
            item = await service.authorize_case(item["id"], project_id=3, expected_revision=2, actor="manager", authorization_reference="AUTH-3", return_instructions="Drain equipment, secure shaft, attach RMA label and ship to depot")
            item = await service.ship_return(item["id"], project_id=3, expected_revision=3, actor="customer-service", return_shipment_reference="CARRIER-RETURN-3")
            item = await service.receive_return(item["id"], project_id=3, expected_revision=4, actor="warehouse", warehouse_receipt_reference="WH-RECEIPT-3", received_condition="Crate intact, serial matched, returned unit quarantined for inspection")
            with pytest.raises(ValueError, match="QMS evidence"):
                await service.inspect_return(item["id"], project_id=3, expected_revision=5, actor="quality", inspection_reference="RMA-INSPECTION-3", inspection_result="manufacturing-defect", inspection_note="Bearing race material defect confirmed under magnification")
            item = await service.inspect_return(item["id"], project_id=3, expected_revision=5, actor="quality", inspection_reference="RMA-INSPECTION-3", inspection_result="manufacturing-defect", inspection_note="Bearing race material defect confirmed under magnification", quality_evidence_reference="QMS-NCR-3")
            with pytest.raises(ValueError, match="cannot be rejected"):
                await service.approve_disposition(item["id"], project_id=3, expected_revision=6, actor="manager", disposition="reject", responsibility="manufacturer", disposition_approval_reference="DISP-REJECT-3", currency="USD", estimated_parts_cost="0", estimated_labor_cost="0", estimated_logistics_cost="0")
            item = await service.approve_disposition(item["id"], project_id=3, expected_revision=6, actor="manager", disposition="repair", responsibility="manufacturer", disposition_approval_reference="DISP-APPROVAL-3", currency="USD", estimated_parts_cost=Decimal("400"), estimated_labor_cost=Decimal("100"), estimated_logistics_cost=Decimal("25"))
            assert item["estimated_total_cost"] == "525.00"
            assert item["lifecycle_status"] == "disposition-approved"
            item = await service.close_case(item["id"], project_id=3, expected_revision=7, actor="service-manager", remedy_evidence_reference="REPAIR-TEST-REPORT-3", customer_acknowledgement_reference="CUSTOMER-ACK-3")
            assert item["lifecycle_status"] == "closed"
            assert item["revision"] == 8
            assert [row["evidence_type"] for row in item["evidence"]] == ["claim-submission", "authorization", "return-shipment", "warehouse-receipt", "inspection", "disposition", "remedy", "customer-acknowledgement"]
            assert asset.status == "active"
            assert asset.service_count == 2
            assert asset.revision == 6
        await engine.dispose()
    asyncio.run(scenario())
