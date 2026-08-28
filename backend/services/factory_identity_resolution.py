"""Consent-governed identity matching and immutable golden-profile publication."""
from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import json
import secrets

from core.tenant_context import TenantContext
from models.factory_identity_resolution import (
    FactoryGoldenProfile,
    FactoryGoldenProfileVersion,
    FactoryIdentityConsent,
    FactoryIdentityEvidence,
    FactoryIdentityMatchCase,
    FactoryIdentityPublication,
    FactoryIdentitySignal,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


SIGNAL_TYPES = {"account", "contact", "email", "phone", "device"}
LAWFUL_BASES = {"consent", "contract", "legitimate-interest"}
MATCH_METHODS = {"deterministic", "probabilistic", "manual"}
CONSUMERS = {"cdp", "crm", "ads", "service"}
CONSENT = ("id", "consent_number", "subject_reference", "account_reference", "consent_reference", "lawful_basis", "purposes_json", "source_event_hash", "valid_from", "expires_at", "status", "requested_by", "approved_by", "revoked_by", "revision")
SIGNAL = ("id", "signal_number", "consent_id", "consent_number", "account_reference", "signal_type", "identifier_hash", "display_hint", "source_type", "source_reference", "source_revision", "source_fingerprint", "status", "captured_by", "verified_by", "revision")
CASE = ("id", "case_number", "account_reference", "signal_ids_json", "signal_manifest_hash", "match_method", "match_score", "reasons_json", "status", "proposed_by", "decided_by", "revision")
PROFILE = ("id", "profile_number", "account_reference", "match_case_id", "match_case_number", "member_signal_ids_json", "source_manifest_json", "source_manifest_hash", "status", "authored_by", "published_by", "revision")
VERSION = ("id", "version_number_ref", "profile_id", "profile_number", "version_number", "manifest_json", "manifest_hash", "status", "published_by")
PUBLICATION = ("id", "publication_number", "profile_id", "version_id", "version_number_ref", "consumer_system", "manifest_hash", "remote_reference", "consumer_mutated", "status", "created_by", "acknowledged_by", "revision")


def _id(kind: str) -> str: return f"{kind}-{secrets.token_urlsafe(18)}"
def _number(prefix: str, project_id: int) -> str: return f"{prefix}-{project_id}-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S%f')}-{secrets.token_hex(3).upper()}"
def _context(context: TenantContext, project_id: int) -> dict: return {"project_id": project_id, "agent_path": context.agent_path, "tenant_id": context.tenant_id, "client_id": context.client_id, "plan_id": context.plan_id or f"plan-{project_id}"}
def _same(item) -> dict: return {key: getattr(item, key) for key in ("project_id", "agent_path", "tenant_id", "client_id", "plan_id")}
def _hash(payload) -> str: return hashlib.sha256(json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str).encode()).hexdigest()
def _serialize(item, fields) -> dict: return {field: getattr(item, field) for field in fields}
def _aware(value: datetime) -> datetime: return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


class FactoryIdentityResolutionService:
    def __init__(self, db: AsyncSession): self.db = db

    async def list_workspace(self, *, project_id: int):
        async def rows(model, order): return (await self.db.execute(select(model).where(model.project_id == project_id).order_by(order.desc()).limit(500))).scalars().all()
        consents = await rows(FactoryIdentityConsent, FactoryIdentityConsent.created_at)
        signals = await rows(FactoryIdentitySignal, FactoryIdentitySignal.created_at)
        cases = await rows(FactoryIdentityMatchCase, FactoryIdentityMatchCase.created_at)
        profiles = await rows(FactoryGoldenProfile, FactoryGoldenProfile.created_at)
        versions = await rows(FactoryGoldenProfileVersion, FactoryGoldenProfileVersion.published_at)
        publications = await rows(FactoryIdentityPublication, FactoryIdentityPublication.created_at)
        evidence = await rows(FactoryIdentityEvidence, FactoryIdentityEvidence.recorded_at)
        verified = [x for x in signals if x.status == "verified"]
        approved_cases = [x for x in cases if x.status == "approved"]
        matched_ids = {sid for x in approved_cases for sid in x.signal_ids_json}
        published = [x for x in profiles if x.status == "published"]
        acknowledged = [x for x in publications if x.status == "acknowledged"]
        return {
            "consents": [_serialize(x, CONSENT) for x in consents],
            "signals": [_serialize(x, SIGNAL) for x in signals],
            "match_cases": [_serialize(x, CASE) for x in cases],
            "profiles": [_serialize(x, PROFILE) for x in profiles],
            "versions": [_serialize(x, VERSION) for x in versions],
            "publications": [_serialize(x, PUBLICATION) for x in publications],
            "evidence": [{"id": x.id, "subject_type": x.subject_type, "subject_id": x.subject_id, "evidence_type": x.evidence_type, "evidence_reference": x.evidence_reference, "recorded_by": x.recorded_by} for x in evidence],
            "metrics": {
                "active_consents": len([x for x in consents if x.status == "active" and _aware(x.expires_at) > datetime.now(timezone.utc)]),
                "verified_signals": len(verified),
                "identity_match_percent": round(len(matched_ids) * 100 / max(1, len(verified)), 2),
                "approved_matches": len(approved_cases),
                "published_profiles": len(published),
                "handoff_acknowledgement_percent": round(len(acknowledged) * 100 / max(1, len(publications)), 2),
            },
            "contract": {
                "raw_identifier_stored": False,
                "consent_required": True,
                "revoked_consent_matchable": False,
                "source_revision_pinned": True,
                "source_fingerprint_pinned": True,
                "signal_self_verification": False,
                "match_self_approval": False,
                "probabilistic_auto_merge": False,
                "profile_author_self_publish": False,
                "published_versions_mutable": False,
                "consumer_system_mutated": False,
                "acknowledgement_required": True,
            },
        }

    async def create_consent(self, *, project_id: int, context: TenantContext, actor: str, subject_reference: str, account_reference: str, consent_reference: str, lawful_basis: str, purposes: list[str], expires_at: datetime):
        now = datetime.now(timezone.utc)
        clean_purposes = sorted({str(x).strip() for x in purposes if str(x).strip()})
        if lawful_basis not in LAWFUL_BASES or not clean_purposes or _aware(expires_at) <= now: raise ValueError("Identity consent requires lawful basis, purpose and future expiry")
        source = {"subject_reference": subject_reference.strip(), "account_reference": account_reference.strip(), "consent_reference": consent_reference.strip(), "lawful_basis": lawful_basis, "purposes": clean_purposes, "valid_from": now.isoformat(), "expires_at": _aware(expires_at).isoformat()}
        if not all((source["subject_reference"], source["account_reference"], source["consent_reference"])): raise ValueError("Identity consent references are required")
        item = FactoryIdentityConsent(id=_id("identity-consent"), **_context(context, project_id), consent_number=_number("IDC", project_id), subject_reference=source["subject_reference"][:180], account_reference=source["account_reference"][:180], consent_reference=source["consent_reference"][:255], lawful_basis=lawful_basis, purposes_json=clean_purposes, source_event_hash=_hash(source), valid_from=now, expires_at=_aware(expires_at), status="pending", requested_by=str(actor), revision=1, created_at=now)
        self.db.add(item); await self._event(item, "consent", "consent-requested", item.consent_reference, "Recorded purpose-limited consent event without identity plaintext", actor); await self.db.flush(); return _serialize(item, CONSENT)

    async def approve_consent(self, consent_id: str, *, project_id: int, actor: str, expected_revision: int, reference: str):
        item = await self._get(FactoryIdentityConsent, consent_id, project_id, "Identity consent"); self._revision(item, expected_revision)
        if item.status != "pending" or item.requested_by == str(actor) or not reference.strip() or _aware(item.expires_at) <= datetime.now(timezone.utc): raise ValueError("Identity consent requires independent approval evidence and valid term")
        item.status = "active"; item.approved_by = str(actor); item.approved_at = datetime.now(timezone.utc); item.revision += 1
        await self._event(item, "consent", "consent-approved", reference, "Independently approved purpose and term", actor); await self.db.flush(); return _serialize(item, CONSENT)

    async def revoke_consent(self, consent_id: str, *, project_id: int, actor: str, expected_revision: int, reference: str):
        item = await self._get(FactoryIdentityConsent, consent_id, project_id, "Identity consent"); self._revision(item, expected_revision)
        if item.status != "active" or not reference.strip(): raise ValueError("Only active consent can be revoked with evidence")
        item.status = "revoked"; item.revoked_by = str(actor); item.revoked_at = datetime.now(timezone.utc); item.revision += 1
        await self._event(item, "consent", "consent-revoked", reference, "Stopped future identity resolution for revoked consent", actor); await self.db.flush(); return _serialize(item, CONSENT)

    async def add_signal(self, *, project_id: int, context: TenantContext, actor: str, consent_id: str, signal_type: str, identifier_hash: str, display_hint: str, source_type: str, source_reference: str, source_revision: int, source_fingerprint: str):
        consent = await self._active_consent(consent_id, project_id)
        digest = identifier_hash.strip().lower()
        if signal_type not in SIGNAL_TYPES or len(digest) != 64 or any(c not in "0123456789abcdef" for c in digest): raise ValueError("Only a 64-character irreversible identity hash is accepted")
        if any(marker in display_hint.lower() for marker in ("@", "+86", "http://", "https://")) or len(display_hint) > 12: raise ValueError("Display hint must not contain a raw identifier")
        if source_revision != consent.revision or source_fingerprint != consent.source_event_hash or not source_reference.strip(): raise ValueError("Identity signal source revision or fingerprint drifted")
        now = datetime.now(timezone.utc); item = FactoryIdentitySignal(id=_id("identity-signal"), **_context(context, project_id), signal_number=_number("IDS", project_id), consent_id=consent.id, consent_number=consent.consent_number, account_reference=consent.account_reference, signal_type=signal_type, identifier_hash=digest, display_hint=display_hint.strip()[:32], source_type=source_type.strip()[:40], source_reference=source_reference.strip()[:255], source_revision=source_revision, source_fingerprint=source_fingerprint, status="pending", captured_by=str(actor), revision=1, created_at=now)
        self.db.add(item); await self._event(item, "signal", "signal-captured", item.source_reference, "Stored irreversible hash and pinned source only", actor); await self.db.flush(); return _serialize(item, SIGNAL)

    async def verify_signal(self, signal_id: str, *, project_id: int, actor: str, expected_revision: int, reference: str):
        item = await self._get(FactoryIdentitySignal, signal_id, project_id, "Identity signal"); self._revision(item, expected_revision)
        await self._validate_signal(item)
        if item.status != "pending" or item.captured_by == str(actor) or not reference.strip(): raise ValueError("Identity signal requires independent verification evidence")
        item.status = "verified"; item.verified_by = str(actor); item.verified_at = datetime.now(timezone.utc); item.verification_reference = reference.strip()[:255]; item.revision += 1
        await self._event(item, "signal", "signal-verified", reference, "Independently verified hash and pinned consent source", actor); await self.db.flush(); return _serialize(item, SIGNAL)

    async def propose_match(self, *, project_id: int, context: TenantContext, actor: str, account_reference: str, signal_ids: list[str], match_method: str, match_score: float, reasons: list[str]):
        ids = list(dict.fromkeys(signal_ids)); clean_reasons = [str(x).strip() for x in reasons if str(x).strip()]
        if match_method not in MATCH_METHODS or len(ids) < 2 or not clean_reasons or not 0 <= match_score <= 100: raise ValueError("Match proposal requires two signals, method, score and reasons")
        signals = [await self._get(FactoryIdentitySignal, signal_id, project_id, "Identity signal") for signal_id in ids]
        for item in signals: await self._validate_signal(item)
        if any(x.status != "verified" or x.account_reference != account_reference for x in signals): raise ValueError("Only verified signals for one account can be matched")
        manifest = self._signal_manifest(signals); now = datetime.now(timezone.utc)
        item = FactoryIdentityMatchCase(id=_id("identity-match"), **_context(context, project_id), case_number=_number("IDM", project_id), account_reference=account_reference.strip()[:180], signal_ids_json=ids, signal_manifest_hash=_hash(manifest), match_method=match_method, match_score=match_score, reasons_json=clean_reasons, status="proposed", proposed_by=str(actor), revision=1, created_at=now)
        self.db.add(item); await self._event(item, "match", "match-proposed", item.signal_manifest_hash, "Proposed explainable match; no automatic merge performed", actor); await self.db.flush(); return _serialize(item, CASE)

    async def decide_match(self, case_id: str, *, project_id: int, actor: str, expected_revision: int, decision: str, reference: str):
        item = await self._get(FactoryIdentityMatchCase, case_id, project_id, "Identity match"); self._revision(item, expected_revision)
        if item.status != "proposed" or item.proposed_by == str(actor) or decision not in {"approved", "rejected"} or not reference.strip(): raise ValueError("Identity match requires independent explicit decision evidence")
        signals = [await self._get(FactoryIdentitySignal, sid, project_id, "Identity signal") for sid in item.signal_ids_json]
        for signal in signals: await self._validate_signal(signal)
        if _hash(self._signal_manifest(signals)) != item.signal_manifest_hash: raise ValueError("Identity match signal manifest drifted")
        item.status = decision; item.decided_by = str(actor); item.decided_at = datetime.now(timezone.utc); item.decision_reference = reference.strip()[:255]; item.revision += 1
        await self._event(item, "match", f"match-{decision}", reference, "Independent human decision recorded for identity match", actor); await self.db.flush(); return _serialize(item, CASE)

    async def create_profile(self, case_id: str, *, project_id: int, context: TenantContext, actor: str):
        case = await self._get(FactoryIdentityMatchCase, case_id, project_id, "Identity match")
        if case.status != "approved": raise ValueError("Golden profile requires approved identity match")
        signals = [await self._get(FactoryIdentitySignal, sid, project_id, "Identity signal") for sid in case.signal_ids_json]
        for signal in signals: await self._validate_signal(signal)
        manifest = {"account_reference": case.account_reference, "match_case_number": case.case_number, "match_method": case.match_method, "match_score": case.match_score, "signals": self._signal_manifest(signals)}
        now = datetime.now(timezone.utc); item = FactoryGoldenProfile(id=_id("golden-profile"), **_context(context, project_id), profile_number=_number("IDP", project_id), account_reference=case.account_reference, match_case_id=case.id, match_case_number=case.case_number, member_signal_ids_json=case.signal_ids_json, source_manifest_json=manifest, source_manifest_hash=_hash(manifest), status="draft", authored_by=str(actor), revision=1, created_at=now, updated_at=now)
        self.db.add(item); await self._event(item, "profile", "profile-created", case.case_number, "Built golden profile from approved hashes and pinned sources", actor); await self.db.flush(); return _serialize(item, PROFILE)

    async def publish_profile(self, profile_id: str, *, project_id: int, context: TenantContext, actor: str, expected_revision: int, consumers: list[str], remote_reference_prefix: str):
        profile = await self._get(FactoryGoldenProfile, profile_id, project_id, "Golden profile"); self._revision(profile, expected_revision)
        requested = sorted(set(consumers))
        if profile.status != "draft" or profile.authored_by == str(actor) or not requested or any(x not in CONSUMERS for x in requested) or not remote_reference_prefix.strip(): raise ValueError("Golden profile requires independent publisher, supported consumers and reference")
        signals = [await self._get(FactoryIdentitySignal, sid, project_id, "Identity signal") for sid in profile.member_signal_ids_json]
        for signal in signals: await self._validate_signal(signal)
        if _hash(profile.source_manifest_json) != profile.source_manifest_hash or profile.source_manifest_json.get("signals") != self._signal_manifest(signals): raise ValueError("Golden profile source manifest drifted")
        current = await self.db.scalar(select(FactoryGoldenProfileVersion.version_number).where(FactoryGoldenProfileVersion.profile_id == profile.id).order_by(FactoryGoldenProfileVersion.version_number.desc()).limit(1)) or 0
        now = datetime.now(timezone.utc); version = FactoryGoldenProfileVersion(id=_id("golden-version"), **_context(context, project_id), version_number_ref=_number("IDV", project_id), profile_id=profile.id, profile_number=profile.profile_number, version_number=int(current) + 1, manifest_json=profile.source_manifest_json, manifest_hash=profile.source_manifest_hash, status="published", published_by=str(actor), published_at=now)
        self.db.add(version); publications = []
        for consumer in requested:
            publication = FactoryIdentityPublication(id=_id("identity-publication"), **_context(context, project_id), publication_number=_number("IDH", project_id), profile_id=profile.id, version_id=version.id, version_number_ref=version.version_number_ref, consumer_system=consumer, manifest_hash=version.manifest_hash, remote_reference=f"{remote_reference_prefix.strip()[:180]}:{consumer}", consumer_mutated=False, status="pending", created_by=str(actor), created_at=now, revision=1)
            self.db.add(publication); publications.append(publication); await self._event(publication, "publication", "handoff-created", publication.remote_reference, "Created explicit downstream acknowledgement for exact profile hash", actor)
        profile.status = "published"; profile.published_by = str(actor); profile.published_at = now; profile.revision += 1; profile.updated_at = now
        await self._event(profile, "profile", "profile-published", version.version_number_ref, "Published immutable golden-profile version without mutating consumers", actor); await self.db.flush()
        return {"profile": _serialize(profile, PROFILE), "version": _serialize(version, VERSION), "publications": [_serialize(x, PUBLICATION) for x in publications]}

    async def acknowledge_publication(self, publication_id: str, *, project_id: int, actor: str, expected_revision: int, reference: str):
        item = await self._get(FactoryIdentityPublication, publication_id, project_id, "Identity publication"); self._revision(item, expected_revision)
        if item.status != "pending" or item.created_by == str(actor) or not reference.strip(): raise ValueError("Identity handoff acknowledgement must be independent and evidenced")
        version = await self._get(FactoryGoldenProfileVersion, item.version_id, project_id, "Golden profile version")
        if version.status != "published" or version.manifest_hash != item.manifest_hash or _hash(version.manifest_json) != item.manifest_hash: raise ValueError("Published golden profile changed")
        item.status = "acknowledged"; item.acknowledged_by = str(actor); item.acknowledged_at = datetime.now(timezone.utc); item.acknowledgement_reference = reference.strip()[:255]; item.revision += 1
        await self._event(item, "publication", "handoff-acknowledged", reference, "Consumer acknowledged exact immutable profile hash", actor); await self.db.flush(); return _serialize(item, PUBLICATION)

    async def _active_consent(self, consent_id: str, project_id: int):
        item = await self._get(FactoryIdentityConsent, consent_id, project_id, "Identity consent")
        if item.status != "active" or _aware(item.valid_from) > datetime.now(timezone.utc) or _aware(item.expires_at) <= datetime.now(timezone.utc): raise ValueError("Active unexpired identity consent is required")
        return item

    async def _validate_signal(self, item):
        consent = await self._active_consent(item.consent_id, item.project_id)
        if item.source_revision != consent.revision or item.source_fingerprint != consent.source_event_hash or item.account_reference != consent.account_reference: raise ValueError("Identity signal source revision or fingerprint drifted")
        return consent

    @staticmethod
    def _signal_manifest(signals) -> list[dict]:
        return sorted([{"id": x.id, "signal_number": x.signal_number, "type": x.signal_type, "identifier_hash": x.identifier_hash, "source_revision": x.source_revision, "source_fingerprint": x.source_fingerprint} for x in signals], key=lambda x: x["id"])

    async def _get(self, model, item_id: str, project_id: int, label: str):
        item = await self.db.scalar(select(model).where(model.id == item_id, model.project_id == project_id))
        if not item: raise KeyError(f"{label} not found")
        return item

    @staticmethod
    def _revision(item, expected: int):
        if int(item.revision) != int(expected): raise ValueError("Revision conflict")

    async def _event(self, item, subject_type: str, evidence_type: str, reference: str, note: str, actor: str):
        number = next((getattr(item, key, None) for key in ("consent_number", "signal_number", "case_number", "profile_number", "version_number_ref", "publication_number") if getattr(item, key, None)), str(item.id))
        self.db.add(FactoryIdentityEvidence(id=_id("identity-evidence"), **_same(item), evidence_number=_number("IDX", item.project_id), subject_type=subject_type, subject_id=item.id, subject_number=number, evidence_type=evidence_type, evidence_reference=str(reference)[:255], note=note, recorded_by=str(actor), recorded_at=datetime.now(timezone.utc)))
