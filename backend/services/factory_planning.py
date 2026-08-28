"""Order-led MRP and finite-capacity production planning workflow."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation, ROUND_CEILING
import json
import secrets

from core.tenant_context import TenantContext
from models.factory_fulfillment import FactoryFulfillmentOrder
from models.factory_planning import FactoryPlanningResource, FactoryProductionPlan
from models.factory_procurement import FactoryPurchaseOrder
from models.factory_product_passport import FactoryEngineeringVersion
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


ELIGIBLE_DEMAND_STATUSES = ("confirmed", "allocated", "in-production", "production-completed", "quality-released", "shipped", "delivered")
PLAN_TRANSITIONS = {"submit": ("draft", "pending-review"), "approve": ("pending-review", "approved"), "release": ("approved", "released")}


def _json(value: str | None, fallback):
    try:
        parsed = json.loads(value or "")
    except (TypeError, ValueError):
        return fallback
    return parsed if isinstance(parsed, type(fallback)) else fallback


def _decimal(value: object, label: str) -> Decimal:
    try:
        result = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise ValueError(f"{label} must be a valid number") from exc
    if result <= 0:
        raise ValueError(f"{label} must be positive")
    return result


def _utc(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def _add_working_days(start: datetime, days: int) -> datetime:
    cursor = start
    remaining = days
    while remaining > 0:
        cursor += timedelta(days=1)
        if cursor.weekday() < 5:
            remaining -= 1
    return cursor


def serialize_resource(item: FactoryPlanningResource) -> dict[str, object]:
    return {
        "id": item.id, "project_id": item.project_id, "tenant_id": item.tenant_id,
        "client_id": item.client_id, "plan_id": item.plan_id, "resource_number": item.resource_number,
        "resource_reference": item.resource_reference, "resource_name": item.resource_name,
        "daily_capacity": str(item.daily_capacity), "shift_hours": str(item.shift_hours),
        "efficiency_percent": str(item.efficiency_percent),
        "calendar_evidence_reference": item.calendar_evidence_reference,
        "lifecycle_status": item.lifecycle_status, "approval_reference": item.approval_reference,
        "approval_note": item.approval_note, "approved_by": item.approved_by,
        "approved_at": item.approved_at, "revision": item.revision,
        "updated_by": item.updated_by, "created_at": item.created_at, "updated_at": item.updated_at,
    }


def serialize_plan(item: FactoryProductionPlan) -> dict[str, object]:
    return {
        "id": item.id, "project_id": item.project_id, "tenant_id": item.tenant_id,
        "client_id": item.client_id, "plan_id": item.plan_id,
        "production_plan_number": item.production_plan_number,
        "demand_order_id": item.demand_order_id, "demand_order_number": item.demand_order_number,
        "engineering_version_id": item.engineering_version_id, "engineering_number": item.engineering_number,
        "product_reference": item.product_reference, "sku_reference": item.sku_reference,
        "demand_quantity": str(item.demand_quantity), "resource_id": item.resource_id,
        "resource_number": item.resource_number, "effective_daily_capacity": str(item.effective_daily_capacity),
        "capacity_days": item.capacity_days, "planned_start_at": item.planned_start_at,
        "planned_end_at": item.planned_end_at, "due_at": item.due_at,
        "material_requirements": _json(item.material_requirements_json, []),
        "shortages": _json(item.shortage_json, []),
        "material_readiness_status": item.material_readiness_status,
        "schedule_status": item.schedule_status, "lifecycle_status": item.lifecycle_status,
        "review_note": item.review_note, "approval_reference": item.approval_reference,
        "release_reference": item.release_reference,
        "work_order_intent_reference": item.work_order_intent_reference,
        "milestones": _json(item.milestones_json, []), "revision": item.revision,
        "updated_by": item.updated_by, "created_at": item.created_at, "updated_at": item.updated_at,
    }


class FactoryPlanningService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_workspace(self, *, project_id: int) -> dict[str, object]:
        resources = (await self.db.execute(select(FactoryPlanningResource).where(
            FactoryPlanningResource.project_id == project_id,
        ).order_by(FactoryPlanningResource.created_at.desc()))).scalars().all()
        plans = (await self.db.execute(select(FactoryProductionPlan).where(
            FactoryProductionPlan.project_id == project_id,
        ).order_by(FactoryProductionPlan.created_at.desc()))).scalars().all()
        engineering = (await self.db.execute(select(FactoryEngineeringVersion).where(
            FactoryEngineeringVersion.project_id == project_id,
            FactoryEngineeringVersion.lifecycle_status == "released",
        ).order_by(FactoryEngineeringVersion.created_at.desc()))).scalars().all()
        orders = (await self.db.execute(select(FactoryFulfillmentOrder).where(
            FactoryFulfillmentOrder.project_id == project_id,
            FactoryFulfillmentOrder.status.in_(ELIGIBLE_DEMAND_STATUSES),
        ).order_by(FactoryFulfillmentOrder.created_at.desc()))).scalars().all()
        return {
            "resources": [serialize_resource(item) for item in resources],
            "production_plans": [serialize_plan(item) for item in plans],
            "released_engineering_versions": [{
                "id": item.id, "engineering_number": item.engineering_number,
                "engineering_version": item.engineering_version, "product_reference": item.product_reference,
                "sku_reference": item.sku_reference, "bom_components": _json(item.bom_components_json, []),
            } for item in engineering],
            "eligible_demand_orders": [{
                "id": item.id, "order_number": item.order_number, "status": item.status,
                "lines": _json(item.lines_json, []),
            } for item in orders],
        }

    async def create_resource(
        self, *, project_id: int, context: TenantContext, actor: str, resource_reference: str,
        resource_name: str, daily_capacity: Decimal, shift_hours: Decimal,
        efficiency_percent: Decimal, calendar_evidence_reference: str,
    ) -> dict[str, object]:
        reference = resource_reference.strip()[:255]
        name = resource_name.strip()[:500]
        evidence = calendar_evidence_reference.strip()[:500]
        capacity = _decimal(daily_capacity, "Daily capacity")
        hours = _decimal(shift_hours, "Shift hours")
        efficiency = _decimal(efficiency_percent, "Efficiency percent")
        if not reference or not name or not evidence or hours > 24 or efficiency > 100:
            raise ValueError("Resource identity, calendar, shift hours and efficiency are invalid")
        duplicate = await self.db.scalar(select(FactoryPlanningResource.id).where(
            FactoryPlanningResource.tenant_id == context.tenant_id,
            FactoryPlanningResource.resource_reference == reference,
        ))
        if duplicate:
            raise ValueError("Planning resource reference already exists in this tenant")
        now = datetime.now(timezone.utc)
        item = FactoryPlanningResource(
            id=f"planning-resource-{secrets.token_urlsafe(18)}", project_id=project_id,
            agent_path=context.agent_path, tenant_id=context.tenant_id, client_id=context.client_id,
            plan_id=context.plan_id or f"plan-{project_id}",
            resource_number=f"RES-{project_id}-{now:%Y%m%d%H%M%S}-{secrets.token_hex(3).upper()}",
            resource_reference=reference, resource_name=name, daily_capacity=capacity,
            shift_hours=hours, efficiency_percent=efficiency,
            calendar_evidence_reference=evidence, updated_by=actor,
        )
        self.db.add(item)
        await self.db.flush()
        return serialize_resource(item)

    async def approve_resource(
        self, resource_id: str, *, project_id: int, expected_revision: int, actor: str,
        approval_reference: str, approval_note: str,
    ) -> dict[str, object]:
        item = await self._resource(resource_id, project_id)
        self._require_revision(item.revision, expected_revision, "Planning resource")
        if item.lifecycle_status != "draft":
            raise ValueError("Only a draft planning resource can be approved")
        reference = approval_reference.strip()[:255]
        note = approval_note.strip()
        if not reference or len(note) < 8:
            raise ValueError("Resource approval requires evidence and a review note")
        item.lifecycle_status = "approved"
        item.approval_reference = reference
        item.approval_note = note
        item.approved_by = actor
        item.approved_at = datetime.now(timezone.utc)
        item.revision += 1
        item.updated_by = actor
        await self.db.flush()
        return serialize_resource(item)

    async def create_plan(
        self, *, project_id: int, context: TenantContext, actor: str, demand_order_id: str,
        engineering_version_id: str, resource_id: str, due_at: datetime,
    ) -> dict[str, object]:
        resource = await self._resource(resource_id, project_id)
        if resource.lifecycle_status != "approved":
            raise ValueError("Production planning requires an approved finite-capacity resource")
        engineering = await self.db.scalar(select(FactoryEngineeringVersion).where(
            FactoryEngineeringVersion.id == engineering_version_id,
            FactoryEngineeringVersion.project_id == project_id,
            FactoryEngineeringVersion.lifecycle_status == "released",
        ))
        if not engineering:
            raise ValueError("Production planning requires a released engineering version")
        order = await self.db.scalar(select(FactoryFulfillmentOrder).where(
            FactoryFulfillmentOrder.id == demand_order_id,
            FactoryFulfillmentOrder.project_id == project_id,
            FactoryFulfillmentOrder.status.in_(ELIGIBLE_DEMAND_STATUSES),
        ))
        if not order:
            raise ValueError("Production planning requires an authoritative confirmed demand order")
        line = next((row for row in _json(order.lines_json, [])
                     if str(row.get("product_reference") or "") == engineering.product_reference
                     and str(row.get("sku_reference") or "") == engineering.sku_reference), None)
        if not line:
            raise ValueError("Engineering product and SKU must match the demand order line")
        duplicate = await self.db.scalar(select(FactoryProductionPlan.id).where(
            FactoryProductionPlan.project_id == project_id,
            FactoryProductionPlan.demand_order_id == order.id,
            FactoryProductionPlan.engineering_version_id == engineering.id,
            FactoryProductionPlan.lifecycle_status != "cancelled",
        ))
        if duplicate:
            raise ValueError("This demand and engineering version already has an active production plan")
        demand_quantity = _decimal(line.get("quantity"), "Demand quantity")
        target_due = _utc(due_at)
        if target_due <= datetime.now(timezone.utc):
            raise ValueError("Production plan due date must be in the future")
        requirements, shortages = await self._material_snapshot(
            project_id=project_id, demand_order_id=order.id, engineering=engineering,
            demand_quantity=demand_quantity,
        )
        start, end, effective, days = self._schedule(resource, demand_quantity)
        now = datetime.now(timezone.utc)
        item = FactoryProductionPlan(
            id=f"production-plan-{secrets.token_urlsafe(18)}", project_id=project_id,
            agent_path=context.agent_path, tenant_id=context.tenant_id, client_id=context.client_id,
            plan_id=context.plan_id or f"plan-{project_id}",
            production_plan_number=f"PLAN-{project_id}-{now:%Y%m%d%H%M%S}-{secrets.token_hex(3).upper()}",
            demand_order_id=order.id, demand_order_number=order.order_number,
            engineering_version_id=engineering.id, engineering_number=engineering.engineering_number,
            product_reference=engineering.product_reference, sku_reference=engineering.sku_reference,
            demand_quantity=demand_quantity, resource_id=resource.id, resource_number=resource.resource_number,
            effective_daily_capacity=effective, capacity_days=days, planned_start_at=start,
            planned_end_at=end, due_at=target_due,
            material_requirements_json=json.dumps(requirements, ensure_ascii=False, separators=(",", ":")),
            shortage_json=json.dumps(shortages, ensure_ascii=False, separators=(",", ":")),
            material_readiness_status="ready" if not shortages else "shortage",
            schedule_status="on-time" if end <= target_due else "late", updated_by=actor,
        )
        self.db.add(item)
        await self.db.flush()
        return serialize_plan(item)

    async def recalculate_plan(
        self, plan_id: str, *, project_id: int, expected_revision: int, actor: str,
    ) -> dict[str, object]:
        item = await self._plan(plan_id, project_id)
        self._require_revision(item.revision, expected_revision, "Production plan")
        if item.lifecycle_status not in {"draft", "pending-review", "approved"}:
            raise ValueError("Only an unreleased plan can be recalculated")
        engineering = await self.db.scalar(select(FactoryEngineeringVersion).where(
            FactoryEngineeringVersion.id == item.engineering_version_id,
            FactoryEngineeringVersion.project_id == project_id,
            FactoryEngineeringVersion.lifecycle_status == "released",
        ))
        resource = await self._resource(item.resource_id, project_id)
        if not engineering or resource.lifecycle_status != "approved":
            raise ValueError("Recalculation requires the released engineering version and approved resource")
        requirements, shortages = await self._material_snapshot(
            project_id=project_id, demand_order_id=item.demand_order_id,
            engineering=engineering, demand_quantity=Decimal(item.demand_quantity),
        )
        start, end, effective, days = self._schedule(resource, Decimal(item.demand_quantity))
        item.material_requirements_json = json.dumps(requirements, ensure_ascii=False, separators=(",", ":"))
        item.shortage_json = json.dumps(shortages, ensure_ascii=False, separators=(",", ":"))
        item.material_readiness_status = "ready" if not shortages else "shortage"
        item.planned_start_at = start
        item.planned_end_at = end
        item.effective_daily_capacity = effective
        item.capacity_days = days
        item.schedule_status = "on-time" if end <= _utc(item.due_at) else "late"
        item.lifecycle_status = "draft"
        item.review_note = None
        item.approval_reference = None
        item.revision += 1
        item.updated_by = actor
        await self.db.flush()
        return serialize_plan(item)

    async def transition_plan(
        self, plan_id: str, *, project_id: int, expected_revision: int, actor: str,
        action: str, note: str | None = None, approval_reference: str | None = None,
        release_reference: str | None = None,
    ) -> dict[str, object]:
        item = await self._plan(plan_id, project_id)
        self._require_revision(item.revision, expected_revision, "Production plan")
        transition = PLAN_TRANSITIONS.get(action)
        if not transition:
            raise ValueError("Unsupported production-plan action")
        expected, target = transition
        if item.lifecycle_status != expected:
            raise ValueError(f"Production-plan action {action} requires status {expected}")
        clean_note = (note or "").strip()
        evidence = ""
        if action == "submit":
            if len(clean_note) < 8:
                raise ValueError("Production-plan review requires assumptions and a review note")
            item.review_note = clean_note
            evidence = "planning-review"
        elif action == "approve":
            evidence = (approval_reference or "").strip()[:255]
            if not evidence or len(clean_note) < 8:
                raise ValueError("Production-plan approval requires evidence and a review note")
            item.approval_reference = evidence
            item.review_note = clean_note
        elif action == "release":
            evidence = (release_reference or "").strip()[:255]
            if item.material_readiness_status != "ready":
                raise ValueError("Production release is blocked until all BOM material shortages are cleared")
            if item.schedule_status != "on-time":
                raise ValueError("Production release is blocked until finite capacity meets the committed due date")
            if not evidence:
                raise ValueError("Production release requires an authorized release reference")
            item.release_reference = evidence
            item.work_order_intent_reference = f"WOI-{item.production_plan_number}"
        milestones = _json(item.milestones_json, [])
        milestones.append({
            "action": action, "status": target, "evidenceReference": evidence,
            "note": clean_note, "recordedBy": actor, "occurredAt": datetime.now(timezone.utc).isoformat(),
        })
        item.milestones_json = json.dumps(milestones, ensure_ascii=False, separators=(",", ":"))
        item.lifecycle_status = target
        item.revision += 1
        item.updated_by = actor
        await self.db.flush()
        return serialize_plan(item)

    async def _material_snapshot(
        self, *, project_id: int, demand_order_id: str,
        engineering: FactoryEngineeringVersion, demand_quantity: Decimal,
    ) -> tuple[list[dict[str, object]], list[dict[str, object]]]:
        purchase_orders = (await self.db.execute(select(FactoryPurchaseOrder).where(
            FactoryPurchaseOrder.project_id == project_id,
            FactoryPurchaseOrder.demand_order_id == demand_order_id,
            FactoryPurchaseOrder.engineering_version_id == engineering.id,
            FactoryPurchaseOrder.lifecycle_status == "received",
        ))).scalars().all()
        received: dict[str, Decimal] = {}
        evidence: dict[str, list[str]] = {}
        for purchase_order in purchase_orders:
            for row in _json(purchase_order.received_quantities_json, []):
                reference = str(row.get("material_reference") or "")
                quantity = Decimal(str(row.get("received_quantity") or "0"))
                received[reference] = received.get(reference, Decimal("0")) + quantity
                evidence.setdefault(reference, []).append(str(purchase_order.receiving_reference or ""))
        requirements: list[dict[str, object]] = []
        shortages: list[dict[str, object]] = []
        for component in _json(engineering.bom_components_json, []):
            reference = str(component.get("material_reference") or "").strip()
            if not reference:
                raise ValueError("Released engineering BOM contains an invalid material reference")
            required = demand_quantity * _decimal(component.get("quantity"), f"BOM quantity for {reference}")
            available = received.get(reference, Decimal("0"))
            shortage = max(required - available, Decimal("0"))
            row = {
                "material_reference": reference,
                "material_name": str(component.get("material_name") or reference),
                "required_quantity": str(required), "received_quantity": str(available),
                "shortage_quantity": str(shortage), "unit": str(component.get("unit") or "EA"),
                "receiving_evidence": evidence.get(reference, []),
            }
            requirements.append(row)
            if shortage > 0:
                shortages.append({"material_reference": reference, "shortage_quantity": str(shortage), "unit": row["unit"]})
        if not requirements:
            raise ValueError("Released engineering version requires a non-empty BOM")
        return requirements, shortages

    @staticmethod
    def _schedule(resource: FactoryPlanningResource, demand_quantity: Decimal):
        effective = Decimal(resource.daily_capacity) * Decimal(resource.efficiency_percent) / Decimal("100")
        if effective <= 0:
            raise ValueError("Approved resource has no effective finite capacity")
        days = int((demand_quantity / effective).to_integral_value(rounding=ROUND_CEILING))
        start = datetime.now(timezone.utc)
        end = _add_working_days(start, days)
        return start, end, effective, days

    async def _resource(self, resource_id: str, project_id: int) -> FactoryPlanningResource:
        item = await self.db.scalar(select(FactoryPlanningResource).where(
            FactoryPlanningResource.id == resource_id,
            FactoryPlanningResource.project_id == project_id,
        ))
        if not item:
            raise KeyError("Planning resource not found in this tenant plan")
        return item

    async def _plan(self, plan_id: str, project_id: int) -> FactoryProductionPlan:
        item = await self.db.scalar(select(FactoryProductionPlan).where(
            FactoryProductionPlan.id == plan_id,
            FactoryProductionPlan.project_id == project_id,
        ))
        if not item:
            raise KeyError("Production plan not found in this tenant plan")
        return item

    @staticmethod
    def _require_revision(actual: int, expected: int, label: str) -> None:
        if actual != expected:
            raise ValueError(f"{label} changed; refresh before continuing")
