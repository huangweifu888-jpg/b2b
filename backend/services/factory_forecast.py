"""Governed rolling demand, capacity and cash forecasting."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
import hashlib
import json
import math
import re
import secrets

from core.tenant_context import TenantContext
from models.factory_data_warehouse import (
    FactoryWarehouseFactVersion,
    FactoryWarehouseLineageEdge,
    FactoryWarehouseLoadRun,
)
from models.factory_forecast import (
    FactoryForecastBucket,
    FactoryForecastEvidence,
    FactoryForecastInputEdge,
    FactoryForecastPolicy,
    FactoryForecastPolicyVersion,
    FactoryForecastRun,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


MONEY = Decimal("0.01")
QUANTITY = Decimal("0.0001")
PERCENT = Decimal("0.0001")
POLICY_CODE = re.compile(r"^[a-z][a-z0-9.-]{2,99}$")
MODEL_TYPE = "weighted-pipeline-capacity-cash"
SOURCE_CODES = (
    "quotes", "orders", "revenue", "capacity-resources",
    "production-plans", "purchase-orders",
)


def _utc(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def _decimal(value: object, label: str, quantum: Decimal = MONEY) -> Decimal:
    try:
        return Decimal(str(value or 0)).quantize(quantum, rounding=ROUND_HALF_UP)
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise ValueError(f"{label} must be numeric") from exc


def _percent(value: object, label: str, minimum: Decimal = Decimal("0"), maximum: Decimal = Decimal("100")) -> Decimal:
    result = _decimal(value, label, PERCENT)
    if result < minimum or result > maximum:
        raise ValueError(f"{label} must be between {minimum} and {maximum}")
    return result


def _payload(item: FactoryWarehouseFactVersion) -> dict[str, object]:
    try:
        parsed = json.loads(item.payload_json)
    except (TypeError, ValueError) as exc:
        raise ValueError("Published warehouse forecast input is invalid") from exc
    if not isinstance(parsed, dict):
        raise ValueError("Published warehouse forecast input must be an object")
    return parsed


def serialize_policy(item: FactoryForecastPolicy) -> dict[str, object]:
    return {
        "id": item.id, "policy_number": item.policy_number,
        "policy_reference": item.policy_reference, "policy_code": item.policy_code,
        "owner": item.owner, "purpose": item.purpose, "status": item.status,
        "current_version_id": item.current_version_id,
        "current_version_number": item.current_version_number, "revision": item.revision,
    }


def serialize_version(item: FactoryForecastPolicyVersion) -> dict[str, object]:
    return {
        "id": item.id, "version_number_record": item.version_number_record,
        "version_reference": item.version_reference, "policy_id": item.policy_id,
        "policy_number": item.policy_number, "policy_code": item.policy_code,
        "version_number": item.version_number, "label": item.label,
        "model_type": item.model_type, "horizon_days": item.horizon_days,
        "bucket_days": item.bucket_days,
        "demand_growth_percent": str(item.demand_growth_percent),
        "pipeline_probability_percent": str(item.pipeline_probability_percent),
        "collection_percent": str(item.collection_percent),
        "capacity_buffer_percent": str(item.capacity_buffer_percent),
        "procurement_payment_percent": str(item.procurement_payment_percent),
        "policy_fingerprint": item.policy_fingerprint, "status": item.status,
        "change_reason": item.change_reason, "effective_from": item.effective_from,
        "authored_by": item.authored_by, "submitted_by": item.submitted_by,
        "approved_by": item.approved_by, "revision": item.revision,
    }


def serialize_run(item: FactoryForecastRun) -> dict[str, object]:
    return {
        "id": item.id, "run_number": item.run_number,
        "forecast_reference": item.forecast_reference, "policy_id": item.policy_id,
        "policy_version_id": item.policy_version_id,
        "policy_version_number": item.policy_version_number,
        "policy_fingerprint": item.policy_fingerprint, "model_type": item.model_type,
        "as_of_at": item.as_of_at, "horizon_days": item.horizon_days,
        "bucket_days": item.bucket_days, "currency": item.currency,
        "source_count": item.source_count, "input_fact_count": item.input_fact_count,
        "pipeline_demand_value": str(item.pipeline_demand_value),
        "confirmed_order_value": str(item.confirmed_order_value),
        "required_capacity_units": str(item.required_capacity_units),
        "available_capacity_units": str(item.available_capacity_units),
        "capacity_gap_units": str(item.capacity_gap_units),
        "expected_cash_in": str(item.expected_cash_in),
        "expected_cash_out": str(item.expected_cash_out),
        "net_cash_change": str(item.net_cash_change),
        "forecast_classification": item.forecast_classification, "status": item.status,
        "calculated_by": item.calculated_by, "verified_by": item.verified_by,
        "revision": item.revision,
    }


def serialize_edge(item: FactoryForecastInputEdge) -> dict[str, object]:
    return {
        "id": item.id, "edge_number": item.edge_number, "forecast_run_id": item.forecast_run_id,
        "source_code": item.source_code, "warehouse_load_run_id": item.warehouse_load_run_id,
        "warehouse_run_number": item.warehouse_run_number,
        "warehouse_fact_id": item.warehouse_fact_id,
        "warehouse_fact_number": item.warehouse_fact_number,
        "source_object_id": item.source_object_id,
        "source_object_number": item.source_object_number,
        "source_revision": item.source_revision, "content_hash": item.content_hash,
    }


def serialize_bucket(item: FactoryForecastBucket) -> dict[str, object]:
    return {
        "id": item.id, "bucket_number": item.bucket_number,
        "forecast_run_id": item.forecast_run_id, "bucket_index": item.bucket_index,
        "bucket_start": item.bucket_start, "bucket_end": item.bucket_end,
        "pipeline_demand_value": str(item.pipeline_demand_value),
        "confirmed_order_value": str(item.confirmed_order_value),
        "required_capacity_units": str(item.required_capacity_units),
        "available_capacity_units": str(item.available_capacity_units),
        "expected_cash_in": str(item.expected_cash_in),
        "expected_cash_out": str(item.expected_cash_out),
        "net_cash_change": str(item.net_cash_change),
    }


class FactoryForecastService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_workspace(self, *, project_id: int) -> dict[str, object]:
        async def items(model, limit: int):
            return (await self.db.execute(select(model).where(
                model.project_id == project_id,
            ).order_by(model.created_at.desc()).limit(limit))).scalars().all()

        policies = await items(FactoryForecastPolicy, 100)
        versions = await items(FactoryForecastPolicyVersion, 200)
        runs = await items(FactoryForecastRun, 200)
        edges = await items(FactoryForecastInputEdge, 2000)
        buckets = await items(FactoryForecastBucket, 1000)
        evidence = await items(FactoryForecastEvidence, 2000)
        source_readiness = await self._source_readiness(project_id)
        return {
            "policies": [serialize_policy(item) for item in policies],
            "policy_versions": [serialize_version(item) for item in versions],
            "forecast_runs": [serialize_run(item) for item in runs],
            "input_edges": [serialize_edge(item) for item in edges],
            "buckets": [serialize_bucket(item) for item in buckets],
            "evidence": [{
                "id": item.id, "subject_type": item.subject_type,
                "subject_id": item.subject_id, "evidence_type": item.evidence_type,
                "evidence_reference": item.evidence_reference, "recorded_by": item.recorded_by,
            } for item in evidence],
            "source_readiness": source_readiness,
            "contract": {
                "forecast_classification": "management-rolling-forecast",
                "formal_financial_forecast": False,
                "published_warehouse_required": True,
                "policy_approval_independent": True,
                "run_verification_independent": True,
                "historical_recalculation": False,
                "authority_writeback": False,
                "required_source_codes": list(SOURCE_CODES),
            },
        }

    async def create_policy(self, *, project_id: int, context: TenantContext, actor: str,
                            policy_reference: str, policy_code: str, owner: str, purpose: str,
                            **version_fields) -> dict[str, object]:
        reference, code = policy_reference.strip(), policy_code.strip().lower()
        clean_owner, clean_purpose = owner.strip(), purpose.strip()
        if not reference or not POLICY_CODE.fullmatch(code):
            raise ValueError("Forecast policy requires a reference and stable lowercase code")
        if not clean_owner or len(clean_purpose) < 8:
            raise ValueError("Forecast policy requires owner and explicit purpose")
        duplicate = await self.db.scalar(select(FactoryForecastPolicy.id).where(
            FactoryForecastPolicy.tenant_id == context.tenant_id,
            FactoryForecastPolicy.policy_code == code,
        ))
        if duplicate:
            raise ValueError("Forecast policy code already exists in this tenant")
        now = datetime.now(timezone.utc)
        policy = FactoryForecastPolicy(
            id=f"forecast-policy-{secrets.token_urlsafe(18)}", project_id=project_id,
            agent_path=context.agent_path, tenant_id=context.tenant_id, client_id=context.client_id,
            plan_id=context.plan_id or f"plan-{project_id}", policy_number=self._number("FCP", project_id, now),
            policy_reference=reference[:255], policy_code=code, owner=clean_owner[:255],
            purpose=clean_purpose, updated_by=str(actor),
        )
        self.db.add(policy); await self.db.flush()
        version = await self._create_version(policy, version_number=1, actor=str(actor), **version_fields)
        await self._evidence(version, "policy-version", "policy-authored", version.version_reference,
                             "Created immutable forecast policy version 1", str(actor))
        await self.db.flush()
        return {"policy": serialize_policy(policy), "version": serialize_version(version)}

    async def create_policy_version(self, policy_id: str, *, project_id: int,
                                    expected_policy_revision: int, actor: str, **version_fields) -> dict[str, object]:
        policy = await self._policy(policy_id, project_id); self._revision(policy, expected_policy_revision)
        if policy.status != "active" or not policy.current_version_number:
            raise ValueError("A new forecast version requires an active published policy")
        version = await self._create_version(
            policy, version_number=policy.current_version_number + 1, actor=str(actor), **version_fields,
        )
        policy.revision += 1; policy.updated_by = str(actor)
        await self._evidence(version, "policy-version", "policy-authored", version.version_reference,
                             "Created a new forecast version without recalculating history", str(actor))
        await self.db.flush()
        return {"policy": serialize_policy(policy), "version": serialize_version(version)}

    async def submit_policy_version(self, version_id: str, *, project_id: int,
                                    expected_revision: int, actor: str,
                                    evidence_reference: str) -> dict[str, object]:
        version = await self._version(version_id, project_id); self._revision(version, expected_revision)
        if version.status != "draft":
            raise ValueError("Only a draft forecast policy can be submitted")
        reference = evidence_reference.strip()
        if not reference:
            raise ValueError("Forecast policy submission requires evidence")
        version.status = "pending-approval"; version.submitted_by = str(actor)
        version.submitted_at = datetime.now(timezone.utc); version.revision += 1; version.updated_by = str(actor)
        await self._evidence(version, "policy-version", "policy-submission", reference,
                             f"Submitted forecast policy fingerprint {version.policy_fingerprint}", str(actor))
        await self.db.flush(); return serialize_version(version)

    async def approve_policy_version(self, version_id: str, *, project_id: int,
                                     expected_revision: int, actor: str,
                                     evidence_reference: str) -> dict[str, object]:
        version = await self._version(version_id, project_id); self._revision(version, expected_revision)
        if version.status != "pending-approval":
            raise ValueError("Only a pending forecast policy can be approved")
        if version.authored_by == str(actor):
            raise ValueError("Forecast policy approver must be independent from the author")
        reference = evidence_reference.strip()
        if not reference:
            raise ValueError("Forecast policy approval requires evidence")
        policy = await self._policy(version.policy_id, project_id)
        previous = await self._version(policy.current_version_id, project_id) if policy.current_version_id else None
        if previous:
            previous.status = "superseded"; previous.revision += 1; previous.updated_by = str(actor)
        now = datetime.now(timezone.utc)
        version.status = "published"; version.approval_reference = reference[:500]
        version.approved_by = str(actor); version.approved_at = now; version.revision += 1; version.updated_by = str(actor)
        policy.status = "active"; policy.current_version_id = version.id
        policy.current_version_number = version.version_number; policy.revision += 1; policy.updated_by = str(actor)
        await self._evidence(version, "policy-version", "policy-publication", reference,
                             "Published forecast policy; historical runs remain pinned", str(actor))
        await self.db.flush()
        return {"policy": serialize_policy(policy), "version": serialize_version(version),
                "superseded_version": serialize_version(previous) if previous else None}

    async def calculate(self, *, project_id: int, actor: str, context: TenantContext,
                        policy_version_id: str, forecast_reference: str,
                        as_of_at: datetime) -> dict[str, object]:
        version = await self._version(policy_version_id, project_id)
        if version.status != "published":
            raise ValueError("Forecast calculation requires a published policy version")
        reference = forecast_reference.strip()
        if not reference:
            raise ValueError("Forecast calculation requires a stable reference")
        duplicate = await self.db.scalar(select(FactoryForecastRun.id).where(
            FactoryForecastRun.tenant_id == context.tenant_id,
            FactoryForecastRun.forecast_reference == reference,
        ))
        if duplicate:
            raise ValueError("Forecast reference already exists in this tenant")
        inputs = await self._published_inputs(project_id, context.tenant_id)
        metrics = self._calculate_metrics(inputs, version)
        as_of = _utc(as_of_at); now = datetime.now(timezone.utc)
        if as_of > now + timedelta(minutes=5) or as_of < now - timedelta(days=7):
            raise ValueError("Forecast as-of time must be current and reproducible")
        run = FactoryForecastRun(
            id=f"forecast-run-{secrets.token_urlsafe(18)}", project_id=project_id,
            agent_path=context.agent_path, tenant_id=context.tenant_id, client_id=context.client_id,
            plan_id=context.plan_id or f"plan-{project_id}", run_number=self._number("FCR", project_id, now),
            forecast_reference=reference[:255], policy_id=version.policy_id,
            policy_version_id=version.id, policy_version_number=version.version_number,
            policy_fingerprint=version.policy_fingerprint, model_type=version.model_type,
            as_of_at=as_of, horizon_days=version.horizon_days, bucket_days=version.bucket_days,
            currency=metrics["currency"], source_count=len(SOURCE_CODES), input_fact_count=len(inputs),
            pipeline_demand_value=metrics["pipeline"], confirmed_order_value=metrics["orders"],
            required_capacity_units=metrics["required_capacity"],
            available_capacity_units=metrics["available_capacity"],
            capacity_gap_units=metrics["capacity_gap"], expected_cash_in=metrics["cash_in"],
            expected_cash_out=metrics["cash_out"], net_cash_change=metrics["net_cash"],
            calculated_by=str(actor), calculated_at=now, updated_by=str(actor),
        )
        self.db.add(run); await self.db.flush()
        edges: list[FactoryForecastInputEdge] = []
        for index, (load, fact) in enumerate(inputs, start=1):
            edge = FactoryForecastInputEdge(
                id=f"forecast-edge-{secrets.token_urlsafe(18)}", project_id=project_id,
                agent_path=context.agent_path, tenant_id=context.tenant_id, client_id=context.client_id,
                plan_id=context.plan_id or f"plan-{project_id}", edge_number=self._number("FCE", project_id, now, index),
                forecast_run_id=run.id, run_number=run.run_number, source_code=load.source_code,
                warehouse_load_run_id=load.id, warehouse_run_number=load.run_number,
                warehouse_fact_id=fact.id, warehouse_fact_number=fact.fact_number,
                source_object_id=fact.source_object_id, source_object_number=fact.source_object_number,
                source_revision=fact.source_revision, content_hash=fact.content_hash,
            )
            self.db.add(edge); edges.append(edge)
        buckets = await self._create_buckets(run, metrics, context, now)
        await self._evidence(run, "forecast-run", "forecast-calculated", reference,
                             f"Calculated management rolling forecast from {len(inputs)} pinned published facts", str(actor))
        await self.db.flush()
        return {"run": serialize_run(run), "input_edges": [serialize_edge(item) for item in edges],
                "buckets": [serialize_bucket(item) for item in buckets]}

    async def verify(self, run_id: str, *, project_id: int, actor: str,
                     expected_revision: int, verification_reference: str,
                     verification_note: str) -> dict[str, object]:
        run = await self._run(run_id, project_id); self._revision(run, expected_revision)
        if run.status != "calculated":
            raise ValueError("Only a calculated forecast can be verified")
        if run.calculated_by == str(actor):
            raise ValueError("Forecast verifier must be independent from the calculator")
        reference, note = verification_reference.strip(), verification_note.strip()
        if not reference or len(note) < 8:
            raise ValueError("Forecast verification requires evidence and an explicit note")
        run.status = "published"; run.verification_reference = reference[:500]
        run.verification_note = note; run.verified_by = str(actor)
        run.verified_at = datetime.now(timezone.utc); run.revision += 1; run.updated_by = str(actor)
        await self._evidence(run, "forecast-run", "forecast-publication", reference,
                             "Published a management rolling forecast; not a formal financial forecast", str(actor))
        await self.db.flush(); return serialize_run(run)

    async def _source_readiness(self, project_id: int) -> list[dict[str, object]]:
        runs = (await self.db.execute(select(FactoryWarehouseLoadRun).where(
            FactoryWarehouseLoadRun.project_id == project_id,
            FactoryWarehouseLoadRun.source_code.in_(SOURCE_CODES),
            FactoryWarehouseLoadRun.status == "published",
        ).order_by(FactoryWarehouseLoadRun.published_at.desc()))).scalars().all()
        latest: dict[str, FactoryWarehouseLoadRun] = {}
        for run in runs:
            latest.setdefault(run.source_code, run)
        return [{
            "source_code": code, "ready": code in latest,
            "load_run_id": latest[code].id if code in latest else None,
            "run_number": latest[code].run_number if code in latest else None,
            "published_at": latest[code].published_at if code in latest else None,
        } for code in SOURCE_CODES]

    async def _published_inputs(self, project_id: int, tenant_id: str):
        runs = (await self.db.execute(select(FactoryWarehouseLoadRun).where(
            FactoryWarehouseLoadRun.project_id == project_id,
            FactoryWarehouseLoadRun.tenant_id == tenant_id,
            FactoryWarehouseLoadRun.source_code.in_(SOURCE_CODES),
            FactoryWarehouseLoadRun.status == "published",
        ).order_by(FactoryWarehouseLoadRun.published_at.desc()))).scalars().all()
        latest: dict[str, FactoryWarehouseLoadRun] = {}
        for run in runs:
            latest.setdefault(run.source_code, run)
        missing = [code for code in SOURCE_CODES if code not in latest]
        if missing:
            raise ValueError(f"Forecast requires latest published warehouse sources: {', '.join(missing)}")
        result = []
        for code in SOURCE_CODES:
            load = latest[code]
            edges = (await self.db.execute(select(FactoryWarehouseLineageEdge).where(
                FactoryWarehouseLineageEdge.load_run_id == load.id,
            ))).scalars().all()
            if not edges:
                raise ValueError(f"Published forecast source {code} has no lineage facts")
            facts = (await self.db.execute(select(FactoryWarehouseFactVersion).where(
                FactoryWarehouseFactVersion.id.in_(list(dict.fromkeys(edge.fact_id for edge in edges))),
                FactoryWarehouseFactVersion.project_id == project_id,
                FactoryWarehouseFactVersion.tenant_id == tenant_id,
                FactoryWarehouseFactVersion.source_code == code,
                FactoryWarehouseFactVersion.quality_status == "accepted",
            ))).scalars().all()
            result.extend((load, fact) for fact in facts)
        return result

    def _calculate_metrics(self, inputs, version: FactoryForecastPolicyVersion) -> dict[str, object]:
        grouped: dict[str, list[dict[str, object]]] = {code: [] for code in SOURCE_CODES}
        currencies: set[str] = set()
        for load, fact in inputs:
            payload = _payload(fact); grouped[load.source_code].append(payload)
            currency = str(payload.get("currency") or "").strip().upper()
            if currency:
                currencies.add(currency)
        if len(currencies) != 1:
            raise ValueError("Forecast monetary facts must resolve to exactly one currency")
        growth = Decimal("1") + Decimal(version.demand_growth_percent) / Decimal("100")
        probability = Decimal(version.pipeline_probability_percent) / Decimal("100")
        collection = Decimal(version.collection_percent) / Decimal("100")
        buffer = Decimal("1") + Decimal(version.capacity_buffer_percent) / Decimal("100")
        procurement = Decimal(version.procurement_payment_percent) / Decimal("100")
        ordered_quotes = {str(row.get("quote_number") or "") for row in grouped["orders"]}
        pipeline = sum((_decimal(row.get("subtotal"), "Quote subtotal") for row in grouped["quotes"]
                        if str(row.get("status") or "").lower() not in {"rejected", "expired", "cancelled"}
                        and str(row.get("quote_number") or "") not in ordered_quotes), Decimal("0"))
        pipeline = (pipeline * probability * growth).quantize(MONEY, rounding=ROUND_HALF_UP)
        orders = sum((_decimal(row.get("order_total"), "Order total") for row in grouped["orders"]
                      if str(row.get("status") or "").lower() not in {"cancelled", "rejected"}), Decimal("0"))
        orders = (orders * growth).quantize(MONEY, rounding=ROUND_HALF_UP)
        required = sum((_decimal(row.get("demand_quantity"), "Plan demand", QUANTITY)
                        for row in grouped["production-plans"]
                        if str(row.get("lifecycle_status") or "").lower() not in {"cancelled", "rejected"}), Decimal("0"))
        required = (required * growth * buffer).quantize(QUANTITY, rounding=ROUND_HALF_UP)
        available = sum((
            _decimal(row.get("daily_capacity"), "Daily capacity", QUANTITY)
            * Decimal(version.horizon_days)
            * (_decimal(row.get("efficiency_percent"), "Efficiency", PERCENT) / Decimal("100"))
            for row in grouped["capacity-resources"]
            if str(row.get("lifecycle_status") or "").lower() in {"approved", "active"}
        ), Decimal("0")).quantize(QUANTITY, rounding=ROUND_HALF_UP)
        capacity_gap = (available - required).quantize(QUANTITY, rounding=ROUND_HALF_UP)
        outstanding = sum((max(Decimal("0"), _decimal(row.get("invoiced_amount"), "Invoice")
                                   - _decimal(row.get("paid_amount"), "Paid"))
                           for row in grouped["revenue"]), Decimal("0"))
        cash_in = ((outstanding + pipeline) * collection).quantize(MONEY, rounding=ROUND_HALF_UP)
        cash_out = (sum((_decimal(row.get("subtotal"), "Purchase order subtotal")
                         for row in grouped["purchase-orders"]
                         if str(row.get("lifecycle_status") or "").lower() not in {"cancelled", "rejected"}), Decimal("0"))
                    * procurement).quantize(MONEY, rounding=ROUND_HALF_UP)
        return {
            "currency": next(iter(currencies)), "pipeline": pipeline, "orders": orders,
            "required_capacity": required, "available_capacity": available,
            "capacity_gap": capacity_gap, "cash_in": cash_in, "cash_out": cash_out,
            "net_cash": (cash_in - cash_out).quantize(MONEY, rounding=ROUND_HALF_UP),
        }

    async def _create_buckets(self, run: FactoryForecastRun, metrics: dict[str, object],
                              context: TenantContext, now: datetime) -> list[FactoryForecastBucket]:
        count = int(math.ceil(run.horizon_days / run.bucket_days))
        fields = {
            "pipeline_demand_value": (metrics["pipeline"], MONEY),
            "confirmed_order_value": (metrics["orders"], MONEY),
            "required_capacity_units": (metrics["required_capacity"], QUANTITY),
            "available_capacity_units": (metrics["available_capacity"], QUANTITY),
            "expected_cash_in": (metrics["cash_in"], MONEY),
            "expected_cash_out": (metrics["cash_out"], MONEY),
            "net_cash_change": (metrics["net_cash"], MONEY),
        }
        shares: dict[str, list[Decimal]] = {}
        for name, (total, quantum) in fields.items():
            per = (Decimal(total) / Decimal(count)).quantize(quantum, rounding=ROUND_HALF_UP)
            values = [per for _ in range(count)]
            values[-1] = (Decimal(total) - sum(values[:-1], Decimal("0"))).quantize(quantum, rounding=ROUND_HALF_UP)
            shares[name] = values
        buckets = []
        for index in range(count):
            start = run.as_of_at + timedelta(days=index * run.bucket_days)
            end = min(run.as_of_at + timedelta(days=(index + 1) * run.bucket_days),
                      run.as_of_at + timedelta(days=run.horizon_days))
            item = FactoryForecastBucket(
                id=f"forecast-bucket-{secrets.token_urlsafe(18)}", project_id=run.project_id,
                agent_path=context.agent_path, tenant_id=context.tenant_id, client_id=context.client_id,
                plan_id=context.plan_id or f"plan-{run.project_id}",
                bucket_number=self._number("FCB", run.project_id, now, index + 1),
                forecast_run_id=run.id, run_number=run.run_number, bucket_index=index + 1,
                bucket_start=start, bucket_end=end,
                **{name: values[index] for name, values in shares.items()},
            )
            self.db.add(item); buckets.append(item)
        return buckets

    async def _create_version(self, policy: FactoryForecastPolicy, *, version_number: int,
                              actor: str, version_reference: str, label: str,
                              model_type: str, horizon_days: int, bucket_days: int,
                              demand_growth_percent: object, pipeline_probability_percent: object,
                              collection_percent: object, capacity_buffer_percent: object,
                              procurement_payment_percent: object, effective_from: datetime,
                              change_reason: str):
        reference, clean_label, reason = version_reference.strip(), label.strip(), change_reason.strip()
        if not reference or not clean_label or len(reason) < 8:
            raise ValueError("Forecast version requires reference, label and explicit change reason")
        if model_type != MODEL_TYPE:
            raise ValueError(f"Forecast policy model must be {MODEL_TYPE}")
        if not 7 <= int(horizon_days) <= 365 or not 1 <= int(bucket_days) <= int(horizon_days):
            raise ValueError("Forecast horizon must be 7-365 days and bucket must fit the horizon")
        values = {
            "demand_growth_percent": _percent(demand_growth_percent, "Demand growth", Decimal("-100"), Decimal("500")),
            "pipeline_probability_percent": _percent(pipeline_probability_percent, "Pipeline probability"),
            "collection_percent": _percent(collection_percent, "Collection percent"),
            "capacity_buffer_percent": _percent(capacity_buffer_percent, "Capacity buffer", Decimal("0"), Decimal("200")),
            "procurement_payment_percent": _percent(procurement_payment_percent, "Procurement payment percent"),
        }
        effective = _utc(effective_from); now = datetime.now(timezone.utc)
        fingerprint = hashlib.sha256(json.dumps({
            "policy_code": policy.policy_code, "version": version_number, "model_type": model_type,
            "horizon_days": horizon_days, "bucket_days": bucket_days,
            **{key: str(value) for key, value in values.items()}, "effective_from": effective.isoformat(),
        }, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
        item = FactoryForecastPolicyVersion(
            id=f"forecast-policy-version-{secrets.token_urlsafe(18)}", project_id=policy.project_id,
            agent_path=policy.agent_path, tenant_id=policy.tenant_id, client_id=policy.client_id,
            plan_id=policy.plan_id, version_number_record=self._number("FCV", policy.project_id, now),
            version_reference=reference[:255], policy_id=policy.id, policy_number=policy.policy_number,
            policy_code=policy.policy_code, version_number=version_number, label=clean_label[:255],
            model_type=model_type, horizon_days=int(horizon_days), bucket_days=int(bucket_days),
            policy_fingerprint=fingerprint, change_reason=reason, effective_from=effective,
            authored_by=str(actor), updated_by=str(actor), **values,
        )
        self.db.add(item); await self.db.flush(); return item

    async def _policy(self, item_id: str, project_id: int):
        item = await self.db.scalar(select(FactoryForecastPolicy).where(
            FactoryForecastPolicy.id == item_id, FactoryForecastPolicy.project_id == project_id,
        ))
        if not item: raise KeyError("Forecast policy not found in this tenant plan")
        return item

    async def _version(self, item_id: str | None, project_id: int):
        item = await self.db.scalar(select(FactoryForecastPolicyVersion).where(
            FactoryForecastPolicyVersion.id == item_id,
            FactoryForecastPolicyVersion.project_id == project_id,
        ))
        if not item: raise KeyError("Forecast policy version not found in this tenant plan")
        return item

    async def _run(self, item_id: str, project_id: int):
        item = await self.db.scalar(select(FactoryForecastRun).where(
            FactoryForecastRun.id == item_id, FactoryForecastRun.project_id == project_id,
        ))
        if not item: raise KeyError("Forecast run not found in this tenant plan")
        return item

    async def _evidence(self, subject, subject_type: str, evidence_type: str,
                        reference: str, note: str, actor: str):
        now = datetime.now(timezone.utc)
        number = getattr(subject, "version_number_record", None) or getattr(subject, "run_number", subject.id)
        item = FactoryForecastEvidence(
            id=f"forecast-evidence-{secrets.token_urlsafe(18)}", project_id=subject.project_id,
            agent_path=subject.agent_path, tenant_id=subject.tenant_id, client_id=subject.client_id,
            plan_id=subject.plan_id, evidence_number=self._number("FCEV", subject.project_id, now),
            subject_type=subject_type, subject_id=subject.id, subject_number=number,
            evidence_type=evidence_type, evidence_reference=reference[:500], note=note,
            recorded_by=actor,
        )
        self.db.add(item); return item

    @staticmethod
    def _revision(item, expected: int) -> None:
        if int(item.revision) != int(expected):
            raise ValueError(f"Forecast revision conflict: expected {expected}, current {item.revision}")

    @staticmethod
    def _number(prefix: str, project_id: int, now: datetime, sequence: int | None = None) -> str:
        suffix = f"-{sequence:03d}" if sequence is not None else ""
        return f"{prefix}-{project_id}-{now.strftime('%Y%m%d%H%M%S%f')}-{secrets.token_hex(3).upper()}{suffix}"
