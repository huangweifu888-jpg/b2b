"""Authoritative order confirmation and evidence-led fulfillment workflow."""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
import json
import secrets

from core.tenant_context import TenantContext
from models.factory_contract import FactoryCoreEventContract
from models.factory_cpq import FactoryCpqQuote
from models.factory_fulfillment import FactoryFulfillmentOrder
from models.factory_quality import FactoryQualityInspection
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


VALIDATION_KEYS = ("product", "payment", "inventory", "capacity")
MILESTONE_TRANSITIONS = {
    "allocate": ("confirmed", "allocated", None, "inventory_reference"),
    "start-production": ("allocated", "in-production", None, "work_order_reference"),
    "complete-production": ("in-production", "production-completed", "production-completed", "batch_reference"),
    "release-quality": ("production-completed", "quality-released", None, "inspection_reference"),
    "ship": ("quality-released", "shipped", None, "shipment_reference"),
    "deliver": ("shipped", "delivered", "shipment-delivered", "delivery_receipt_reference"),
}


def _json(value: str | None, fallback):
    try:
        parsed = json.loads(value or "")
    except (TypeError, ValueError):
        return fallback
    return parsed if isinstance(parsed, type(fallback)) else fallback


def _event(item: FactoryFulfillmentOrder, contract: FactoryCoreEventContract, event_type: str, *, subject_id: str) -> dict[str, object]:
    return {
        "eventId": f"evt-{secrets.token_urlsafe(18)}",
        "tenantId": item.tenant_id,
        "eventType": event_type,
        "occurredAt": datetime.now(timezone.utc).isoformat(),
        "source": "fulfillment",
        "subjectId": subject_id,
        "version": contract.schema_version,
        "correlationId": item.order_number,
        "orderId": item.id,
        "amount": str(item.order_total),
        "currency": item.currency,
    }


def serialize_order(item: FactoryFulfillmentOrder) -> dict[str, object]:
    return {
        "id": item.id,
        "project_id": item.project_id,
        "tenant_id": item.tenant_id,
        "client_id": item.client_id,
        "plan_id": item.plan_id,
        "order_number": item.order_number,
        "quote_id": item.quote_id,
        "quote_number": item.quote_number,
        "order_intent_id": item.order_intent_id,
        "account_reference": item.account_reference,
        "currency": item.currency,
        "exchange_rate": str(item.exchange_rate),
        "lines": _json(item.lines_json, []),
        "order_total": f"{Decimal(item.order_total):.2f}",
        "status": item.status,
        "authority_source": item.authority_source,
        "validation": _json(item.validation_json, {}),
        "fulfillment_evidence": _json(item.fulfillment_evidence_json, []),
        "emitted_events": _json(item.emitted_events_json, []),
        "confirmed_by": item.confirmed_by,
        "confirmed_at": item.confirmed_at,
        "revision": item.revision,
        "updated_by": item.updated_by,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
    }


class FactoryFulfillmentService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list(self, *, project_id: int) -> list[dict[str, object]]:
        items = (await self.db.execute(select(FactoryFulfillmentOrder).where(FactoryFulfillmentOrder.project_id == project_id).order_by(FactoryFulfillmentOrder.created_at.desc()))).scalars().all()
        return [serialize_order(item) for item in items]

    async def register_intent(self, *, project_id: int, context: TenantContext, actor: str, order_intent_id: str) -> dict[str, object]:
        clean_intent = order_intent_id.strip()
        quote = await self.db.scalar(select(FactoryCpqQuote).where(
            FactoryCpqQuote.project_id == project_id,
            FactoryCpqQuote.order_intent_id == clean_intent,
            FactoryCpqQuote.status == "accepted",
        ))
        if not quote:
            raise ValueError("Only an accepted quote intent in this tenant plan can be registered")
        existing = await self.db.scalar(select(FactoryFulfillmentOrder).where(FactoryFulfillmentOrder.order_intent_id == clean_intent))
        if existing:
            raise ValueError("This order intent is already registered")
        now = datetime.now(timezone.utc)
        item = FactoryFulfillmentOrder(
            id=f"order-{secrets.token_urlsafe(18)}",
            project_id=project_id,
            agent_path=context.agent_path,
            tenant_id=context.tenant_id,
            client_id=context.client_id,
            plan_id=context.plan_id or f"plan-{project_id}",
            order_number=f"SO-{project_id}-{now.strftime('%Y%m%d%H%M%S')}-{secrets.token_hex(3).upper()}",
            quote_id=quote.id,
            quote_number=quote.quote_number,
            order_intent_id=clean_intent,
            account_reference=quote.account_reference,
            currency=quote.currency,
            exchange_rate=quote.exchange_rate,
            lines_json=quote.lines_json,
            order_total=quote.subtotal,
            updated_by=actor,
        )
        self.db.add(item)
        await self.db.flush()
        return serialize_order(item)

    async def decide(self, order_id: str, *, project_id: int, expected_revision: int, actor: str, action: str, validations: dict[str, bool], note: str) -> dict[str, object]:
        item = await self._get(order_id, project_id)
        self._require_revision(item, expected_revision)
        if item.status != "pending-validation":
            raise ValueError("Only a pending-validation order can be decided")
        clean_note = note.strip()
        if len(clean_note) < 4:
            raise ValueError("Order decision requires a review note")
        normalized = {key: bool(validations.get(key, False)) for key in VALIDATION_KEYS}
        item.validation_json = json.dumps({**normalized, "note": clean_note, "reviewedBy": actor, "reviewedAt": datetime.now(timezone.utc).isoformat()}, ensure_ascii=False, separators=(",", ":"))
        if action == "reject":
            item.status = "rejected"
        elif action == "confirm":
            failed = [key for key, passed in normalized.items() if not passed]
            if failed:
                raise ValueError(f"Order confirmation requires all checks: {', '.join(failed)}")
            contract = await self._contract("order-confirmed")
            events = _json(item.emitted_events_json, [])
            events.append(_event(item, contract, "order-confirmed", subject_id=item.id))
            item.emitted_events_json = json.dumps(events, ensure_ascii=False, separators=(",", ":"))
            item.status = "confirmed"
            item.confirmed_by = actor
            item.confirmed_at = datetime.now(timezone.utc)
        else:
            raise ValueError("Unsupported order decision")
        item.revision += 1
        item.updated_by = actor
        await self.db.flush()
        return serialize_order(item)

    async def advance(self, order_id: str, *, project_id: int, expected_revision: int, actor: str, action: str, evidence_reference: str, note: str) -> dict[str, object]:
        item = await self._get(order_id, project_id)
        self._require_revision(item, expected_revision)
        transition = MILESTONE_TRANSITIONS.get(action)
        if not transition:
            raise ValueError("Unsupported fulfillment action")
        expected_status, target_status, event_type, reference_type = transition
        if item.status != expected_status:
            raise ValueError(f"Fulfillment action {action} requires status {expected_status}")
        reference = evidence_reference.strip()
        clean_note = note.strip()
        if not reference or len(clean_note) < 4:
            raise ValueError("Fulfillment milestones require an evidence reference and note")
        if action == "release-quality":
            released_inspection = await self.db.scalar(select(FactoryQualityInspection).where(
                FactoryQualityInspection.project_id == project_id,
                FactoryQualityInspection.order_id == item.id,
                FactoryQualityInspection.inspection_reference == reference,
                FactoryQualityInspection.lifecycle_status == "released",
            ))
            if not released_inspection:
                raise ValueError("Quality release requires an approved QMS inspection in this tenant plan")
            events = _json(item.emitted_events_json, [])
            if not any(event.get("eventType") == "quality-released" for event in events):
                released_events = _json(released_inspection.emitted_events_json, [])
                released_event = next((event for event in released_events if event.get("eventType") == "quality-released"), None)
                if not released_event:
                    raise ValueError("Released QMS inspection is missing its frozen quality-release event")
                events.append(released_event)
                item.emitted_events_json = json.dumps(events, ensure_ascii=False, separators=(",", ":"))
        occurred_at = datetime.now(timezone.utc).isoformat()
        evidence = _json(item.fulfillment_evidence_json, [])
        evidence.append({"action": action, "referenceType": reference_type, "reference": reference, "note": clean_note, "recordedBy": actor, "occurredAt": occurred_at})
        item.fulfillment_evidence_json = json.dumps(evidence, ensure_ascii=False, separators=(",", ":"))
        if event_type:
            contract = await self._contract(event_type)
            subject_id = reference if event_type != "order-confirmed" else item.id
            events = _json(item.emitted_events_json, [])
            events.append(_event(item, contract, event_type, subject_id=subject_id))
            item.emitted_events_json = json.dumps(events, ensure_ascii=False, separators=(",", ":"))
        item.status = target_status
        item.revision += 1
        item.updated_by = actor
        await self.db.flush()
        return serialize_order(item)

    async def _get(self, order_id: str, project_id: int) -> FactoryFulfillmentOrder:
        item = await self.db.scalar(select(FactoryFulfillmentOrder).where(FactoryFulfillmentOrder.id == order_id, FactoryFulfillmentOrder.project_id == project_id))
        if not item:
            raise KeyError("Fulfillment order not found in this tenant plan")
        return item

    @staticmethod
    def _require_revision(item: FactoryFulfillmentOrder, expected_revision: int) -> None:
        if item.revision != expected_revision:
            raise ValueError("Fulfillment order changed; refresh before continuing")

    async def _contract(self, event_type: str) -> FactoryCoreEventContract:
        contract = await self.db.scalar(select(FactoryCoreEventContract).where(FactoryCoreEventContract.id == event_type, FactoryCoreEventContract.lifecycle_status == "frozen"))
        if not contract:
            raise ValueError(f"The frozen {event_type} contract is required")
        return contract
