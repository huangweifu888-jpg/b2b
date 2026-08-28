"""Controlled technical SEO lifecycle; it never changes a public site directly."""
from datetime import datetime, timezone
import hashlib, json, secrets
from typing import Any
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from core.tenant_context import TenantContext
from models.factory_contract import FactoryCoreEventContract, FactoryCoreObjectContract
from models.factory_technical_seo import FactoryTechnicalSeoAudit, FactoryTechnicalSeoEvidence, FactoryTechnicalSeoRelease, FactoryTechnicalSeoSnapshot

APPLICATION_ID = "trust.technical-seo"
FORBIDDEN = {"password", "secret", "token", "api_key", "credential", "cookie", "authorization", "customer_email", "customer_phone"}
AUDIT_FIELDS = ("id", "audit_number", "site_reference", "audit_reference", "public_scope", "status", "revision")
SNAPSHOT_FIELDS = ("id", "snapshot_number", "audit_id", "audit_number", "manifest_hash", "status", "captured_by", "verified_by", "revision")
RELEASE_FIELDS = ("id", "release_number", "audit_id", "snapshot_id", "snapshot_number", "target", "status", "available", "consumer_receipt_reference", "revision")


def _id(prefix: str) -> str: return f"{prefix}-{secrets.token_urlsafe(18)}"
def _number(prefix: str, project_id: int) -> str: return f"{prefix}-{project_id}-{datetime.now(timezone.utc):%Y%m%d%H%M%S%f}-{secrets.token_hex(3).upper()}"
def _hash(value: object) -> str: return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str).encode()).hexdigest()
def _context(context: TenantContext, project_id: int) -> dict[str, object]: return {"project_id": project_id, "agent_path": context.agent_path, "tenant_id": context.tenant_id, "client_id": context.client_id, "plan_id": context.plan_id or f"plan-{project_id}"}
def _same(record: object) -> dict[str, object]: return {key: getattr(record, key) for key in ("project_id", "agent_path", "tenant_id", "client_id", "plan_id")}
def _pick(record: object, fields: tuple[str, ...]) -> dict[str, object]: return {field: getattr(record, field) for field in fields}


def _unsafe(value: object) -> bool:
    if isinstance(value, dict): return any(str(key).casefold() in FORBIDDEN or _unsafe(item) for key, item in value.items())
    if isinstance(value, list): return any(_unsafe(item) for item in value)
    return isinstance(value, str) and ("<script" in value.casefold() or "javascript:" in value.casefold())


class FactoryTechnicalSeoService:
    def __init__(self, db: AsyncSession): self.db = db

    async def workspace(self, *, project_id: int) -> dict[str, object]:
        async def rows(model: object, column: object) -> list[object]:
            return list((await self.db.execute(select(model).where(model.project_id == project_id).order_by(column.desc()).limit(500))).scalars().all())
        audits = await rows(FactoryTechnicalSeoAudit, FactoryTechnicalSeoAudit.created_at)
        snapshots = await rows(FactoryTechnicalSeoSnapshot, FactoryTechnicalSeoSnapshot.captured_at)
        releases = await rows(FactoryTechnicalSeoRelease, FactoryTechnicalSeoRelease.prepared_at)
        evidence = await rows(FactoryTechnicalSeoEvidence, FactoryTechnicalSeoEvidence.recorded_at)
        ready = [item for item in releases if item.status == "available" and item.available]
        return {"audits": [_pick(item, AUDIT_FIELDS) for item in audits], "snapshots": [_pick(item, SNAPSHOT_FIELDS) for item in snapshots], "releases": [_pick(item, RELEASE_FIELDS) for item in releases], "evidence": [{"id": item.id, "evidence_type": item.evidence_type, "evidence_reference": item.evidence_reference} for item in evidence], "metrics": {"registered_audits": len(audits), "verified_snapshots": sum(item.status == "verified" for item in snapshots), "acknowledged_remediations": len(ready), "evidence_records": len(evidence)}, "availability": {"application_id": APPLICATION_ID, "status": "available" if ready else "pilot", "release_version": ready[0].snapshot_number if ready else None}, "contract": {"public_site_mutated_directly": False, "search_console_credential_stored": False, "search_ranking_guaranteed": False, "snapshot_self_verification": False, "release_self_approval": False, "consumer_handoff_required": True}}

    async def create_audit(self, *, project_id: int, context: TenantContext, actor: object, site_reference: str, audit_reference: str, public_scope: str) -> dict[str, object]:
        if not all(str(value).strip() for value in (site_reference, audit_reference, public_scope)): raise ValueError("Technical SEO audit requires site, evidence source and public scope references")
        now = datetime.now(timezone.utc)
        audit = FactoryTechnicalSeoAudit(id=_id("seo-audit"), **_context(context, project_id), audit_number=_number("TSA", project_id), site_reference=site_reference.strip()[:255], audit_reference=audit_reference.strip()[:255], public_scope=public_scope.strip()[:255], status="active", created_by=str(actor), created_at=now, revision=1)
        self.db.add(audit); await self._event(audit, "audit", "technical-seo-audit-registered", audit.audit_reference, "Audit records references only; public site and crawler credentials remain outside this application", actor); await self.db.flush(); return _pick(audit, AUDIT_FIELDS)

    async def capture_snapshot(self, audit_id: str, *, project_id: int, context: TenantContext, actor: object, evidence_manifest: dict[str, Any]) -> dict[str, object]:
        audit = await self._get(FactoryTechnicalSeoAudit, audit_id, project_id, "Technical SEO audit")
        if audit.status != "active" or not evidence_manifest or _unsafe(evidence_manifest): raise ValueError("Snapshot requires active audit and safe crawl or site-health evidence manifest")
        payload = {"audit_number": audit.audit_number, "site_reference": audit.site_reference, "audit_reference": audit.audit_reference, "public_scope": audit.public_scope, "evidence_manifest": evidence_manifest}
        snapshot = FactoryTechnicalSeoSnapshot(id=_id("seo-snapshot"), **_same(audit), snapshot_number=_number("TSS", project_id), audit_id=audit.id, audit_number=audit.audit_number, evidence_manifest_json=evidence_manifest, manifest_hash=_hash(payload), status="draft", captured_by=str(actor), captured_at=datetime.now(timezone.utc), revision=1)
        self.db.add(snapshot); await self._event(snapshot, "snapshot", "technical-seo-snapshot-captured", snapshot.manifest_hash, "Immutable SEO evidence snapshot does not crawl, alter or publish the site", actor); await self.db.flush(); return _pick(snapshot, SNAPSHOT_FIELDS)

    async def verify_snapshot(self, snapshot_id: str, *, project_id: int, actor: object, expected_revision: int, verification_reference: str) -> dict[str, object]:
        snapshot = await self._get(FactoryTechnicalSeoSnapshot, snapshot_id, project_id, "Technical SEO snapshot"); self._revision(snapshot, expected_revision); audit = await self._get(FactoryTechnicalSeoAudit, snapshot.audit_id, project_id, "Technical SEO audit")
        expected = _hash({"audit_number": audit.audit_number, "site_reference": audit.site_reference, "audit_reference": audit.audit_reference, "public_scope": audit.public_scope, "evidence_manifest": snapshot.evidence_manifest_json})
        if snapshot.status != "draft" or snapshot.captured_by == str(actor) or not verification_reference.strip() or snapshot.manifest_hash != expected: raise ValueError("Snapshot requires independent verification of unchanged SEO evidence")
        snapshot.status = "verified"; snapshot.verified_by = str(actor); snapshot.verified_at = datetime.now(timezone.utc); snapshot.verification_reference = verification_reference.strip()[:255]; snapshot.revision += 1
        await self._event(snapshot, "snapshot", "technical-seo-snapshot-verified", snapshot.verification_reference, "Independent verifier accepted source, scope and evidence hash", actor); await self.db.flush(); return _pick(snapshot, SNAPSHOT_FIELDS)

    async def prepare_release(self, snapshot_id: str, *, project_id: int, context: TenantContext, actor: object, target: str, remediation_manifest: dict[str, Any], rollback_reference: str) -> dict[str, object]:
        snapshot = await self._get(FactoryTechnicalSeoSnapshot, snapshot_id, project_id, "Technical SEO snapshot"); audit = await self._get(FactoryTechnicalSeoAudit, snapshot.audit_id, project_id, "Technical SEO audit")
        if snapshot.status != "verified" or target not in {"site-owner", "web-team", "seo-operations"} or not remediation_manifest or _unsafe(remediation_manifest) or not rollback_reference.strip(): raise ValueError("Remediation handoff requires verified audit, safe plan, allowed target and rollback reference")
        manifest = {"application_id": APPLICATION_ID, "audit_number": audit.audit_number, "snapshot_number": snapshot.snapshot_number, "source_manifest_hash": snapshot.manifest_hash, "site_reference": audit.site_reference, "audit_reference": audit.audit_reference, "public_scope": audit.public_scope, "target": target, "remediation_manifest": remediation_manifest, "public_site_mutated_directly": False, "consumer_receipt_required": True, "rollback_reference": rollback_reference.strip()}
        release = FactoryTechnicalSeoRelease(id=_id("seo-release"), **_context(context, project_id), release_number=_number("TSR", project_id), audit_id=audit.id, snapshot_id=snapshot.id, snapshot_number=snapshot.snapshot_number, target=target, remediation_manifest_json=manifest, manifest_hash=_hash(manifest), rollback_reference=rollback_reference.strip()[:255], status="pending-approval", prepared_by=str(actor), available=False, prepared_at=datetime.now(timezone.utc), revision=1)
        self.db.add(release); await self._event(release, "release", "technical-seo-remediation-prepared", release.manifest_hash, "Controlled handoff does not automatically alter robots, sitemap, pages or search-engine settings", actor); await self.db.flush(); return _pick(release, RELEASE_FIELDS)

    async def approve_release(self, release_id: str, *, project_id: int, actor: object, expected_revision: int, approval_reference: str) -> dict[str, object]:
        release = await self._get(FactoryTechnicalSeoRelease, release_id, project_id, "Technical SEO remediation"); self._revision(release, expected_revision); snapshot = await self._get(FactoryTechnicalSeoSnapshot, release.snapshot_id, project_id, "Technical SEO snapshot")
        object_contract = await self.db.scalar(select(FactoryCoreObjectContract).where(FactoryCoreObjectContract.id == "technical-seo-evidence-snapshot", FactoryCoreObjectContract.lifecycle_status == "frozen")); event_contract = await self.db.scalar(select(FactoryCoreEventContract).where(FactoryCoreEventContract.id == "technical-seo-remediation-released", FactoryCoreEventContract.lifecycle_status == "frozen"))
        if release.status != "pending-approval" or release.prepared_by == str(actor) or not approval_reference.strip() or release.manifest_hash != _hash(release.remediation_manifest_json) or snapshot.status != "verified" or not object_contract or not event_contract: raise ValueError("Remediation requires independent approval, frozen contracts and unchanged verified SEO evidence")
        release.status = "approved"; release.approved_by = str(actor); release.approval_reference = approval_reference.strip()[:255]; release.revision += 1
        await self._event(release, "release", "technical-seo-remediation-approved", release.approval_reference, "Awaiting authorized consumer acknowledgement; no web change has been applied", actor); await self.db.flush(); return _pick(release, RELEASE_FIELDS)

    async def acknowledge_release(self, release_id: str, *, project_id: int, actor: object, expected_revision: int, consumer_receipt_reference: str) -> dict[str, object]:
        release = await self._get(FactoryTechnicalSeoRelease, release_id, project_id, "Technical SEO remediation"); self._revision(release, expected_revision)
        if release.status != "approved" or release.approved_by == str(actor) or not consumer_receipt_reference.strip(): raise ValueError("Consumer acknowledgement requires independently approved remediation handoff")
        release.status = "available"; release.available = True; release.consumer_receipt_reference = consumer_receipt_reference.strip()[:255]; release.acknowledged_at = datetime.now(timezone.utc); release.revision += 1
        await self._event(release, "release", "technical-seo-remediation-released", release.consumer_receipt_reference, "Website owner or operations consumer acknowledged a bounded remediation handoff", actor); await self.db.flush(); return _pick(release, RELEASE_FIELDS)

    async def _get(self, model: object, item_id: str, project_id: int, label: str) -> object:
        record = await self.db.scalar(select(model).where(model.id == item_id, model.project_id == project_id))
        if not record: raise KeyError(f"{label} not found in this tenant plan")
        return record

    @staticmethod
    def _revision(record: object, expected: int) -> None:
        if int(getattr(record, "revision")) != int(expected): raise ValueError("Revision conflict")

    async def _event(self, record: object, subject_type: str, evidence_type: str, reference: str, note: str, actor: object) -> None:
        number = next((getattr(record, key, None) for key in ("audit_number", "snapshot_number", "release_number") if getattr(record, key, None)), str(record.id))
        self.db.add(FactoryTechnicalSeoEvidence(id=_id("seo-evidence"), **_same(record), evidence_number=_number("TSE", record.project_id), subject_type=subject_type, subject_id=record.id, subject_number=number, evidence_type=evidence_type, evidence_reference=str(reference)[:255], note=note, recorded_by=str(actor), recorded_at=datetime.now(timezone.utc)))
