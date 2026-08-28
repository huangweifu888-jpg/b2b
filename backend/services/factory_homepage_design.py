"""Controlled homepage composition release workflow."""
from datetime import datetime, timezone
import hashlib
import json
import secrets
from typing import Any

from core.tenant_context import TenantContext
from models.factory_contract import FactoryCoreEventContract, FactoryCoreObjectContract
from models.factory_homepage_design import FactoryHomepageDesign, FactoryHomepageDesignEvidence, FactoryHomepageDesignPublication, FactoryHomepageDesignVersion
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

APPLICATION_ID = "content.homepage"
_PROHIBITED_KEYS = {"password", "secret", "token", "private_key", "api_key", "credential"}

def _id(prefix: str) -> str: return f"{prefix}-{secrets.token_urlsafe(18)}"
def _number(prefix: str, project_id: int) -> str: return f"{prefix}-{project_id}-{datetime.now(timezone.utc):%Y%m%d%H%M%S%f}-{secrets.token_hex(3).upper()}"
def _hash(value: object) -> str: return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str).encode()).hexdigest()
def _context(context: TenantContext, project_id: int) -> dict[str, object]: return {"project_id": project_id, "agent_path": context.agent_path, "tenant_id": context.tenant_id, "client_id": context.client_id, "plan_id": context.plan_id or f"plan-{project_id}"}
def _same(row: object) -> dict[str, object]: return {name: getattr(row, name) for name in ("project_id", "agent_path", "tenant_id", "client_id", "plan_id")}
def _pick(row: object, names: tuple[str, ...]) -> dict[str, object]: return {name: getattr(row, name) for name in names}
DESIGN = ("id", "design_number", "design_key", "display_name", "status", "revision")
VERSION = ("id", "version_number", "design_id", "design_number", "locale", "manifest_hash", "source_reference", "status", "authored_by", "validated_by", "revision")
PUBLICATION = ("id", "publication_number", "design_id", "design_version_id", "version_number", "target", "status", "available", "consumer_receipt_reference", "revision")

def _unsafe(value: object) -> bool:
    if isinstance(value, dict): return any(str(key).casefold() in _PROHIBITED_KEYS or _unsafe(item) for key, item in value.items())
    if isinstance(value, list): return any(_unsafe(item) for item in value)
    return isinstance(value, str) and ("javascript:" in value.casefold() or "<script" in value.casefold())


class FactoryHomepageDesignService:
    def __init__(self, db: AsyncSession): self.db = db

    async def workspace(self, *, project_id: int) -> dict[str, object]:
        async def rows(model: Any, order: Any):
            result = await self.db.execute(select(model).where(model.project_id == project_id).order_by(order.desc()).limit(500)); return list(result.scalars().all())
        designs = await rows(FactoryHomepageDesign, FactoryHomepageDesign.created_at); versions = await rows(FactoryHomepageDesignVersion, FactoryHomepageDesignVersion.created_at); publications = await rows(FactoryHomepageDesignPublication, FactoryHomepageDesignPublication.prepared_at); evidence = await rows(FactoryHomepageDesignEvidence, FactoryHomepageDesignEvidence.recorded_at)
        ready = [item for item in publications if item.status == "available" and item.available]
        return {"designs": [_pick(x, DESIGN) for x in designs], "versions": [_pick(x, VERSION) for x in versions], "publications": [_pick(x, PUBLICATION) for x in publications], "evidence": [{"id": x.id, "evidence_type": x.evidence_type, "evidence_reference": x.evidence_reference} for x in evidence], "metrics": {"designs": len(designs), "validated_versions": sum(x.status == "validated" for x in versions), "acknowledged_releases": len(ready), "evidence_records": len(evidence)}, "availability": {"application_id": APPLICATION_ID, "status": "available" if ready else "pilot", "release_version": ready[0].version_number if ready else None}, "contract": {"customer_site_mutated_directly": False, "plugin_locks_overwritten": False, "unsafe_markup_stored": False, "version_self_validation": False, "publication_self_approval": False, "consumer_handoff_required": True}}

    async def create_design(self, *, project_id: int, context: TenantContext, actor: str, design_key: str, display_name: str):
        if not design_key.strip() or not display_name.strip(): raise ValueError("Design requires a key and display name")
        now = datetime.now(timezone.utc); design = FactoryHomepageDesign(id=_id("homepage-design"), **_context(context, project_id), design_number=_number("HPD", project_id), design_key=design_key.strip().lower(), display_name=display_name.strip()[:200], status="active", created_by=str(actor), created_at=now, revision=1)
        self.db.add(design); await self._event(design, "design", "homepage-design-created", design.design_key, "Design container only; it does not modify customer pages or plugin locks", actor); await self.db.flush(); return _pick(design, DESIGN)

    async def draft_version(self, design_id: str, *, project_id: int, context: TenantContext, actor: str, locale: str, composition_manifest: dict[str, object], source_reference: str):
        design = await self._get(FactoryHomepageDesign, design_id, project_id, "Homepage design")
        if design.status != "active" or not locale.strip() or not composition_manifest or not source_reference.strip(): raise ValueError("Version requires active design, locale, composition and source reference")
        if _unsafe(composition_manifest): raise ValueError("Composition manifest must not contain unsafe markup or credentials")
        manifest = {"design_number": design.design_number, "locale": locale.strip(), "composition_manifest": composition_manifest, "source_reference": source_reference.strip()}
        version = FactoryHomepageDesignVersion(id=_id("homepage-version"), **_same(design), version_number=_number("HPV", project_id), design_id=design.id, design_number=design.design_number, locale=locale.strip(), composition_manifest_json=composition_manifest, manifest_hash=_hash(manifest), source_reference=source_reference.strip()[:255], status="draft", authored_by=str(actor), created_at=datetime.now(timezone.utc), revision=1)
        self.db.add(version); await self._event(version, "version", "homepage-composition-drafted", version.manifest_hash, "Pinned navigation/banner/recommendation composition; source editor remains unchanged", actor); await self.db.flush(); return _pick(version, VERSION)

    async def validate_version(self, version_id: str, *, project_id: int, actor: str, expected_revision: int, validation_reference: str):
        version = await self._get(FactoryHomepageDesignVersion, version_id, project_id, "Homepage design version"); self._revision(version, expected_revision)
        expected = _hash({"design_number": version.design_number, "locale": version.locale, "composition_manifest": version.composition_manifest_json, "source_reference": version.source_reference})
        if version.status != "draft" or version.authored_by == str(actor) or not validation_reference.strip() or version.manifest_hash != expected: raise ValueError("Version requires independent validation of an unchanged composition")
        version.status = "validated"; version.validated_by = str(actor); version.validated_at = datetime.now(timezone.utc); version.validation_reference = validation_reference.strip()[:255]; version.revision += 1
        await self._event(version, "version", "homepage-composition-validated", version.validation_reference, "Independent validator accepted the pinned composition", actor); await self.db.flush(); return _pick(version, VERSION)

    async def prepare_publication(self, version_id: str, *, project_id: int, context: TenantContext, actor: str, target: str, rollback_reference: str):
        version = await self._get(FactoryHomepageDesignVersion, version_id, project_id, "Homepage design version")
        if version.status != "validated" or target not in {"website-homepage", "landing-page"} or not rollback_reference.strip(): raise ValueError("Release requires validated composition, supported target and rollback reference")
        manifest = {"application_id": APPLICATION_ID, "design_number": version.design_number, "version_number": version.version_number, "source_manifest_hash": version.manifest_hash, "target": target, "direct_customer_site_mutation": False, "plugin_locks_overwritten": False, "consumer_receipt_required": True, "rollback_reference": rollback_reference.strip()}
        publication = FactoryHomepageDesignPublication(id=_id("homepage-release"), **_context(context, project_id), publication_number=_number("HPP", project_id), design_id=version.design_id, design_version_id=version.id, version_number=version.version_number, target=target, release_manifest_json=manifest, manifest_hash=_hash(manifest), rollback_reference=rollback_reference.strip()[:255], status="pending-approval", prepared_by=str(actor), available=False, prepared_at=datetime.now(timezone.utc), revision=1)
        self.db.add(publication); await self._event(publication, "publication", "homepage-release-prepared", publication.manifest_hash, "Controlled consumer handoff; no website deployment or plugin-lock overwrite occurred", actor); await self.db.flush(); return _pick(publication, PUBLICATION)

    async def approve_publication(self, publication_id: str, *, project_id: int, actor: str, expected_revision: int, approval_reference: str):
        publication = await self._get(FactoryHomepageDesignPublication, publication_id, project_id, "Homepage design publication"); self._revision(publication, expected_revision); version = await self._get(FactoryHomepageDesignVersion, publication.design_version_id, project_id, "Homepage design version")
        obj = await self.db.scalar(select(FactoryCoreObjectContract).where(FactoryCoreObjectContract.id == "homepage-composition-version", FactoryCoreObjectContract.lifecycle_status == "frozen")); event = await self.db.scalar(select(FactoryCoreEventContract).where(FactoryCoreEventContract.id == "homepage-composition-released", FactoryCoreEventContract.lifecycle_status == "frozen"))
        if publication.status != "pending-approval" or publication.prepared_by == str(actor) or not approval_reference.strip() or publication.manifest_hash != _hash(publication.release_manifest_json) or version.status != "validated" or not obj or not event: raise ValueError("Release requires independent approval, frozen contracts and unchanged validated composition")
        publication.status = "approved"; publication.approved_by = str(actor); publication.approval_reference = approval_reference.strip()[:255]; publication.revision += 1
        await self._event(publication, "publication", "homepage-release-approved", publication.approval_reference, "Awaiting consumer acknowledgement; no direct customer-site mutation occurred", actor); await self.db.flush(); return _pick(publication, PUBLICATION)

    async def acknowledge_publication(self, publication_id: str, *, project_id: int, actor: str, expected_revision: int, consumer_receipt_reference: str):
        publication = await self._get(FactoryHomepageDesignPublication, publication_id, project_id, "Homepage design publication"); self._revision(publication, expected_revision)
        if publication.status != "approved" or publication.approved_by == str(actor) or not consumer_receipt_reference.strip(): raise ValueError("Consumer acknowledgement requires an approved release and separate handoff actor")
        publication.status = "available"; publication.available = True; publication.consumer_receipt_reference = consumer_receipt_reference.strip()[:255]; publication.acknowledged_at = datetime.now(timezone.utc); publication.revision += 1
        await self._event(publication, "publication", "homepage-composition-released", publication.consumer_receipt_reference, "Consumer receipt accepted handoff without direct page mutation", actor); await self.db.flush(); return _pick(publication, PUBLICATION)

    async def _get(self, model: Any, item_id: str, project_id: int, label: str):
        item = await self.db.scalar(select(model).where(model.id == item_id, model.project_id == project_id))
        if not item: raise KeyError(f"{label} not found in this tenant plan")
        return item
    @staticmethod
    def _revision(item: object, expected: int):
        if int(getattr(item, "revision")) != int(expected): raise ValueError("Revision conflict")
    async def _event(self, item: object, subject_type: str, evidence_type: str, reference: str, note: str, actor: str):
        number = next((getattr(item, name, None) for name in ("design_number", "version_number", "publication_number") if getattr(item, name, None)), str(getattr(item, "id")))
        self.db.add(FactoryHomepageDesignEvidence(id=_id("homepage-evidence"), **_same(item), evidence_number=_number("HPE", getattr(item, "project_id")), subject_type=subject_type, subject_id=getattr(item, "id"), subject_number=number, evidence_type=evidence_type, evidence_reference=str(reference)[:255], note=note, recorded_by=str(actor), recorded_at=datetime.now(timezone.utc)))
