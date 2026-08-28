"""Installed-base, service and renewal workflow for factory customer value."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
import json
import secrets

from core.tenant_context import TenantContext
from models.factory_contract import FactoryCoreEventContract
from models.factory_customer_asset import FactoryAssetServiceTicket, FactoryCustomerAsset
from models.factory_fulfillment import FactoryFulfillmentOrder
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession


TICKET_TRANSITIONS = {
    "schedule": ("open", "scheduled"),
    "start": ("scheduled", "in-progress"),
    "resolve": ("in-progress", "resolved"),
}
SLA_HOURS = {"critical": 4, "high": 8, "medium": 24, "low": 72}


def _utc(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def _json(value: str | None, fallback):
    try:
        parsed = json.loads(value or "")
    except (TypeError, ValueError):
        return fallback
    return parsed if isinstance(parsed, type(fallback)) else fallback


def _event(contract: FactoryCoreEventContract, *, tenant_id: str, event_type: str, subject_id: str, correlation_id: str, extra: dict[str, object]) -> dict[str, object]:
    return {
        "eventId": f"evt-{secrets.token_urlsafe(18)}",
        "tenantId": tenant_id,
        "eventType": event_type,
        "occurredAt": datetime.now(timezone.utc).isoformat(),
        "source": "care",
        "subjectId": subject_id,
        "version": contract.schema_version,
        "correlationId": correlation_id,
        **extra,
    }


def serialize_asset(item: FactoryCustomerAsset) -> dict[str, object]:
    return {
        "id": item.id, "project_id": item.project_id, "tenant_id": item.tenant_id, "client_id": item.client_id, "plan_id": item.plan_id,
        "asset_number": item.asset_number, "order_id": item.order_id, "order_number": item.order_number, "account_reference": item.account_reference,
        "product_reference": item.product_reference, "sku_reference": item.sku_reference, "serial_number": item.serial_number,
        "installation_location": item.installation_location, "installed_at": item.installed_at, "warranty_until": item.warranty_until,
        "next_service_due_at": item.next_service_due_at, "status": item.status, "renewal_status": item.renewal_status,
        "renewal_owner": item.renewal_owner, "renewal_action": item.renewal_action, "service_count": item.service_count,
        "last_service_at": item.last_service_at, "emitted_events": _json(item.emitted_events_json, []), "revision": item.revision,
        "updated_by": item.updated_by, "created_at": item.created_at, "updated_at": item.updated_at,
    }


def serialize_ticket(item: FactoryAssetServiceTicket) -> dict[str, object]:
    return {
        "id": item.id, "project_id": item.project_id, "tenant_id": item.tenant_id, "client_id": item.client_id, "plan_id": item.plan_id,
        "ticket_number": item.ticket_number, "asset_id": item.asset_id, "asset_number": item.asset_number,
        "issue_summary": item.issue_summary, "severity": item.severity, "status": item.status, "sla_due_at": item.sla_due_at,
        "assigned_to": item.assigned_to, "scheduled_for": item.scheduled_for, "resolution_reference": item.resolution_reference,
        "resolution_note": item.resolution_note, "emitted_events": _json(item.emitted_events_json, []), "revision": item.revision,
        "updated_by": item.updated_by, "created_at": item.created_at, "updated_at": item.updated_at,
    }


class FactoryCustomerAssetService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_workspace(self, *, project_id: int) -> dict[str, object]:
        assets = (await self.db.execute(select(FactoryCustomerAsset).where(FactoryCustomerAsset.project_id == project_id).order_by(FactoryCustomerAsset.created_at.desc()))).scalars().all()
        tickets = (await self.db.execute(select(FactoryAssetServiceTicket).where(FactoryAssetServiceTicket.project_id == project_id).order_by(FactoryAssetServiceTicket.created_at.desc()))).scalars().all()
        orders = (await self.db.execute(select(FactoryFulfillmentOrder).where(FactoryFulfillmentOrder.project_id == project_id, FactoryFulfillmentOrder.status == "delivered").order_by(FactoryFulfillmentOrder.created_at.desc()))).scalars().all()
        return {
            "assets": [serialize_asset(item) for item in assets],
            "tickets": [serialize_ticket(item) for item in tickets],
            "eligible_orders": [{"id": item.id, "order_number": item.order_number, "account_reference": item.account_reference, "lines": _json(item.lines_json, [])} for item in orders],
        }

    async def register_asset(self, *, project_id: int, context: TenantContext, actor: str, order_id: str, product_reference: str, sku_reference: str, serial_number: str, installation_location: str, installed_at: datetime, warranty_until: datetime, next_service_due_at: datetime) -> dict[str, object]:
        order = await self.db.scalar(select(FactoryFulfillmentOrder).where(FactoryFulfillmentOrder.id == order_id.strip(), FactoryFulfillmentOrder.project_id == project_id, FactoryFulfillmentOrder.status == "delivered"))
        if not order:
            raise ValueError("Customer assets require a delivered authoritative order in this tenant plan")
        product = product_reference.strip()
        sku = sku_reference.strip()
        lines = _json(order.lines_json, [])
        line = next((item for item in lines if str(item.get("product_reference", "")).strip() == product and str(item.get("sku_reference", "")).strip() == sku), None)
        if not line:
            raise ValueError("Product and SKU must match a delivered order line")
        try:
            ordered_quantity = Decimal(str(line.get("quantity", "0")))
        except (InvalidOperation, TypeError):
            ordered_quantity = Decimal(0)
        registered_count = await self.db.scalar(select(func.count()).select_from(FactoryCustomerAsset).where(FactoryCustomerAsset.order_id == order.id, FactoryCustomerAsset.product_reference == product, FactoryCustomerAsset.sku_reference == sku))
        if Decimal(registered_count or 0) >= ordered_quantity:
            raise ValueError("Registered serial assets cannot exceed the delivered order quantity")
        serial = serial_number.strip()
        location = installation_location.strip()
        if not serial or not location:
            raise ValueError("Serial number and installation location are required")
        duplicate = await self.db.scalar(select(FactoryCustomerAsset.id).where(FactoryCustomerAsset.tenant_id == context.tenant_id, FactoryCustomerAsset.serial_number == serial))
        if duplicate:
            raise ValueError("Serial number already exists in this tenant")
        installed = _utc(installed_at)
        warranty = _utc(warranty_until)
        service_due = _utc(next_service_due_at)
        now = datetime.now(timezone.utc)
        if installed > now + timedelta(days=1):
            raise ValueError("Installation time cannot be in the future")
        if warranty <= installed or service_due <= installed:
            raise ValueError("Warranty and next service dates must follow installation")
        contract = await self._contract("customer-asset-created")
        created = datetime.now(timezone.utc)
        item = FactoryCustomerAsset(
            id=f"asset-{secrets.token_urlsafe(18)}", project_id=project_id, agent_path=context.agent_path, tenant_id=context.tenant_id,
            client_id=context.client_id, plan_id=context.plan_id or f"plan-{project_id}", asset_number=f"ASSET-{project_id}-{created.strftime('%Y%m%d%H%M%S')}-{secrets.token_hex(3).upper()}",
            order_id=order.id, order_number=order.order_number, account_reference=order.account_reference, product_reference=product, sku_reference=sku,
            serial_number=serial, installation_location=location, installed_at=installed, warranty_until=warranty, next_service_due_at=service_due,
            updated_by=actor,
        )
        item.emitted_events_json = json.dumps([_event(contract, tenant_id=item.tenant_id, event_type="customer-asset-created", subject_id=item.id, correlation_id=item.asset_number, extra={"assetId": item.id, "accountId": item.account_reference, "orderId": item.order_id, "serialNumber": item.serial_number})], ensure_ascii=False, separators=(",", ":"))
        self.db.add(item)
        await self.db.flush()
        return serialize_asset(item)

    async def create_ticket(self, asset_id: str, *, project_id: int, context: TenantContext, actor: str, issue_summary: str, severity: str) -> dict[str, object]:
        asset = await self._asset(asset_id, project_id)
        if asset.status == "retired":
            raise ValueError("Retired assets cannot receive new service tickets")
        existing = await self.db.scalar(select(FactoryAssetServiceTicket.id).where(FactoryAssetServiceTicket.asset_id == asset.id, FactoryAssetServiceTicket.status.in_(("open", "scheduled", "in-progress"))))
        if existing:
            raise ValueError("Asset already has an unresolved service ticket")
        clean_issue = issue_summary.strip()
        clean_severity = severity.strip().lower()
        if len(clean_issue) < 4 or clean_severity not in SLA_HOURS:
            raise ValueError("Service issue and valid severity are required")
        now = datetime.now(timezone.utc)
        ticket = FactoryAssetServiceTicket(
            id=f"ticket-{secrets.token_urlsafe(18)}", project_id=project_id, agent_path=context.agent_path, tenant_id=context.tenant_id,
            client_id=context.client_id, plan_id=context.plan_id or f"plan-{project_id}", ticket_number=f"SRV-{project_id}-{now.strftime('%Y%m%d%H%M%S')}-{secrets.token_hex(3).upper()}",
            asset_id=asset.id, asset_number=asset.asset_number, issue_summary=clean_issue, severity=clean_severity,
            sla_due_at=now + timedelta(hours=SLA_HOURS[clean_severity]), updated_by=actor,
        )
        asset.status = "service-open"
        asset.revision += 1
        asset.updated_by = actor
        self.db.add(ticket)
        await self.db.flush()
        return {"asset": serialize_asset(asset), "ticket": serialize_ticket(ticket)}

    async def transition_ticket(self, ticket_id: str, *, project_id: int, expected_revision: int, actor: str, action: str, assigned_to: str | None = None, scheduled_for: datetime | None = None, resolution_reference: str | None = None, resolution_note: str | None = None, next_service_due_at: datetime | None = None) -> dict[str, object]:
        ticket = await self.db.scalar(select(FactoryAssetServiceTicket).where(FactoryAssetServiceTicket.id == ticket_id, FactoryAssetServiceTicket.project_id == project_id))
        if not ticket:
            raise KeyError("Service ticket not found in this tenant plan")
        if ticket.revision != expected_revision:
            raise ValueError("Service ticket changed; refresh before continuing")
        transition = TICKET_TRANSITIONS.get(action)
        if not transition or ticket.status != transition[0]:
            raise ValueError("Service ticket must advance open, scheduled, in-progress, resolved")
        asset = await self._asset(ticket.asset_id, project_id)
        if action == "schedule":
            owner = (assigned_to or "").strip()
            scheduled = _utc(scheduled_for) if scheduled_for else None
            if not owner or not scheduled or scheduled <= datetime.now(timezone.utc):
                raise ValueError("Scheduling requires an owner and future service time")
            ticket.assigned_to = owner
            ticket.scheduled_for = scheduled
        elif action == "resolve":
            reference = (resolution_reference or "").strip()
            note = (resolution_note or "").strip()
            if not reference or len(note) < 4:
                raise ValueError("Resolution requires an evidence reference and note")
            contract = await self._contract("service-resolved")
            events = _json(ticket.emitted_events_json, [])
            events.append(_event(contract, tenant_id=ticket.tenant_id, event_type="service-resolved", subject_id=ticket.id, correlation_id=ticket.ticket_number, extra={"ticketId": ticket.id, "assetId": asset.id, "ownerId": ticket.assigned_to or actor, "status": "resolved"}))
            ticket.emitted_events_json = json.dumps(events, ensure_ascii=False, separators=(",", ":"))
            ticket.resolution_reference = reference
            ticket.resolution_note = note
            asset.status = "active"
            asset.service_count += 1
            asset.last_service_at = datetime.now(timezone.utc)
            if next_service_due_at:
                next_due = _utc(next_service_due_at)
                if next_due <= datetime.now(timezone.utc):
                    raise ValueError("Next service date must be in the future")
                asset.next_service_due_at = next_due
            asset.revision += 1
            asset.updated_by = actor
        ticket.status = transition[1]
        ticket.revision += 1
        ticket.updated_by = actor
        await self.db.flush()
        return {"asset": serialize_asset(asset), "ticket": serialize_ticket(ticket)}

    async def flag_warranty(self, asset_id: str, *, project_id: int, expected_revision: int, actor: str, renewal_owner: str, renewal_action: str) -> dict[str, object]:
        asset = await self._asset(asset_id, project_id)
        if asset.revision != expected_revision:
            raise ValueError("Customer asset changed; refresh before continuing")
        if _utc(asset.warranty_until) > datetime.now(timezone.utc) + timedelta(days=180):
            raise ValueError("Warranty action is available within 180 days of expiry")
        owner = renewal_owner.strip()
        action = renewal_action.strip()
        if not owner or len(action) < 4:
            raise ValueError("Warranty action requires an owner and next action")
        events = _json(asset.emitted_events_json, [])
        if any(event.get("eventType") == "warranty-expiring" for event in events):
            raise ValueError("Warranty expiry action already exists")
        contract = await self._contract("warranty-expiring")
        events.append(_event(contract, tenant_id=asset.tenant_id, event_type="warranty-expiring", subject_id=asset.id, correlation_id=asset.asset_number, extra={"assetId": asset.id, "accountId": asset.account_reference, "orderId": asset.order_id, "serialNumber": asset.serial_number}))
        asset.emitted_events_json = json.dumps(events, ensure_ascii=False, separators=(",", ":"))
        asset.renewal_status = "action-required"
        asset.renewal_owner = owner
        asset.renewal_action = action
        asset.revision += 1
        asset.updated_by = actor
        await self.db.flush()
        return serialize_asset(asset)

    async def _asset(self, asset_id: str, project_id: int) -> FactoryCustomerAsset:
        asset = await self.db.scalar(select(FactoryCustomerAsset).where(FactoryCustomerAsset.id == asset_id, FactoryCustomerAsset.project_id == project_id))
        if not asset:
            raise KeyError("Customer asset not found in this tenant plan")
        return asset

    async def _contract(self, event_type: str) -> FactoryCoreEventContract:
        contract = await self.db.scalar(select(FactoryCoreEventContract).where(FactoryCoreEventContract.id == event_type, FactoryCoreEventContract.lifecycle_status == "frozen"))
        if not contract:
            raise ValueError(f"The frozen {event_type} contract is required")
        return contract
