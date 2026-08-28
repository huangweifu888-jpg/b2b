"""Warranty eligibility, governed returns, inspection and remedy evidence."""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
import json
import secrets

from core.tenant_context import TenantContext
from models.factory_customer_asset import FactoryAssetServiceTicket, FactoryCustomerAsset
from models.factory_warranty_rma import FactoryRmaEvidence, FactoryWarrantyRmaCase
from services.factory_customer_asset import serialize_asset, serialize_ticket
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


REQUESTED_REMEDIES = {"repair", "replace", "refund"}
INSPECTION_RESULTS = {"manufacturing-defect", "customer-damage", "logistics-damage", "no-fault-found"}
DISPOSITIONS = {"repair", "replace", "refund", "reject", "scrap"}
RESPONSIBILITIES = {"manufacturer", "customer", "logistics", "supplier"}


def _utc(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def _json(value: str | None, fallback):
    try:
        parsed = json.loads(value or "")
    except (TypeError, ValueError):
        return fallback
    return parsed if isinstance(parsed, type(fallback)) else fallback


def _money(value: object, label: str) -> Decimal:
    try:
        result = Decimal(str(value)).quantize(Decimal("0.01"))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise ValueError(f"{label} must be a valid monetary amount") from exc
    if result < 0:
        raise ValueError(f"{label} cannot be negative")
    return result


def serialize_evidence(item: FactoryRmaEvidence) -> dict[str, object]:
    return {
        "id": item.id, "evidence_number": item.evidence_number,
        "rma_case_id": item.rma_case_id, "rma_number": item.rma_number,
        "evidence_type": item.evidence_type, "evidence_reference": item.evidence_reference,
        "note": item.note, "recorded_by": item.recorded_by, "created_at": item.created_at,
    }


def serialize_case(item: FactoryWarrantyRmaCase, evidence: list[FactoryRmaEvidence] | None = None) -> dict[str, object]:
    return {
        "id": item.id, "project_id": item.project_id, "tenant_id": item.tenant_id,
        "client_id": item.client_id, "plan_id": item.plan_id, "rma_number": item.rma_number,
        "claim_reference": item.claim_reference, "asset_id": item.asset_id,
        "asset_number": item.asset_number, "service_ticket_id": item.service_ticket_id,
        "service_ticket_number": item.service_ticket_number, "order_id": item.order_id,
        "order_number": item.order_number, "account_reference": item.account_reference,
        "product_reference": item.product_reference, "sku_reference": item.sku_reference,
        "serial_number": item.serial_number, "warranty_until": item.warranty_until,
        "eligibility_status": item.eligibility_status, "claim_summary": item.claim_summary,
        "requested_remedy": item.requested_remedy, "lifecycle_status": item.lifecycle_status,
        "submitted_at": item.submitted_at, "authorization_reference": item.authorization_reference,
        "goodwill_reference": item.goodwill_reference, "return_instructions": item.return_instructions,
        "authorized_by": item.authorized_by, "authorized_at": item.authorized_at,
        "return_shipment_reference": item.return_shipment_reference, "shipped_at": item.shipped_at,
        "warehouse_receipt_reference": item.warehouse_receipt_reference,
        "received_condition": item.received_condition, "received_by": item.received_by,
        "received_at": item.received_at, "inspection_reference": item.inspection_reference,
        "inspection_result": item.inspection_result, "inspection_note": item.inspection_note,
        "quality_evidence_reference": item.quality_evidence_reference,
        "inspected_by": item.inspected_by, "inspected_at": item.inspected_at,
        "disposition": item.disposition, "responsibility": item.responsibility,
        "disposition_approval_reference": item.disposition_approval_reference,
        "currency": item.currency, "estimated_parts_cost": str(item.estimated_parts_cost),
        "estimated_labor_cost": str(item.estimated_labor_cost),
        "estimated_logistics_cost": str(item.estimated_logistics_cost),
        "estimated_total_cost": str(item.estimated_total_cost),
        "finance_followup_reference": item.finance_followup_reference,
        "supplier_recovery_reference": item.supplier_recovery_reference,
        "disposition_by": item.disposition_by, "disposition_at": item.disposition_at,
        "remedy_evidence_reference": item.remedy_evidence_reference,
        "customer_acknowledgement_reference": item.customer_acknowledgement_reference,
        "closed_by": item.closed_by, "closed_at": item.closed_at,
        "milestones": _json(item.milestones_json, []),
        "evidence": [serialize_evidence(row) for row in evidence or []],
        "revision": item.revision, "updated_by": item.updated_by,
        "created_at": item.created_at, "updated_at": item.updated_at,
    }


class FactoryWarrantyRmaService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_workspace(self, *, project_id: int) -> dict[str, object]:
        assets = (await self.db.execute(select(FactoryCustomerAsset).where(
            FactoryCustomerAsset.project_id == project_id,
            FactoryCustomerAsset.status != "retired",
        ).order_by(FactoryCustomerAsset.created_at.desc()))).scalars().all()
        tickets = (await self.db.execute(select(FactoryAssetServiceTicket).where(
            FactoryAssetServiceTicket.project_id == project_id,
            FactoryAssetServiceTicket.status == "resolved",
        ).order_by(FactoryAssetServiceTicket.created_at.desc()))).scalars().all()
        cases = (await self.db.execute(select(FactoryWarrantyRmaCase).where(
            FactoryWarrantyRmaCase.project_id == project_id,
        ).order_by(FactoryWarrantyRmaCase.created_at.desc()))).scalars().all()
        evidence = (await self.db.execute(select(FactoryRmaEvidence).where(
            FactoryRmaEvidence.project_id == project_id,
        ).order_by(FactoryRmaEvidence.created_at))).scalars().all()
        evidence_map: dict[str, list[FactoryRmaEvidence]] = {}
        for row in evidence:
            evidence_map.setdefault(row.rma_case_id, []).append(row)
        return {
            "assets": [serialize_asset(row) for row in assets],
            "resolved_tickets": [serialize_ticket(row) for row in tickets],
            "cases": [serialize_case(row, evidence_map.get(row.id)) for row in cases],
        }

    async def create_case(
        self, *, project_id: int, context: TenantContext, actor: str,
        asset_id: str, service_ticket_id: str, claim_reference: str,
        claim_summary: str, requested_remedy: str,
    ) -> dict[str, object]:
        asset = await self._asset(asset_id, project_id)
        ticket = await self._ticket(service_ticket_id, project_id)
        if ticket.asset_id != asset.id or ticket.status != "resolved":
            raise ValueError("RMA requires a resolved service ticket for the same customer asset")
        duplicate = await self.db.scalar(select(FactoryWarrantyRmaCase.id).where(
            FactoryWarrantyRmaCase.tenant_id == context.tenant_id,
            FactoryWarrantyRmaCase.service_ticket_id == ticket.id,
        ))
        if duplicate:
            raise ValueError("This resolved service ticket already has an RMA case")
        reference = claim_reference.strip()[:255]
        summary = claim_summary.strip()
        remedy = requested_remedy.strip().lower()
        if not reference or len(summary) < 8 or remedy not in REQUESTED_REMEDIES:
            raise ValueError("RMA claim requires reference, detailed issue and requested remedy")
        repeated_reference = await self.db.scalar(select(FactoryWarrantyRmaCase.id).where(
            FactoryWarrantyRmaCase.tenant_id == context.tenant_id,
            FactoryWarrantyRmaCase.claim_reference == reference,
        ))
        if repeated_reference:
            raise ValueError("Claim reference already exists in this tenant")
        now = datetime.now(timezone.utc)
        item = FactoryWarrantyRmaCase(
            id=f"rma-{secrets.token_urlsafe(18)}", project_id=project_id,
            agent_path=context.agent_path, tenant_id=context.tenant_id, client_id=context.client_id,
            plan_id=context.plan_id or f"plan-{project_id}",
            rma_number=f"RMA-{project_id}-{now:%Y%m%d%H%M%S}-{secrets.token_hex(3).upper()}",
            claim_reference=reference, asset_id=asset.id, asset_number=asset.asset_number,
            service_ticket_id=ticket.id, service_ticket_number=ticket.ticket_number,
            order_id=asset.order_id, order_number=asset.order_number,
            account_reference=asset.account_reference, product_reference=asset.product_reference,
            sku_reference=asset.sku_reference, serial_number=asset.serial_number,
            warranty_until=asset.warranty_until, claim_summary=summary[:4000],
            requested_remedy=remedy, updated_by=actor,
        )
        self.db.add(item)
        await self.db.flush()
        return serialize_case(item, [])

    async def submit_case(
        self, case_id: str, *, project_id: int, expected_revision: int,
        actor: str, submission_reference: str,
    ) -> dict[str, object]:
        item = await self._case(case_id, project_id)
        self._guard(item, expected_revision, "draft", "RMA submission")
        evidence = self._required(submission_reference, "Submission evidence")
        now = datetime.now(timezone.utc)
        item.eligibility_status = "eligible" if now <= _utc(item.warranty_until) else "expired"
        item.lifecycle_status = "pending-review"
        item.submitted_at = now
        await self._record(item, "claim-submission", evidence, item.claim_summary, actor)
        self._advance(item, "submit", evidence, actor)
        return await self._serialized_case(item)

    async def authorize_case(
        self, case_id: str, *, project_id: int, expected_revision: int, actor: str,
        authorization_reference: str, return_instructions: str,
        goodwill_reference: str | None = None,
    ) -> dict[str, object]:
        item = await self._case(case_id, project_id)
        self._guard(item, expected_revision, "pending-review", "RMA authorization")
        reference = self._required(authorization_reference, "Authorization evidence")
        instructions = return_instructions.strip()
        goodwill = (goodwill_reference or "").strip()[:500] or None
        if len(instructions) < 8:
            raise ValueError("RMA authorization requires detailed return instructions")
        if item.eligibility_status == "expired" and not goodwill:
            raise ValueError("Expired warranty requires a goodwill authorization reference")
        item.lifecycle_status = "authorized"
        item.authorization_reference = reference
        item.goodwill_reference = goodwill
        item.return_instructions = instructions[:4000]
        item.authorized_by = actor
        item.authorized_at = datetime.now(timezone.utc)
        await self._record(item, "authorization", reference, instructions, actor)
        self._advance(item, "authorize", reference, actor)
        return await self._serialized_case(item)

    async def ship_return(
        self, case_id: str, *, project_id: int, expected_revision: int,
        actor: str, return_shipment_reference: str,
    ) -> dict[str, object]:
        item = await self._case(case_id, project_id)
        self._guard(item, expected_revision, "authorized", "RMA return shipment")
        reference = self._required(return_shipment_reference, "Return shipment evidence")
        item.lifecycle_status = "return-in-transit"
        item.return_shipment_reference = reference
        item.shipped_at = datetime.now(timezone.utc)
        await self._record(item, "return-shipment", reference, "Customer handed the authorized return to the carrier", actor)
        self._advance(item, "ship-return", reference, actor)
        return await self._serialized_case(item)

    async def receive_return(
        self, case_id: str, *, project_id: int, expected_revision: int, actor: str,
        warehouse_receipt_reference: str, received_condition: str,
    ) -> dict[str, object]:
        item = await self._case(case_id, project_id)
        self._guard(item, expected_revision, "return-in-transit", "RMA warehouse receipt")
        reference = self._required(warehouse_receipt_reference, "Warehouse receipt evidence")
        condition = received_condition.strip()
        if len(condition) < 8:
            raise ValueError("Warehouse receipt requires an independent condition record")
        item.lifecycle_status = "received"
        item.warehouse_receipt_reference = reference
        item.received_condition = condition[:4000]
        item.received_by = actor
        item.received_at = datetime.now(timezone.utc)
        await self._record(item, "warehouse-receipt", reference, condition, actor)
        self._advance(item, "receive", reference, actor)
        return await self._serialized_case(item)

    async def inspect_return(
        self, case_id: str, *, project_id: int, expected_revision: int, actor: str,
        inspection_reference: str, inspection_result: str, inspection_note: str,
        quality_evidence_reference: str | None = None,
    ) -> dict[str, object]:
        item = await self._case(case_id, project_id)
        self._guard(item, expected_revision, "received", "RMA inspection")
        reference = self._required(inspection_reference, "Inspection evidence")
        result = inspection_result.strip().lower()
        note = inspection_note.strip()
        quality = (quality_evidence_reference or "").strip()[:500] or None
        if result not in INSPECTION_RESULTS or len(note) < 8:
            raise ValueError("RMA inspection requires classification and detailed findings")
        if result == "manufacturing-defect" and not quality:
            raise ValueError("Manufacturing defect requires an independent QMS evidence reference")
        item.lifecycle_status = "inspected"
        item.inspection_reference = reference
        item.inspection_result = result
        item.inspection_note = note[:4000]
        item.quality_evidence_reference = quality
        item.inspected_by = actor
        item.inspected_at = datetime.now(timezone.utc)
        await self._record(item, "inspection", reference, note, actor)
        self._advance(item, "inspect", reference, actor)
        return await self._serialized_case(item)

    async def approve_disposition(
        self, case_id: str, *, project_id: int, expected_revision: int, actor: str,
        disposition: str, responsibility: str, disposition_approval_reference: str,
        currency: str, estimated_parts_cost: object, estimated_labor_cost: object,
        estimated_logistics_cost: object, finance_followup_reference: str | None = None,
        supplier_recovery_reference: str | None = None,
    ) -> dict[str, object]:
        item = await self._case(case_id, project_id)
        self._guard(item, expected_revision, "inspected", "RMA disposition")
        decision = disposition.strip().lower()
        owner = responsibility.strip().lower()
        approval = self._required(disposition_approval_reference, "Disposition approval")
        clean_currency = currency.strip().upper()
        if decision not in DISPOSITIONS or owner not in RESPONSIBILITIES or len(clean_currency) != 3:
            raise ValueError("RMA disposition requires valid remedy, responsibility and currency")
        if item.inspection_result == "manufacturing-defect" and decision == "reject":
            raise ValueError("A confirmed manufacturing defect cannot be rejected without remedy")
        parts = _money(estimated_parts_cost, "Parts cost")
        labor = _money(estimated_labor_cost, "Labor cost")
        logistics = _money(estimated_logistics_cost, "Logistics cost")
        finance = (finance_followup_reference or "").strip()[:500] or None
        recovery = (supplier_recovery_reference or "").strip()[:500] or None
        if decision == "refund" and not finance:
            raise ValueError("Refund disposition requires a finance follow-up reference")
        if owner == "supplier" and not recovery:
            raise ValueError("Supplier responsibility requires a recovery reference")
        total = parts + labor + logistics
        item.lifecycle_status = "disposition-approved"
        item.disposition = decision
        item.responsibility = owner
        item.disposition_approval_reference = approval
        item.currency = clean_currency
        item.estimated_parts_cost = parts
        item.estimated_labor_cost = labor
        item.estimated_logistics_cost = logistics
        item.estimated_total_cost = total
        item.finance_followup_reference = finance
        item.supplier_recovery_reference = recovery
        item.disposition_by = actor
        item.disposition_at = datetime.now(timezone.utc)
        await self._record(item, "disposition", approval, f"{decision}; responsibility={owner}; estimate={clean_currency} {total}", actor)
        self._advance(item, "approve-disposition", approval, actor)
        return await self._serialized_case(item)

    async def close_case(
        self, case_id: str, *, project_id: int, expected_revision: int, actor: str,
        remedy_evidence_reference: str, customer_acknowledgement_reference: str,
    ) -> dict[str, object]:
        item = await self._case(case_id, project_id)
        self._guard(item, expected_revision, "disposition-approved", "RMA closure")
        remedy = self._required(remedy_evidence_reference, "Remedy evidence")
        acknowledgement = self._required(customer_acknowledgement_reference, "Customer acknowledgement")
        item.lifecycle_status = "closed"
        item.remedy_evidence_reference = remedy
        item.customer_acknowledgement_reference = acknowledgement
        item.closed_by = actor
        item.closed_at = datetime.now(timezone.utc)
        await self._record(item, "remedy", remedy, f"Approved {item.disposition} remedy completed", actor)
        await self._record(item, "customer-acknowledgement", acknowledgement, "Customer acknowledged the RMA outcome", actor)
        self._advance(item, "close", acknowledgement, actor)
        return await self._serialized_case(item)

    async def _asset(self, item_id: str, project_id: int) -> FactoryCustomerAsset:
        item = await self.db.scalar(select(FactoryCustomerAsset).where(
            FactoryCustomerAsset.id == item_id, FactoryCustomerAsset.project_id == project_id,
        ))
        if not item:
            raise KeyError("Customer asset not found in this tenant plan")
        return item

    async def _ticket(self, item_id: str, project_id: int) -> FactoryAssetServiceTicket:
        item = await self.db.scalar(select(FactoryAssetServiceTicket).where(
            FactoryAssetServiceTicket.id == item_id,
            FactoryAssetServiceTicket.project_id == project_id,
        ))
        if not item:
            raise KeyError("Service ticket not found in this tenant plan")
        return item

    async def _case(self, item_id: str, project_id: int) -> FactoryWarrantyRmaCase:
        item = await self.db.scalar(select(FactoryWarrantyRmaCase).where(
            FactoryWarrantyRmaCase.id == item_id,
            FactoryWarrantyRmaCase.project_id == project_id,
        ))
        if not item:
            raise KeyError("RMA case not found in this tenant plan")
        return item

    async def _evidence(self, case_id: str) -> list[FactoryRmaEvidence]:
        return list((await self.db.execute(select(FactoryRmaEvidence).where(
            FactoryRmaEvidence.rma_case_id == case_id,
        ).order_by(FactoryRmaEvidence.created_at))).scalars().all())

    async def _serialized_case(self, item: FactoryWarrantyRmaCase) -> dict[str, object]:
        await self.db.flush()
        return serialize_case(item, await self._evidence(item.id))

    async def _record(
        self, item: FactoryWarrantyRmaCase, evidence_type: str,
        reference: str, note: str, actor: str,
    ) -> None:
        now = datetime.now(timezone.utc)
        evidence = FactoryRmaEvidence(
            id=f"rma-evidence-{secrets.token_urlsafe(18)}", project_id=item.project_id,
            agent_path=item.agent_path, tenant_id=item.tenant_id, client_id=item.client_id,
            plan_id=item.plan_id,
            evidence_number=f"RMAE-{item.project_id}-{now:%Y%m%d%H%M%S}-{secrets.token_hex(3).upper()}",
            rma_case_id=item.id, rma_number=item.rma_number, evidence_type=evidence_type,
            evidence_reference=reference, note=note[:4000], recorded_by=actor,
        )
        self.db.add(evidence)
        await self.db.flush()

    @staticmethod
    def _required(value: str, label: str) -> str:
        cleaned = value.strip()[:500]
        if not cleaned:
            raise ValueError(f"{label} is required")
        return cleaned

    @staticmethod
    def _guard(item: FactoryWarrantyRmaCase, expected_revision: int, status: str, label: str) -> None:
        if item.revision != expected_revision:
            raise ValueError(f"{label} changed; refresh before saving")
        if item.lifecycle_status != status:
            raise ValueError(f"{label} requires {status} status")

    @staticmethod
    def _advance(item: FactoryWarrantyRmaCase, action: str, reference: str, actor: str) -> None:
        milestones = _json(item.milestones_json, [])
        milestones.append({
            "action": action, "status": item.lifecycle_status,
            "evidenceReference": reference, "recordedBy": actor,
            "occurredAt": datetime.now(timezone.utc).isoformat(),
        })
        item.milestones_json = json.dumps(milestones, ensure_ascii=False, separators=(",", ":"))
        item.revision += 1
        item.updated_by = actor
