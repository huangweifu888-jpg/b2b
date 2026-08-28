"""Traceable production work-order and shop-floor execution workflow."""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation, ROUND_CEILING
import json
import secrets

from core.tenant_context import TenantContext
from models.factory_mes import FactoryManufacturingDowntime, FactoryManufacturingOperation, FactoryManufacturingWorkOrder
from models.factory_planning import FactoryProductionPlan
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


def _json(value: str | None, fallback):
    try:
        parsed = json.loads(value or "")
    except (TypeError, ValueError):
        return fallback
    return parsed if isinstance(parsed, type(fallback)) else fallback


def _quantity(value: object, label: str, *, allow_zero: bool = False) -> Decimal:
    try:
        result = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise ValueError(f"{label} must be a valid number") from exc
    if result < 0 or (not allow_zero and result == 0):
        raise ValueError(f"{label} must be {'zero or positive' if allow_zero else 'positive'}")
    return result


def serialize_operation(item: FactoryManufacturingOperation) -> dict[str, object]:
    return {
        "id": item.id, "work_order_id": item.work_order_id, "work_order_number": item.work_order_number,
        "operation_sequence": item.operation_sequence, "operation_code": item.operation_code,
        "operation_name": item.operation_name, "work_center_reference": item.work_center_reference,
        "input_quantity": str(item.input_quantity), "good_quantity": str(item.good_quantity),
        "scrap_quantity": str(item.scrap_quantity), "lifecycle_status": item.lifecycle_status,
        "operator_reference": item.operator_reference, "start_evidence_reference": item.start_evidence_reference,
        "completion_evidence_reference": item.completion_evidence_reference,
        "started_at": item.started_at, "completed_at": item.completed_at, "revision": item.revision,
    }


def serialize_downtime(item: FactoryManufacturingDowntime) -> dict[str, object]:
    return {
        "id": item.id, "downtime_number": item.downtime_number, "work_order_id": item.work_order_id,
        "work_order_number": item.work_order_number, "operation_id": item.operation_id,
        "operation_code": item.operation_code, "reason_code": item.reason_code,
        "reason_note": item.reason_note, "lifecycle_status": item.lifecycle_status,
        "resolution_note": item.resolution_note,
        "resolution_evidence_reference": item.resolution_evidence_reference,
        "duration_minutes": item.duration_minutes, "started_at": item.started_at,
        "resolved_at": item.resolved_at, "revision": item.revision,
    }


def serialize_work_order(
    item: FactoryManufacturingWorkOrder,
    operations: list[FactoryManufacturingOperation] | None = None,
    downtimes: list[FactoryManufacturingDowntime] | None = None,
) -> dict[str, object]:
    return {
        "id": item.id, "project_id": item.project_id, "tenant_id": item.tenant_id,
        "client_id": item.client_id, "plan_id": item.plan_id,
        "work_order_number": item.work_order_number, "production_plan_id": item.production_plan_id,
        "production_plan_number": item.production_plan_number,
        "work_order_intent_reference": item.work_order_intent_reference,
        "demand_order_id": item.demand_order_id, "demand_order_number": item.demand_order_number,
        "engineering_version_id": item.engineering_version_id, "engineering_number": item.engineering_number,
        "product_reference": item.product_reference, "sku_reference": item.sku_reference,
        "resource_id": item.resource_id, "resource_number": item.resource_number,
        "batch_reference": item.batch_reference, "target_quantity": str(item.target_quantity),
        "completed_quantity": str(item.completed_quantity), "scrap_quantity": str(item.scrap_quantity),
        "material_lots": _json(item.material_lots_json, []), "lifecycle_status": item.lifecycle_status,
        "current_operation_code": item.current_operation_code, "release_reference": item.release_reference,
        "completion_reference": item.completion_reference, "started_at": item.started_at,
        "completed_at": item.completed_at, "milestones": _json(item.milestones_json, []),
        "operations": [serialize_operation(row) for row in operations or []],
        "downtimes": [serialize_downtime(row) for row in downtimes or []],
        "revision": item.revision, "updated_by": item.updated_by,
        "created_at": item.created_at, "updated_at": item.updated_at,
    }


class FactoryMesService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_workspace(self, *, project_id: int) -> dict[str, object]:
        plans = (await self.db.execute(select(FactoryProductionPlan).where(
            FactoryProductionPlan.project_id == project_id,
            FactoryProductionPlan.lifecycle_status == "released",
        ).order_by(FactoryProductionPlan.created_at.desc()))).scalars().all()
        work_orders = (await self.db.execute(select(FactoryManufacturingWorkOrder).where(
            FactoryManufacturingWorkOrder.project_id == project_id,
        ).order_by(FactoryManufacturingWorkOrder.created_at.desc()))).scalars().all()
        operations = (await self.db.execute(select(FactoryManufacturingOperation).where(
            FactoryManufacturingOperation.project_id == project_id,
        ).order_by(FactoryManufacturingOperation.operation_sequence))).scalars().all()
        downtimes = (await self.db.execute(select(FactoryManufacturingDowntime).where(
            FactoryManufacturingDowntime.project_id == project_id,
        ).order_by(FactoryManufacturingDowntime.created_at.desc()))).scalars().all()
        operation_map: dict[str, list[FactoryManufacturingOperation]] = {}
        downtime_map: dict[str, list[FactoryManufacturingDowntime]] = {}
        for row in operations:
            operation_map.setdefault(row.work_order_id, []).append(row)
        for row in downtimes:
            downtime_map.setdefault(row.work_order_id, []).append(row)
        work_ordered = {row.production_plan_id for row in work_orders}
        return {
            "released_production_plans": [{
                "id": row.id, "production_plan_number": row.production_plan_number,
                "work_order_intent_reference": row.work_order_intent_reference,
                "demand_order_number": row.demand_order_number, "engineering_number": row.engineering_number,
                "product_reference": row.product_reference, "sku_reference": row.sku_reference,
                "demand_quantity": str(row.demand_quantity), "resource_number": row.resource_number,
                "material_requirements": _json(row.material_requirements_json, []),
                "already_work_ordered": row.id in work_ordered,
            } for row in plans],
            "work_orders": [serialize_work_order(row, operation_map.get(row.id), downtime_map.get(row.id)) for row in work_orders],
        }

    async def create_work_order(
        self, *, project_id: int, context: TenantContext, actor: str, production_plan_id: str,
        batch_reference: str, material_lots: list[dict[str, object]], routing: list[dict[str, object]],
    ) -> dict[str, object]:
        plan = await self.db.scalar(select(FactoryProductionPlan).where(
            FactoryProductionPlan.id == production_plan_id,
            FactoryProductionPlan.project_id == project_id,
            FactoryProductionPlan.lifecycle_status == "released",
        ))
        if not plan or not plan.work_order_intent_reference:
            raise ValueError("MES work orders require a released production-plan work-order intent")
        duplicate = await self.db.scalar(select(FactoryManufacturingWorkOrder.id).where(
            FactoryManufacturingWorkOrder.tenant_id == context.tenant_id,
            FactoryManufacturingWorkOrder.production_plan_id == plan.id,
        ))
        if duplicate:
            raise ValueError("This production plan already has a manufacturing work order")
        batch = batch_reference.strip()[:255]
        if not batch:
            raise ValueError("A controlled manufacturing batch reference is required")
        normalized_lots = self._validate_material_lots(_json(plan.material_requirements_json, []), material_lots)
        normalized_routing = self._validate_routing(routing)
        now = datetime.now(timezone.utc)
        item = FactoryManufacturingWorkOrder(
            id=f"manufacturing-work-order-{secrets.token_urlsafe(18)}", project_id=project_id,
            agent_path=context.agent_path, tenant_id=context.tenant_id, client_id=context.client_id,
            plan_id=context.plan_id or f"plan-{project_id}",
            work_order_number=f"MO-{project_id}-{now:%Y%m%d%H%M%S}-{secrets.token_hex(3).upper()}",
            production_plan_id=plan.id, production_plan_number=plan.production_plan_number,
            work_order_intent_reference=plan.work_order_intent_reference,
            demand_order_id=plan.demand_order_id, demand_order_number=plan.demand_order_number,
            engineering_version_id=plan.engineering_version_id, engineering_number=plan.engineering_number,
            product_reference=plan.product_reference, sku_reference=plan.sku_reference,
            resource_id=plan.resource_id, resource_number=plan.resource_number,
            batch_reference=batch, target_quantity=plan.demand_quantity,
            material_lots_json=json.dumps(normalized_lots, ensure_ascii=False, separators=(",", ":")),
            updated_by=actor,
        )
        self.db.add(item)
        await self.db.flush()
        operations: list[FactoryManufacturingOperation] = []
        for row in normalized_routing:
            operation = FactoryManufacturingOperation(
                id=f"manufacturing-operation-{secrets.token_urlsafe(18)}", project_id=project_id,
                agent_path=context.agent_path, tenant_id=context.tenant_id, client_id=context.client_id,
                plan_id=context.plan_id or f"plan-{project_id}", work_order_id=item.id,
                work_order_number=item.work_order_number, operation_sequence=row["operation_sequence"],
                operation_code=row["operation_code"], operation_name=row["operation_name"],
                work_center_reference=row["work_center_reference"], updated_by=actor,
            )
            self.db.add(operation)
            operations.append(operation)
        await self.db.flush()
        return serialize_work_order(item, operations, [])

    async def transition_work_order(
        self, work_order_id: str, *, project_id: int, expected_revision: int, actor: str,
        action: str, evidence_reference: str,
    ) -> dict[str, object]:
        item = await self._work_order(work_order_id, project_id)
        self._require_revision(item.revision, expected_revision, "Manufacturing work order")
        evidence = evidence_reference.strip()[:500]
        if not evidence:
            raise ValueError("Manufacturing work-order transition requires evidence")
        now = datetime.now(timezone.utc)
        if action == "release":
            if item.lifecycle_status != "draft":
                raise ValueError("Only a draft manufacturing work order can be released")
            if not _json(item.material_lots_json, []):
                raise ValueError("Manufacturing release requires traceable issued material lots")
            item.lifecycle_status = "released"
            item.release_reference = evidence
        elif action == "complete":
            if item.lifecycle_status != "ready-to-complete":
                raise ValueError("All routing operations must complete before the work order closes")
            if Decimal(item.completed_quantity) <= 0:
                raise ValueError("A work order with no good output requires quality disposition instead of completion")
            item.lifecycle_status = "completed"
            item.completion_reference = evidence
            item.completed_at = now
        else:
            raise ValueError("Unsupported manufacturing work-order action")
        self._milestone(item, action, evidence, actor)
        item.revision += 1
        item.updated_by = actor
        await self.db.flush()
        return await self._serialized_work_order(item)

    async def start_operation(
        self, operation_id: str, *, project_id: int, expected_revision: int, actor: str,
        operator_reference: str, evidence_reference: str,
    ) -> dict[str, object]:
        operation = await self._operation(operation_id, project_id)
        self._require_revision(operation.revision, expected_revision, "Manufacturing operation")
        work_order = await self._work_order(operation.work_order_id, project_id)
        if work_order.lifecycle_status not in {"released", "in-progress"} or operation.lifecycle_status != "pending":
            raise ValueError("Operation start requires a released active work order and pending operation")
        active = await self.db.scalar(select(FactoryManufacturingOperation.id).where(
            FactoryManufacturingOperation.work_order_id == work_order.id,
            FactoryManufacturingOperation.lifecycle_status == "in-progress",
        ))
        if active:
            raise ValueError("Only one operation may be active on a manufacturing work order")
        operations = await self._operations(work_order.id)
        index = next(index for index, row in enumerate(operations) if row.id == operation.id)
        if index and operations[index - 1].lifecycle_status != "completed":
            raise ValueError("Manufacturing operations must start in routing sequence")
        input_quantity = Decimal(work_order.target_quantity) if index == 0 else Decimal(operations[index - 1].good_quantity)
        if input_quantity <= 0:
            raise ValueError("Operation has no accepted input quantity")
        operator = operator_reference.strip()[:255]
        evidence = evidence_reference.strip()[:500]
        if not operator or not evidence:
            raise ValueError("Operation start requires operator identity and evidence")
        now = datetime.now(timezone.utc)
        operation.input_quantity = input_quantity
        operation.lifecycle_status = "in-progress"
        operation.operator_reference = operator
        operation.start_evidence_reference = evidence
        operation.started_at = now
        operation.revision += 1
        operation.updated_by = actor
        work_order.lifecycle_status = "in-progress"
        work_order.current_operation_code = operation.operation_code
        work_order.started_at = work_order.started_at or now
        self._milestone(work_order, "operation-started", evidence, actor, operation.operation_code)
        work_order.revision += 1
        work_order.updated_by = actor
        await self.db.flush()
        return await self._serialized_work_order(work_order)

    async def complete_operation(
        self, operation_id: str, *, project_id: int, expected_revision: int, actor: str,
        good_quantity: Decimal, scrap_quantity: Decimal, evidence_reference: str,
    ) -> dict[str, object]:
        operation = await self._operation(operation_id, project_id)
        self._require_revision(operation.revision, expected_revision, "Manufacturing operation")
        work_order = await self._work_order(operation.work_order_id, project_id)
        if operation.lifecycle_status != "in-progress" or work_order.lifecycle_status != "in-progress":
            raise ValueError("Operation completion requires an active, unpaused operation")
        open_downtime = await self.db.scalar(select(FactoryManufacturingDowntime.id).where(
            FactoryManufacturingDowntime.work_order_id == work_order.id,
            FactoryManufacturingDowntime.lifecycle_status == "open",
        ))
        if open_downtime:
            raise ValueError("Resolve the open downtime event before completing the operation")
        good = _quantity(good_quantity, "Good quantity", allow_zero=True)
        scrap = _quantity(scrap_quantity, "Scrap quantity", allow_zero=True)
        if good + scrap != Decimal(operation.input_quantity):
            raise ValueError("Good plus scrap quantity must equal the operation input quantity")
        evidence = evidence_reference.strip()[:500]
        if not evidence:
            raise ValueError("Operation completion requires evidence")
        operation.good_quantity = good
        operation.scrap_quantity = scrap
        operation.completion_evidence_reference = evidence
        operation.lifecycle_status = "completed"
        operation.completed_at = datetime.now(timezone.utc)
        operation.revision += 1
        operation.updated_by = actor
        operations = await self._operations(work_order.id)
        is_final = operations[-1].id == operation.id
        work_order.current_operation_code = None
        if is_final:
            work_order.completed_quantity = good
            work_order.scrap_quantity = Decimal(work_order.target_quantity) - good
            work_order.lifecycle_status = "ready-to-complete"
        self._milestone(work_order, "operation-completed", evidence, actor, operation.operation_code)
        work_order.revision += 1
        work_order.updated_by = actor
        await self.db.flush()
        return await self._serialized_work_order(work_order)

    async def open_downtime(
        self, operation_id: str, *, project_id: int, context: TenantContext, actor: str,
        reason_code: str, reason_note: str,
    ) -> dict[str, object]:
        operation = await self._operation(operation_id, project_id)
        work_order = await self._work_order(operation.work_order_id, project_id)
        if operation.lifecycle_status != "in-progress" or work_order.lifecycle_status != "in-progress":
            raise ValueError("Downtime can only be opened against the active operation")
        duplicate = await self.db.scalar(select(FactoryManufacturingDowntime.id).where(
            FactoryManufacturingDowntime.work_order_id == work_order.id,
            FactoryManufacturingDowntime.lifecycle_status == "open",
        ))
        code = reason_code.strip()[:100]
        note = reason_note.strip()
        if duplicate or not code or len(note) < 8:
            raise ValueError("Only one evidenced downtime may be open for a work order")
        now = datetime.now(timezone.utc)
        item = FactoryManufacturingDowntime(
            id=f"manufacturing-downtime-{secrets.token_urlsafe(18)}", project_id=project_id,
            agent_path=context.agent_path, tenant_id=context.tenant_id, client_id=context.client_id,
            plan_id=context.plan_id or f"plan-{project_id}",
            downtime_number=f"DT-{project_id}-{now:%Y%m%d%H%M%S}-{secrets.token_hex(3).upper()}",
            work_order_id=work_order.id, work_order_number=work_order.work_order_number,
            operation_id=operation.id, operation_code=operation.operation_code,
            reason_code=code, reason_note=note[:2000], started_at=now, updated_by=actor,
        )
        self.db.add(item)
        work_order.lifecycle_status = "paused"
        self._milestone(work_order, "downtime-opened", item.downtime_number, actor, operation.operation_code)
        work_order.revision += 1
        work_order.updated_by = actor
        await self.db.flush()
        return await self._serialized_work_order(work_order)

    async def resolve_downtime(
        self, downtime_id: str, *, project_id: int, expected_revision: int, actor: str,
        resolution_note: str, evidence_reference: str,
    ) -> dict[str, object]:
        item = await self.db.scalar(select(FactoryManufacturingDowntime).where(
            FactoryManufacturingDowntime.id == downtime_id,
            FactoryManufacturingDowntime.project_id == project_id,
        ))
        if not item:
            raise KeyError("Manufacturing downtime not found")
        self._require_revision(item.revision, expected_revision, "Manufacturing downtime")
        note = resolution_note.strip()
        evidence = evidence_reference.strip()[:500]
        if item.lifecycle_status != "open" or len(note) < 8 or not evidence:
            raise ValueError("Open downtime resolution requires a note and evidence")
        work_order = await self._work_order(item.work_order_id, project_id)
        if work_order.lifecycle_status != "paused":
            raise ValueError("Downtime work order is not paused")
        now = datetime.now(timezone.utc)
        seconds = max(1, int((now - item.started_at.replace(tzinfo=timezone.utc) if item.started_at.tzinfo is None else now - item.started_at).total_seconds()))
        item.lifecycle_status = "resolved"
        item.resolution_note = note[:2000]
        item.resolution_evidence_reference = evidence
        item.duration_minutes = int((Decimal(seconds) / Decimal(60)).to_integral_value(rounding=ROUND_CEILING))
        item.resolved_at = now
        item.revision += 1
        item.updated_by = actor
        work_order.lifecycle_status = "in-progress"
        self._milestone(work_order, "downtime-resolved", evidence, actor, item.operation_code)
        work_order.revision += 1
        work_order.updated_by = actor
        await self.db.flush()
        return await self._serialized_work_order(work_order)

    async def _serialized_work_order(self, item: FactoryManufacturingWorkOrder) -> dict[str, object]:
        return serialize_work_order(item, await self._operations(item.id), await self._downtimes(item.id))

    async def _work_order(self, item_id: str, project_id: int) -> FactoryManufacturingWorkOrder:
        item = await self.db.scalar(select(FactoryManufacturingWorkOrder).where(
            FactoryManufacturingWorkOrder.id == item_id,
            FactoryManufacturingWorkOrder.project_id == project_id,
        ))
        if not item:
            raise KeyError("Manufacturing work order not found")
        return item

    async def _operation(self, item_id: str, project_id: int) -> FactoryManufacturingOperation:
        item = await self.db.scalar(select(FactoryManufacturingOperation).where(
            FactoryManufacturingOperation.id == item_id,
            FactoryManufacturingOperation.project_id == project_id,
        ))
        if not item:
            raise KeyError("Manufacturing operation not found")
        return item

    async def _operations(self, work_order_id: str) -> list[FactoryManufacturingOperation]:
        return list((await self.db.execute(select(FactoryManufacturingOperation).where(
            FactoryManufacturingOperation.work_order_id == work_order_id,
        ).order_by(FactoryManufacturingOperation.operation_sequence))).scalars().all())

    async def _downtimes(self, work_order_id: str) -> list[FactoryManufacturingDowntime]:
        return list((await self.db.execute(select(FactoryManufacturingDowntime).where(
            FactoryManufacturingDowntime.work_order_id == work_order_id,
        ).order_by(FactoryManufacturingDowntime.created_at.desc()))).scalars().all())

    @staticmethod
    def _validate_material_lots(requirements: list[dict[str, object]], supplied: list[dict[str, object]]) -> list[dict[str, object]]:
        if not requirements:
            raise ValueError("Released plan has no material requirements")
        normalized: list[dict[str, object]] = []
        totals: dict[str, Decimal] = {}
        for raw in supplied:
            reference = str(raw.get("material_reference") or "").strip()
            lot = str(raw.get("lot_reference") or "").strip()
            receiving = str(raw.get("source_receiving_reference") or "").strip()
            quantity = _quantity(raw.get("issued_quantity"), f"Issued quantity for {reference or 'material'}")
            if not reference or not lot or not receiving:
                raise ValueError("Every issued material requires material, lot and receiving references")
            normalized.append({"material_reference": reference[:255], "lot_reference": lot[:255], "issued_quantity": str(quantity), "source_receiving_reference": receiving[:500]})
            totals[reference] = totals.get(reference, Decimal("0")) + quantity
        expected = {str(row.get("material_reference") or ""): Decimal(str(row.get("required_quantity") or "0")) for row in requirements}
        if set(totals) != set(expected) or any(totals[key] < expected[key] for key in expected):
            raise ValueError("Issued material lots must cover every released-plan material requirement")
        return normalized

    @staticmethod
    def _validate_routing(routing: list[dict[str, object]]) -> list[dict[str, object]]:
        if not 2 <= len(routing) <= 12:
            raise ValueError("Manufacturing routing requires between 2 and 12 operations")
        normalized: list[dict[str, object]] = []
        for raw in routing:
            try:
                sequence = int(raw.get("operation_sequence") or 0)
            except (TypeError, ValueError) as exc:
                raise ValueError("Operation sequence must be an integer") from exc
            code = str(raw.get("operation_code") or "").strip()
            name = str(raw.get("operation_name") or "").strip()
            center = str(raw.get("work_center_reference") or "").strip()
            if sequence <= 0 or not code or not name or not center:
                raise ValueError("Every routing operation requires sequence, code, name and work center")
            normalized.append({"operation_sequence": sequence, "operation_code": code[:100], "operation_name": name[:500], "work_center_reference": center[:255]})
        if len({row["operation_sequence"] for row in normalized}) != len(normalized) or len({row["operation_code"] for row in normalized}) != len(normalized):
            raise ValueError("Routing operation sequences and codes must be unique")
        return sorted(normalized, key=lambda row: int(row["operation_sequence"]))

    @staticmethod
    def _milestone(item: FactoryManufacturingWorkOrder, action: str, evidence: str, actor: str, operation_code: str | None = None) -> None:
        values = _json(item.milestones_json, [])
        values.append({"action": action, "status": item.lifecycle_status, "operationCode": operation_code, "evidenceReference": evidence, "recordedBy": actor, "occurredAt": datetime.now(timezone.utc).isoformat()})
        item.milestones_json = json.dumps(values, ensure_ascii=False, separators=(",", ":"))

    @staticmethod
    def _require_revision(actual: int, expected: int, label: str) -> None:
        if actual != expected:
            raise ValueError(f"{label} changed; refresh before saving")
