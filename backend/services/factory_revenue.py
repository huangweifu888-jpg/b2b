"""State machine for the tenant-scoped revenue golden flow pilot."""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
import json
import secrets

from core.tenant_context import TenantContext
from models.factory_contract import FactoryCoreEventContract
from models.factory_revenue import FactoryRevenueFlowRun
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


STAGE_SEQUENCE = ["product-selected", "inquiry-created", "quote-submitted", "quote-accepted", "order-confirmed", "invoice-issued", "payment-received"]
EVENT_PRODUCERS = {
    "inquiry-created": "convert",
    "quote-submitted": "convert",
    "quote-accepted": "convert",
    "order-confirmed": "fulfillment",
    "invoice-issued": "operations",
    "payment-received": "operations",
}


def _events(value: str | None) -> list[dict[str, object]]:
    try:
        parsed = json.loads(value or "[]")
    except (TypeError, ValueError):
        return []
    return parsed if isinstance(parsed, list) else []


def serialize_run(item: FactoryRevenueFlowRun) -> dict[str, object]:
    return {
        "id": item.id,
        "project_id": item.project_id,
        "tenant_id": item.tenant_id,
        "client_id": item.client_id,
        "plan_id": item.plan_id,
        "correlation_id": item.correlation_id,
        "product_reference": item.product_reference,
        "account_reference": item.account_reference,
        "currency": item.currency,
        "quoted_amount": str(item.quoted_amount),
        "ordered_amount": str(item.ordered_amount),
        "invoiced_amount": str(item.invoiced_amount),
        "paid_amount": str(item.paid_amount),
        "current_stage": item.current_stage,
        "emitted_events": _events(item.emitted_events_json),
        "revision": item.revision,
        "updated_by": item.updated_by,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
    }


class FactoryRevenueService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list(self, *, project_id: int) -> list[dict[str, object]]:
        items = (await self.db.execute(select(FactoryRevenueFlowRun).where(FactoryRevenueFlowRun.project_id == project_id).order_by(FactoryRevenueFlowRun.created_at.desc()))).scalars().all()
        return [serialize_run(item) for item in items]

    async def create(self, *, project_id: int, context: TenantContext, actor: str, product_reference: str, account_reference: str, currency: str) -> dict[str, object]:
        required_contracts = (await self.db.execute(select(FactoryCoreEventContract.id).where(FactoryCoreEventContract.id.in_(EVENT_PRODUCERS), FactoryCoreEventContract.lifecycle_status == "frozen"))).scalars().all()
        if set(required_contracts) != set(EVENT_PRODUCERS):
            raise ValueError("Revenue flow requires the frozen V1 event contracts")
        item = FactoryRevenueFlowRun(
            id=f"revenue-{secrets.token_urlsafe(18)}",
            project_id=project_id,
            agent_path=context.agent_path,
            tenant_id=context.tenant_id,
            client_id=context.client_id,
            plan_id=context.plan_id or f"plan-{project_id}",
            correlation_id=f"corr-{secrets.token_urlsafe(16)}",
            product_reference=product_reference.strip()[:255],
            account_reference=account_reference.strip()[:255],
            currency=currency.strip().upper()[:10],
            updated_by=actor,
        )
        if not item.product_reference or not item.account_reference or len(item.currency) != 3:
            raise ValueError("Product, customer account and three-letter currency are required")
        self.db.add(item)
        await self.db.flush()
        return serialize_run(item)

    async def transition(self, run_id: str, *, project_id: int, expected_revision: int, actor: str, event_type: str, amount: Decimal | None) -> dict[str, object]:
        item = await self.db.scalar(select(FactoryRevenueFlowRun).where(FactoryRevenueFlowRun.id == run_id, FactoryRevenueFlowRun.project_id == project_id))
        if not item:
            raise KeyError("Revenue flow run not found in this tenant plan")
        if item.revision != expected_revision:
            raise ValueError("Revenue flow changed; refresh before advancing")
        current_index = STAGE_SEQUENCE.index(item.current_stage)
        if current_index >= len(STAGE_SEQUENCE) - 1 or STAGE_SEQUENCE[current_index + 1] != event_type:
            expected = STAGE_SEQUENCE[min(current_index + 1, len(STAGE_SEQUENCE) - 1)]
            raise ValueError(f"Revenue flow must advance in order; expected {expected}")
        contract = await self.db.scalar(select(FactoryCoreEventContract).where(FactoryCoreEventContract.id == event_type, FactoryCoreEventContract.lifecycle_status == "frozen"))
        if not contract:
            raise ValueError("The requested event contract is not frozen")

        event_amount = Decimal(amount or 0)
        if event_type == "quote-submitted" and event_amount <= 0:
            raise ValueError("Quote amount must be greater than zero")
        if event_type == "order-confirmed" and (event_amount <= 0 or event_amount > Decimal(item.quoted_amount)):
            raise ValueError("Order amount must be positive and cannot exceed the accepted quote")
        if event_type == "invoice-issued" and (event_amount <= 0 or event_amount > Decimal(item.ordered_amount)):
            raise ValueError("Invoice amount must be positive and cannot exceed the order")
        if event_type == "payment-received" and event_amount != Decimal(item.invoiced_amount):
            raise ValueError("Pilot completion requires payment to reconcile exactly to the invoice")

        if event_type == "quote-submitted":
            item.quoted_amount = event_amount
        elif event_type == "order-confirmed":
            item.ordered_amount = event_amount
        elif event_type == "invoice-issued":
            item.invoiced_amount = event_amount
        elif event_type == "payment-received":
            item.paid_amount = event_amount

        envelope = {
            "eventId": f"evt-{secrets.token_urlsafe(18)}",
            "tenantId": item.tenant_id,
            "eventType": event_type,
            "occurredAt": datetime.now(timezone.utc).isoformat(),
            "source": EVENT_PRODUCERS[event_type],
            "subjectId": item.id,
            "version": contract.schema_version,
            "correlationId": item.correlation_id,
            "amount": str(event_amount) if event_amount else None,
            "currency": item.currency,
        }
        events = _events(item.emitted_events_json)
        events.append(envelope)
        item.emitted_events_json = json.dumps(events, ensure_ascii=False, separators=(",", ":"))
        item.current_stage = event_type
        item.revision += 1
        item.updated_by = actor
        await self.db.flush()
        return serialize_run(item)
