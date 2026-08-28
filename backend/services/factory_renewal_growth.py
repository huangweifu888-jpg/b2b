"""Evidence-led renewal, repurchase and expansion workflow for installed assets."""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
import json
import secrets

from core.tenant_context import TenantContext
from models.factory_cpq import FactoryCpqQuote
from models.factory_customer_asset import FactoryAssetServiceTicket, FactoryCustomerAsset
from models.factory_fulfillment import FactoryFulfillmentOrder
from models.factory_renewal_growth import FactoryRenewalGrowthEvidence, FactoryRenewalGrowthOpportunity
from models.factory_warranty_rma import FactoryWarrantyRmaCase
from services.factory_cpq import serialize_quote
from services.factory_customer_asset import serialize_asset, serialize_ticket
from services.factory_fulfillment import serialize_order
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession


MOTIONS = {"renewal", "repurchase", "upsell"}
OPEN_STATUSES = {"draft", "assessed", "recommended", "approved", "cpq-requested", "quoted"}
ORDER_CONFIRMED_STATUSES = {
    "confirmed", "allocated", "in-production", "production-completed",
    "quality-released", "shipped", "delivered",
}
MONEY = Decimal("0.01")
MARGIN = Decimal("0.0001")


def _json(value: str | None, fallback):
    try:
        parsed = json.loads(value or "")
    except (TypeError, ValueError):
        return fallback
    return parsed if isinstance(parsed, type(fallback)) else fallback


def _utc(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def _decimal(value: object, field: str) -> Decimal:
    try:
        result = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise ValueError(f"{field} must be a valid number") from exc
    return result


def _money_text(value: object | None) -> str | None:
    return str(Decimal(value).quantize(MONEY, rounding=ROUND_HALF_UP)) if value is not None else None


def serialize_evidence(item: FactoryRenewalGrowthEvidence) -> dict[str, object]:
    return {
        "id": item.id, "evidence_number": item.evidence_number,
        "opportunity_id": item.opportunity_id, "opportunity_number": item.opportunity_number,
        "evidence_type": item.evidence_type, "evidence_reference": item.evidence_reference,
        "note": item.note, "recorded_by": item.recorded_by, "created_at": item.created_at,
    }


def serialize_opportunity(
    item: FactoryRenewalGrowthOpportunity,
    evidence: list[FactoryRenewalGrowthEvidence] | None = None,
) -> dict[str, object]:
    return {
        "id": item.id, "project_id": item.project_id, "tenant_id": item.tenant_id,
        "client_id": item.client_id, "plan_id": item.plan_id,
        "opportunity_number": item.opportunity_number,
        "opportunity_reference": item.opportunity_reference,
        "asset_id": item.asset_id, "asset_number": item.asset_number,
        "original_order_id": item.original_order_id,
        "original_order_number": item.original_order_number,
        "account_reference": item.account_reference,
        "current_product_reference": item.current_product_reference,
        "current_sku_reference": item.current_sku_reference,
        "serial_number": item.serial_number, "warranty_until": item.warranty_until,
        "service_count_snapshot": item.service_count_snapshot,
        "resolved_service_count": item.resolved_service_count,
        "closed_rma_count": item.closed_rma_count,
        "manufacturer_fault_count": item.manufacturer_fault_count,
        "health_score": item.health_score, "risk_level": item.risk_level,
        "source_snapshot": _json(item.source_snapshot_json, {}),
        "lifecycle_status": item.lifecycle_status, "motion": item.motion,
        "owner": item.owner, "next_action_at": item.next_action_at,
        "value_evidence_reference": item.value_evidence_reference,
        "customer_goal": item.customer_goal,
        "customer_confirmation_reference": item.customer_confirmation_reference,
        "recommendation_reference": item.recommendation_reference,
        "recommended_product_reference": item.recommended_product_reference,
        "recommended_sku_reference": item.recommended_sku_reference,
        "recommended_quantity": str(item.recommended_quantity) if item.recommended_quantity is not None else None,
        "currency": item.currency,
        "estimated_unit_price": _money_text(item.estimated_unit_price),
        "estimated_unit_cost": _money_text(item.estimated_unit_cost),
        "estimated_value": _money_text(item.estimated_value),
        "estimated_margin_percent": str(item.estimated_margin_percent) if item.estimated_margin_percent is not None else None,
        "recommendation_rationale": item.recommendation_rationale,
        "approval_reference": item.approval_reference,
        "approved_by": item.approved_by, "approved_at": item.approved_at,
        "cpq_handoff_reference": item.cpq_handoff_reference,
        "cpq_handoff_at": item.cpq_handoff_at,
        "quote_id": item.quote_id, "quote_number": item.quote_number,
        "quote_value": _money_text(item.quote_value),
        "quote_accepted_at": item.quote_accepted_at,
        "order_id": item.order_id, "order_number": item.order_number,
        "actual_value": _money_text(item.actual_value),
        "won_at": item.won_at, "loss_reason": item.loss_reason,
        "closed_by": item.closed_by, "closed_at": item.closed_at,
        "milestones": _json(item.milestones_json, []),
        "evidence": [serialize_evidence(row) for row in evidence or []],
        "revision": item.revision, "updated_by": item.updated_by,
        "created_at": item.created_at, "updated_at": item.updated_at,
    }


class FactoryRenewalGrowthService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_workspace(self, *, project_id: int) -> dict[str, object]:
        assets = (await self.db.execute(select(FactoryCustomerAsset).where(
            FactoryCustomerAsset.project_id == project_id,
            FactoryCustomerAsset.status == "active",
        ).order_by(FactoryCustomerAsset.warranty_until))).scalars().all()
        tickets = (await self.db.execute(select(FactoryAssetServiceTicket).where(
            FactoryAssetServiceTicket.project_id == project_id,
            FactoryAssetServiceTicket.status == "resolved",
        ).order_by(FactoryAssetServiceTicket.created_at.desc()))).scalars().all()
        rmas = (await self.db.execute(select(FactoryWarrantyRmaCase).where(
            FactoryWarrantyRmaCase.project_id == project_id,
            FactoryWarrantyRmaCase.lifecycle_status == "closed",
        ).order_by(FactoryWarrantyRmaCase.created_at.desc()))).scalars().all()
        quotes = (await self.db.execute(select(FactoryCpqQuote).where(
            FactoryCpqQuote.project_id == project_id,
        ).order_by(FactoryCpqQuote.created_at.desc()))).scalars().all()
        orders = (await self.db.execute(select(FactoryFulfillmentOrder).where(
            FactoryFulfillmentOrder.project_id == project_id,
        ).order_by(FactoryFulfillmentOrder.created_at.desc()))).scalars().all()
        opportunities = (await self.db.execute(select(FactoryRenewalGrowthOpportunity).where(
            FactoryRenewalGrowthOpportunity.project_id == project_id,
        ).order_by(FactoryRenewalGrowthOpportunity.created_at.desc()))).scalars().all()
        evidence = (await self.db.execute(select(FactoryRenewalGrowthEvidence).where(
            FactoryRenewalGrowthEvidence.project_id == project_id,
        ).order_by(FactoryRenewalGrowthEvidence.created_at))).scalars().all()
        evidence_map: dict[str, list[FactoryRenewalGrowthEvidence]] = {}
        for row in evidence:
            evidence_map.setdefault(row.opportunity_id, []).append(row)
        return {
            "assets": [serialize_asset(row) for row in assets],
            "resolved_tickets": [serialize_ticket(row) for row in tickets],
            "closed_rmas": [{
                "id": row.id, "rma_number": row.rma_number, "asset_id": row.asset_id,
                "inspection_result": row.inspection_result, "responsibility": row.responsibility,
                "estimated_total_cost": str(row.estimated_total_cost),
            } for row in rmas],
            "quotes": [serialize_quote(row) for row in quotes],
            "orders": [serialize_order(row) for row in orders],
            "opportunities": [serialize_opportunity(row, evidence_map.get(row.id)) for row in opportunities],
        }

    async def create(
        self, *, project_id: int, context: TenantContext, actor: str,
        asset_id: str, opportunity_reference: str, owner: str, next_action_at: datetime,
    ) -> dict[str, object]:
        asset = await self._asset(asset_id, project_id)
        if asset.status != "active" or asset.renewal_status != "action-required":
            raise ValueError("Renewal opportunity requires an active asset with an approved renewal action")
        open_item = await self.db.scalar(select(FactoryRenewalGrowthOpportunity.id).where(
            FactoryRenewalGrowthOpportunity.project_id == project_id,
            FactoryRenewalGrowthOpportunity.asset_id == asset.id,
            FactoryRenewalGrowthOpportunity.lifecycle_status.in_(OPEN_STATUSES),
        ))
        if open_item:
            raise ValueError("This customer asset already has an open renewal opportunity")
        reference = self._required(opportunity_reference, "Opportunity reference")
        clean_owner = self._required(owner, "Opportunity owner")[:255]
        if _utc(next_action_at) <= datetime.now(timezone.utc):
            raise ValueError("Next renewal action must be scheduled in the future")
        duplicate = await self.db.scalar(select(FactoryRenewalGrowthOpportunity.id).where(
            FactoryRenewalGrowthOpportunity.tenant_id == context.tenant_id,
            FactoryRenewalGrowthOpportunity.opportunity_reference == reference,
        ))
        if duplicate:
            raise ValueError("Opportunity reference already exists in this tenant")
        resolved_count = int(await self.db.scalar(select(func.count(FactoryAssetServiceTicket.id)).where(
            FactoryAssetServiceTicket.project_id == project_id,
            FactoryAssetServiceTicket.asset_id == asset.id,
            FactoryAssetServiceTicket.status == "resolved",
        )) or 0)
        closed_rma_count = int(await self.db.scalar(select(func.count(FactoryWarrantyRmaCase.id)).where(
            FactoryWarrantyRmaCase.project_id == project_id,
            FactoryWarrantyRmaCase.asset_id == asset.id,
            FactoryWarrantyRmaCase.lifecycle_status == "closed",
        )) or 0)
        manufacturer_fault_count = int(await self.db.scalar(select(func.count(FactoryWarrantyRmaCase.id)).where(
            FactoryWarrantyRmaCase.project_id == project_id,
            FactoryWarrantyRmaCase.asset_id == asset.id,
            FactoryWarrantyRmaCase.lifecycle_status == "closed",
            FactoryWarrantyRmaCase.inspection_result == "manufacturing-defect",
            FactoryWarrantyRmaCase.responsibility == "manufacturer",
        )) or 0)
        now = datetime.now(timezone.utc)
        days_to_warranty = int((_utc(asset.warranty_until) - now).total_seconds() // 86400)
        warranty_penalty = 25 if days_to_warranty < 0 else 15 if days_to_warranty <= 30 else 10 if days_to_warranty <= 90 else 0
        service_penalty = min(resolved_count * 5, 20)
        quality_penalty = min(manufacturer_fault_count * 20, 40)
        maintenance_penalty = 10 if _utc(asset.next_service_due_at) < now else 0
        score = max(0, 100 - warranty_penalty - service_penalty - quality_penalty - maintenance_penalty)
        risk = "low" if score >= 80 else "medium" if score >= 60 else "high"
        snapshot = {
            "capturedAt": now.isoformat(), "assetRevision": asset.revision,
            "renewalStatus": asset.renewal_status, "daysToWarranty": days_to_warranty,
            "resolvedServiceCount": resolved_count, "closedRmaCount": closed_rma_count,
            "manufacturerFaultCount": manufacturer_fault_count,
            "healthFormula": "100-warranty-service-manufacturerFault-maintenance",
        }
        item = FactoryRenewalGrowthOpportunity(
            id=f"renewal-{secrets.token_urlsafe(18)}", project_id=project_id,
            agent_path=context.agent_path, tenant_id=context.tenant_id,
            client_id=context.client_id, plan_id=context.plan_id or f"plan-{project_id}",
            opportunity_number=f"REN-{project_id}-{now:%Y%m%d%H%M%S}-{secrets.token_hex(3).upper()}",
            opportunity_reference=reference, asset_id=asset.id, asset_number=asset.asset_number,
            original_order_id=asset.order_id, original_order_number=asset.order_number,
            account_reference=asset.account_reference,
            current_product_reference=asset.product_reference,
            current_sku_reference=asset.sku_reference, serial_number=asset.serial_number,
            warranty_until=asset.warranty_until, service_count_snapshot=asset.service_count,
            resolved_service_count=resolved_count, closed_rma_count=closed_rma_count,
            manufacturer_fault_count=manufacturer_fault_count, health_score=score,
            risk_level=risk, source_snapshot_json=json.dumps(snapshot, ensure_ascii=False, separators=(",", ":")),
            owner=clean_owner, next_action_at=_utc(next_action_at), updated_by=actor,
        )
        self.db.add(item)
        await self.db.flush()
        return serialize_opportunity(item, [])

    async def assess(
        self, opportunity_id: str, *, project_id: int, expected_revision: int,
        actor: str, value_evidence_reference: str, value_summary: str,
    ) -> dict[str, object]:
        item = await self._get(opportunity_id, project_id)
        self._guard(item, expected_revision, "draft", "Renewal assessment")
        reference = self._required(value_evidence_reference, "Value evidence")
        note = value_summary.strip()
        if len(note) < 8:
            raise ValueError("Renewal assessment requires a detailed customer value summary")
        item.lifecycle_status = "assessed"
        item.value_evidence_reference = reference
        await self._record(item, "value-assessment", reference, note, actor)
        self._advance(item, "assess", reference, actor)
        return await self._serialized(item)

    async def recommend(
        self, opportunity_id: str, *, project_id: int, expected_revision: int, actor: str,
        motion: str, customer_goal: str, customer_confirmation_reference: str,
        recommendation_reference: str, recommended_product_reference: str,
        recommended_sku_reference: str, recommended_quantity: object,
        currency: str, estimated_unit_price: object, estimated_unit_cost: object,
        recommendation_rationale: str,
    ) -> dict[str, object]:
        item = await self._get(opportunity_id, project_id)
        self._guard(item, expected_revision, "assessed", "Renewal recommendation")
        clean_motion = motion.strip().lower()
        goal = customer_goal.strip()
        confirmation = self._required(customer_confirmation_reference, "Customer confirmation")
        reference = self._required(recommendation_reference, "Recommendation evidence")
        product = self._required(recommended_product_reference, "Recommended product")[:255]
        sku = self._required(recommended_sku_reference, "Recommended SKU")[:255]
        rationale = recommendation_rationale.strip()
        quantity = _decimal(recommended_quantity, "Recommended quantity")
        price = _decimal(estimated_unit_price, "Estimated unit price").quantize(MONEY, rounding=ROUND_HALF_UP)
        cost = _decimal(estimated_unit_cost, "Estimated unit cost").quantize(MONEY, rounding=ROUND_HALF_UP)
        clean_currency = currency.strip().upper()
        if clean_motion not in MOTIONS or len(goal) < 8 or len(rationale) < 8:
            raise ValueError("Recommendation requires motion, customer goal and detailed rationale")
        if quantity <= 0 or price <= 0 or cost < 0 or price < cost or len(clean_currency) != 3:
            raise ValueError("Recommendation requires positive quantity, governed price/cost and currency")
        value = (quantity * price).quantize(MONEY, rounding=ROUND_HALF_UP)
        margin = ((value - quantity * cost) / value * Decimal("100")).quantize(MARGIN, rounding=ROUND_HALF_UP)
        item.lifecycle_status = "recommended"
        item.motion = clean_motion
        item.customer_goal = goal[:4000]
        item.customer_confirmation_reference = confirmation
        item.recommendation_reference = reference
        item.recommended_product_reference = product
        item.recommended_sku_reference = sku
        item.recommended_quantity = quantity
        item.currency = clean_currency
        item.estimated_unit_price = price
        item.estimated_unit_cost = cost
        item.estimated_value = value
        item.estimated_margin_percent = margin
        item.recommendation_rationale = rationale[:4000]
        await self._record(item, "customer-confirmation", confirmation, goal, actor)
        await self._record(item, "recommendation", reference, rationale, actor)
        self._advance(item, "recommend", reference, actor)
        return await self._serialized(item)

    async def approve(
        self, opportunity_id: str, *, project_id: int, expected_revision: int,
        actor: str, approval_reference: str, approval_note: str,
    ) -> dict[str, object]:
        item = await self._get(opportunity_id, project_id)
        self._guard(item, expected_revision, "recommended", "Renewal approval")
        reference = self._required(approval_reference, "Renewal approval")
        note = approval_note.strip()
        if len(note) < 8:
            raise ValueError("Renewal approval requires a review note")
        item.lifecycle_status = "approved"
        item.approval_reference = reference
        item.approved_by = actor
        item.approved_at = datetime.now(timezone.utc)
        await self._record(item, "approval", reference, note, actor)
        self._advance(item, "approve", reference, actor)
        return await self._serialized(item)

    async def request_cpq(
        self, opportunity_id: str, *, project_id: int, expected_revision: int,
        actor: str, cpq_handoff_reference: str,
    ) -> dict[str, object]:
        item = await self._get(opportunity_id, project_id)
        self._guard(item, expected_revision, "approved", "CPQ handoff")
        reference = self._required(cpq_handoff_reference, "CPQ handoff reference")
        item.lifecycle_status = "cpq-requested"
        item.cpq_handoff_reference = reference
        item.cpq_handoff_at = datetime.now(timezone.utc)
        await self._record(item, "cpq-handoff", reference, "Approved recommendation handed to governed CPQ", actor)
        self._advance(item, "request-cpq", reference, actor)
        return await self._serialized(item)

    async def link_accepted_quote(
        self, opportunity_id: str, *, project_id: int, expected_revision: int,
        actor: str, quote_id: str,
    ) -> dict[str, object]:
        item = await self._get(opportunity_id, project_id)
        self._guard(item, expected_revision, "cpq-requested", "Accepted quote link")
        quote = await self.db.scalar(select(FactoryCpqQuote).where(
            FactoryCpqQuote.id == quote_id, FactoryCpqQuote.project_id == project_id,
        ))
        if not quote or quote.status != "accepted" or not quote.order_intent_id:
            raise ValueError("Renewal can link only an accepted CPQ quote in this tenant plan")
        if quote.account_reference != item.account_reference:
            raise ValueError("Accepted quote customer does not match the renewal opportunity")
        original_order = await self.db.scalar(select(FactoryFulfillmentOrder).where(
            FactoryFulfillmentOrder.id == item.original_order_id,
            FactoryFulfillmentOrder.project_id == project_id,
        ))
        if original_order and original_order.quote_id == quote.id:
            raise ValueError("The original asset order cannot be reused as a renewal quote")
        repeated = await self.db.scalar(select(FactoryRenewalGrowthOpportunity.id).where(
            FactoryRenewalGrowthOpportunity.tenant_id == item.tenant_id,
            FactoryRenewalGrowthOpportunity.quote_id == quote.id,
            FactoryRenewalGrowthOpportunity.id != item.id,
        ))
        if repeated:
            raise ValueError("Accepted quote is already linked to another renewal opportunity")
        matching_line = next((line for line in _json(quote.lines_json, []) if
            line.get("product_reference") == item.recommended_product_reference and
            line.get("sku_reference") == item.recommended_sku_reference and
            _decimal(line.get("quantity"), "Quote quantity") >= Decimal(item.recommended_quantity)
        ), None)
        if not matching_line:
            raise ValueError("Accepted quote must contain the approved renewal product, SKU and quantity")
        item.lifecycle_status = "quoted"
        item.quote_id = quote.id
        item.quote_number = quote.quote_number
        item.quote_value = quote.subtotal
        item.quote_accepted_at = quote.updated_at or datetime.now(timezone.utc)
        await self._record(item, "quote-accepted", quote.quote_number, f"Accepted CPQ value {quote.currency} {quote.subtotal}", actor)
        self._advance(item, "link-quote", quote.quote_number, actor)
        return await self._serialized(item)

    async def confirm_won(
        self, opportunity_id: str, *, project_id: int, expected_revision: int,
        actor: str, order_id: str,
    ) -> dict[str, object]:
        item = await self._get(opportunity_id, project_id)
        self._guard(item, expected_revision, "quoted", "Renewal win confirmation")
        order = await self.db.scalar(select(FactoryFulfillmentOrder).where(
            FactoryFulfillmentOrder.id == order_id,
            FactoryFulfillmentOrder.project_id == project_id,
        ))
        if not order or order.status not in ORDER_CONFIRMED_STATUSES or not order.confirmed_at:
            raise ValueError("Renewal win requires an OMS-confirmed order in this tenant plan")
        if order.quote_id != item.quote_id or order.account_reference != item.account_reference:
            raise ValueError("Confirmed order must originate from the linked renewal quote and customer")
        repeated = await self.db.scalar(select(FactoryRenewalGrowthOpportunity.id).where(
            FactoryRenewalGrowthOpportunity.tenant_id == item.tenant_id,
            FactoryRenewalGrowthOpportunity.order_id == order.id,
            FactoryRenewalGrowthOpportunity.id != item.id,
        ))
        if repeated:
            raise ValueError("Confirmed order is already linked to another renewal opportunity")
        now = datetime.now(timezone.utc)
        item.lifecycle_status = "won"
        item.order_id = order.id
        item.order_number = order.order_number
        item.actual_value = order.order_total
        item.won_at = now
        item.closed_by = actor
        item.closed_at = now
        await self._record(item, "order-confirmed", order.order_number, f"OMS confirmed renewal value {order.currency} {order.order_total}", actor)
        self._advance(item, "confirm-won", order.order_number, actor)
        return await self._serialized(item)

    async def close_lost(
        self, opportunity_id: str, *, project_id: int, expected_revision: int,
        actor: str, loss_reference: str, loss_reason: str,
    ) -> dict[str, object]:
        item = await self._get(opportunity_id, project_id)
        if item.revision != expected_revision:
            raise ValueError("Renewal opportunity changed; refresh before saving")
        if item.lifecycle_status not in {"assessed", "recommended", "approved", "cpq-requested", "quoted"}:
            raise ValueError("Only an active assessed renewal opportunity can be closed lost")
        reference = self._required(loss_reference, "Loss evidence")
        reason = loss_reason.strip()
        if len(reason) < 8:
            raise ValueError("Closing a renewal opportunity lost requires a detailed reason")
        now = datetime.now(timezone.utc)
        item.lifecycle_status = "lost"
        item.loss_reason = reason[:4000]
        item.closed_by = actor
        item.closed_at = now
        await self._record(item, "loss", reference, reason, actor)
        self._advance(item, "close-lost", reference, actor)
        return await self._serialized(item)

    async def _asset(self, item_id: str, project_id: int) -> FactoryCustomerAsset:
        item = await self.db.scalar(select(FactoryCustomerAsset).where(
            FactoryCustomerAsset.id == item_id,
            FactoryCustomerAsset.project_id == project_id,
        ))
        if not item:
            raise KeyError("Customer asset not found in this tenant plan")
        return item

    async def _get(self, item_id: str, project_id: int) -> FactoryRenewalGrowthOpportunity:
        item = await self.db.scalar(select(FactoryRenewalGrowthOpportunity).where(
            FactoryRenewalGrowthOpportunity.id == item_id,
            FactoryRenewalGrowthOpportunity.project_id == project_id,
        ))
        if not item:
            raise KeyError("Renewal opportunity not found in this tenant plan")
        return item

    async def _evidence(self, item_id: str) -> list[FactoryRenewalGrowthEvidence]:
        return list((await self.db.execute(select(FactoryRenewalGrowthEvidence).where(
            FactoryRenewalGrowthEvidence.opportunity_id == item_id,
        ).order_by(FactoryRenewalGrowthEvidence.created_at))).scalars().all())

    async def _serialized(self, item: FactoryRenewalGrowthOpportunity) -> dict[str, object]:
        await self.db.flush()
        return serialize_opportunity(item, await self._evidence(item.id))

    async def _record(
        self, item: FactoryRenewalGrowthOpportunity, evidence_type: str,
        reference: str, note: str, actor: str,
    ) -> None:
        now = datetime.now(timezone.utc)
        self.db.add(FactoryRenewalGrowthEvidence(
            id=f"renewal-evidence-{secrets.token_urlsafe(18)}", project_id=item.project_id,
            agent_path=item.agent_path, tenant_id=item.tenant_id,
            client_id=item.client_id, plan_id=item.plan_id,
            evidence_number=f"RENE-{item.project_id}-{now:%Y%m%d%H%M%S}-{secrets.token_hex(3).upper()}",
            opportunity_id=item.id, opportunity_number=item.opportunity_number,
            evidence_type=evidence_type, evidence_reference=reference,
            note=note[:4000], recorded_by=actor,
        ))
        await self.db.flush()

    @staticmethod
    def _required(value: str, label: str) -> str:
        cleaned = value.strip()[:500]
        if not cleaned:
            raise ValueError(f"{label} is required")
        return cleaned

    @staticmethod
    def _guard(
        item: FactoryRenewalGrowthOpportunity, expected_revision: int,
        status: str, label: str,
    ) -> None:
        if item.revision != expected_revision:
            raise ValueError(f"{label} changed; refresh before saving")
        if item.lifecycle_status != status:
            raise ValueError(f"{label} requires {status} status")

    @staticmethod
    def _advance(
        item: FactoryRenewalGrowthOpportunity, action: str,
        reference: str, actor: str,
    ) -> None:
        milestones = _json(item.milestones_json, [])
        milestones.append({
            "action": action, "status": item.lifecycle_status,
            "evidenceReference": reference, "recordedBy": actor,
            "occurredAt": datetime.now(timezone.utc).isoformat(),
        })
        item.milestones_json = json.dumps(milestones, ensure_ascii=False, separators=(",", ":"))
        item.revision += 1
        item.updated_by = actor
