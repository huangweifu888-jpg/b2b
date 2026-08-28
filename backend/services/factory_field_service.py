"""Evidence-led field dispatch, onsite work and customer sign-off workflow."""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
import json
import secrets

from core.tenant_context import TenantContext
from models.factory_customer_asset import FactoryAssetServiceTicket, FactoryCustomerAsset
from models.factory_field_service import FactoryFieldServiceEntry, FactoryFieldServiceTechnician, FactoryFieldServiceVisit
from services.factory_customer_asset import FactoryCustomerAssetService, serialize_asset, serialize_ticket
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


VISIT_TRANSITIONS = {
    "depart": ("dispatched", "en-route"),
    "arrive": ("en-route", "on-site"),
    "start": ("on-site", "in-progress"),
}


def _json(value: str | None, fallback):
    try:
        parsed = json.loads(value or "")
    except (TypeError, ValueError):
        return fallback
    return parsed if isinstance(parsed, type(fallback)) else fallback


def _utc(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def _positive(value: object, label: str) -> Decimal:
    try:
        result = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise ValueError(f"{label} must be a valid number") from exc
    if result <= 0:
        raise ValueError(f"{label} must be positive")
    return result


def serialize_technician(item: FactoryFieldServiceTechnician) -> dict[str, object]:
    return {
        "id": item.id, "project_id": item.project_id, "tenant_id": item.tenant_id,
        "client_id": item.client_id, "plan_id": item.plan_id,
        "technician_number": item.technician_number, "technician_reference": item.technician_reference,
        "technician_name": item.technician_name, "skills": _json(item.skills_json, []),
        "service_regions": _json(item.service_regions_json, []), "lifecycle_status": item.lifecycle_status,
        "approval_reference": item.approval_reference, "approved_by": item.approved_by,
        "approved_at": item.approved_at, "revision": item.revision,
    }


def serialize_entry(item: FactoryFieldServiceEntry) -> dict[str, object]:
    return {
        "id": item.id, "entry_number": item.entry_number, "visit_id": item.visit_id,
        "visit_number": item.visit_number, "entry_type": item.entry_type,
        "description": item.description, "labor_minutes": item.labor_minutes,
        "part_reference": item.part_reference, "quantity": str(item.quantity), "unit": item.unit,
        "stock_evidence_reference": item.stock_evidence_reference,
        "evidence_reference": item.evidence_reference, "recorded_by": item.recorded_by,
        "created_at": item.created_at,
    }


def serialize_visit(item: FactoryFieldServiceVisit, entries: list[FactoryFieldServiceEntry] | None = None) -> dict[str, object]:
    return {
        "id": item.id, "project_id": item.project_id, "tenant_id": item.tenant_id,
        "client_id": item.client_id, "plan_id": item.plan_id, "visit_number": item.visit_number,
        "service_ticket_id": item.service_ticket_id, "service_ticket_number": item.service_ticket_number,
        "asset_id": item.asset_id, "asset_number": item.asset_number,
        "account_reference": item.account_reference, "technician_id": item.technician_id,
        "technician_number": item.technician_number, "technician_name": item.technician_name,
        "scheduled_for": item.scheduled_for, "sla_due_at": item.sla_due_at,
        "sla_status": item.sla_status, "lifecycle_status": item.lifecycle_status,
        "departure_reference": item.departure_reference, "arrival_reference": item.arrival_reference,
        "arrival_location": item.arrival_location, "diagnosis_summary": item.diagnosis_summary,
        "resolution_reference": item.resolution_reference, "resolution_note": item.resolution_note,
        "customer_signer": item.customer_signer,
        "customer_signoff_reference": item.customer_signoff_reference,
        "escalation_reference": item.escalation_reference,
        "total_labor_minutes": item.total_labor_minutes,
        "parts_summary": _json(item.parts_summary_json, []),
        "departed_at": item.departed_at, "arrived_at": item.arrived_at,
        "started_at": item.started_at, "completed_at": item.completed_at,
        "milestones": _json(item.milestones_json, []),
        "entries": [serialize_entry(row) for row in entries or []],
        "revision": item.revision, "updated_by": item.updated_by,
        "created_at": item.created_at, "updated_at": item.updated_at,
    }


class FactoryFieldService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.customer_assets = FactoryCustomerAssetService(db)

    async def list_workspace(self, *, project_id: int) -> dict[str, object]:
        assets = (await self.db.execute(select(FactoryCustomerAsset).where(
            FactoryCustomerAsset.project_id == project_id,
            FactoryCustomerAsset.status != "retired",
        ).order_by(FactoryCustomerAsset.created_at.desc()))).scalars().all()
        tickets = (await self.db.execute(select(FactoryAssetServiceTicket).where(
            FactoryAssetServiceTicket.project_id == project_id,
        ).order_by(FactoryAssetServiceTicket.created_at.desc()))).scalars().all()
        technicians = (await self.db.execute(select(FactoryFieldServiceTechnician).where(
            FactoryFieldServiceTechnician.project_id == project_id,
        ).order_by(FactoryFieldServiceTechnician.created_at.desc()))).scalars().all()
        visits = (await self.db.execute(select(FactoryFieldServiceVisit).where(
            FactoryFieldServiceVisit.project_id == project_id,
        ).order_by(FactoryFieldServiceVisit.created_at.desc()))).scalars().all()
        entries = (await self.db.execute(select(FactoryFieldServiceEntry).where(
            FactoryFieldServiceEntry.project_id == project_id,
        ).order_by(FactoryFieldServiceEntry.created_at))).scalars().all()
        entry_map: dict[str, list[FactoryFieldServiceEntry]] = {}
        for row in entries:
            entry_map.setdefault(row.visit_id, []).append(row)
        return {
            "assets": [serialize_asset(row) for row in assets],
            "tickets": [serialize_ticket(row) for row in tickets],
            "technicians": [serialize_technician(row) for row in technicians],
            "visits": [serialize_visit(row, entry_map.get(row.id)) for row in visits],
        }

    async def create_ticket(
        self, asset_id: str, *, project_id: int, context: TenantContext, actor: str,
        issue_summary: str, severity: str,
    ) -> dict[str, object]:
        return await self.customer_assets.create_ticket(
            asset_id, project_id=project_id, context=context, actor=actor,
            issue_summary=issue_summary, severity=severity,
        )

    async def create_technician(
        self, *, project_id: int, context: TenantContext, actor: str,
        technician_reference: str, technician_name: str,
        skills: list[str], service_regions: list[str],
    ) -> dict[str, object]:
        reference = technician_reference.strip()[:255]
        name = technician_name.strip()[:500]
        clean_skills = list(dict.fromkeys(str(row).strip()[:255] for row in skills if str(row).strip()))
        clean_regions = list(dict.fromkeys(str(row).strip()[:255] for row in service_regions if str(row).strip()))
        if not reference or not name or not clean_skills or not clean_regions:
            raise ValueError("Field technicians require identity, skills and service regions")
        duplicate = await self.db.scalar(select(FactoryFieldServiceTechnician.id).where(
            FactoryFieldServiceTechnician.tenant_id == context.tenant_id,
            FactoryFieldServiceTechnician.technician_reference == reference,
        ))
        if duplicate:
            raise ValueError("Technician reference already exists in this tenant")
        now = datetime.now(timezone.utc)
        item = FactoryFieldServiceTechnician(
            id=f"field-technician-{secrets.token_urlsafe(18)}", project_id=project_id,
            agent_path=context.agent_path, tenant_id=context.tenant_id, client_id=context.client_id,
            plan_id=context.plan_id or f"plan-{project_id}",
            technician_number=f"TECH-{project_id}-{now:%Y%m%d%H%M%S}-{secrets.token_hex(3).upper()}",
            technician_reference=reference, technician_name=name,
            skills_json=json.dumps(clean_skills, ensure_ascii=False, separators=(",", ":")),
            service_regions_json=json.dumps(clean_regions, ensure_ascii=False, separators=(",", ":")),
            updated_by=actor,
        )
        self.db.add(item)
        await self.db.flush()
        return serialize_technician(item)

    async def approve_technician(
        self, technician_id: str, *, project_id: int, expected_revision: int,
        actor: str, approval_reference: str,
    ) -> dict[str, object]:
        item = await self._technician(technician_id, project_id)
        self._require_revision(item.revision, expected_revision, "Field technician")
        evidence = approval_reference.strip()[:500]
        if item.lifecycle_status != "draft" or not evidence:
            raise ValueError("Only a draft technician with approval evidence can be approved")
        item.lifecycle_status = "approved"
        item.approval_reference = evidence
        item.approved_by = actor
        item.approved_at = datetime.now(timezone.utc)
        item.revision += 1
        item.updated_by = actor
        await self.db.flush()
        return serialize_technician(item)

    async def dispatch(
        self, ticket_id: str, *, project_id: int, context: TenantContext, actor: str,
        technician_id: str, scheduled_for: datetime, escalation_reference: str | None = None,
    ) -> dict[str, object]:
        ticket = await self._ticket(ticket_id, project_id)
        technician = await self._technician(technician_id, project_id)
        if ticket.status != "open" or technician.lifecycle_status != "approved":
            raise ValueError("Dispatch requires an open service ticket and approved technician")
        duplicate = await self.db.scalar(select(FactoryFieldServiceVisit.id).where(
            FactoryFieldServiceVisit.tenant_id == context.tenant_id,
            FactoryFieldServiceVisit.service_ticket_id == ticket.id,
        ))
        if duplicate:
            raise ValueError("This service ticket already has a field-service visit")
        scheduled = _utc(scheduled_for)
        now = datetime.now(timezone.utc)
        escalation = (escalation_reference or "").strip()[:500] or None
        if scheduled <= now:
            raise ValueError("Field-service schedule must be in the future")
        if scheduled > _utc(ticket.sla_due_at) and not escalation:
            raise ValueError("A dispatch scheduled beyond SLA requires an escalation reference")
        transition = await self.customer_assets.transition_ticket(
            ticket.id, project_id=project_id, expected_revision=ticket.revision, actor=actor,
            action="schedule", assigned_to=technician.technician_reference,
            scheduled_for=scheduled,
        )
        asset = await self._asset(ticket.asset_id, project_id)
        created = datetime.now(timezone.utc)
        visit = FactoryFieldServiceVisit(
            id=f"field-visit-{secrets.token_urlsafe(18)}", project_id=project_id,
            agent_path=context.agent_path, tenant_id=context.tenant_id, client_id=context.client_id,
            plan_id=context.plan_id or f"plan-{project_id}",
            visit_number=f"VISIT-{project_id}-{created:%Y%m%d%H%M%S}-{secrets.token_hex(3).upper()}",
            service_ticket_id=ticket.id, service_ticket_number=ticket.ticket_number,
            asset_id=asset.id, asset_number=asset.asset_number, account_reference=asset.account_reference,
            technician_id=technician.id, technician_number=technician.technician_number,
            technician_name=technician.technician_name, scheduled_for=scheduled,
            sla_due_at=ticket.sla_due_at, escalation_reference=escalation, updated_by=actor,
        )
        self._milestone(visit, "dispatch", technician.technician_number, actor)
        self.db.add(visit)
        await self.db.flush()
        return {"visit": serialize_visit(visit, []), **transition}

    async def transition_visit(
        self, visit_id: str, *, project_id: int, expected_revision: int, actor: str,
        action: str, evidence_reference: str, arrival_location: str | None = None,
    ) -> dict[str, object]:
        visit = await self._visit(visit_id, project_id)
        self._require_revision(visit.revision, expected_revision, "Field-service visit")
        transition = VISIT_TRANSITIONS.get(action)
        evidence = evidence_reference.strip()[:500]
        if not transition or visit.lifecycle_status != transition[0] or not evidence:
            raise ValueError("Field-service visit must advance dispatch, travel, arrival and work in order")
        now = datetime.now(timezone.utc)
        ticket = await self._ticket(visit.service_ticket_id, project_id)
        asset = await self._asset(visit.asset_id, project_id)
        ticket_result = serialize_ticket(ticket)
        if action == "depart":
            visit.departure_reference = evidence
            visit.departed_at = now
        elif action == "arrive":
            location = (arrival_location or "").strip()[:500]
            if not location:
                raise ValueError("Arrival requires a verified customer location")
            visit.arrival_reference = evidence
            visit.arrival_location = location
            visit.arrived_at = now
        elif action == "start":
            result = await self.customer_assets.transition_ticket(
                ticket.id, project_id=project_id, expected_revision=ticket.revision,
                actor=actor, action="start",
            )
            ticket_result = result["ticket"]
            asset = await self._asset(visit.asset_id, project_id)
            visit.started_at = now
        visit.lifecycle_status = transition[1]
        self._milestone(visit, action, evidence, actor)
        visit.revision += 1
        visit.updated_by = actor
        await self.db.flush()
        return {"visit": await self._serialized_visit(visit), "ticket": ticket_result, "asset": serialize_asset(asset)}

    async def add_entry(
        self, visit_id: str, *, project_id: int, context: TenantContext, actor: str,
        entry_type: str, description: str, evidence_reference: str,
        labor_minutes: int = 0, part_reference: str | None = None,
        quantity: Decimal = Decimal("0"), unit: str | None = None,
        stock_evidence_reference: str | None = None,
    ) -> dict[str, object]:
        visit = await self._visit(visit_id, project_id)
        if visit.lifecycle_status != "in-progress":
            raise ValueError("Field work entries require an in-progress onsite visit")
        kind = entry_type.strip().lower()
        note = description.strip()
        evidence = evidence_reference.strip()[:500]
        if kind not in {"diagnostic", "labor", "part"} or len(note) < 8 or not evidence:
            raise ValueError("Work entry requires type, detailed description and evidence")
        part = (part_reference or "").strip()[:255] or None
        stock = (stock_evidence_reference or "").strip()[:500] or None
        clean_unit = (unit or "").strip()[:50] or None
        clean_quantity = Decimal("0")
        clean_minutes = 0
        if kind == "labor":
            if labor_minutes <= 0:
                raise ValueError("Labor entry requires positive work minutes")
            clean_minutes = labor_minutes
        elif kind == "part":
            clean_quantity = _positive(quantity, "Part quantity")
            if not part or not stock or not clean_unit:
                raise ValueError("Part entry requires part, quantity, unit and stock evidence")
        now = datetime.now(timezone.utc)
        item = FactoryFieldServiceEntry(
            id=f"field-entry-{secrets.token_urlsafe(18)}", project_id=project_id,
            agent_path=context.agent_path, tenant_id=context.tenant_id, client_id=context.client_id,
            plan_id=context.plan_id or f"plan-{project_id}",
            entry_number=f"FSE-{project_id}-{now:%Y%m%d%H%M%S}-{secrets.token_hex(3).upper()}",
            visit_id=visit.id, visit_number=visit.visit_number, entry_type=kind,
            description=note[:4000], labor_minutes=clean_minutes, part_reference=part,
            quantity=clean_quantity, unit=clean_unit, stock_evidence_reference=stock,
            evidence_reference=evidence, recorded_by=actor,
        )
        self.db.add(item)
        if kind == "diagnostic":
            visit.diagnosis_summary = note[:4000]
        elif kind == "labor":
            visit.total_labor_minutes += clean_minutes
        elif kind == "part":
            parts = _json(visit.parts_summary_json, [])
            parts.append({"part_reference": part, "quantity": str(clean_quantity), "unit": clean_unit, "stock_evidence_reference": stock})
            visit.parts_summary_json = json.dumps(parts, ensure_ascii=False, separators=(",", ":"))
        self._milestone(visit, f"entry-{kind}", evidence, actor)
        visit.revision += 1
        visit.updated_by = actor
        await self.db.flush()
        return {"visit": await self._serialized_visit(visit), "entry": serialize_entry(item)}

    async def complete_visit(
        self, visit_id: str, *, project_id: int, expected_revision: int, actor: str,
        resolution_reference: str, resolution_note: str, customer_signer: str,
        customer_signoff_reference: str, next_service_due_at: datetime,
        escalation_reference: str | None = None,
    ) -> dict[str, object]:
        visit = await self._visit(visit_id, project_id)
        self._require_revision(visit.revision, expected_revision, "Field-service visit")
        if visit.lifecycle_status != "in-progress":
            raise ValueError("Only an in-progress onsite visit can be completed")
        entries = await self._entries(visit.id)
        types = {row.entry_type for row in entries}
        if not {"diagnostic", "labor"}.issubset(types):
            raise ValueError("Customer sign-off requires diagnostic and labor evidence")
        reference = resolution_reference.strip()[:500]
        note = resolution_note.strip()
        signer = customer_signer.strip()[:500]
        signoff = customer_signoff_reference.strip()[:500]
        if not reference or len(note) < 8 or not signer or not signoff:
            raise ValueError("Completion requires resolution evidence and customer sign-off")
        completed = datetime.now(timezone.utc)
        breached = completed > _utc(visit.sla_due_at)
        escalation = (escalation_reference or visit.escalation_reference or "").strip()[:500] or None
        if breached and not escalation:
            raise ValueError("SLA-breached completion requires an escalation reference")
        ticket = await self._ticket(visit.service_ticket_id, project_id)
        result = await self.customer_assets.transition_ticket(
            ticket.id, project_id=project_id, expected_revision=ticket.revision, actor=actor,
            action="resolve", resolution_reference=reference, resolution_note=note,
            next_service_due_at=next_service_due_at,
        )
        visit.lifecycle_status = "completed"
        visit.sla_status = "breached" if breached else "met"
        visit.resolution_reference = reference
        visit.resolution_note = note[:4000]
        visit.customer_signer = signer
        visit.customer_signoff_reference = signoff
        visit.escalation_reference = escalation
        visit.completed_at = completed
        self._milestone(visit, "customer-signoff", signoff, actor)
        visit.revision += 1
        visit.updated_by = actor
        await self.db.flush()
        return {"visit": serialize_visit(visit, entries), **result}

    async def _technician(self, item_id: str, project_id: int) -> FactoryFieldServiceTechnician:
        item = await self.db.scalar(select(FactoryFieldServiceTechnician).where(
            FactoryFieldServiceTechnician.id == item_id,
            FactoryFieldServiceTechnician.project_id == project_id,
        ))
        if not item:
            raise KeyError("Field technician not found in this tenant plan")
        return item

    async def _visit(self, item_id: str, project_id: int) -> FactoryFieldServiceVisit:
        item = await self.db.scalar(select(FactoryFieldServiceVisit).where(
            FactoryFieldServiceVisit.id == item_id,
            FactoryFieldServiceVisit.project_id == project_id,
        ))
        if not item:
            raise KeyError("Field-service visit not found in this tenant plan")
        return item

    async def _ticket(self, item_id: str, project_id: int) -> FactoryAssetServiceTicket:
        item = await self.db.scalar(select(FactoryAssetServiceTicket).where(
            FactoryAssetServiceTicket.id == item_id,
            FactoryAssetServiceTicket.project_id == project_id,
        ))
        if not item:
            raise KeyError("Service ticket not found in this tenant plan")
        return item

    async def _asset(self, item_id: str, project_id: int) -> FactoryCustomerAsset:
        item = await self.db.scalar(select(FactoryCustomerAsset).where(
            FactoryCustomerAsset.id == item_id,
            FactoryCustomerAsset.project_id == project_id,
        ))
        if not item:
            raise KeyError("Customer asset not found in this tenant plan")
        return item

    async def _entries(self, visit_id: str) -> list[FactoryFieldServiceEntry]:
        return list((await self.db.execute(select(FactoryFieldServiceEntry).where(
            FactoryFieldServiceEntry.visit_id == visit_id,
        ).order_by(FactoryFieldServiceEntry.created_at))).scalars().all())

    async def _serialized_visit(self, visit: FactoryFieldServiceVisit) -> dict[str, object]:
        return serialize_visit(visit, await self._entries(visit.id))

    @staticmethod
    def _milestone(visit: FactoryFieldServiceVisit, action: str, evidence: str, actor: str) -> None:
        values = _json(visit.milestones_json, [])
        values.append({"action": action, "status": visit.lifecycle_status, "evidenceReference": evidence, "recordedBy": actor, "occurredAt": datetime.now(timezone.utc).isoformat()})
        visit.milestones_json = json.dumps(values, ensure_ascii=False, separators=(",", ":"))

    @staticmethod
    def _require_revision(actual: int, expected: int, label: str) -> None:
        if actual != expected:
            raise ValueError(f"{label} changed; refresh before saving")
