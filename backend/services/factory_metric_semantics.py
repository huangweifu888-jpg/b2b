"""Governed metric vocabulary with immutable versions and warehouse-pinned results."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
import hashlib
import json
import re
import secrets

from core.tenant_context import TenantContext
from models.factory_data_warehouse import (
    FactoryWarehouseFactVersion,
    FactoryWarehouseLineageEdge,
    FactoryWarehouseLoadRun,
    FactoryWarehouseSource,
)
from models.factory_metric_semantics import (
    FactoryMetricDefinition,
    FactoryMetricEvaluationRun,
    FactoryMetricEvidence,
    FactoryMetricObservation,
    FactoryMetricVersion,
)
from services.factory_data_warehouse import SOURCE_SPECS
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


AGGREGATIONS = {"count", "sum", "average", "ratio", "percentage"}
FILTER_OPERATORS = {"eq", "ne"}
METRIC_CODE = re.compile(r"^[a-z][a-z0-9_.-]{2,99}$")
SIX_PLACES = Decimal("0.000001")


def _decimal(value: object, *, field: str) -> Decimal:
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise ValueError(f"Metric field {field} must contain numeric warehouse values") from exc


def _value(value: Decimal) -> Decimal:
    return value.quantize(SIX_PLACES, rounding=ROUND_HALF_UP)


def _json(value: str, fallback):
    try:
        parsed = json.loads(value)
        return parsed
    except (TypeError, ValueError):
        return fallback


def _formula_hash(contract: dict[str, object]) -> str:
    return hashlib.sha256(json.dumps(contract, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def serialize_definition(item: FactoryMetricDefinition) -> dict[str, object]:
    return {
        "id": item.id, "project_id": item.project_id, "tenant_id": item.tenant_id,
        "client_id": item.client_id, "plan_id": item.plan_id,
        "definition_number": item.definition_number, "definition_reference": item.definition_reference,
        "metric_code": item.metric_code, "domain": item.domain, "owner": item.owner,
        "purpose": item.purpose, "status": item.status, "current_version_id": item.current_version_id,
        "current_version_number": item.current_version_number, "revision": item.revision,
        "updated_by": item.updated_by, "created_at": item.created_at, "updated_at": item.updated_at,
    }


def serialize_version(item: FactoryMetricVersion) -> dict[str, object]:
    return {
        "id": item.id, "project_id": item.project_id, "version_number_record": item.version_number_record,
        "version_reference": item.version_reference, "definition_id": item.definition_id,
        "definition_number": item.definition_number, "metric_code": item.metric_code,
        "version_number": item.version_number, "label": item.label, "description": item.description,
        "unit": item.unit, "aggregation": item.aggregation, "value_field": item.value_field,
        "numerator_field": item.numerator_field, "denominator_field": item.denominator_field,
        "filter_field": item.filter_field, "filter_operator": item.filter_operator,
        "filter_value": item.filter_value, "dimensions": _json(item.dimensions_json, []),
        "source_id": item.source_id, "source_code": item.source_code,
        "source_schema_fingerprint": item.source_schema_fingerprint,
        "formula_hash": item.formula_hash, "status": item.status, "change_reason": item.change_reason,
        "effective_from": item.effective_from, "authored_by": item.authored_by,
        "submitted_by": item.submitted_by, "submitted_at": item.submitted_at,
        "approval_reference": item.approval_reference, "approved_by": item.approved_by,
        "approved_at": item.approved_at, "revision": item.revision,
        "updated_by": item.updated_by, "created_at": item.created_at, "updated_at": item.updated_at,
    }


def serialize_run(item: FactoryMetricEvaluationRun) -> dict[str, object]:
    return {
        "id": item.id, "project_id": item.project_id, "run_number": item.run_number,
        "evaluation_reference": item.evaluation_reference, "definition_id": item.definition_id,
        "definition_number": item.definition_number, "metric_version_id": item.metric_version_id,
        "metric_version_number": item.metric_version_number, "metric_code": item.metric_code,
        "formula_hash": item.formula_hash, "warehouse_load_run_id": item.warehouse_load_run_id,
        "warehouse_run_number": item.warehouse_run_number, "source_code": item.source_code,
        "source_watermark_at": item.source_watermark_at, "status": item.status,
        "fact_count": item.fact_count, "lineage_count": item.lineage_count,
        "numerator_value": str(item.numerator_value), "denominator_value": str(item.denominator_value),
        "metric_value": str(item.metric_value), "observation_count": item.observation_count,
        "evaluated_by": item.evaluated_by, "evaluated_at": item.evaluated_at,
        "verification_reference": item.verification_reference, "verification_note": item.verification_note,
        "verified_by": item.verified_by, "verified_at": item.verified_at,
        "revision": item.revision, "updated_by": item.updated_by,
        "created_at": item.created_at, "updated_at": item.updated_at,
    }


def serialize_observation(item: FactoryMetricObservation) -> dict[str, object]:
    return {
        "id": item.id, "observation_number": item.observation_number,
        "evaluation_run_id": item.evaluation_run_id, "run_number": item.run_number,
        "metric_code": item.metric_code, "dimension_key": item.dimension_key,
        "dimensions": _json(item.dimensions_json, {}), "fact_count": item.fact_count,
        "numerator_value": str(item.numerator_value), "denominator_value": str(item.denominator_value),
        "metric_value": str(item.metric_value), "created_at": item.created_at,
    }


def serialize_evidence(item: FactoryMetricEvidence) -> dict[str, object]:
    return {
        "id": item.id, "evidence_number": item.evidence_number, "subject_type": item.subject_type,
        "subject_id": item.subject_id, "subject_number": item.subject_number,
        "evidence_type": item.evidence_type, "evidence_reference": item.evidence_reference,
        "note": item.note, "recorded_by": item.recorded_by, "created_at": item.created_at,
    }


class FactoryMetricSemanticsService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_workspace(self, *, project_id: int) -> dict[str, object]:
        async def items(model, limit: int):
            return (await self.db.execute(select(model).where(model.project_id == project_id).order_by(model.created_at.desc()).limit(limit))).scalars().all()

        definitions = await items(FactoryMetricDefinition, 100)
        versions = await items(FactoryMetricVersion, 200)
        runs = await items(FactoryMetricEvaluationRun, 200)
        observations = await items(FactoryMetricObservation, 500)
        evidence = await items(FactoryMetricEvidence, 500)
        sources = (await self.db.execute(select(FactoryWarehouseSource).where(
            FactoryWarehouseSource.project_id == project_id, FactoryWarehouseSource.status == "active",
        ).order_by(FactoryWarehouseSource.source_code))).scalars().all()
        warehouse_runs = (await self.db.execute(select(FactoryWarehouseLoadRun).where(
            FactoryWarehouseLoadRun.project_id == project_id, FactoryWarehouseLoadRun.status == "published",
        ).order_by(FactoryWarehouseLoadRun.published_at.desc()).limit(100))).scalars().all()
        return {
            "definitions": [serialize_definition(item) for item in definitions],
            "versions": [serialize_version(item) for item in versions],
            "evaluation_runs": [serialize_run(item) for item in runs],
            "observations": [serialize_observation(item) for item in observations],
            "evidence": [serialize_evidence(item) for item in evidence],
            "warehouse_sources": [{
                "id": item.id, "source_number": item.source_number, "source_code": item.source_code,
                "source_system": item.source_system, "source_table": item.source_table,
                "schema_fingerprint": item.schema_fingerprint, "fields": list(SOURCE_SPECS[item.source_code]["fields"]),
            } for item in sources],
            "warehouse_runs": [{
                "id": item.id, "run_number": item.run_number, "source_id": item.source_id,
                "source_code": item.source_code, "status": item.status, "rows_accepted": item.rows_accepted,
                "quality_score": str(item.quality_score), "watermark_to": item.watermark_to,
                "schema_fingerprint": item.schema_fingerprint,
            } for item in warehouse_runs],
            "contract": {
                "formula_mode": "declarative-only", "allowed_aggregations": sorted(AGGREGATIONS),
                "historical_recalculation": False, "approval_independent": True,
                "evaluation_verification_independent": True, "warehouse_publication_required": True,
            },
        }

    async def create_definition(self, *, project_id: int, context: TenantContext, actor: str,
                                definition_reference: str, metric_code: str, domain: str,
                                owner: str, purpose: str, version_reference: str,
                                label: str, description: str, unit: str, aggregation: str,
                                source_id: str, value_field: str | None,
                                numerator_field: str | None, denominator_field: str | None,
                                filter_field: str | None, filter_operator: str | None,
                                filter_value: str | None, dimensions: list[str],
                                effective_from: datetime, change_reason: str) -> dict[str, object]:
        reference, code = definition_reference.strip(), metric_code.strip().lower()
        clean_domain, clean_owner, clean_purpose = domain.strip(), owner.strip(), purpose.strip()
        if not reference or not METRIC_CODE.fullmatch(code):
            raise ValueError("Metric definition requires a reference and a stable lowercase metric code")
        if not clean_domain or not clean_owner or len(clean_purpose) < 8:
            raise ValueError("Metric definition requires domain, owner and an explicit business purpose")
        duplicate = await self.db.scalar(select(FactoryMetricDefinition.id).where(
            FactoryMetricDefinition.tenant_id == context.tenant_id,
            FactoryMetricDefinition.metric_code == code,
        ))
        if duplicate:
            raise ValueError("Metric code already exists in this tenant")
        source = await self._source(source_id, project_id)
        contract = self._formula_contract(
            source=source, aggregation=aggregation, value_field=value_field,
            numerator_field=numerator_field, denominator_field=denominator_field,
            filter_field=filter_field, filter_operator=filter_operator,
            filter_value=filter_value, dimensions=dimensions,
        )
        now = datetime.now(timezone.utc)
        effective = self._effective(effective_from, now)
        definition = FactoryMetricDefinition(
            id=f"metric-definition-{secrets.token_urlsafe(18)}", project_id=project_id,
            agent_path=context.agent_path, tenant_id=context.tenant_id, client_id=context.client_id,
            plan_id=context.plan_id or f"plan-{project_id}", definition_number=self._number("MET", project_id, now),
            definition_reference=reference[:255], metric_code=code, domain=clean_domain[:50],
            owner=clean_owner[:255], purpose=clean_purpose, updated_by=str(actor),
        )
        self.db.add(definition)
        await self.db.flush()
        version = await self._create_version(
            definition, version_number=1, actor=str(actor), version_reference=version_reference,
            label=label, description=description, unit=unit, source=source,
            contract=contract, effective_from=effective, change_reason=change_reason,
        )
        await self._evidence(version, "version", "version-authored", version.version_reference,
                             "Created immutable draft metric version 1 from a declarative warehouse contract", str(actor))
        await self.db.flush()
        return {"definition": serialize_definition(definition), "version": serialize_version(version)}

    async def create_version(self, definition_id: str, *, project_id: int, expected_definition_revision: int,
                             actor: str, version_reference: str, label: str, description: str,
                             unit: str, aggregation: str, source_id: str, value_field: str | None,
                             numerator_field: str | None, denominator_field: str | None,
                             filter_field: str | None, filter_operator: str | None,
                             filter_value: str | None, dimensions: list[str],
                             effective_from: datetime, change_reason: str) -> dict[str, object]:
        definition = await self._definition(definition_id, project_id)
        self._revision(definition, expected_definition_revision)
        if definition.status != "active" or not definition.current_version_number:
            raise ValueError("A new metric version requires an active published definition")
        source = await self._source(source_id, project_id)
        contract = self._formula_contract(
            source=source, aggregation=aggregation, value_field=value_field,
            numerator_field=numerator_field, denominator_field=denominator_field,
            filter_field=filter_field, filter_operator=filter_operator,
            filter_value=filter_value, dimensions=dimensions,
        )
        now = datetime.now(timezone.utc)
        version = await self._create_version(
            definition, version_number=definition.current_version_number + 1, actor=str(actor),
            version_reference=version_reference, label=label, description=description,
            unit=unit, source=source, contract=contract,
            effective_from=self._effective(effective_from, now), change_reason=change_reason,
        )
        definition.revision += 1; definition.updated_by = str(actor)
        await self._evidence(version, "version", "version-authored", version.version_reference,
                             f"Created draft version {version.version_number}; prior published results remain pinned", str(actor))
        await self.db.flush()
        return {"definition": serialize_definition(definition), "version": serialize_version(version)}

    async def submit_version(self, version_id: str, *, project_id: int, expected_revision: int,
                             actor: str, submission_reference: str) -> dict[str, object]:
        version = await self._version(version_id, project_id)
        self._revision(version, expected_revision)
        if version.status != "draft":
            raise ValueError("Only a draft metric version can be submitted")
        reference = submission_reference.strip()
        if not reference:
            raise ValueError("Metric version submission requires an evidence reference")
        now = datetime.now(timezone.utc)
        version.status = "pending-approval"; version.submitted_by = str(actor); version.submitted_at = now
        version.revision += 1; version.updated_by = str(actor)
        await self._evidence(version, "version", "submission", reference,
                             f"Submitted formula hash {version.formula_hash} for independent approval", str(actor))
        await self.db.flush()
        return serialize_version(version)

    async def approve_version(self, version_id: str, *, project_id: int, expected_revision: int,
                              actor: str, approval_reference: str) -> dict[str, object]:
        version = await self._version(version_id, project_id)
        self._revision(version, expected_revision)
        if version.status != "pending-approval":
            raise ValueError("Only a pending metric version can be approved")
        if version.authored_by == str(actor):
            raise ValueError("Metric version approver must be independent from the author")
        reference = approval_reference.strip()
        if not reference:
            raise ValueError("Metric version approval requires an evidence reference")
        definition = await self._definition(version.definition_id, project_id)
        previous = None
        if definition.current_version_id:
            previous = await self._version(definition.current_version_id, project_id)
            if previous.status != "published":
                raise ValueError("Current metric version is not a published governance baseline")
            previous.status = "superseded"; previous.revision += 1; previous.updated_by = str(actor)
        now = datetime.now(timezone.utc)
        version.status = "published"; version.approval_reference = reference[:500]
        version.approved_by = str(actor); version.approved_at = now
        version.revision += 1; version.updated_by = str(actor)
        definition.status = "active"; definition.current_version_id = version.id
        definition.current_version_number = version.version_number
        definition.revision += 1; definition.updated_by = str(actor)
        await self._evidence(version, "version", "approval-publication", reference,
                             f"Published version {version.version_number}; historical evaluations were not recalculated", str(actor))
        await self.db.flush()
        return {
            "definition": serialize_definition(definition), "version": serialize_version(version),
            "superseded_version": serialize_version(previous) if previous else None,
        }

    async def evaluate(self, version_id: str, *, project_id: int, actor: str,
                       warehouse_load_run_id: str, evaluation_reference: str) -> dict[str, object]:
        version = await self._version(version_id, project_id)
        if version.status != "published":
            raise ValueError("Metric evaluation requires a published metric version")
        reference = evaluation_reference.strip()
        if not reference:
            raise ValueError("Metric evaluation requires an evidence reference")
        warehouse_run = await self.db.scalar(select(FactoryWarehouseLoadRun).where(
            FactoryWarehouseLoadRun.id == warehouse_load_run_id,
            FactoryWarehouseLoadRun.project_id == project_id,
        ))
        if not warehouse_run or warehouse_run.status != "published":
            raise ValueError("Metric evaluation requires a published warehouse load run")
        if warehouse_run.source_id != version.source_id or warehouse_run.source_code != version.source_code:
            raise ValueError("Warehouse load source does not match the metric version binding")
        if warehouse_run.schema_fingerprint != version.source_schema_fingerprint:
            raise ValueError("Warehouse schema fingerprint changed; author and approve a new metric version")
        duplicate = await self.db.scalar(select(FactoryMetricEvaluationRun.id).where(
            FactoryMetricEvaluationRun.metric_version_id == version.id,
            FactoryMetricEvaluationRun.warehouse_load_run_id == warehouse_run.id,
        ))
        if duplicate:
            raise ValueError("This metric version already evaluated the warehouse load run")
        lineage = (await self.db.execute(select(FactoryWarehouseLineageEdge).where(
            FactoryWarehouseLineageEdge.load_run_id == warehouse_run.id,
        ).order_by(FactoryWarehouseLineageEdge.created_at))).scalars().all()
        if len(lineage) != warehouse_run.rows_accepted or not lineage:
            raise ValueError("Metric evaluation requires complete non-empty warehouse lineage")
        fact_ids = list(dict.fromkeys(edge.fact_id for edge in lineage))
        facts = (await self.db.execute(select(FactoryWarehouseFactVersion).where(
            FactoryWarehouseFactVersion.id.in_(fact_ids),
        ))).scalars().all()
        if len(facts) != len(fact_ids) or any(item.source_code != version.source_code or item.quality_status != "accepted" for item in facts):
            raise ValueError("Metric evaluation found incomplete or unaccepted warehouse facts")
        payloads = [json.loads(item.payload_json) for item in facts]
        filtered = [payload for payload in payloads if self._matches(payload, version)]
        dimensions = _json(version.dimensions_json, [])
        groups: dict[str, tuple[dict[str, object], list[dict[str, object]]]] = {}
        for payload in filtered:
            values = {field: payload.get(field) for field in dimensions}
            key = json.dumps(values, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
            if key not in groups:
                groups[key] = (values, [])
            groups[key][1].append(payload)
        if not dimensions and not groups:
            groups["{}"] = ({}, [])
        overall_numerator, overall_denominator, overall_value = self._aggregate(filtered, version)
        now = datetime.now(timezone.utc)
        run = FactoryMetricEvaluationRun(
            id=f"metric-run-{secrets.token_urlsafe(18)}", project_id=project_id,
            agent_path=version.agent_path, tenant_id=version.tenant_id, client_id=version.client_id,
            plan_id=version.plan_id, run_number=self._number("MER", project_id, now),
            evaluation_reference=reference[:255], definition_id=version.definition_id,
            definition_number=version.definition_number, metric_version_id=version.id,
            metric_version_number=version.version_number, metric_code=version.metric_code,
            formula_hash=version.formula_hash, warehouse_load_run_id=warehouse_run.id,
            warehouse_run_number=warehouse_run.run_number, source_code=version.source_code,
            source_watermark_at=warehouse_run.watermark_to, fact_count=len(filtered),
            lineage_count=len(lineage), numerator_value=_value(overall_numerator),
            denominator_value=_value(overall_denominator), metric_value=_value(overall_value),
            evaluated_by=str(actor), evaluated_at=now, updated_by=str(actor),
        )
        self.db.add(run)
        await self.db.flush()
        for key, (dimension_values, group_payloads) in groups.items():
            numerator, denominator, result = self._aggregate(group_payloads, version)
            self.db.add(FactoryMetricObservation(
                id=f"metric-observation-{secrets.token_urlsafe(18)}", project_id=project_id,
                agent_path=version.agent_path, tenant_id=version.tenant_id, client_id=version.client_id,
                plan_id=version.plan_id, observation_number=self._number("MEO", project_id, now),
                evaluation_run_id=run.id, run_number=run.run_number, metric_code=version.metric_code,
                dimension_key=key[:500], dimensions_json=json.dumps(dimension_values, ensure_ascii=False, sort_keys=True, separators=(",", ":")),
                fact_count=len(group_payloads), numerator_value=_value(numerator),
                denominator_value=_value(denominator), metric_value=_value(result),
            ))
        run.observation_count = len(groups)
        await self._evidence(run, "run", "evaluation", reference,
                             f"Evaluated version {version.version_number} against {len(lineage)} warehouse lineage memberships", str(actor))
        await self.db.flush()
        observations = (await self.db.execute(select(FactoryMetricObservation).where(
            FactoryMetricObservation.evaluation_run_id == run.id,
        ).order_by(FactoryMetricObservation.dimension_key))).scalars().all()
        return {"run": serialize_run(run), "observations": [serialize_observation(item) for item in observations]}

    async def verify_evaluation(self, run_id: str, *, project_id: int, expected_revision: int,
                                actor: str, verification_reference: str,
                                verification_note: str) -> dict[str, object]:
        run = await self._run(run_id, project_id)
        self._revision(run, expected_revision)
        if run.status != "evaluated":
            raise ValueError("Only an evaluated metric run can be verified")
        if run.evaluated_by == str(actor):
            raise ValueError("Metric evaluation verifier must be independent from the evaluator")
        reference, note = verification_reference.strip(), verification_note.strip()
        if not reference or len(note) < 8:
            raise ValueError("Metric verification requires evidence and an explicit verification note")
        now = datetime.now(timezone.utc)
        run.status = "published"; run.verification_reference = reference[:500]
        run.verification_note = note; run.verified_by = str(actor); run.verified_at = now
        run.revision += 1; run.updated_by = str(actor)
        await self._evidence(run, "run", "verification-publication", reference,
                             f"Independent verification published metric value {run.metric_value}: {note}", str(actor))
        await self.db.flush()
        return serialize_run(run)

    async def _create_version(self, definition: FactoryMetricDefinition, *, version_number: int,
                              actor: str, version_reference: str, label: str, description: str,
                              unit: str, source: FactoryWarehouseSource, contract: dict[str, object],
                              effective_from: datetime, change_reason: str) -> FactoryMetricVersion:
        reference, clean_label, clean_description = version_reference.strip(), label.strip(), description.strip()
        clean_unit, reason = unit.strip(), change_reason.strip()
        if not reference or not clean_label or len(clean_description) < 8 or not clean_unit or len(reason) < 8:
            raise ValueError("Metric version requires reference, label, description, unit and change reason")
        duplicate = await self.db.scalar(select(FactoryMetricVersion.id).where(
            FactoryMetricVersion.tenant_id == definition.tenant_id,
            FactoryMetricVersion.version_reference == reference,
        ))
        if duplicate:
            raise ValueError("Metric version reference already exists in this tenant")
        now = datetime.now(timezone.utc)
        version = FactoryMetricVersion(
            id=f"metric-version-{secrets.token_urlsafe(18)}", project_id=definition.project_id,
            agent_path=definition.agent_path, tenant_id=definition.tenant_id, client_id=definition.client_id,
            plan_id=definition.plan_id, version_number_record=self._number("MEV", definition.project_id, now),
            version_reference=reference[:255], definition_id=definition.id,
            definition_number=definition.definition_number, metric_code=definition.metric_code,
            version_number=version_number, label=clean_label[:255], description=clean_description,
            unit=clean_unit[:50], aggregation=str(contract["aggregation"]),
            value_field=contract["value_field"], numerator_field=contract["numerator_field"],
            denominator_field=contract["denominator_field"], filter_field=contract["filter_field"],
            filter_operator=contract["filter_operator"], filter_value=contract["filter_value"],
            dimensions_json=json.dumps(contract["dimensions"], ensure_ascii=False, separators=(",", ":")),
            source_id=source.id, source_code=source.source_code,
            source_schema_fingerprint=str(source.schema_fingerprint), formula_hash=_formula_hash(contract),
            change_reason=reason, effective_from=effective_from, authored_by=actor, updated_by=actor,
        )
        self.db.add(version)
        await self.db.flush()
        return version

    @staticmethod
    def _formula_contract(*, source: FactoryWarehouseSource, aggregation: str,
                          value_field: str | None, numerator_field: str | None,
                          denominator_field: str | None, filter_field: str | None,
                          filter_operator: str | None, filter_value: str | None,
                          dimensions: list[str]) -> dict[str, object]:
        if source.status != "active" or not source.schema_fingerprint:
            raise ValueError("Metric versions require an active schema-approved warehouse source")
        operation = aggregation.strip().lower()
        if operation not in AGGREGATIONS:
            raise ValueError("Metric formulas must use an approved declarative aggregation")
        allowed = set(SOURCE_SPECS[source.source_code]["fields"])
        clean_value = value_field.strip() if value_field else None
        clean_numerator = numerator_field.strip() if numerator_field else None
        clean_denominator = denominator_field.strip() if denominator_field else None
        clean_filter = filter_field.strip() if filter_field else None
        clean_filter_operator = filter_operator.strip().lower() if filter_operator else None
        clean_dimensions = list(dict.fromkeys(item.strip() for item in dimensions if item.strip()))
        referenced = [item for item in [clean_value, clean_numerator, clean_denominator, clean_filter, *clean_dimensions] if item]
        if any(item not in allowed for item in referenced):
            raise ValueError("Metric formula references a field outside the approved warehouse schema")
        if len(clean_dimensions) > 2:
            raise ValueError("Metric versions allow at most two governed dimensions")
        if operation in {"sum", "average"} and not clean_value:
            raise ValueError("Sum and average metrics require a value field")
        if operation in {"ratio", "percentage"} and (not clean_numerator or not clean_denominator):
            raise ValueError("Ratio and percentage metrics require numerator and denominator fields")
        if clean_filter and (clean_filter_operator not in FILTER_OPERATORS or filter_value is None):
            raise ValueError("Metric filters support only explicit eq or ne comparisons")
        if not clean_filter and (filter_operator or filter_value):
            raise ValueError("Metric filter operator and value require a filter field")
        return {
            "mode": "declarative-only", "aggregation": operation,
            "value_field": clean_value, "numerator_field": clean_numerator,
            "denominator_field": clean_denominator, "filter_field": clean_filter,
            "filter_operator": clean_filter_operator, "filter_value": filter_value,
            "dimensions": clean_dimensions, "source_code": source.source_code,
            "source_schema_fingerprint": source.schema_fingerprint,
        }

    @staticmethod
    def _matches(payload: dict[str, object], version: FactoryMetricVersion) -> bool:
        if not version.filter_field:
            return True
        equal = str(payload.get(version.filter_field)) == str(version.filter_value)
        return equal if version.filter_operator == "eq" else not equal

    @staticmethod
    def _aggregate(payloads: list[dict[str, object]], version: FactoryMetricVersion) -> tuple[Decimal, Decimal, Decimal]:
        operation = version.aggregation
        if operation == "count":
            numerator, denominator = Decimal(len(payloads)), Decimal(1)
        elif operation in {"sum", "average"}:
            values = [_decimal(payload.get(str(version.value_field)), field=str(version.value_field)) for payload in payloads]
            numerator = sum(values, Decimal(0)); denominator = Decimal(len(values)) if operation == "average" else Decimal(1)
        else:
            numerator = sum((_decimal(payload.get(str(version.numerator_field)), field=str(version.numerator_field)) for payload in payloads), Decimal(0))
            denominator = sum((_decimal(payload.get(str(version.denominator_field)), field=str(version.denominator_field)) for payload in payloads), Decimal(0))
        if denominator == 0:
            raise ValueError("Metric denominator is zero; evaluation cannot publish an undefined value")
        result = numerator / denominator
        if operation == "percentage":
            result *= Decimal(100)
        return numerator, denominator, result

    async def _definition(self, item_id: str, project_id: int) -> FactoryMetricDefinition:
        item = await self.db.scalar(select(FactoryMetricDefinition).where(
            FactoryMetricDefinition.id == item_id, FactoryMetricDefinition.project_id == project_id,
        ))
        if not item:
            raise KeyError("Metric definition not found in this tenant plan")
        return item

    async def _version(self, item_id: str, project_id: int) -> FactoryMetricVersion:
        item = await self.db.scalar(select(FactoryMetricVersion).where(
            FactoryMetricVersion.id == item_id, FactoryMetricVersion.project_id == project_id,
        ))
        if not item:
            raise KeyError("Metric version not found in this tenant plan")
        return item

    async def _source(self, item_id: str, project_id: int) -> FactoryWarehouseSource:
        item = await self.db.scalar(select(FactoryWarehouseSource).where(
            FactoryWarehouseSource.id == item_id, FactoryWarehouseSource.project_id == project_id,
        ))
        if not item:
            raise KeyError("Warehouse source not found in this tenant plan")
        return item

    async def _run(self, item_id: str, project_id: int) -> FactoryMetricEvaluationRun:
        item = await self.db.scalar(select(FactoryMetricEvaluationRun).where(
            FactoryMetricEvaluationRun.id == item_id, FactoryMetricEvaluationRun.project_id == project_id,
        ))
        if not item:
            raise KeyError("Metric evaluation run not found in this tenant plan")
        return item

    async def _evidence(self, item, subject_type: str, evidence_type: str,
                        reference: str, note: str, actor: str) -> None:
        number = item.version_number_record if subject_type == "version" else item.run_number
        now = datetime.now(timezone.utc)
        self.db.add(FactoryMetricEvidence(
            id=f"metric-evidence-{secrets.token_urlsafe(18)}", project_id=item.project_id,
            agent_path=item.agent_path, tenant_id=item.tenant_id, client_id=item.client_id,
            plan_id=item.plan_id, evidence_number=self._number("MEE", item.project_id, now),
            subject_type=subject_type, subject_id=item.id, subject_number=number,
            evidence_type=evidence_type, evidence_reference=reference.strip()[:500],
            note=note.strip(), recorded_by=actor,
        ))

    @staticmethod
    def _effective(value: datetime, now: datetime) -> datetime:
        aware = value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)
        if aware < now - timedelta(minutes=5):
            raise ValueError("Metric versions cannot become effective retroactively; historical results stay pinned")
        return aware

    @staticmethod
    def _number(prefix: str, project_id: int, now: datetime) -> str:
        return f"{prefix}-{project_id}-{now:%Y%m%d%H%M%S}-{secrets.token_hex(3).upper()}"

    @staticmethod
    def _revision(item, expected: int) -> None:
        if item.revision != expected:
            raise ValueError("Metric governance record changed; refresh before continuing")
