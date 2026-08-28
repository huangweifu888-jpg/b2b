"""Authoritative batch inspection, nonconformance and quality-release workflow."""

from __future__ import annotations

from datetime import datetime, timezone
import json
import secrets

from core.tenant_context import TenantContext
from models.factory_contract import FactoryCoreEventContract
from models.factory_fulfillment import FactoryFulfillmentOrder
from models.factory_quality import FactoryQualityFinding, FactoryQualityInspection
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


REQUIRED_CHECK_CODES = ("appearance", "dimensions", "performance", "safety", "documentation")
ELIGIBLE_ORDER_STATUSES = ("production-completed", "quality-released", "shipped", "delivered")
SEVERITIES = {"minor", "major", "critical"}
DISPOSITIONS = {"rework", "scrap", "use-as-is", "return-supplier"}


def _json(value: str | None, fallback):
    try:
        parsed = json.loads(value or "")
    except (TypeError, ValueError):
        return fallback
    return parsed if isinstance(parsed, type(fallback)) else fallback


def _event(contract: FactoryCoreEventContract, item: FactoryQualityInspection) -> dict[str, object]:
    return {
        "eventId": f"evt-{secrets.token_urlsafe(18)}",
        "tenantId": item.tenant_id,
        "eventType": "quality-released",
        "occurredAt": datetime.now(timezone.utc).isoformat(),
        "source": "fulfillment",
        "subjectId": item.batch_reference,
        "version": contract.schema_version,
        "correlationId": item.order_number,
        "orderId": item.order_id,
        "batchId": item.batch_reference,
        "inspectionId": item.id,
        "inspectionReference": item.inspection_reference,
    }


def serialize_finding(item: FactoryQualityFinding) -> dict[str, object]:
    return {
        "id": item.id,
        "project_id": item.project_id,
        "finding_number": item.finding_number,
        "inspection_id": item.inspection_id,
        "inspection_number": item.inspection_number,
        "check_code": item.check_code,
        "severity": item.severity,
        "description": item.description,
        "affected_quantity": item.affected_quantity,
        "lifecycle_status": item.lifecycle_status,
        "disposition": item.disposition,
        "root_cause": item.root_cause,
        "corrective_action": item.corrective_action,
        "resolution_evidence_reference": item.resolution_evidence_reference,
        "resolved_by": item.resolved_by,
        "resolved_at": item.resolved_at,
        "revision": item.revision,
        "updated_by": item.updated_by,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
    }


def serialize_inspection(
    item: FactoryQualityInspection,
    *,
    findings: list[FactoryQualityFinding] | None = None,
) -> dict[str, object]:
    return {
        "id": item.id,
        "project_id": item.project_id,
        "tenant_id": item.tenant_id,
        "client_id": item.client_id,
        "plan_id": item.plan_id,
        "inspection_number": item.inspection_number,
        "inspection_reference": item.inspection_reference,
        "order_id": item.order_id,
        "order_number": item.order_number,
        "product_reference": item.product_reference,
        "sku_reference": item.sku_reference,
        "work_order_reference": item.work_order_reference,
        "batch_reference": item.batch_reference,
        "inspection_type": item.inspection_type,
        "sample_size": item.sample_size,
        "accepted_quantity": item.accepted_quantity,
        "rejected_quantity": item.rejected_quantity,
        "lifecycle_status": item.lifecycle_status,
        "inspector": item.inspector,
        "started_at": item.started_at,
        "check_results": _json(item.check_results_json, []),
        "approval_reference": item.approval_reference,
        "release_note": item.release_note,
        "released_by": item.released_by,
        "released_at": item.released_at,
        "emitted_events": _json(item.emitted_events_json, []),
        "revision": item.revision,
        "findings": [serialize_finding(finding) for finding in findings or []],
        "updated_by": item.updated_by,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
    }


class FactoryQualityService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_workspace(self, *, project_id: int) -> dict[str, object]:
        inspections = (await self.db.execute(
            select(FactoryQualityInspection)
            .where(FactoryQualityInspection.project_id == project_id)
            .order_by(FactoryQualityInspection.created_at.desc())
        )).scalars().all()
        findings = (await self.db.execute(
            select(FactoryQualityFinding)
            .where(FactoryQualityFinding.project_id == project_id)
            .order_by(FactoryQualityFinding.created_at.desc())
        )).scalars().all()
        orders = (await self.db.execute(
            select(FactoryFulfillmentOrder)
            .where(
                FactoryFulfillmentOrder.project_id == project_id,
                FactoryFulfillmentOrder.status.in_(ELIGIBLE_ORDER_STATUSES),
            )
            .order_by(FactoryFulfillmentOrder.created_at.desc())
        )).scalars().all()
        return {
            "inspections": [
                serialize_inspection(item, findings=[finding for finding in findings if finding.inspection_id == item.id])
                for item in inspections
            ],
            "eligible_orders": [
                {
                    "id": order.id,
                    "order_number": order.order_number,
                    "status": order.status,
                    "lines": _json(order.lines_json, []),
                    "fulfillment_evidence": _json(order.fulfillment_evidence_json, []),
                }
                for order in orders
                if self._evidence_reference(order, "complete-production")
            ],
        }

    async def create_inspection(
        self,
        *,
        project_id: int,
        context: TenantContext,
        actor: str,
        order_id: str,
        product_reference: str,
        sku_reference: str,
        inspection_reference: str,
        inspection_type: str,
        sample_size: int,
    ) -> dict[str, object]:
        order = await self.db.scalar(select(FactoryFulfillmentOrder).where(
            FactoryFulfillmentOrder.id == order_id.strip(),
            FactoryFulfillmentOrder.project_id == project_id,
            FactoryFulfillmentOrder.status.in_(ELIGIBLE_ORDER_STATUSES),
        ))
        if not order:
            raise ValueError("Quality inspection requires a produced authoritative order in this tenant plan")
        product = product_reference.strip()
        sku = sku_reference.strip()
        if not any(
            str(line.get("product_reference") or "").strip() == product
            and str(line.get("sku_reference") or "").strip() == sku
            for line in _json(order.lines_json, [])
        ):
            raise ValueError("Product and SKU must match the authoritative order line")
        work_order = self._evidence_reference(order, "start-production")
        batch = self._evidence_reference(order, "complete-production")
        if not work_order or not batch:
            raise ValueError("Quality inspection requires work-order and production-batch evidence")
        reference = inspection_reference.strip()
        historical_reference = self._evidence_reference(order, "release-quality")
        if historical_reference and historical_reference != reference:
            raise ValueError("Historical QMS adoption must preserve the original quality evidence reference")
        if not reference or sample_size <= 0:
            raise ValueError("Inspection reference and positive sample size are required")
        clean_type = inspection_type.strip().lower()
        if clean_type not in {"incoming", "in-process", "final"}:
            raise ValueError("Unsupported inspection type")
        duplicate = await self.db.scalar(select(FactoryQualityInspection.id).where(
            FactoryQualityInspection.tenant_id == context.tenant_id,
            FactoryQualityInspection.inspection_reference == reference,
        ))
        if duplicate:
            raise ValueError("Inspection reference already exists in this tenant")
        now = datetime.now(timezone.utc)
        item = FactoryQualityInspection(
            id=f"inspection-{secrets.token_urlsafe(18)}",
            project_id=project_id,
            agent_path=context.agent_path,
            tenant_id=context.tenant_id,
            client_id=context.client_id,
            plan_id=context.plan_id or f"plan-{project_id}",
            inspection_number=f"QIN-{project_id}-{now.strftime('%Y%m%d%H%M%S')}-{secrets.token_hex(3).upper()}",
            inspection_reference=reference,
            order_id=order.id,
            order_number=order.order_number,
            product_reference=product,
            sku_reference=sku,
            work_order_reference=work_order,
            batch_reference=batch,
            inspection_type=clean_type,
            sample_size=sample_size,
            updated_by=actor,
        )
        self.db.add(item)
        await self.db.flush()
        return serialize_inspection(item)

    async def start_inspection(
        self,
        inspection_id: str,
        *,
        project_id: int,
        expected_revision: int,
        actor: str,
        inspector: str,
    ) -> dict[str, object]:
        item = await self._inspection(inspection_id, project_id)
        self._require_revision(item.revision, expected_revision, "Quality inspection")
        if item.lifecycle_status != "draft":
            raise ValueError("Only a draft inspection can be started")
        owner = inspector.strip()
        if not owner:
            raise ValueError("Inspection requires an assigned inspector")
        item.inspector = owner
        item.started_at = datetime.now(timezone.utc)
        item.lifecycle_status = "in-progress"
        item.revision += 1
        item.updated_by = actor
        await self.db.flush()
        return serialize_inspection(item)

    async def record_results(
        self,
        inspection_id: str,
        *,
        project_id: int,
        expected_revision: int,
        actor: str,
        accepted_quantity: int,
        rejected_quantity: int,
        check_results: list[dict[str, object]],
    ) -> dict[str, object]:
        item = await self._inspection(inspection_id, project_id)
        self._require_revision(item.revision, expected_revision, "Quality inspection")
        if item.lifecycle_status != "in-progress":
            raise ValueError("Inspection results require an in-progress inspection")
        if accepted_quantity < 0 or rejected_quantity < 0 or accepted_quantity + rejected_quantity != item.sample_size:
            raise ValueError("Accepted and rejected quantities must reconcile to the sample size")
        normalized: list[dict[str, object]] = []
        seen: set[str] = set()
        for result in check_results:
            code = str(result.get("check_code") or "").strip().lower()
            evidence = str(result.get("evidence_reference") or "").strip()[:500]
            measured = str(result.get("measured_value") or "").strip()[:500]
            if code not in REQUIRED_CHECK_CODES or code in seen or not evidence or not measured:
                raise ValueError("Every required quality check needs one measured value and evidence reference")
            seen.add(code)
            normalized.append({
                "check_code": code,
                "passed": bool(result.get("passed")),
                "measured_value": measured,
                "evidence_reference": evidence,
            })
        if seen != set(REQUIRED_CHECK_CODES):
            raise ValueError("Appearance, dimensions, performance, safety and documentation checks are all required")
        failed = [result for result in normalized if not result["passed"]]
        if failed and rejected_quantity == 0:
            raise ValueError("Failed quality checks require a rejected sample quantity")
        if not failed and rejected_quantity:
            raise ValueError("Rejected samples require at least one failed quality check")
        item.accepted_quantity = accepted_quantity
        item.rejected_quantity = rejected_quantity
        item.check_results_json = json.dumps(normalized, ensure_ascii=False, separators=(",", ":"))
        item.lifecycle_status = "review-required"
        item.revision += 1
        item.updated_by = actor
        await self.db.flush()
        return serialize_inspection(item)

    async def create_finding(
        self,
        inspection_id: str,
        *,
        project_id: int,
        context: TenantContext,
        actor: str,
        expected_revision: int,
        check_code: str,
        severity: str,
        description: str,
        affected_quantity: int,
    ) -> dict[str, object]:
        inspection = await self._inspection(inspection_id, project_id)
        self._require_revision(inspection.revision, expected_revision, "Quality inspection")
        if inspection.lifecycle_status != "review-required":
            raise ValueError("Quality findings require recorded inspection results")
        code = check_code.strip().lower()
        failed_codes = {
            str(result.get("check_code"))
            for result in _json(inspection.check_results_json, [])
            if not result.get("passed")
        }
        if code not in failed_codes:
            raise ValueError("A finding must reference a failed quality check")
        clean_severity = severity.strip().lower()
        clean_description = description.strip()
        if clean_severity not in SEVERITIES or len(clean_description) < 4:
            raise ValueError("Finding severity and description are required")
        if affected_quantity <= 0 or affected_quantity > inspection.rejected_quantity:
            raise ValueError("Finding affected quantity must fit the rejected sample quantity")
        duplicate = await self.db.scalar(select(FactoryQualityFinding.id).where(
            FactoryQualityFinding.inspection_id == inspection.id,
            FactoryQualityFinding.check_code == code,
        ))
        if duplicate:
            raise ValueError("This failed check already has a quality finding")
        now = datetime.now(timezone.utc)
        finding = FactoryQualityFinding(
            id=f"finding-{secrets.token_urlsafe(18)}",
            project_id=project_id,
            agent_path=context.agent_path,
            tenant_id=context.tenant_id,
            client_id=context.client_id,
            plan_id=context.plan_id or f"plan-{project_id}",
            finding_number=f"NCR-{project_id}-{now.strftime('%Y%m%d%H%M%S')}-{secrets.token_hex(3).upper()}",
            inspection_id=inspection.id,
            inspection_number=inspection.inspection_number,
            check_code=code,
            severity=clean_severity,
            description=clean_description,
            affected_quantity=affected_quantity,
            updated_by=actor,
        )
        inspection.revision += 1
        inspection.updated_by = actor
        self.db.add(finding)
        await self.db.flush()
        return {"inspection": serialize_inspection(inspection, findings=[finding]), "finding": serialize_finding(finding)}

    async def resolve_finding(
        self,
        finding_id: str,
        *,
        project_id: int,
        expected_revision: int,
        expected_inspection_revision: int,
        actor: str,
        disposition: str,
        root_cause: str,
        corrective_action: str,
        resolution_evidence_reference: str,
    ) -> dict[str, object]:
        finding = await self.db.scalar(select(FactoryQualityFinding).where(
            FactoryQualityFinding.id == finding_id,
            FactoryQualityFinding.project_id == project_id,
        ))
        if not finding:
            raise KeyError("Quality finding not found in this tenant plan")
        self._require_revision(finding.revision, expected_revision, "Quality finding")
        inspection = await self._inspection(finding.inspection_id, project_id)
        self._require_revision(inspection.revision, expected_inspection_revision, "Quality inspection")
        if finding.lifecycle_status != "open" or inspection.lifecycle_status != "review-required":
            raise ValueError("Only an open finding on a review-required inspection can be resolved")
        clean_disposition = disposition.strip().lower()
        clean_root = root_cause.strip()
        clean_action = corrective_action.strip()
        clean_evidence = resolution_evidence_reference.strip()
        if clean_disposition not in DISPOSITIONS or min(len(clean_root), len(clean_action)) < 8 or not clean_evidence:
            raise ValueError("Finding resolution requires disposition, root cause, corrective action and evidence")
        finding.disposition = clean_disposition
        finding.root_cause = clean_root
        finding.corrective_action = clean_action
        finding.resolution_evidence_reference = clean_evidence
        finding.lifecycle_status = "closed"
        finding.resolved_by = actor
        finding.resolved_at = datetime.now(timezone.utc)
        finding.revision += 1
        finding.updated_by = actor
        inspection.revision += 1
        inspection.updated_by = actor
        await self.db.flush()
        return {"inspection": serialize_inspection(inspection, findings=[finding]), "finding": serialize_finding(finding)}

    async def release_inspection(
        self,
        inspection_id: str,
        *,
        project_id: int,
        expected_revision: int,
        actor: str,
        approval_reference: str,
        release_note: str,
    ) -> dict[str, object]:
        inspection = await self._inspection(inspection_id, project_id)
        self._require_revision(inspection.revision, expected_revision, "Quality inspection")
        if inspection.lifecycle_status != "review-required":
            raise ValueError("Only a reviewed inspection can be released")
        findings = (await self.db.execute(select(FactoryQualityFinding).where(
            FactoryQualityFinding.inspection_id == inspection.id,
            FactoryQualityFinding.project_id == project_id,
        ))).scalars().all()
        failed_codes = {
            str(result.get("check_code"))
            for result in _json(inspection.check_results_json, [])
            if not result.get("passed")
        }
        closed_codes = {finding.check_code for finding in findings if finding.lifecycle_status == "closed"}
        if failed_codes - closed_codes or any(finding.lifecycle_status != "closed" for finding in findings):
            raise ValueError("Every failed check requires a closed quality finding before release")
        approval = approval_reference.strip()
        note = release_note.strip()
        if not approval or len(note) < 8:
            raise ValueError("Quality release requires approval evidence and a release note")
        contract = await self._contract("quality-released")
        order = await self.db.scalar(select(FactoryFulfillmentOrder).where(
            FactoryFulfillmentOrder.id == inspection.order_id,
            FactoryFulfillmentOrder.project_id == project_id,
        ))
        if not order:
            raise ValueError("Authoritative order is unavailable for quality release")
        existing_event = next((
            event for event in _json(order.emitted_events_json, [])
            if event.get("eventType") == "quality-released"
        ), None)
        release_event = existing_event or _event(contract, inspection)
        if not existing_event:
            order_events = _json(order.emitted_events_json, [])
            order_events.append(release_event)
            order.emitted_events_json = json.dumps(order_events, ensure_ascii=False, separators=(",", ":"))
            order.revision += 1
            order.updated_by = actor
        inspection.approval_reference = approval
        inspection.release_note = note
        inspection.released_by = actor
        inspection.released_at = datetime.now(timezone.utc)
        inspection.lifecycle_status = "released"
        inspection.emitted_events_json = json.dumps([release_event], ensure_ascii=False, separators=(",", ":"))
        inspection.revision += 1
        inspection.updated_by = actor
        await self.db.flush()
        return serialize_inspection(inspection, findings=findings)

    async def _inspection(self, inspection_id: str, project_id: int) -> FactoryQualityInspection:
        item = await self.db.scalar(select(FactoryQualityInspection).where(
            FactoryQualityInspection.id == inspection_id,
            FactoryQualityInspection.project_id == project_id,
        ))
        if not item:
            raise KeyError("Quality inspection not found in this tenant plan")
        return item

    @staticmethod
    def _evidence_reference(order: FactoryFulfillmentOrder, action: str) -> str:
        record = next((
            item for item in _json(order.fulfillment_evidence_json, [])
            if item.get("action") == action
        ), None)
        return str(record.get("reference") or "").strip() if record else ""

    @staticmethod
    def _require_revision(actual: int, expected: int, label: str) -> None:
        if actual != expected:
            raise ValueError(f"{label} changed; refresh before continuing")

    async def _contract(self, event_type: str) -> FactoryCoreEventContract:
        contract = await self.db.scalar(select(FactoryCoreEventContract).where(
            FactoryCoreEventContract.id == event_type,
            FactoryCoreEventContract.lifecycle_status == "frozen",
        ))
        if not contract:
            raise ValueError(f"The frozen {event_type} contract is required")
        return contract
