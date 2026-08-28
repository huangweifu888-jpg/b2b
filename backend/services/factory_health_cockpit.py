"""Cross-system operating-health snapshots and closed-loop responsibility tasks."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
import json
import secrets

from core.tenant_context import TenantContext
from models.factory_cpq import FactoryCpqQuote
from models.factory_customer_asset import FactoryAssetServiceTicket, FactoryCustomerAsset
from models.factory_fulfillment import FactoryFulfillmentOrder
from models.factory_health_cockpit import (
    FactoryHealthCockpitAlert,
    FactoryHealthCockpitEvidence,
    FactoryHealthCockpitSnapshot,
    FactoryHealthResponsibilityTask,
)
from models.factory_partner_voice import FactoryPartnerAccount, FactoryVoiceOfCustomerCase
from models.factory_quality import FactoryQualityInspection
from models.factory_revenue import FactoryRevenueFlowRun
from models.factory_warranty_rma import FactoryWarrantyRmaCase
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession


METRIC_DEFINITIONS = (
    ("demand", "quote_to_order", "报价转订单率", Decimal("60"), "%", 15, "factory_cpq_quotes+factory_fulfillment_orders"),
    ("delivery", "delivery_completion", "订单交付完成率", Decimal("85"), "%", 15, "factory_fulfillment_orders"),
    ("quality", "quality_release", "质量放行率", Decimal("95"), "%", 15, "factory_quality_inspections"),
    ("customer", "customer_resolution", "客户问题闭环率", Decimal("90"), "%", 15, "factory_asset_service_tickets+factory_warranty_rma_cases+factory_voice_of_customer_cases"),
    ("customer", "asset_stability", "客户资产稳定率", Decimal("85"), "%", 10, "factory_customer_assets"),
    ("cash", "cash_collection", "开票回款率", Decimal("95"), "%", 15, "factory_revenue_flow_runs"),
    ("ecosystem", "partner_readiness", "伙伴开通率", Decimal("80"), "%", 5, "factory_partner_accounts"),
    ("governance", "data_coverage", "经营数据覆盖率", Decimal("80"), "%", 10, "health-source-watermarks"),
)


def _json(value: str | None, fallback):
    try:
        parsed = json.loads(value or "")
    except (TypeError, ValueError):
        return fallback
    return parsed if isinstance(parsed, type(fallback)) else fallback


def _number(value: Decimal | int | float | None) -> str | None:
    if value is None:
        return None
    return str(Decimal(value).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def _ratio(numerator: int | Decimal, denominator: int | Decimal) -> Decimal | None:
    denominator_value = Decimal(denominator)
    if denominator_value <= 0:
        return None
    value = Decimal(numerator) * Decimal("100") / denominator_value
    return min(Decimal("100"), max(Decimal("0"), value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _severity(actual: Decimal | None, target: Decimal) -> str:
    if actual is None:
        return "medium"
    gap = target - actual
    if gap >= 40:
        return "critical"
    if gap >= 20:
        return "high"
    return "medium"


def serialize_snapshot(item: FactoryHealthCockpitSnapshot) -> dict[str, object]:
    return {
        "id": item.id, "project_id": item.project_id, "snapshot_number": item.snapshot_number,
        "snapshot_reference": item.snapshot_reference, "period_start": item.period_start,
        "period_end": item.period_end, "overall_score": _number(item.overall_score),
        "health_grade": item.health_grade, "metric_count": item.metric_count,
        "available_metric_count": item.available_metric_count, "alert_count": item.alert_count,
        "dimensions": _json(item.dimensions_json, []), "source_watermarks": _json(item.source_watermarks_json, []),
        "methodology_version": item.methodology_version, "status": item.status,
        "generated_by": item.generated_by, "generated_at": item.generated_at,
        "revision": item.revision, "created_at": item.created_at,
    }


def serialize_alert(item: FactoryHealthCockpitAlert) -> dict[str, object]:
    return {
        "id": item.id, "project_id": item.project_id, "alert_number": item.alert_number,
        "snapshot_id": item.snapshot_id, "snapshot_number": item.snapshot_number,
        "dimension": item.dimension, "metric_code": item.metric_code, "metric_label": item.metric_label,
        "severity": item.severity, "actual_value": _number(item.actual_value),
        "threshold_value": _number(item.threshold_value), "unit": item.unit,
        "source_object_type": item.source_object_type, "source_reference": item.source_reference,
        "status": item.status, "owner": item.owner, "acknowledged_by": item.acknowledged_by,
        "acknowledged_at": item.acknowledged_at, "due_at": item.due_at,
        "verified_by": item.verified_by, "verified_at": item.verified_at,
        "revision": item.revision, "updated_by": item.updated_by,
        "created_at": item.created_at, "updated_at": item.updated_at,
    }


def serialize_task(item: FactoryHealthResponsibilityTask) -> dict[str, object]:
    return {
        "id": item.id, "project_id": item.project_id, "task_number": item.task_number,
        "alert_id": item.alert_id, "alert_number": item.alert_number, "owner": item.owner,
        "action_plan": item.action_plan, "due_at": item.due_at, "status": item.status,
        "started_at": item.started_at, "completion_note": item.completion_note,
        "completion_evidence_reference": item.completion_evidence_reference,
        "completed_by": item.completed_by, "completed_at": item.completed_at,
        "verified_by": item.verified_by, "verified_at": item.verified_at,
        "revision": item.revision, "updated_by": item.updated_by,
        "created_at": item.created_at, "updated_at": item.updated_at,
    }


def serialize_evidence(item: FactoryHealthCockpitEvidence) -> dict[str, object]:
    return {
        "id": item.id, "evidence_number": item.evidence_number,
        "subject_type": item.subject_type, "subject_id": item.subject_id,
        "subject_number": item.subject_number, "evidence_type": item.evidence_type,
        "evidence_reference": item.evidence_reference, "note": item.note,
        "recorded_by": item.recorded_by, "created_at": item.created_at,
    }


class FactoryHealthCockpitService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self._last_evidence_at: datetime | None = None

    async def list_workspace(self, *, project_id: int) -> dict[str, object]:
        snapshots = (await self.db.execute(select(FactoryHealthCockpitSnapshot).where(
            FactoryHealthCockpitSnapshot.project_id == project_id,
        ).order_by(FactoryHealthCockpitSnapshot.created_at.desc()).limit(12))).scalars().all()
        alerts = (await self.db.execute(select(FactoryHealthCockpitAlert).where(
            FactoryHealthCockpitAlert.project_id == project_id,
        ).order_by(FactoryHealthCockpitAlert.created_at.desc()).limit(100))).scalars().all()
        tasks = (await self.db.execute(select(FactoryHealthResponsibilityTask).where(
            FactoryHealthResponsibilityTask.project_id == project_id,
        ).order_by(FactoryHealthResponsibilityTask.created_at.desc()).limit(100))).scalars().all()
        evidence = (await self.db.execute(select(FactoryHealthCockpitEvidence).where(
            FactoryHealthCockpitEvidence.project_id == project_id,
        ).order_by(FactoryHealthCockpitEvidence.created_at.desc()).limit(200))).scalars().all()
        return {
            "snapshots": [serialize_snapshot(item) for item in snapshots],
            "alerts": [serialize_alert(item) for item in alerts],
            "tasks": [serialize_task(item) for item in tasks],
            "evidence": [serialize_evidence(item) for item in evidence],
            "methodology": {
                "version": "v1", "policy": "read-only-authority-snapshot",
                "metric_codes": [definition[1] for definition in METRIC_DEFINITIONS],
            },
        }

    async def refresh(self, *, project_id: int, context: TenantContext, actor: str,
                      snapshot_reference: str, period_start: datetime, period_end: datetime) -> dict[str, object]:
        reference = snapshot_reference.strip()
        if not reference:
            raise ValueError("Snapshot reference is required")
        start = self._aware(period_start)
        end = self._aware(period_end)
        if end <= start or (end - start).days > 366:
            raise ValueError("Snapshot period must be positive and no longer than 366 days")
        existing = await self.db.scalar(select(FactoryHealthCockpitSnapshot.id).where(
            FactoryHealthCockpitSnapshot.tenant_id == context.tenant_id,
            FactoryHealthCockpitSnapshot.snapshot_reference == reference,
        ))
        if existing:
            raise ValueError("Snapshot reference already exists in this tenant")

        raw, watermarks = await self._authoritative_metrics(project_id)
        available_base = sum(1 for value in raw.values() if value[1] > 0)
        raw["data_coverage"] = (available_base, len(raw))
        metrics: list[dict[str, object]] = []
        weighted_total = Decimal("0")
        included_weight = Decimal("0")
        for dimension, code, label, target, unit, weight, source in METRIC_DEFINITIONS:
            numerator, denominator = raw[code]
            actual = _ratio(numerator, denominator)
            status = "unavailable" if actual is None else ("healthy" if actual >= target else "attention")
            if actual is not None:
                weighted_total += actual * Decimal(weight)
                included_weight += Decimal(weight)
            metrics.append({
                "dimension": dimension, "code": code, "label": label,
                "actual": _number(actual), "target": _number(target), "unit": unit,
                "weight": weight, "status": status, "numerator": _number(numerator),
                "denominator": _number(denominator), "source": source,
            })
        overall = (weighted_total / included_weight if included_weight else Decimal("0")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        grade = "healthy" if overall >= 85 else ("watch" if overall >= 70 else "critical")
        now = datetime.now(timezone.utc)
        snapshot = FactoryHealthCockpitSnapshot(
            id=f"health-snapshot-{secrets.token_urlsafe(18)}", project_id=project_id,
            agent_path=context.agent_path, tenant_id=context.tenant_id, client_id=context.client_id,
            plan_id=context.plan_id or f"plan-{project_id}",
            snapshot_number=self._number("HCS", project_id, now), snapshot_reference=reference[:255],
            period_start=start, period_end=end, overall_score=overall, health_grade=grade,
            metric_count=len(metrics), available_metric_count=sum(1 for metric in metrics if metric["status"] != "unavailable"),
            dimensions_json=json.dumps(metrics, ensure_ascii=False, separators=(",", ":")),
            source_watermarks_json=json.dumps(watermarks, ensure_ascii=False, separators=(",", ":")),
            generated_by=actor, generated_at=now,
        )
        self.db.add(snapshot)
        await self.db.flush()

        alerts: list[FactoryHealthCockpitAlert] = []
        for metric in metrics:
            actual = Decimal(metric["actual"]) if metric["actual"] is not None else None
            target = Decimal(metric["target"])
            if actual is not None and actual >= target:
                continue
            alert = FactoryHealthCockpitAlert(
                id=f"health-alert-{secrets.token_urlsafe(18)}", project_id=project_id,
                agent_path=context.agent_path, tenant_id=context.tenant_id, client_id=context.client_id,
                plan_id=context.plan_id or f"plan-{project_id}", alert_number=self._number("HAL", project_id, now),
                snapshot_id=snapshot.id, snapshot_number=snapshot.snapshot_number,
                dimension=str(metric["dimension"]), metric_code=str(metric["code"]), metric_label=str(metric["label"]),
                severity=_severity(actual, target), actual_value=actual, threshold_value=target, unit=str(metric["unit"]),
                source_object_type=str(metric["source"]), source_reference=f"{reference}:{metric['code']}",
                updated_by=actor,
            )
            self.db.add(alert)
            alerts.append(alert)
        snapshot.alert_count = len(alerts)
        await self._evidence(snapshot, "snapshot", "snapshot-generated", reference, f"Generated {len(metrics)} governed metrics from {len(watermarks)} authority sources", actor)
        await self.db.flush()
        return {"snapshot": serialize_snapshot(snapshot), "alerts": [serialize_alert(item) for item in alerts]}

    async def acknowledge_alert(self, alert_id: str, *, project_id: int, expected_revision: int,
                                actor: str, owner: str, due_at: datetime, acknowledgement_reference: str) -> dict[str, object]:
        alert = await self._alert(alert_id, project_id)
        self._revision(alert, expected_revision)
        if alert.status != "open":
            raise ValueError("Only an open health alert can be acknowledged")
        clean_owner = owner.strip()
        reference = acknowledgement_reference.strip()
        due = self._aware(due_at)
        if not clean_owner or not reference or due <= datetime.now(timezone.utc):
            raise ValueError("Alert acknowledgement requires an owner, future due date and evidence reference")
        now = datetime.now(timezone.utc)
        alert.status = "acknowledged"; alert.owner = clean_owner[:255]
        alert.acknowledged_by = actor; alert.acknowledged_at = now; alert.due_at = due
        alert.revision += 1; alert.updated_by = actor
        await self._evidence(alert, "alert", "acknowledgement", reference, f"Owned by {clean_owner} until {due.isoformat()}", actor)
        await self.db.flush()
        return serialize_alert(alert)

    async def create_task(self, alert_id: str, *, project_id: int, expected_alert_revision: int,
                          actor: str, owner: str, action_plan: str, due_at: datetime,
                          assignment_reference: str) -> dict[str, object]:
        alert = await self._alert(alert_id, project_id)
        self._revision(alert, expected_alert_revision)
        if alert.status != "acknowledged":
            raise ValueError("Responsibility task requires an acknowledged alert")
        existing = await self.db.scalar(select(FactoryHealthResponsibilityTask.id).where(
            FactoryHealthResponsibilityTask.alert_id == alert.id,
        ))
        if existing:
            raise ValueError("This alert already has a responsibility task")
        clean_owner, clean_plan, reference = owner.strip(), action_plan.strip(), assignment_reference.strip()
        due = self._aware(due_at)
        if not clean_owner or len(clean_plan) < 8 or not reference or due <= datetime.now(timezone.utc):
            raise ValueError("Task requires an owner, future due date, action plan and assignment evidence")
        now = datetime.now(timezone.utc)
        task = FactoryHealthResponsibilityTask(
            id=f"health-task-{secrets.token_urlsafe(18)}", project_id=project_id,
            agent_path=alert.agent_path, tenant_id=alert.tenant_id, client_id=alert.client_id, plan_id=alert.plan_id,
            task_number=self._number("HTK", project_id, now), alert_id=alert.id, alert_number=alert.alert_number,
            owner=clean_owner[:255], action_plan=clean_plan, due_at=due, updated_by=actor,
        )
        alert.status = "task-assigned"; alert.owner = clean_owner[:255]; alert.due_at = due
        alert.revision += 1; alert.updated_by = actor
        self.db.add(task)
        await self._evidence(task, "task", "assignment", reference, clean_plan, actor)
        await self.db.flush()
        return serialize_task(task)

    async def start_task(self, task_id: str, *, project_id: int, expected_revision: int,
                         actor: str, start_reference: str) -> dict[str, object]:
        task = await self._task(task_id, project_id)
        self._revision(task, expected_revision)
        if task.status != "assigned":
            raise ValueError("Only an assigned responsibility task can start")
        reference = start_reference.strip()
        if not reference:
            raise ValueError("Task start evidence is required")
        task.status = "in-progress"; task.started_at = datetime.now(timezone.utc)
        task.revision += 1; task.updated_by = actor
        await self._evidence(task, "task", "work-started", reference, "Responsibility task started", actor)
        await self.db.flush()
        return serialize_task(task)

    async def complete_task(self, task_id: str, *, project_id: int, expected_revision: int,
                            actor: str, completion_note: str, completion_evidence_reference: str) -> dict[str, object]:
        task = await self._task(task_id, project_id)
        self._revision(task, expected_revision)
        if task.status != "in-progress":
            raise ValueError("Only an in-progress responsibility task can complete")
        note, reference = completion_note.strip(), completion_evidence_reference.strip()
        if len(note) < 8 or not reference:
            raise ValueError("Task completion requires a result note and evidence reference")
        now = datetime.now(timezone.utc)
        task.status = "completed"; task.completion_note = note
        task.completion_evidence_reference = reference; task.completed_by = actor; task.completed_at = now
        task.revision += 1; task.updated_by = actor
        alert = await self._alert(task.alert_id, project_id)
        alert.status = "pending-verification"; alert.revision += 1; alert.updated_by = actor
        await self._evidence(task, "task", "completion", reference, note, actor)
        await self.db.flush()
        return serialize_task(task)

    async def verify_task(self, task_id: str, *, project_id: int, expected_revision: int,
                          actor: str, verification_reference: str, verification_note: str) -> dict[str, object]:
        task = await self._task(task_id, project_id)
        self._revision(task, expected_revision)
        if task.status != "completed":
            raise ValueError("Only a completed responsibility task can be verified")
        reference, note = verification_reference.strip(), verification_note.strip()
        if not reference or len(note) < 8:
            raise ValueError("Independent verification evidence and note are required")
        if task.completed_by == actor:
            raise ValueError("Task verifier must be independent from the completer")
        now = datetime.now(timezone.utc)
        task.status = "verified"; task.verified_by = actor; task.verified_at = now
        task.revision += 1; task.updated_by = actor
        alert = await self._alert(task.alert_id, project_id)
        alert.status = "resolved"; alert.verified_by = actor; alert.verified_at = now
        alert.revision += 1; alert.updated_by = actor
        await self._evidence(task, "task", "verification", reference, note, actor)
        await self.db.flush()
        return {"task": serialize_task(task), "alert": serialize_alert(alert)}

    async def _authoritative_metrics(self, project_id: int) -> tuple[dict[str, tuple[Decimal | int, Decimal | int]], list[dict[str, object]]]:
        async def count(model, *criteria) -> int:
            value = await self.db.scalar(select(func.count()).select_from(model).where(model.project_id == project_id, *criteria))
            return int(value or 0)

        quote_total = await count(FactoryCpqQuote)
        order_total = await count(FactoryFulfillmentOrder, FactoryFulfillmentOrder.status != "rejected")
        confirmed_order_total = await count(FactoryFulfillmentOrder, FactoryFulfillmentOrder.status.in_(("confirmed", "allocated", "in-production", "production-completed", "quality-released", "shipped", "delivered")))
        delivered_total = await count(FactoryFulfillmentOrder, FactoryFulfillmentOrder.status == "delivered")
        inspection_total = await count(FactoryQualityInspection)
        released_total = await count(FactoryQualityInspection, FactoryQualityInspection.lifecycle_status == "released")
        ticket_total = await count(FactoryAssetServiceTicket)
        ticket_closed = await count(FactoryAssetServiceTicket, FactoryAssetServiceTicket.status == "resolved")
        rma_total = await count(FactoryWarrantyRmaCase)
        rma_closed = await count(FactoryWarrantyRmaCase, FactoryWarrantyRmaCase.lifecycle_status == "closed")
        voice_total = await count(FactoryVoiceOfCustomerCase)
        voice_closed = await count(FactoryVoiceOfCustomerCase, FactoryVoiceOfCustomerCase.lifecycle_status == "closed")
        asset_total = await count(FactoryCustomerAsset)
        stable_assets = await count(FactoryCustomerAsset, FactoryCustomerAsset.status == "active", FactoryCustomerAsset.renewal_status != "action-required")
        partner_total = await count(FactoryPartnerAccount)
        active_partners = await count(FactoryPartnerAccount, FactoryPartnerAccount.status == "active")
        invoiced = await self.db.scalar(select(func.coalesce(func.sum(FactoryRevenueFlowRun.invoiced_amount), 0)).where(FactoryRevenueFlowRun.project_id == project_id))
        paid = await self.db.scalar(select(func.coalesce(func.sum(FactoryRevenueFlowRun.paid_amount), 0)).where(FactoryRevenueFlowRun.project_id == project_id))
        raw = {
            "quote_to_order": (confirmed_order_total, quote_total),
            "delivery_completion": (delivered_total, order_total),
            "quality_release": (released_total, inspection_total),
            "customer_resolution": (ticket_closed + rma_closed + voice_closed, ticket_total + rma_total + voice_total),
            "asset_stability": (stable_assets, asset_total),
            "cash_collection": (Decimal(paid or 0), Decimal(invoiced or 0)),
            "partner_readiness": (active_partners, partner_total),
        }
        sources = (
            ("factory_cpq_quotes", FactoryCpqQuote), ("factory_fulfillment_orders", FactoryFulfillmentOrder),
            ("factory_quality_inspections", FactoryQualityInspection), ("factory_asset_service_tickets", FactoryAssetServiceTicket),
            ("factory_warranty_rma_cases", FactoryWarrantyRmaCase), ("factory_voice_of_customer_cases", FactoryVoiceOfCustomerCase),
            ("factory_customer_assets", FactoryCustomerAsset), ("factory_revenue_flow_runs", FactoryRevenueFlowRun),
            ("factory_partner_accounts", FactoryPartnerAccount),
        )
        watermarks = []
        for source, model in sources:
            record_count = await count(model)
            watermark = await self.db.scalar(select(func.max(model.updated_at)).where(model.project_id == project_id))
            watermarks.append({"source": source, "recordCount": record_count, "watermark": watermark.isoformat() if watermark else None})
        return raw, watermarks

    async def _alert(self, item_id: str, project_id: int) -> FactoryHealthCockpitAlert:
        item = await self.db.scalar(select(FactoryHealthCockpitAlert).where(
            FactoryHealthCockpitAlert.id == item_id, FactoryHealthCockpitAlert.project_id == project_id,
        ))
        if not item:
            raise KeyError("Health alert not found in this tenant plan")
        return item

    async def _task(self, item_id: str, project_id: int) -> FactoryHealthResponsibilityTask:
        item = await self.db.scalar(select(FactoryHealthResponsibilityTask).where(
            FactoryHealthResponsibilityTask.id == item_id, FactoryHealthResponsibilityTask.project_id == project_id,
        ))
        if not item:
            raise KeyError("Responsibility task not found in this tenant plan")
        return item

    async def _evidence(self, item, subject_type: str, evidence_type: str,
                        reference: str, note: str, actor: str) -> None:
        number_field = {"snapshot": "snapshot_number", "alert": "alert_number", "task": "task_number"}[subject_type]
        number = getattr(item, number_field)
        now = datetime.now(timezone.utc)
        if self._last_evidence_at is not None:
            now = max(now, self._last_evidence_at + timedelta(milliseconds=1))
        self._last_evidence_at = now
        self.db.add(FactoryHealthCockpitEvidence(
            id=f"health-evidence-{secrets.token_urlsafe(18)}", project_id=item.project_id,
            agent_path=item.agent_path, tenant_id=item.tenant_id, client_id=item.client_id, plan_id=item.plan_id,
            evidence_number=self._number("HEV", item.project_id, now), subject_type=subject_type,
            subject_id=item.id, subject_number=number, evidence_type=evidence_type,
            evidence_reference=reference.strip()[:500], note=note.strip(), recorded_by=actor,
            created_at=now,
        ))

    @staticmethod
    def _number(prefix: str, project_id: int, now: datetime) -> str:
        return f"{prefix}-{project_id}-{now:%Y%m%d%H%M%S}-{secrets.token_hex(3).upper()}"

    @staticmethod
    def _aware(value: datetime) -> datetime:
        return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)

    @staticmethod
    def _revision(item, expected: int) -> None:
        if item.revision != expected:
            raise ValueError("Health cockpit record changed; refresh before continuing")
