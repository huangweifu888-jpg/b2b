"""Governed country-market opportunity radar and commercial release workflow."""

from datetime import datetime, timezone
from decimal import Decimal
import hashlib, json, secrets

from core.tenant_context import TenantContext
from models.factory_contract import FactoryCoreEventContract, FactoryCoreObjectContract
from models.factory_market_radar import FactoryMarketEntryDecision, FactoryMarketRadarEvidence, FactoryMarketRadarRelease, FactoryMarketScan, FactoryMarketSignal
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

APPLICATION_ID = "identity.market-radar"
SIGNAL_TYPES = ("demand", "growth", "competition", "entry-barrier", "channel-fit")
SIGNAL_WEIGHTS = {"demand": Decimal("0.25"), "growth": Decimal("0.20"), "competition": Decimal("0.15"), "entry-barrier": Decimal("0.20"), "channel-fit": Decimal("0.20")}
RELEASE_EVIDENCE_FIELDS = ("customer_trial_reference", "role_training_reference", "issue_closure_reference", "monitoring_reference", "rollback_reference")


def _id(prefix): return f"{prefix}-{secrets.token_urlsafe(18)}"
def _number(prefix, project_id): return f"{prefix}-{project_id}-{datetime.now(timezone.utc):%Y%m%d%H%M%S%f}-{secrets.token_hex(3).upper()}"
def _hash(value): return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str).encode()).hexdigest()
def _context(context, project_id): return {"project_id": project_id, "agent_path": context.agent_path, "tenant_id": context.tenant_id, "client_id": context.client_id, "plan_id": context.plan_id or f"plan-{project_id}"}
def _same(item): return {key: getattr(item, key) for key in ("project_id", "agent_path", "tenant_id", "client_id", "plan_id")}
def _serialize(item, fields):
    result = {field: getattr(item, field) for field in fields}
    for key, value in list(result.items()):
        if isinstance(value, Decimal): result[key] = str(value)
    return result

SCAN_FIELDS = ("id", "scan_number", "product_reference", "product_name", "target_country", "target_channel", "objective", "status", "created_by", "revision")
SIGNAL_FIELDS = ("id", "signal_number", "scan_id", "scan_number", "signal_type", "normalized_score", "raw_value", "measurement_unit", "source_system", "source_reference", "source_revision", "source_observed_at", "source_hash", "status", "recorded_by", "verified_by", "verification_reference", "revision")
DECISION_FIELDS = ("id", "decision_number", "scan_id", "scan_number", "input_hash", "opportunity_score", "entry_recommendation", "entry_gate_note", "status", "authored_by", "reviewed_by", "review_reference", "revision")
RELEASE_FIELDS = ("id", "release_number", "application_id", "release_version", "scan_id", "decision_id", "manifest_hash", "support_owner", "support_until", *RELEASE_EVIDENCE_FIELDS, "status", "available", "prepared_by", "approved_by", "approval_reference", "revision")


class FactoryMarketRadarService:
    def __init__(self, db: AsyncSession): self.db = db

    async def workspace(self, *, project_id: int):
        async def rows(model, order): return (await self.db.execute(select(model).where(model.project_id == project_id).order_by(order.desc()).limit(500))).scalars().all()
        scans = await rows(FactoryMarketScan, FactoryMarketScan.created_at)
        signals = await rows(FactoryMarketSignal, FactoryMarketSignal.recorded_at)
        decisions = await rows(FactoryMarketEntryDecision, FactoryMarketEntryDecision.authored_at)
        releases = await rows(FactoryMarketRadarRelease, FactoryMarketRadarRelease.prepared_at)
        evidence = await rows(FactoryMarketRadarEvidence, FactoryMarketRadarEvidence.recorded_at)
        active = [r for r in releases if r.available and r.status == "available" and self._utc(r.support_until) > datetime.now(timezone.utc)]
        verified = [s for s in signals if s.status == "verified"]
        return {
            "scans": [_serialize(x, SCAN_FIELDS) for x in scans], "signals": [_serialize(x, SIGNAL_FIELDS) for x in signals],
            "decisions": [_serialize(x, DECISION_FIELDS) for x in decisions], "releases": [_serialize(x, RELEASE_FIELDS) for x in releases],
            "evidence": [{"id": x.id, "subject_type": x.subject_type, "evidence_type": x.evidence_type, "evidence_reference": x.evidence_reference, "recorded_by": x.recorded_by} for x in evidence],
            "metrics": {"market_scans": len(scans), "verified_signal_percent": round(len(verified) * 100 / max(1, len(signals)), 2), "approved_decisions": len([x for x in decisions if x.status == "approved"]), "available_releases": len(active), "latest_opportunity_score": str(decisions[0].opportunity_score) if decisions else None},
            "availability": {"application_id": APPLICATION_ID, "status": "available" if active else "pilot", "release_version": active[0].release_version if active else None, "support_until": active[0].support_until if active else None},
            "contract": {"required_signal_types": list(SIGNAL_TYPES), "source_records_copied": False, "signal_self_verification": False, "decision_self_review": False, "release_self_approval": False, "raw_connector_secret_stored": False, "availability_requires_current_customer_trial": True, "availability_requires_unexpired_support": True},
        }

    async def create_scan(self, *, project_id: int, context: TenantContext, actor: str, product_reference: str, product_name: str, target_country: str, target_channel: str, objective: str):
        values = [product_reference.strip(), product_name.strip(), target_country.strip().upper(), target_channel.strip(), objective.strip()]
        if not all(values) or len(values[2]) not in (2, 3): raise ValueError("Market scan requires product, ISO country, channel and objective")
        now = datetime.now(timezone.utc)
        item = FactoryMarketScan(id=_id("market-scan"), **_context(context, project_id), scan_number=_number("MRS", project_id), product_reference=values[0], product_name=values[1], target_country=values[2], target_channel=values[3], objective=values[4], status="gathering", created_by=str(actor), created_at=now, updated_at=now, revision=1)
        self.db.add(item); await self._event(item, "scan", "scan-created", item.product_reference, "Country-market scan opened", actor); await self.db.flush()
        return _serialize(item, SCAN_FIELDS)

    async def add_signal(self, scan_id: str, *, project_id: int, context: TenantContext, actor: str, signal_type: str, normalized_score: Decimal, raw_value: Decimal, measurement_unit: str, source_system: str, source_reference: str, source_revision: str, source_observed_at: datetime):
        scan = await self._get(FactoryMarketScan, scan_id, project_id, "Market scan")
        score = Decimal(normalized_score); signal_type = signal_type.strip()
        if scan.status != "gathering" or signal_type not in SIGNAL_TYPES or not 0 <= score <= 100 or not all(x.strip() for x in (measurement_unit, source_system, source_reference, source_revision)): raise ValueError("Signal requires a gathering scan, supported type, 0-100 score and source evidence")
        payload = {"scan_number": scan.scan_number, "signal_type": signal_type, "score": format(score.quantize(Decimal("0.01")), "f"), "raw_value": format(Decimal(raw_value).quantize(Decimal("0.0001")), "f"), "unit": measurement_unit.strip(), "source_system": source_system.strip(), "source_reference": source_reference.strip(), "source_revision": source_revision.strip(), "observed_at": self._utc(source_observed_at).isoformat()}
        item = FactoryMarketSignal(id=_id("market-signal"), **_context(context, project_id), signal_number=_number("MRG", project_id), scan_id=scan.id, scan_number=scan.scan_number, signal_type=signal_type, normalized_score=score, raw_value=Decimal(raw_value), measurement_unit=payload["unit"], source_system=payload["source_system"], source_reference=payload["source_reference"], source_revision=payload["source_revision"], source_observed_at=self._utc(source_observed_at), source_hash=_hash(payload), status="pending-verification", recorded_by=str(actor), recorded_at=datetime.now(timezone.utc), revision=1)
        self.db.add(item); await self._event(item, "signal", "signal-recorded", item.source_hash, "Pinned source reference without connector secret", actor); await self.db.flush()
        return _serialize(item, SIGNAL_FIELDS)

    async def verify_signal(self, signal_id: str, *, project_id: int, actor: str, expected_revision: int, verification_reference: str):
        item = await self._get(FactoryMarketSignal, signal_id, project_id, "Market signal"); self._revision(item, expected_revision)
        if item.status != "pending-verification" or item.recorded_by == str(actor) or not verification_reference.strip() or item.source_hash != _hash(self._source_payload(item)): raise ValueError("Market signal requires independent verification of unchanged evidence")
        item.status = "verified"; item.verified_by = str(actor); item.verified_at = datetime.now(timezone.utc); item.verification_reference = verification_reference.strip()[:255]; item.revision += 1
        await self._event(item, "signal", "signal-verified", verification_reference, "Independent source verification completed", actor); await self.db.flush(); return _serialize(item, SIGNAL_FIELDS)

    async def create_decision(self, scan_id: str, *, project_id: int, context: TenantContext, actor: str, entry_gate_note: str):
        scan = await self._get(FactoryMarketScan, scan_id, project_id, "Market scan"); signals = await self._signals(scan.id, project_id); verified = {x.signal_type: x for x in signals if x.status == "verified"}
        if scan.status != "gathering" or set(verified) != set(SIGNAL_TYPES) or not entry_gate_note.strip(): raise ValueError("Entry decision requires all five independently verified signals and gate notes")
        snapshot = self._snapshot([verified[x] for x in SIGNAL_TYPES]); score = sum(Decimal(verified[x].normalized_score) * SIGNAL_WEIGHTS[x] for x in SIGNAL_TYPES).quantize(Decimal("0.01")); recommendation = "enter" if score >= 75 else "validate" if score >= 55 else "defer"
        item = FactoryMarketEntryDecision(id=_id("market-decision"), **_context(context, project_id), decision_number=_number("MRD", project_id), scan_id=scan.id, scan_number=scan.scan_number, input_snapshot_json=snapshot, input_hash=_hash(snapshot), opportunity_score=score, entry_recommendation=recommendation, entry_gate_note=entry_gate_note.strip(), status="pending-review", authored_by=str(actor), authored_at=datetime.now(timezone.utc), revision=1)
        self.db.add(item); scan.status = "decision-pending"; scan.updated_at = datetime.now(timezone.utc); scan.revision += 1; await self._event(item, "decision", "decision-created", item.input_hash, "Weighted entry decision created", actor); await self.db.flush(); return _serialize(item, DECISION_FIELDS)

    async def review_decision(self, decision_id: str, *, project_id: int, actor: str, expected_revision: int, decision: str, review_reference: str):
        item = await self._get(FactoryMarketEntryDecision, decision_id, project_id, "Market decision"); self._revision(item, expected_revision); await self._validate_decision(item)
        if item.status != "pending-review" or item.authored_by == str(actor) or decision not in {"approve", "reject"} or not review_reference.strip(): raise ValueError("Entry decision requires independent documented review")
        item.status = "approved" if decision == "approve" else "rejected"; item.reviewed_by = str(actor); item.reviewed_at = datetime.now(timezone.utc); item.review_reference = review_reference.strip()[:255]; item.revision += 1
        scan = await self._get(FactoryMarketScan, item.scan_id, project_id, "Market scan"); scan.status = "decided" if decision == "approve" else "gathering"; scan.updated_at = datetime.now(timezone.utc); scan.revision += 1; await self._event(item, "decision", "decision-reviewed", review_reference, "Independent entry review completed", actor); await self.db.flush(); return _serialize(item, DECISION_FIELDS)

    async def prepare_release(self, decision_id: str, *, project_id: int, context: TenantContext, actor: str, release_version: str, support_owner: str, support_until: datetime, **evidence):
        decision = await self._get(FactoryMarketEntryDecision, decision_id, project_id, "Market decision"); await self._validate_decision(decision); clean = {x: str(evidence.get(x, "")).strip() for x in RELEASE_EVIDENCE_FIELDS}; support_end = self._utc(support_until)
        if decision.status != "approved" or not release_version.strip() or not support_owner.strip() or not all(clean.values()) or support_end <= datetime.now(timezone.utc): raise ValueError("Market release requires approved decision, five evidence keys and future support")
        manifest = {"application_id": APPLICATION_ID, "release_version": release_version.strip(), "decision_number": decision.decision_number, "decision_hash": decision.input_hash, "opportunity_score": str(decision.opportunity_score), "support_owner": support_owner.strip(), "support_until": support_end.isoformat(), "evidence": clean}
        item = FactoryMarketRadarRelease(id=_id("market-release"), **_context(context, project_id), release_number=_number("MRR", project_id), application_id=APPLICATION_ID, release_version=manifest["release_version"], scan_id=decision.scan_id, decision_id=decision.id, manifest_json=manifest, manifest_hash=_hash(manifest), support_owner=manifest["support_owner"], support_until=support_end, **clean, status="pending-approval", available=False, prepared_by=str(actor), prepared_at=datetime.now(timezone.utc), revision=1)
        self.db.add(item); await self._event(item, "release", "availability-prepared", item.manifest_hash, "Current-version customer and operations evidence pinned", actor); await self.db.flush(); return _serialize(item, RELEASE_FIELDS)

    async def approve_release(self, release_id: str, *, project_id: int, actor: str, expected_revision: int, approval_reference: str):
        item = await self._get(FactoryMarketRadarRelease, release_id, project_id, "Market release"); self._revision(item, expected_revision); decision = await self._get(FactoryMarketEntryDecision, item.decision_id, project_id, "Market decision"); await self._validate_decision(decision)
        event_contract = await self.db.scalar(select(FactoryCoreEventContract).where(FactoryCoreEventContract.id == "market-entry-released", FactoryCoreEventContract.lifecycle_status == "frozen")); object_contract = await self.db.scalar(select(FactoryCoreObjectContract).where(FactoryCoreObjectContract.id == "market-entry-scan", FactoryCoreObjectContract.lifecycle_status == "frozen"))
        if item.status != "pending-approval" or item.prepared_by == str(actor) or not approval_reference.strip() or item.manifest_hash != _hash(item.manifest_json) or self._utc(item.support_until) <= datetime.now(timezone.utc) or not event_contract or not object_contract: raise ValueError("Market availability requires independent approval, unchanged manifest, support and frozen contracts")
        item.status = "available"; item.available = True; item.approved_by = str(actor); item.approved_at = datetime.now(timezone.utc); item.approval_reference = approval_reference.strip()[:255]; item.revision += 1
        scan = await self._get(FactoryMarketScan, item.scan_id, project_id, "Market scan"); scan.status = "available"; scan.updated_at = datetime.now(timezone.utc); scan.revision += 1; await self._event(item, "release", "market-entry-released", approval_reference, "Commercial market-radar release approved", actor); await self.db.flush(); return _serialize(item, RELEASE_FIELDS)

    async def _validate_decision(self, item):
        signals = await self._signals(item.scan_id, item.project_id); verified = {x.signal_type: x for x in signals if x.status == "verified"}
        if set(verified) != set(SIGNAL_TYPES): raise ValueError("Market decision source coverage changed")
        snapshot = self._snapshot([verified[x] for x in SIGNAL_TYPES])
        if snapshot != item.input_snapshot_json or _hash(snapshot) != item.input_hash: raise ValueError("Market signals changed; release blocked")
    async def _signals(self, scan_id, project_id): return (await self.db.execute(select(FactoryMarketSignal).where(FactoryMarketSignal.scan_id == scan_id, FactoryMarketSignal.project_id == project_id))).scalars().all()
    @staticmethod
    def _source_payload(x): return {"scan_number": x.scan_number, "signal_type": x.signal_type, "score": format(Decimal(x.normalized_score).quantize(Decimal("0.01")), "f"), "raw_value": format(Decimal(x.raw_value).quantize(Decimal("0.0001")), "f"), "unit": x.measurement_unit, "source_system": x.source_system, "source_reference": x.source_reference, "source_revision": x.source_revision, "observed_at": FactoryMarketRadarService._utc(x.source_observed_at).isoformat()}
    def _snapshot(self, signals): return {"application_id": APPLICATION_ID, "signals": [dict(self._source_payload(x), signal_number=x.signal_number, source_hash=x.source_hash, verified_by=x.verified_by, verification_reference=x.verification_reference, revision=x.revision) for x in signals]}
    async def _get(self, model, item_id, project_id, label):
        item = await self.db.scalar(select(model).where(model.id == item_id, model.project_id == project_id))
        if not item: raise KeyError(f"{label} not found in this tenant plan")
        return item
    @staticmethod
    def _revision(item, expected):
        if int(item.revision) != int(expected): raise ValueError("Revision conflict")
    @staticmethod
    def _utc(value): return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)
    async def _event(self, item, subject_type, evidence_type, reference, note, actor):
        number = next((getattr(item, field, None) for field in ("scan_number", "signal_number", "decision_number", "release_number") if getattr(item, field, None)), str(item.id))
        self.db.add(FactoryMarketRadarEvidence(id=_id("market-evidence"), **_same(item), evidence_number=_number("MRE", item.project_id), subject_type=subject_type, subject_id=str(item.id), subject_number=number, evidence_type=evidence_type, evidence_reference=str(reference)[:255], note=note, recorded_by=str(actor), recorded_at=datetime.now(timezone.utc)))
