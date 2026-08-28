"""Controlled company-profile content workflow with independent acknowledgement."""
from datetime import datetime, timezone
import hashlib
import json
import secrets
from typing import Any

from core.tenant_context import TenantContext
from models.factory_company_profile import FactoryCompanyProfile, FactoryCompanyProfileEvidence, FactoryCompanyProfilePublication, FactoryCompanyProfileVersion
from models.factory_contract import FactoryCoreEventContract, FactoryCoreObjectContract
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

APPLICATION_ID = "content.company"
_SENSITIVE_KEYS = {"password", "secret", "token", "private_key", "api_key", "credential"}


def _id(prefix: str) -> str: return f"{prefix}-{secrets.token_urlsafe(18)}"
def _number(prefix: str, project_id: int) -> str: return f"{prefix}-{project_id}-{datetime.now(timezone.utc):%Y%m%d%H%M%S%f}-{secrets.token_hex(3).upper()}"
def _hash(value: object) -> str: return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str).encode()).hexdigest()
def _context(context: TenantContext, project_id: int) -> dict[str, object]: return {"project_id": project_id, "agent_path": context.agent_path, "tenant_id": context.tenant_id, "client_id": context.client_id, "plan_id": context.plan_id or f"plan-{project_id}"}
def _same(row: object) -> dict[str, object]: return {name: getattr(row, name) for name in ("project_id", "agent_path", "tenant_id", "client_id", "plan_id")}
def _pick(row: object, names: tuple[str, ...]) -> dict[str, object]: return {name: getattr(row, name) for name in names}

PROFILE = ("id", "profile_number", "profile_key", "display_name", "status", "revision")
VERSION = ("id", "version_number", "profile_id", "profile_number", "locale", "manifest_hash", "source_reference", "status", "authored_by", "verified_by", "revision")
PUBLICATION = ("id", "publication_number", "profile_id", "profile_version_id", "version_number", "target", "status", "available", "consumer_receipt_reference", "revision")


def _contains_sensitive_key(value: object) -> bool:
    if isinstance(value, dict): return any(str(key).casefold() in _SENSITIVE_KEYS or _contains_sensitive_key(item) for key, item in value.items())
    if isinstance(value, list): return any(_contains_sensitive_key(item) for item in value)
    return False


class FactoryCompanyProfileService:
    def __init__(self, db: AsyncSession): self.db = db

    async def workspace(self, *, project_id: int) -> dict[str, object]:
        async def rows(model: Any, order: Any):
            result = await self.db.execute(select(model).where(model.project_id == project_id).order_by(order.desc()).limit(500))
            return list(result.scalars().all())
        profiles = await rows(FactoryCompanyProfile, FactoryCompanyProfile.created_at)
        versions = await rows(FactoryCompanyProfileVersion, FactoryCompanyProfileVersion.created_at)
        publications = await rows(FactoryCompanyProfilePublication, FactoryCompanyProfilePublication.prepared_at)
        evidence = await rows(FactoryCompanyProfileEvidence, FactoryCompanyProfileEvidence.recorded_at)
        ready = [item for item in publications if item.status == "available" and item.available]
        return {"profiles": [_pick(x, PROFILE) for x in profiles], "versions": [_pick(x, VERSION) for x in versions], "publications": [_pick(x, PUBLICATION) for x in publications], "evidence": [{"id": x.id, "evidence_type": x.evidence_type, "evidence_reference": x.evidence_reference} for x in evidence], "metrics": {"profiles": len(profiles), "verified_versions": sum(x.status == "verified" for x in versions), "acknowledged_releases": len(ready), "evidence_records": len(evidence)}, "availability": {"application_id": APPLICATION_ID, "status": "available" if ready else "pilot", "release_version": ready[0].version_number if ready else None}, "contract": {"source_profile_mutated_directly": False, "sensitive_profile_data_stored": False, "version_self_verification": False, "publication_self_approval": False, "consumer_handoff_required": True}}

    async def create_profile(self, *, project_id: int, context: TenantContext, actor: str, profile_key: str, display_name: str):
        if not profile_key.strip() or not display_name.strip(): raise ValueError("Profile requires a key and display name")
        now = datetime.now(timezone.utc)
        profile = FactoryCompanyProfile(id=_id("company-profile"), **_context(context, project_id), profile_number=_number("CPR", project_id), profile_key=profile_key.strip().lower(), display_name=display_name.strip()[:200], status="active", created_by=str(actor), created_at=now, revision=1)
        self.db.add(profile); await self._event(profile, "profile", "company-profile-created", profile.profile_key, "Container only; it does not overwrite the source profile", actor); await self.db.flush(); return _pick(profile, PROFILE)

    async def draft_version(self, profile_id: str, *, project_id: int, context: TenantContext, actor: str, locale: str, profile_manifest: dict[str, object], source_reference: str):
        profile = await self._get(FactoryCompanyProfile, profile_id, project_id, "Company profile")
        if profile.status != "active" or not locale.strip() or not profile_manifest or not source_reference.strip(): raise ValueError("Version requires an active profile, locale, manifest and source reference")
        if _contains_sensitive_key(profile_manifest): raise ValueError("Profile manifest must not contain secrets or credentials")
        manifest = {"profile_number": profile.profile_number, "locale": locale.strip(), "profile_manifest": profile_manifest, "source_reference": source_reference.strip()}
        version = FactoryCompanyProfileVersion(id=_id("company-version"), **_same(profile), version_number=_number("CPV", project_id), profile_id=profile.id, profile_number=profile.profile_number, locale=locale.strip(), profile_manifest_json=profile_manifest, manifest_hash=_hash(manifest), source_reference=source_reference.strip()[:255], status="draft", authored_by=str(actor), created_at=datetime.now(timezone.utc), revision=1)
        self.db.add(version); await self._event(version, "version", "company-profile-version-drafted", version.manifest_hash, "Pinned customer-facing profile manifest; source systems remain authoritative", actor); await self.db.flush(); return _pick(version, VERSION)

    async def verify_version(self, version_id: str, *, project_id: int, actor: str, expected_revision: int, verification_reference: str):
        version = await self._get(FactoryCompanyProfileVersion, version_id, project_id, "Company profile version"); self._revision(version, expected_revision)
        expected = _hash({"profile_number": version.profile_number, "locale": version.locale, "profile_manifest": version.profile_manifest_json, "source_reference": version.source_reference})
        if version.status != "draft" or version.authored_by == str(actor) or not verification_reference.strip() or version.manifest_hash != expected: raise ValueError("Version requires independent verification of an unchanged manifest")
        version.status = "verified"; version.verified_by = str(actor); version.verified_at = datetime.now(timezone.utc); version.verification_reference = verification_reference.strip()[:255]; version.revision += 1
        await self._event(version, "version", "company-profile-version-verified", version.verification_reference, "Independent verifier accepted the pinned profile content", actor); await self.db.flush(); return _pick(version, VERSION)

    async def prepare_publication(self, version_id: str, *, project_id: int, context: TenantContext, actor: str, target: str, rollback_reference: str):
        version = await self._get(FactoryCompanyProfileVersion, version_id, project_id, "Company profile version")
        if version.status != "verified" or target not in {"website-content", "sales-content"} or not rollback_reference.strip(): raise ValueError("Release requires verified content, supported target and rollback reference")
        manifest = {"application_id": APPLICATION_ID, "profile_number": version.profile_number, "version_number": version.version_number, "source_manifest_hash": version.manifest_hash, "target": target, "direct_source_mutation": False, "consumer_receipt_required": True, "rollback_reference": rollback_reference.strip()}
        publication = FactoryCompanyProfilePublication(id=_id("company-release"), **_context(context, project_id), publication_number=_number("CPP", project_id), profile_id=version.profile_id, profile_version_id=version.id, version_number=version.version_number, target=target, release_manifest_json=manifest, manifest_hash=_hash(manifest), rollback_reference=rollback_reference.strip()[:255], status="pending-approval", prepared_by=str(actor), available=False, prepared_at=datetime.now(timezone.utc), revision=1)
        self.db.add(publication); await self._event(publication, "publication", "company-profile-release-prepared", publication.manifest_hash, "Controlled handoff; source profile is not mutated", actor); await self.db.flush(); return _pick(publication, PUBLICATION)

    async def approve_publication(self, publication_id: str, *, project_id: int, actor: str, expected_revision: int, approval_reference: str):
        publication = await self._get(FactoryCompanyProfilePublication, publication_id, project_id, "Company profile publication"); self._revision(publication, expected_revision)
        version = await self._get(FactoryCompanyProfileVersion, publication.profile_version_id, project_id, "Company profile version")
        obj = await self.db.scalar(select(FactoryCoreObjectContract).where(FactoryCoreObjectContract.id == "company-profile-version", FactoryCoreObjectContract.lifecycle_status == "frozen"))
        event = await self.db.scalar(select(FactoryCoreEventContract).where(FactoryCoreEventContract.id == "company-profile-released", FactoryCoreEventContract.lifecycle_status == "frozen"))
        if publication.status != "pending-approval" or publication.prepared_by == str(actor) or not approval_reference.strip() or publication.manifest_hash != _hash(publication.release_manifest_json) or version.status != "verified" or not obj or not event: raise ValueError("Release requires independent approval, frozen contracts and unchanged verified manifest")
        publication.status = "approved"; publication.approved_by = str(actor); publication.approval_reference = approval_reference.strip()[:255]; publication.revision += 1
        await self._event(publication, "publication", "company-profile-release-approved", publication.approval_reference, "Awaiting consumer acknowledgement; no source profile mutation occurred", actor); await self.db.flush(); return _pick(publication, PUBLICATION)

    async def acknowledge_publication(self, publication_id: str, *, project_id: int, actor: str, expected_revision: int, consumer_receipt_reference: str):
        publication = await self._get(FactoryCompanyProfilePublication, publication_id, project_id, "Company profile publication"); self._revision(publication, expected_revision)
        if publication.status != "approved" or publication.approved_by == str(actor) or not consumer_receipt_reference.strip(): raise ValueError("Consumer acknowledgement requires an approved release and separate handoff actor")
        publication.status = "available"; publication.available = True; publication.consumer_receipt_reference = consumer_receipt_reference.strip()[:255]; publication.acknowledged_at = datetime.now(timezone.utc); publication.revision += 1
        await self._event(publication, "publication", "company-profile-released", publication.consumer_receipt_reference, "Consumer receipt accepted the profile handoff; source profile remains unchanged", actor); await self.db.flush(); return _pick(publication, PUBLICATION)

    async def _get(self, model: Any, item_id: str, project_id: int, label: str):
        item = await self.db.scalar(select(model).where(model.id == item_id, model.project_id == project_id))
        if not item: raise KeyError(f"{label} not found in this tenant plan")
        return item

    @staticmethod
    def _revision(item: object, expected: int):
        if int(getattr(item, "revision")) != int(expected): raise ValueError("Revision conflict")

    async def _event(self, item: object, subject_type: str, evidence_type: str, reference: str, note: str, actor: str):
        number = next((getattr(item, name, None) for name in ("profile_number", "version_number", "publication_number") if getattr(item, name, None)), str(getattr(item, "id")))
        self.db.add(FactoryCompanyProfileEvidence(id=_id("company-evidence"), **_same(item), evidence_number=_number("CPE", getattr(item, "project_id")), subject_type=subject_type, subject_id=getattr(item, "id"), subject_number=number, evidence_type=evidence_type, evidence_reference=str(reference)[:255], note=note, recorded_by=str(actor), recorded_at=datetime.now(timezone.utc)))
