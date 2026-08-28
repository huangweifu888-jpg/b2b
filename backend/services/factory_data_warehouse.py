"""Governed analytical copies with source watermarks, quality and lineage."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
import hashlib
import json
import secrets

from core.tenant_context import TenantContext
from models.factory_cpq import FactoryCpqQuote
from models.factory_customer_asset import FactoryCustomerAsset
from models.factory_data_warehouse import (
    FactoryWarehouseEvidence,
    FactoryWarehouseFactVersion,
    FactoryWarehouseLineageEdge,
    FactoryWarehouseLoadRun,
    FactoryWarehouseQualityIssue,
    FactoryWarehouseSource,
)
from models.factory_fulfillment import FactoryFulfillmentOrder
from models.factory_partner_voice import FactoryVoiceOfCustomerCase
from models.factory_planning import FactoryPlanningResource, FactoryProductionPlan
from models.factory_procurement import FactoryPurchaseOrder
from models.factory_quality import FactoryQualityInspection
from models.factory_revenue import FactoryRevenueFlowRun
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


SOURCE_SPECS = {
    "quotes": {
        "model": FactoryCpqQuote, "system": "factory-cpq", "table": "factory_cpq_quotes", "domain": "demand",
        "number": "quote_number", "required": ("quote_number", "account_reference", "status"),
        "fields": ("quote_number", "account_reference", "currency", "subtotal", "cost_total", "gross_margin_percent", "status", "order_intent_id", "revision"),
    },
    "orders": {
        "model": FactoryFulfillmentOrder, "system": "factory-oms", "table": "factory_fulfillment_orders", "domain": "delivery",
        "number": "order_number", "required": ("order_number", "account_reference", "status"),
        "fields": ("order_number", "quote_number", "account_reference", "currency", "order_total", "status", "authority_source", "revision"),
    },
    "quality": {
        "model": FactoryQualityInspection, "system": "factory-qms", "table": "factory_quality_inspections", "domain": "quality",
        "number": "inspection_number", "required": ("inspection_number", "order_number", "lifecycle_status"),
        "fields": ("inspection_number", "order_number", "product_reference", "sku_reference", "inspection_type", "sample_size", "accepted_quantity", "rejected_quantity", "lifecycle_status", "revision"),
    },
    "assets": {
        "model": FactoryCustomerAsset, "system": "factory-installed-base", "table": "factory_customer_assets", "domain": "customer",
        "number": "asset_number", "required": ("asset_number", "account_reference", "status"),
        "fields": ("asset_number", "order_number", "account_reference", "product_reference", "sku_reference", "serial_number", "status", "renewal_status", "service_count", "revision"),
    },
    "revenue": {
        "model": FactoryRevenueFlowRun, "system": "factory-revenue-ledger", "table": "factory_revenue_flow_runs", "domain": "cash",
        "number": "correlation_id", "required": ("correlation_id", "account_reference", "current_stage"),
        "fields": ("correlation_id", "product_reference", "account_reference", "currency", "quoted_amount", "ordered_amount", "invoiced_amount", "paid_amount", "current_stage", "revision"),
    },
    "capacity-resources": {
        "model": FactoryPlanningResource, "system": "factory-planning", "table": "factory_planning_resources", "domain": "capacity",
        "number": "resource_number", "required": ("resource_number", "daily_capacity", "lifecycle_status"),
        "fields": ("resource_number", "resource_reference", "resource_name", "daily_capacity", "shift_hours", "efficiency_percent", "lifecycle_status", "revision"),
    },
    "production-plans": {
        "model": FactoryProductionPlan, "system": "factory-planning", "table": "factory_production_plans", "domain": "capacity",
        "number": "production_plan_number", "required": ("production_plan_number", "demand_order_number", "lifecycle_status"),
        "fields": ("production_plan_number", "demand_order_number", "product_reference", "sku_reference", "demand_quantity", "effective_daily_capacity", "capacity_days", "planned_start_at", "planned_end_at", "due_at", "material_readiness_status", "schedule_status", "lifecycle_status", "revision"),
    },
    "purchase-orders": {
        "model": FactoryPurchaseOrder, "system": "factory-procurement", "table": "factory_purchase_orders", "domain": "cash-out",
        "number": "purchase_order_number", "required": ("purchase_order_number", "demand_order_number", "lifecycle_status"),
        "fields": ("purchase_order_number", "demand_order_number", "product_reference", "sku_reference", "currency", "subtotal", "needed_by", "promised_delivery_at", "lifecycle_status", "revision"),
    },
    "partner-voice": {
        "model": FactoryVoiceOfCustomerCase, "system": "factory-voc", "table": "factory_voice_of_customer_cases", "domain": "customer",
        "number": "voice_number", "required": ("voice_number", "account_reference", "lifecycle_status"),
        "fields": ("voice_number", "source_type", "account_reference", "related_order_number", "related_asset_number", "category", "severity", "score", "sentiment", "lifecycle_status", "advocacy_status", "revision"),
    },
}


def _value(value):
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    return value


def _fingerprint(source_code: str) -> str:
    spec = SOURCE_SPECS[source_code]
    contract = {"source": source_code, "table": spec["table"], "fields": list(spec["fields"]), "required": list(spec["required"]), "version": "v1"}
    return hashlib.sha256(json.dumps(contract, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def _payload(item, fields: tuple[str, ...]) -> dict[str, object]:
    return {field: _value(getattr(item, field)) for field in fields}


def _hash(payload: dict[str, object]) -> str:
    return hashlib.sha256(json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def serialize_source(item: FactoryWarehouseSource) -> dict[str, object]:
    return {
        "id": item.id, "project_id": item.project_id, "tenant_id": item.tenant_id,
        "client_id": item.client_id, "plan_id": item.plan_id, "source_number": item.source_number,
        "source_reference": item.source_reference, "source_code": item.source_code,
        "source_system": item.source_system, "source_table": item.source_table,
        "domain": item.domain, "owner": item.owner, "purpose": item.purpose,
        "retention_days": item.retention_days, "extraction_mode": item.extraction_mode,
        "schema_contract_reference": item.schema_contract_reference,
        "schema_fingerprint": item.schema_fingerprint, "status": item.status,
        "activated_by": item.activated_by, "activated_at": item.activated_at,
        "last_load_run_id": item.last_load_run_id, "last_watermark_at": item.last_watermark_at,
        "last_published_at": item.last_published_at, "revision": item.revision,
        "updated_by": item.updated_by, "created_at": item.created_at, "updated_at": item.updated_at,
    }


def serialize_run(item: FactoryWarehouseLoadRun) -> dict[str, object]:
    return {
        "id": item.id, "project_id": item.project_id, "run_number": item.run_number,
        "load_reference": item.load_reference, "source_id": item.source_id,
        "source_number": item.source_number, "source_code": item.source_code,
        "source_table": item.source_table, "status": item.status, "cutoff_at": item.cutoff_at,
        "watermark_from": item.watermark_from, "watermark_to": item.watermark_to,
        "rows_read": item.rows_read, "rows_accepted": item.rows_accepted,
        "rows_rejected": item.rows_rejected, "reused_fact_count": item.reused_fact_count,
        "quality_score": str(item.quality_score), "schema_fingerprint": item.schema_fingerprint,
        "validation_reference": item.validation_reference, "validated_by": item.validated_by,
        "validated_at": item.validated_at, "publication_reference": item.publication_reference,
        "published_by": item.published_by, "published_at": item.published_at,
        "failure_reason": item.failure_reason, "revision": item.revision,
        "updated_by": item.updated_by, "created_at": item.created_at, "updated_at": item.updated_at,
    }


def serialize_fact(item: FactoryWarehouseFactVersion) -> dict[str, object]:
    return {
        "id": item.id, "fact_number": item.fact_number, "first_load_run_id": item.first_load_run_id,
        "source_id": item.source_id, "source_code": item.source_code, "source_system": item.source_system,
        "source_table": item.source_table, "source_object_id": item.source_object_id,
        "source_object_number": item.source_object_number, "source_revision": item.source_revision,
        "source_updated_at": item.source_updated_at, "business_date": item.business_date,
        "observed_at": item.observed_at, "payload": json.loads(item.payload_json),
        "content_hash": item.content_hash, "quality_status": item.quality_status,
    }


def serialize_issue(item: FactoryWarehouseQualityIssue) -> dict[str, object]:
    return {
        "id": item.id, "issue_number": item.issue_number, "load_run_id": item.load_run_id,
        "run_number": item.run_number, "source_object_id": item.source_object_id,
        "source_object_number": item.source_object_number, "rule_code": item.rule_code,
        "severity": item.severity, "description": item.description, "status": item.status,
        "resolution_reference": item.resolution_reference, "resolution_note": item.resolution_note,
        "resolved_by": item.resolved_by, "resolved_at": item.resolved_at,
        "revision": item.revision, "created_at": item.created_at,
    }


def serialize_lineage(item: FactoryWarehouseLineageEdge) -> dict[str, object]:
    return {
        "id": item.id, "edge_number": item.edge_number, "load_run_id": item.load_run_id,
        "run_number": item.run_number, "fact_id": item.fact_id, "fact_number": item.fact_number,
        "source_system": item.source_system, "source_table": item.source_table,
        "source_object_id": item.source_object_id, "source_revision": item.source_revision,
        "transformation_reference": item.transformation_reference, "observed_at": item.observed_at,
    }


def serialize_evidence(item: FactoryWarehouseEvidence) -> dict[str, object]:
    return {
        "id": item.id, "evidence_number": item.evidence_number, "subject_type": item.subject_type,
        "subject_id": item.subject_id, "subject_number": item.subject_number,
        "evidence_type": item.evidence_type, "evidence_reference": item.evidence_reference,
        "note": item.note, "recorded_by": item.recorded_by, "created_at": item.created_at,
    }


class FactoryDataWarehouseService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_workspace(self, *, project_id: int) -> dict[str, object]:
        async def items(model, limit: int):
            return (await self.db.execute(select(model).where(model.project_id == project_id).order_by(model.created_at.desc()).limit(limit))).scalars().all()
        sources = await items(FactoryWarehouseSource, 50)
        runs = await items(FactoryWarehouseLoadRun, 100)
        facts = await items(FactoryWarehouseFactVersion, 200)
        issues = await items(FactoryWarehouseQualityIssue, 100)
        lineage = await items(FactoryWarehouseLineageEdge, 200)
        evidence = await items(FactoryWarehouseEvidence, 200)
        return {
            "sources": [serialize_source(item) for item in sources],
            "runs": [serialize_run(item) for item in runs],
            "facts": [serialize_fact(item) for item in facts],
            "quality_issues": [serialize_issue(item) for item in issues],
            "lineage": [serialize_lineage(item) for item in lineage],
            "evidence": [serialize_evidence(item) for item in evidence],
            "available_sources": [{"code": code, "system": spec["system"], "table": spec["table"], "domain": spec["domain"], "fields": list(spec["fields"]), "fingerprint": _fingerprint(code)} for code, spec in SOURCE_SPECS.items()],
            "contract": {"copy_mode": "analytical-read-only", "fact_version": "source-id+revision", "lineage_required": True, "credentials_exposed": False},
        }

    async def create_source(self, *, project_id: int, context: TenantContext, actor: str,
                            source_reference: str, source_code: str, owner: str,
                            purpose: str, retention_days: int) -> dict[str, object]:
        code = source_code.strip()
        reference, clean_owner, clean_purpose = source_reference.strip(), owner.strip(), purpose.strip()
        if code not in SOURCE_SPECS:
            raise ValueError("Warehouse source must use an approved internal adapter")
        if not reference or not clean_owner or len(clean_purpose) < 8 or not 30 <= retention_days <= 3650:
            raise ValueError("Source registration requires reference, owner, purpose and 30-3650 day retention")
        duplicate = await self.db.scalar(select(FactoryWarehouseSource.id).where(
            FactoryWarehouseSource.project_id == project_id, FactoryWarehouseSource.source_code == code,
        ))
        if duplicate:
            raise ValueError("This tenant plan already registered the warehouse source")
        spec = SOURCE_SPECS[code]
        now = datetime.now(timezone.utc)
        source = FactoryWarehouseSource(
            id=f"warehouse-source-{secrets.token_urlsafe(18)}", project_id=project_id,
            agent_path=context.agent_path, tenant_id=context.tenant_id, client_id=context.client_id,
            plan_id=context.plan_id or f"plan-{project_id}", source_number=self._number("DWS", project_id, now),
            source_reference=reference[:255], source_code=code, source_system=str(spec["system"]),
            source_table=str(spec["table"]), domain=str(spec["domain"]), owner=clean_owner[:255],
            purpose=clean_purpose, retention_days=retention_days, updated_by=str(actor),
        )
        self.db.add(source)
        await self.db.flush()
        return serialize_source(source)

    async def activate_source(self, source_id: str, *, project_id: int, expected_revision: int,
                              actor: str, schema_contract_reference: str,
                              approval_reference: str) -> dict[str, object]:
        source = await self._source(source_id, project_id)
        self._revision(source, expected_revision)
        if source.status != "draft":
            raise ValueError("Only a draft warehouse source can be activated")
        schema_reference, approval = schema_contract_reference.strip(), approval_reference.strip()
        if not schema_reference or not approval:
            raise ValueError("Source activation requires schema-contract and approval evidence")
        now = datetime.now(timezone.utc)
        source.schema_contract_reference = schema_reference[:500]
        source.schema_fingerprint = _fingerprint(source.source_code)
        source.status = "active"; source.activated_by = str(actor); source.activated_at = now
        source.revision += 1; source.updated_by = str(actor)
        await self._evidence(source, "source", "activation", approval, f"Approved schema {schema_reference} with fingerprint {source.schema_fingerprint}", str(actor))
        await self.db.flush()
        return serialize_source(source)

    async def extract(self, source_id: str, *, project_id: int, expected_source_revision: int,
                      actor: str, load_reference: str, cutoff_at: datetime) -> dict[str, object]:
        source = await self._source(source_id, project_id)
        self._revision(source, expected_source_revision)
        if source.status != "active":
            raise ValueError("Warehouse extraction requires an active approved source")
        reference = load_reference.strip()
        cutoff = self._aware(cutoff_at)
        if not reference or cutoff > datetime.now(timezone.utc) + timedelta(minutes=5):
            raise ValueError("Extraction requires a load reference and a current or past cutoff")
        existing = await self.db.scalar(select(FactoryWarehouseLoadRun.id).where(
            FactoryWarehouseLoadRun.tenant_id == source.tenant_id,
            FactoryWarehouseLoadRun.load_reference == reference,
        ))
        if existing:
            raise ValueError("Load reference already exists in this tenant")
        spec = SOURCE_SPECS[source.source_code]
        model = spec["model"]
        # Legacy authority models persist ``datetime.now`` as local, timezone-naive
        # SQLite values. Browser cutoffs arrive as UTC ISO timestamps. Compare with
        # the equivalent local wall-clock value so current facts are not silently
        # omitted around the UTC/local calendar boundary.
        database_cutoff = cutoff.astimezone().replace(tzinfo=None)
        records = (await self.db.execute(select(model).where(
            model.project_id == project_id, model.updated_at <= database_cutoff,
        ).order_by(model.updated_at, model.id))).scalars().all()
        now = datetime.now(timezone.utc)
        run = FactoryWarehouseLoadRun(
            id=f"warehouse-run-{secrets.token_urlsafe(18)}", project_id=project_id,
            agent_path=source.agent_path, tenant_id=source.tenant_id, client_id=source.client_id,
            plan_id=source.plan_id, run_number=self._number("DWR", project_id, now),
            load_reference=reference[:255], source_id=source.id, source_number=source.source_number,
            source_code=source.source_code, source_table=source.source_table, cutoff_at=cutoff,
            watermark_from=source.last_watermark_at, schema_fingerprint=source.schema_fingerprint or _fingerprint(source.source_code),
            updated_by=str(actor),
        )
        self.db.add(run)
        await self.db.flush()
        accepted = rejected = reused = 0
        watermark_to: datetime | None = None
        for record in records:
            payload = _payload(record, spec["fields"])
            source_number = str(getattr(record, spec["number"]) or "").strip()
            missing = [field for field in spec["required"] if payload.get(field) in (None, "")]
            source_revision = int(getattr(record, "revision", 0) or 0)
            source_updated_at = self._aware(getattr(record, "updated_at"))
            watermark_to = max(watermark_to, source_updated_at) if watermark_to else source_updated_at
            if missing or source_revision <= 0:
                rejected += 1
                issue = FactoryWarehouseQualityIssue(
                    id=f"warehouse-issue-{secrets.token_urlsafe(18)}", project_id=project_id,
                    agent_path=source.agent_path, tenant_id=source.tenant_id, client_id=source.client_id,
                    plan_id=source.plan_id, issue_number=self._number("DWQ", project_id, now),
                    load_run_id=run.id, run_number=run.run_number, source_object_id=str(record.id),
                    source_object_number=source_number or None, rule_code="required-authority-fields",
                    severity="blocking", description=f"Missing fields: {', '.join(missing) or 'positive revision'}",
                    updated_by=str(actor),
                )
                self.db.add(issue)
                continue
            fact = await self.db.scalar(select(FactoryWarehouseFactVersion).where(
                FactoryWarehouseFactVersion.tenant_id == source.tenant_id,
                FactoryWarehouseFactVersion.source_code == source.source_code,
                FactoryWarehouseFactVersion.source_object_id == str(record.id),
                FactoryWarehouseFactVersion.source_revision == source_revision,
            ))
            if fact:
                reused += 1
            else:
                fact = FactoryWarehouseFactVersion(
                    id=f"warehouse-fact-{secrets.token_urlsafe(18)}", project_id=project_id,
                    agent_path=source.agent_path, tenant_id=source.tenant_id, client_id=source.client_id,
                    plan_id=source.plan_id, fact_number=self._number("DWF", project_id, now),
                    first_load_run_id=run.id, source_id=source.id, source_code=source.source_code,
                    source_system=source.source_system, source_table=source.source_table,
                    source_object_id=str(record.id), source_object_number=source_number,
                    source_revision=source_revision, source_updated_at=source_updated_at,
                    business_date=source_updated_at, observed_at=now,
                    payload_json=json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")),
                    content_hash=_hash(payload),
                )
                self.db.add(fact)
                await self.db.flush()
            accepted += 1
            self.db.add(FactoryWarehouseLineageEdge(
                id=f"warehouse-lineage-{secrets.token_urlsafe(18)}", project_id=project_id,
                agent_path=source.agent_path, tenant_id=source.tenant_id, client_id=source.client_id,
                plan_id=source.plan_id, edge_number=self._number("DWL", project_id, now),
                load_run_id=run.id, run_number=run.run_number, fact_id=fact.id, fact_number=fact.fact_number,
                source_system=source.source_system, source_table=source.source_table,
                source_object_id=str(record.id), source_revision=source_revision,
                transformation_reference=f"factory-warehouse-v1:{source.source_code}:identity-copy",
                observed_at=now,
            ))
        run.rows_read = len(records); run.rows_accepted = accepted; run.rows_rejected = rejected
        run.reused_fact_count = reused; run.watermark_to = watermark_to
        run.quality_score = (Decimal(accepted) * 100 / Decimal(len(records)) if records else Decimal(0)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        await self._evidence(run, "run", "extraction", reference, f"Read {len(records)}, accepted {accepted}, rejected {rejected}, reused {reused}; no source facts were changed", str(actor))
        await self.db.flush()
        return serialize_run(run)

    async def validate(self, run_id: str, *, project_id: int, expected_revision: int,
                       actor: str, validation_reference: str) -> dict[str, object]:
        run = await self._run(run_id, project_id)
        self._revision(run, expected_revision)
        if run.status != "extracted":
            raise ValueError("Only an extracted warehouse run can be validated")
        reference = validation_reference.strip()
        if not reference:
            raise ValueError("Validation evidence reference is required")
        issues = (await self.db.execute(select(FactoryWarehouseQualityIssue).where(
            FactoryWarehouseQualityIssue.load_run_id == run.id,
            FactoryWarehouseQualityIssue.status == "open",
        ))).scalars().all()
        now = datetime.now(timezone.utc)
        run.validation_reference = reference[:500]; run.validated_by = str(actor); run.validated_at = now
        if issues or run.rows_read == 0 or run.rows_read != run.rows_accepted + run.rows_rejected:
            run.status = "failed"
            run.failure_reason = (
                "Validation blocked because the source snapshot is empty"
                if run.rows_read == 0
                else f"Validation blocked by {len(issues)} open quality issue(s)"
            )
            evidence_type, note = "validation-failed", run.failure_reason
        else:
            run.status = "validated"
            evidence_type, note = "validation", f"Validated {run.rows_accepted} analytical fact memberships and lineage edges"
        run.revision += 1; run.updated_by = str(actor)
        await self._evidence(run, "run", evidence_type, reference, note, str(actor))
        await self.db.flush()
        return serialize_run(run)

    async def publish(self, run_id: str, *, project_id: int, expected_revision: int,
                      actor: str, publication_reference: str) -> dict[str, object]:
        run = await self._run(run_id, project_id)
        self._revision(run, expected_revision)
        if run.status != "validated":
            raise ValueError("Only a validated warehouse run can be published")
        reference = publication_reference.strip()
        if not reference:
            raise ValueError("Publication evidence reference is required")
        if run.validated_by == str(actor):
            raise ValueError("Warehouse publisher must be independent from the validator")
        source = await self._source(run.source_id, project_id)
        now = datetime.now(timezone.utc)
        run.status = "published"; run.publication_reference = reference[:500]
        run.published_by = str(actor); run.published_at = now; run.revision += 1; run.updated_by = str(actor)
        source.last_load_run_id = run.id; source.last_watermark_at = run.watermark_to
        source.last_published_at = now; source.revision += 1; source.updated_by = str(actor)
        await self._evidence(run, "run", "publication", reference, f"Published governed snapshot membership for {run.rows_accepted} facts", str(actor))
        await self.db.flush()
        return {"run": serialize_run(run), "source": serialize_source(source)}

    async def _source(self, item_id: str, project_id: int) -> FactoryWarehouseSource:
        item = await self.db.scalar(select(FactoryWarehouseSource).where(
            FactoryWarehouseSource.id == item_id, FactoryWarehouseSource.project_id == project_id,
        ))
        if not item:
            raise KeyError("Warehouse source not found in this tenant plan")
        return item

    async def _run(self, item_id: str, project_id: int) -> FactoryWarehouseLoadRun:
        item = await self.db.scalar(select(FactoryWarehouseLoadRun).where(
            FactoryWarehouseLoadRun.id == item_id, FactoryWarehouseLoadRun.project_id == project_id,
        ))
        if not item:
            raise KeyError("Warehouse load run not found in this tenant plan")
        return item

    async def _evidence(self, item, subject_type: str, evidence_type: str,
                        reference: str, note: str, actor: str) -> None:
        number = getattr(item, "source_number") if subject_type == "source" else getattr(item, "run_number")
        now = datetime.now(timezone.utc)
        self.db.add(FactoryWarehouseEvidence(
            id=f"warehouse-evidence-{secrets.token_urlsafe(18)}", project_id=item.project_id,
            agent_path=item.agent_path, tenant_id=item.tenant_id, client_id=item.client_id, plan_id=item.plan_id,
            evidence_number=self._number("DWE", item.project_id, now), subject_type=subject_type,
            subject_id=item.id, subject_number=number, evidence_type=evidence_type,
            evidence_reference=reference.strip()[:500], note=note.strip(), recorded_by=actor,
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
            raise ValueError("Warehouse record changed; refresh before continuing")
