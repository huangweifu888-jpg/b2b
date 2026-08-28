"""Governed CPQ workflow: draft, approve, send, accept, then order intent."""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
import json
import secrets

from core.tenant_context import TenantContext
from models.factory_contract import FactoryCoreEventContract
from models.factory_cpq import FactoryCpqQuote
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


MONEY = Decimal("0.01")
MARGIN = Decimal("0.0001")
CPQ_TRANSITIONS = {
    "submit": ("draft", "pending-approval"),
    "approve": ("pending-approval", "approved"),
    "reject": ("pending-approval", "rejected"),
    "send": ("approved", "sent"),
    "accept": ("sent", "accepted"),
}


def _json_list(value: str | None) -> list[dict[str, object]]:
    try:
        parsed = json.loads(value or "[]")
    except (TypeError, ValueError):
        return []
    return parsed if isinstance(parsed, list) else []


def _utc(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def _decimal(value: object, field: str) -> Decimal:
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise ValueError(f"{field} must be a valid number") from exc


def normalize_lines(lines: list[dict[str, object]]) -> tuple[list[dict[str, object]], Decimal, Decimal, Decimal]:
    if not 1 <= len(lines) <= 50:
        raise ValueError("A CPQ quote requires 1 to 50 product lines")
    normalized: list[dict[str, object]] = []
    subtotal = Decimal("0")
    cost_total = Decimal("0")
    for index, line in enumerate(lines, start=1):
        product_reference = str(line.get("product_reference") or "").strip()[:255]
        sku_reference = str(line.get("sku_reference") or "").strip()[:255]
        quantity = _decimal(line.get("quantity"), f"line {index} quantity")
        moq = _decimal(line.get("moq"), f"line {index} MOQ")
        unit_price = _decimal(line.get("unit_price"), f"line {index} unit price")
        unit_cost = _decimal(line.get("unit_cost"), f"line {index} unit cost")
        lead_time_days = int(line.get("lead_time_days") or 0)
        if not product_reference or not sku_reference:
            raise ValueError(f"Line {index} requires product and SKU references")
        if quantity <= 0 or moq <= 0 or quantity < moq:
            raise ValueError(f"Line {index} quantity must satisfy the positive MOQ")
        if unit_price <= 0 or unit_cost < 0 or unit_price < unit_cost:
            raise ValueError(f"Line {index} price must be positive and cannot be below cost")
        if not 1 <= lead_time_days <= 3650:
            raise ValueError(f"Line {index} lead time must be between 1 and 3650 days")
        line_total = (quantity * unit_price).quantize(MONEY, rounding=ROUND_HALF_UP)
        line_cost = (quantity * unit_cost).quantize(MONEY, rounding=ROUND_HALF_UP)
        subtotal += line_total
        cost_total += line_cost
        normalized.append({
            "line_number": index,
            "product_reference": product_reference,
            "sku_reference": sku_reference,
            "quantity": str(quantity),
            "moq": str(moq),
            "unit_price": str(unit_price.quantize(MONEY, rounding=ROUND_HALF_UP)),
            "unit_cost": str(unit_cost.quantize(MONEY, rounding=ROUND_HALF_UP)),
            "lead_time_days": lead_time_days,
            "line_total": str(line_total),
        })
    margin = ((subtotal - cost_total) / subtotal * Decimal("100")).quantize(MARGIN, rounding=ROUND_HALF_UP)
    return normalized, subtotal.quantize(MONEY), cost_total.quantize(MONEY), margin


def serialize_quote(item: FactoryCpqQuote) -> dict[str, object]:
    return {
        "id": item.id,
        "project_id": item.project_id,
        "tenant_id": item.tenant_id,
        "client_id": item.client_id,
        "plan_id": item.plan_id,
        "quote_number": item.quote_number,
        "account_reference": item.account_reference,
        "currency": item.currency,
        "exchange_rate": str(item.exchange_rate),
        "valid_until": item.valid_until,
        "lines": _json_list(item.lines_json),
        "subtotal": str(item.subtotal),
        "cost_total": str(item.cost_total),
        "gross_margin_percent": str(item.gross_margin_percent),
        "status": item.status,
        "approval_note": item.approval_note,
        "order_intent_id": item.order_intent_id,
        "emitted_events": _json_list(item.emitted_events_json),
        "revision": item.revision,
        "updated_by": item.updated_by,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
    }


class FactoryCpqService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list(self, *, project_id: int) -> list[dict[str, object]]:
        items = (await self.db.execute(select(FactoryCpqQuote).where(FactoryCpqQuote.project_id == project_id).order_by(FactoryCpqQuote.created_at.desc()))).scalars().all()
        return [serialize_quote(item) for item in items]

    async def create(self, *, project_id: int, context: TenantContext, actor: str, account_reference: str, currency: str, exchange_rate: Decimal, valid_until: datetime, lines: list[dict[str, object]]) -> dict[str, object]:
        account = account_reference.strip()[:255]
        normalized_currency = currency.strip().upper()
        rate = Decimal(exchange_rate)
        if not account or len(normalized_currency) != 3 or rate <= 0:
            raise ValueError("Customer account, three-letter currency and positive exchange rate are required")
        if _utc(valid_until) <= datetime.now(timezone.utc):
            raise ValueError("Quote validity must be in the future")
        normalized, subtotal, cost_total, margin = normalize_lines(lines)
        now = datetime.now(timezone.utc)
        item = FactoryCpqQuote(
            id=f"cpq-{secrets.token_urlsafe(18)}",
            project_id=project_id,
            agent_path=context.agent_path,
            tenant_id=context.tenant_id,
            client_id=context.client_id,
            plan_id=context.plan_id or f"plan-{project_id}",
            quote_number=f"CPQ-{project_id}-{now:%Y%m%d%H%M%S}-{secrets.token_hex(3).upper()}",
            account_reference=account,
            currency=normalized_currency,
            exchange_rate=rate,
            valid_until=_utc(valid_until),
            lines_json=json.dumps(normalized, ensure_ascii=False, separators=(",", ":")),
            subtotal=subtotal,
            cost_total=cost_total,
            gross_margin_percent=margin,
            updated_by=actor,
        )
        self.db.add(item)
        await self.db.flush()
        return serialize_quote(item)

    async def transition(self, quote_id: str, *, project_id: int, expected_revision: int, actor: str, action: str, note: str | None = None) -> dict[str, object]:
        item = await self.db.scalar(select(FactoryCpqQuote).where(FactoryCpqQuote.id == quote_id, FactoryCpqQuote.project_id == project_id))
        if not item:
            raise KeyError("CPQ quote not found in this tenant plan")
        if item.revision != expected_revision:
            raise ValueError("CPQ quote changed; refresh before continuing")
        if action not in CPQ_TRANSITIONS:
            raise ValueError("Unsupported CPQ transition")
        expected, target = CPQ_TRANSITIONS[action]
        if item.status != expected:
            raise ValueError(f"CPQ transition {action} requires status {expected}")
        clean_note = (note or "").strip()[:2000]
        if action in {"approve", "reject"} and not clean_note:
            raise ValueError("Approval or rejection requires a review note")
        if action == "send" and _utc(item.valid_until) <= datetime.now(timezone.utc):
            raise ValueError("Expired quotes cannot be sent")

        event_type = "quote-submitted" if action == "send" else "quote-accepted" if action == "accept" else None
        if event_type:
            contract = await self.db.scalar(select(FactoryCoreEventContract).where(FactoryCoreEventContract.id == event_type, FactoryCoreEventContract.lifecycle_status == "frozen"))
            if not contract:
                raise ValueError(f"The frozen {event_type} contract is required")
            events = _json_list(item.emitted_events_json)
            events.append({
                "eventId": f"evt-{secrets.token_urlsafe(18)}",
                "tenantId": item.tenant_id,
                "eventType": event_type,
                "occurredAt": datetime.now(timezone.utc).isoformat(),
                "source": "convert",
                "subjectId": item.id,
                "version": contract.schema_version,
                "correlationId": item.quote_number,
                "amount": str(item.subtotal),
                "currency": item.currency,
            })
            item.emitted_events_json = json.dumps(events, ensure_ascii=False, separators=(",", ":"))
        if action in {"approve", "reject"}:
            item.approval_note = clean_note
        if action == "accept":
            # This is deliberately not a confirmed order. Only fulfillment or
            # an authorized OMS/ERP adapter may turn the intent into an order.
            item.order_intent_id = f"order-intent-{secrets.token_urlsafe(16)}"
        item.status = target
        item.revision += 1
        item.updated_by = actor
        await self.db.flush()
        return serialize_quote(item)
