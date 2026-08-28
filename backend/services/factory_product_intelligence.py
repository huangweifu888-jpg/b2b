"""Governed product opportunity research with explicit commercial-availability evidence."""

from datetime import datetime, timezone
from decimal import Decimal
import hashlib
import json
import secrets

from core.tenant_context import TenantContext
from models.factory_contract import FactoryCoreEventContract, FactoryCoreObjectContract
from models.factory_product_intelligence import (
    FactoryProductIntelligenceEvidence,
    FactoryProductIntelligenceRelease,
    FactoryProductOpportunityAssessment,
    FactoryProductResearchSignal,
    FactoryProductResearchStudy,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


APPLICATION_ID = "identity.product-intelligence"
SIGNAL_TYPES = ("demand", "margin", "growth", "competition", "capability-fit")
SIGNAL_WEIGHTS = {"demand": Decimal("0.25"), "margin": Decimal("0.25"), "growth": Decimal("0.20"), "competition": Decimal("0.15"), "capability-fit": Decimal("0.15")}
RELEASE_EVIDENCE_FIELDS = (
    "end_to_end_demo_reference",
    "role_training_reference",
    "issue_closure_reference",
    "pilot_report_reference",
    "runtime_monitoring_reference",
    "rollback_drill_reference",
)


def _id(prefix: str) -> str:
    return f"{prefix}-{secrets.token_urlsafe(18)}"


def _number(prefix: str, project_id: int) -> str:
    return f"{prefix}-{project_id}-{datetime.now(timezone.utc):%Y%m%d%H%M%S%f}-{secrets.token_hex(3).upper()}"


def _context(context: TenantContext, project_id: int) -> dict[str, object]:
    return {"project_id": project_id, "agent_path": context.agent_path, "tenant_id": context.tenant_id, "client_id": context.client_id, "plan_id": context.plan_id or f"plan-{project_id}"}


def _same(item: object) -> dict[str, object]:
    return {key: getattr(item, key) for key in ("project_id", "agent_path", "tenant_id", "client_id", "plan_id")}


def _hash(value: object) -> str:
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str).encode()).hexdigest()


def _serialize(item: object, fields: tuple[str, ...]) -> dict[str, object]:
    output = {field: getattr(item, field) for field in fields}
    for key, value in list(output.items()):
        if isinstance(value, Decimal):
            output[key] = str(value)
    return output


STUDY_FIELDS = ("id", "study_number", "product_reference", "product_name", "business_objective", "base_currency", "status", "created_by", "revision")
SIGNAL_FIELDS = ("id", "signal_number", "study_id", "study_number", "signal_type", "normalized_score", "raw_value", "measurement_unit", "region", "source_system", "source_reference", "source_revision", "source_observed_at", "source_hash", "status", "recorded_by", "verified_by", "verification_reference", "revision")
ASSESSMENT_FIELDS = ("id", "assessment_number", "study_id", "study_number", "input_hash", "opportunity_score", "recommendation", "assumptions", "status", "authored_by", "reviewed_by", "review_reference", "review_note", "revision")
RELEASE_FIELDS = ("id", "release_number", "application_id", "release_version", "study_id", "study_number", "assessment_id", "assessment_number", "assessment_hash", "manifest_hash", "tenant_scope", "region_scope_json", "connector_scope_json", "support_owner", "support_until", *RELEASE_EVIDENCE_FIELDS, "status", "available", "prepared_by", "approved_by", "approval_reference", "revision")


class FactoryProductIntelligenceService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def workspace(self, *, project_id: int) -> dict[str, object]:
        async def rows(model, order):
            return (await self.db.execute(select(model).where(model.project_id == project_id).order_by(order.desc()).limit(500))).scalars().all()
        studies = await rows(FactoryProductResearchStudy, FactoryProductResearchStudy.created_at)
        signals = await rows(FactoryProductResearchSignal, FactoryProductResearchSignal.recorded_at)
        assessments = await rows(FactoryProductOpportunityAssessment, FactoryProductOpportunityAssessment.authored_at)
        releases = await rows(FactoryProductIntelligenceRelease, FactoryProductIntelligenceRelease.prepared_at)
        evidence = await rows(FactoryProductIntelligenceEvidence, FactoryProductIntelligenceEvidence.recorded_at)
        verified = [item for item in signals if item.status == "verified"]
        available = [item for item in releases if item.available and item.status == "available" and self._utc(item.support_until) > datetime.now(timezone.utc)]
        latest_score = str(assessments[0].opportunity_score) if assessments else None
        return {
            "studies": [_serialize(item, STUDY_FIELDS) for item in studies],
            "signals": [_serialize(item, SIGNAL_FIELDS) for item in signals],
            "assessments": [_serialize(item, ASSESSMENT_FIELDS) for item in assessments],
            "releases": [_serialize(item, RELEASE_FIELDS) for item in releases],
            "evidence": [{"id": item.id, "subject_type": item.subject_type, "subject_id": item.subject_id, "evidence_type": item.evidence_type, "evidence_reference": item.evidence_reference, "recorded_by": item.recorded_by} for item in evidence],
            "metrics": {
                "studies": len(studies),
                "verified_signal_percent": round(len(verified) * 100 / max(1, len(signals)), 2),
                "approved_assessments": len([item for item in assessments if item.status == "approved"]),
                "available_releases": len(available),
                "latest_opportunity_score": latest_score,
            },
            "availability": {"application_id": APPLICATION_ID, "status": "available" if available else "pilot", "release_version": available[0].release_version if available else None, "support_until": available[0].support_until if available else None},
            "contract": {
                "required_signal_types": list(SIGNAL_TYPES),
                "source_records_copied": False,
                "source_revalidated_before_release": True,
                "signal_self_verification": False,
                "assessment_self_review": False,
                "release_self_approval": False,
                "raw_connector_secret_stored": False,
                "plm_engineering_facts_mutated": False,
                "availability_requires_six_evidence_keys": True,
                "availability_requires_unexpired_support": True,
            },
        }

    async def create_study(self, *, project_id: int, context: TenantContext, actor: str, product_reference: str, product_name: str, business_objective: str, base_currency: str) -> dict[str, object]:
        values = [product_reference.strip(), product_name.strip(), business_objective.strip(), base_currency.strip().upper()]
        if not all(values) or len(values[3]) != 3:
            raise ValueError("Product study requires reference, name, objective and three-letter currency")
        now = datetime.now(timezone.utc)
        item = FactoryProductResearchStudy(id=_id("product-study"), **_context(context, project_id), study_number=_number("PIS", project_id), product_reference=values[0], product_name=values[1], business_objective=values[2], base_currency=values[3], status="gathering", created_by=str(actor), created_at=now, updated_at=now, revision=1)
        self.db.add(item)
        await self._event(item, "study", "study-created", item.product_reference, "Product opportunity study opened without changing PLM facts", actor)
        await self.db.flush()
        return _serialize(item, STUDY_FIELDS)

    async def add_signal(self, study_id: str, *, project_id: int, context: TenantContext, actor: str, signal_type: str, normalized_score: Decimal, raw_value: Decimal, measurement_unit: str, region: str, source_system: str, source_reference: str, source_revision: str, source_observed_at: datetime) -> dict[str, object]:
        study = await self._get(FactoryProductResearchStudy, study_id, project_id, "Product study")
        signal_type = signal_type.strip()
        score = Decimal(normalized_score)
        if study.status != "gathering" or signal_type not in SIGNAL_TYPES or score < 0 or score > 100 or not all(value.strip() for value in (measurement_unit, region, source_system, source_reference, source_revision)):
            raise ValueError("Signal requires a gathering study, supported type, 0-100 score and complete source evidence")
        source_payload = {"study_number": study.study_number, "signal_type": signal_type, "normalized_score": format(score.quantize(Decimal("0.01")), "f"), "raw_value": format(Decimal(raw_value).quantize(Decimal("0.0001")), "f"), "measurement_unit": measurement_unit.strip(), "region": region.strip().upper(), "source_system": source_system.strip(), "source_reference": source_reference.strip(), "source_revision": source_revision.strip(), "source_observed_at": self._utc(source_observed_at).isoformat()}
        now = datetime.now(timezone.utc)
        item = FactoryProductResearchSignal(id=_id("product-signal"), **_context(context, project_id), signal_number=_number("PSG", project_id), study_id=study.id, study_number=study.study_number, signal_type=signal_type, normalized_score=score, raw_value=Decimal(raw_value), measurement_unit=source_payload["measurement_unit"], region=source_payload["region"], source_system=source_payload["source_system"], source_reference=source_payload["source_reference"], source_revision=source_payload["source_revision"], source_observed_at=self._utc(source_observed_at), source_hash=_hash(source_payload), status="pending-verification", recorded_by=str(actor), recorded_at=now, revision=1)
        self.db.add(item)
        await self._event(item, "signal", "signal-recorded", item.source_hash, "Source reference pinned; no connector secret stored", actor)
        await self.db.flush()
        return _serialize(item, SIGNAL_FIELDS)

    async def verify_signal(self, signal_id: str, *, project_id: int, actor: str, expected_revision: int, verification_reference: str) -> dict[str, object]:
        item = await self._get(FactoryProductResearchSignal, signal_id, project_id, "Product signal")
        self._revision(item, expected_revision)
        if item.status != "pending-verification" or item.recorded_by == str(actor) or not verification_reference.strip() or item.source_hash != _hash(self._source_payload(item)):
            raise ValueError("Product signal requires independent verification of unchanged source evidence")
        item.status = "verified"
        item.verified_by = str(actor)
        item.verified_at = datetime.now(timezone.utc)
        item.verification_reference = verification_reference.strip()[:255]
        item.revision += 1
        await self._event(item, "signal", "signal-verified", verification_reference, "Independent signal verification completed", actor)
        await self.db.flush()
        return _serialize(item, SIGNAL_FIELDS)

    async def create_assessment(self, study_id: str, *, project_id: int, context: TenantContext, actor: str, assumptions: str) -> dict[str, object]:
        study = await self._get(FactoryProductResearchStudy, study_id, project_id, "Product study")
        signals = await self._signals(study.id, project_id)
        verified = {item.signal_type: item for item in signals if item.status == "verified"}
        if study.status != "gathering" or set(verified) != set(SIGNAL_TYPES) or not assumptions.strip():
            raise ValueError("Assessment requires all five independently verified signals and documented assumptions")
        snapshot = self._snapshot([verified[key] for key in SIGNAL_TYPES])
        score = sum(Decimal(str(verified[key].normalized_score)) * SIGNAL_WEIGHTS[key] for key in SIGNAL_TYPES).quantize(Decimal("0.01"))
        recommendation = "grow" if score >= 75 else "validate" if score >= 55 else "hold"
        now = datetime.now(timezone.utc)
        item = FactoryProductOpportunityAssessment(id=_id("product-assessment"), **_context(context, project_id), assessment_number=_number("PIA", project_id), study_id=study.id, study_number=study.study_number, input_snapshot_json=snapshot, input_hash=_hash(snapshot), opportunity_score=score, recommendation=recommendation, assumptions=assumptions.strip(), status="pending-review", authored_by=str(actor), authored_at=now, revision=1)
        self.db.add(item)
        study.status = "assessment-pending"
        study.updated_at = now
        study.revision += 1
        await self._event(item, "assessment", "assessment-created", item.input_hash, "Weighted opportunity assessment created from verified facts", actor)
        await self.db.flush()
        return _serialize(item, ASSESSMENT_FIELDS)

    async def review_assessment(self, assessment_id: str, *, project_id: int, actor: str, expected_revision: int, decision: str, review_reference: str, review_note: str) -> dict[str, object]:
        item = await self._get(FactoryProductOpportunityAssessment, assessment_id, project_id, "Product assessment")
        self._revision(item, expected_revision)
        await self._validate_assessment(item)
        if item.status != "pending-review" or item.authored_by == str(actor) or decision not in {"approve", "reject"} or not review_reference.strip() or not review_note.strip():
            raise ValueError("Assessment requires independent documented review")
        item.status = "approved" if decision == "approve" else "rejected"
        item.reviewed_by = str(actor)
        item.reviewed_at = datetime.now(timezone.utc)
        item.review_reference = review_reference.strip()[:255]
        item.review_note = review_note.strip()
        item.revision += 1
        study = await self._get(FactoryProductResearchStudy, item.study_id, project_id, "Product study")
        study.status = "assessed" if decision == "approve" else "gathering"
        study.updated_at = datetime.now(timezone.utc)
        study.revision += 1
        await self._event(item, "assessment", "assessment-reviewed", review_reference, "Independent assessment review completed", actor)
        await self.db.flush()
        return _serialize(item, ASSESSMENT_FIELDS)

    async def prepare_release(self, assessment_id: str, *, project_id: int, context: TenantContext, actor: str, release_version: str, tenant_scope: str, region_scope: list[str], connector_scope: list[str], support_owner: str, support_until: datetime, **evidence: str) -> dict[str, object]:
        assessment = await self._get(FactoryProductOpportunityAssessment, assessment_id, project_id, "Product assessment")
        await self._validate_assessment(assessment)
        clean_evidence = {field: str(evidence.get(field, "")).strip() for field in RELEASE_EVIDENCE_FIELDS}
        regions = sorted({value.strip().upper() for value in region_scope if value.strip()})
        connectors = sorted({value.strip() for value in connector_scope if value.strip()})
        support_end = self._utc(support_until)
        if assessment.status != "approved" or not all(value.strip() for value in (release_version, tenant_scope, support_owner)) or not regions or not connectors or not all(clean_evidence.values()) or support_end <= datetime.now(timezone.utc):
            raise ValueError("Availability release requires approved assessment, scoped tenants/regions/connectors, six evidence keys and future support")
        manifest = {"application_id": APPLICATION_ID, "release_version": release_version.strip(), "assessment_number": assessment.assessment_number, "assessment_hash": assessment.input_hash, "opportunity_score": str(assessment.opportunity_score), "recommendation": assessment.recommendation, "tenant_scope": tenant_scope.strip(), "region_scope": regions, "connector_scope": connectors, "support_owner": support_owner.strip(), "support_until": support_end.isoformat(), "evidence": clean_evidence}
        now = datetime.now(timezone.utc)
        item = FactoryProductIntelligenceRelease(id=_id("product-release"), **_context(context, project_id), release_number=_number("PIR", project_id), application_id=APPLICATION_ID, release_version=manifest["release_version"], study_id=assessment.study_id, study_number=assessment.study_number, assessment_id=assessment.id, assessment_number=assessment.assessment_number, assessment_hash=assessment.input_hash, manifest_json=manifest, manifest_hash=_hash(manifest), tenant_scope=manifest["tenant_scope"], region_scope_json=regions, connector_scope_json=connectors, support_owner=manifest["support_owner"], support_until=support_end, **clean_evidence, status="pending-approval", available=False, prepared_by=str(actor), prepared_at=now, revision=1)
        self.db.add(item)
        await self._event(item, "release", "availability-prepared", item.manifest_hash, "Current-version customer, monitoring and rollback evidence pinned", actor)
        await self.db.flush()
        return _serialize(item, RELEASE_FIELDS)

    async def approve_release(self, release_id: str, *, project_id: int, actor: str, expected_revision: int, approval_reference: str) -> dict[str, object]:
        item = await self._get(FactoryProductIntelligenceRelease, release_id, project_id, "Product intelligence release")
        self._revision(item, expected_revision)
        assessment = await self._get(FactoryProductOpportunityAssessment, item.assessment_id, project_id, "Product assessment")
        await self._validate_assessment(assessment)
        event_contract = await self.db.scalar(select(FactoryCoreEventContract).where(FactoryCoreEventContract.id == "product-opportunity-released", FactoryCoreEventContract.lifecycle_status == "frozen"))
        object_contract = await self.db.scalar(select(FactoryCoreObjectContract).where(FactoryCoreObjectContract.id == "product-opportunity-study", FactoryCoreObjectContract.lifecycle_status == "frozen"))
        if item.status != "pending-approval" or item.prepared_by == str(actor) or not approval_reference.strip() or item.manifest_hash != _hash(item.manifest_json) or self._utc(item.support_until) <= datetime.now(timezone.utc) or not event_contract or not object_contract:
            raise ValueError("Availability requires independent approval, unchanged manifest, active support and frozen object/event contracts")
        item.status = "available"
        item.available = True
        item.approved_by = str(actor)
        item.approved_at = datetime.now(timezone.utc)
        item.approval_reference = approval_reference.strip()[:255]
        item.revision += 1
        study = await self._get(FactoryProductResearchStudy, item.study_id, project_id, "Product study")
        study.status = "available"
        study.updated_at = datetime.now(timezone.utc)
        study.revision += 1
        await self._event(item, "release", "product-opportunity-released", approval_reference, "Commercial availability approved against frozen contracts", actor)
        await self.db.flush()
        return _serialize(item, RELEASE_FIELDS)

    async def _validate_assessment(self, item: FactoryProductOpportunityAssessment) -> None:
        signals = await self._signals(item.study_id, item.project_id)
        verified = {signal.signal_type: signal for signal in signals if signal.status == "verified"}
        if set(verified) != set(SIGNAL_TYPES):
            raise ValueError("Assessment source coverage changed")
        snapshot = self._snapshot([verified[key] for key in SIGNAL_TYPES])
        if snapshot != item.input_snapshot_json or _hash(snapshot) != item.input_hash:
            raise ValueError("Assessment source signals changed; release is blocked")

    async def _signals(self, study_id: str, project_id: int) -> list[FactoryProductResearchSignal]:
        return (await self.db.execute(select(FactoryProductResearchSignal).where(FactoryProductResearchSignal.study_id == study_id, FactoryProductResearchSignal.project_id == project_id))).scalars().all()

    @staticmethod
    def _source_payload(item: FactoryProductResearchSignal) -> dict[str, object]:
        return {"study_number": item.study_number, "signal_type": item.signal_type, "normalized_score": format(Decimal(item.normalized_score).quantize(Decimal("0.01")), "f"), "raw_value": format(Decimal(item.raw_value).quantize(Decimal("0.0001")), "f"), "measurement_unit": item.measurement_unit, "region": item.region, "source_system": item.source_system, "source_reference": item.source_reference, "source_revision": item.source_revision, "source_observed_at": FactoryProductIntelligenceService._utc(item.source_observed_at).isoformat()}

    def _snapshot(self, signals: list[FactoryProductResearchSignal]) -> dict[str, object]:
        return {"application_id": APPLICATION_ID, "signals": [dict(self._source_payload(item), signal_number=item.signal_number, source_hash=item.source_hash, verified_by=item.verified_by, verification_reference=item.verification_reference, revision=item.revision) for item in signals]}

    async def _get(self, model, item_id: str, project_id: int, label: str):
        item = await self.db.scalar(select(model).where(model.id == item_id, model.project_id == project_id))
        if not item:
            raise KeyError(f"{label} not found in this tenant plan")
        return item

    @staticmethod
    def _revision(item: object, expected: int) -> None:
        if int(getattr(item, "revision")) != int(expected):
            raise ValueError("Revision conflict")

    @staticmethod
    def _utc(value: datetime) -> datetime:
        return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)

    async def _event(self, item: object, subject_type: str, evidence_type: str, reference: str, note: str, actor: str) -> None:
        number = next((getattr(item, field, None) for field in ("study_number", "signal_number", "assessment_number", "release_number") if getattr(item, field, None)), str(getattr(item, "id")))
        self.db.add(FactoryProductIntelligenceEvidence(id=_id("product-evidence"), **_same(item), evidence_number=_number("PIE", int(getattr(item, "project_id"))), subject_type=subject_type, subject_id=str(getattr(item, "id")), subject_number=number, evidence_type=evidence_type, evidence_reference=str(reference)[:255], note=note, recorded_by=str(actor), recorded_at=datetime.now(timezone.utc)))
