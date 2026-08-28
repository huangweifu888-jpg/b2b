"""Controlled multi-site content workflow with independent release acknowledgement."""
from datetime import datetime, timezone
import hashlib, json, secrets

from core.tenant_context import TenantContext
from models.factory_contract import FactoryCoreEventContract, FactoryCoreObjectContract
from models.factory_site_management import FactorySiteContentVersion, FactorySiteManagementEvidence, FactorySitePublication, FactorySiteSpace, FactoryWebsiteBuildGate, FactoryWebsiteBuildProgram
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

APPLICATION_ID = "content.cms"

def _id(prefix: str) -> str: return f"{prefix}-{secrets.token_urlsafe(18)}"
def _number(prefix: str, project_id: int) -> str: return f"{prefix}-{project_id}-{datetime.now(timezone.utc):%Y%m%d%H%M%S%f}-{secrets.token_hex(3).upper()}"
def _hash(value: object) -> str: return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str).encode()).hexdigest()
def _context(context: TenantContext, project_id: int) -> dict[str, object]: return {"project_id": project_id, "agent_path": context.agent_path, "tenant_id": context.tenant_id, "client_id": context.client_id, "plan_id": context.plan_id or f"plan-{project_id}"}
def _same(row: object) -> dict[str, object]: return {name: getattr(row, name) for name in ("project_id", "agent_path", "tenant_id", "client_id", "plan_id")}
def _pick(row: object, names: tuple[str, ...]) -> dict[str, object]: return {name: getattr(row, name) for name in names}

SITE = ("id", "site_number", "site_code", "site_name", "channel", "default_locale", "domain_reference", "status", "revision")
VERSION = ("id", "version_number", "site_id", "site_number", "locale", "manifest_hash", "source_reference", "status", "authored_by", "reviewed_by", "revision")
PUBLICATION = ("id", "publication_number", "site_id", "site_version_id", "version_number", "target_environment", "manifest_hash", "rollback_reference", "status", "available", "prepared_by", "approved_by", "consumer_receipt_reference", "revision")
PROGRAM = ("id", "program_number", "program_key", "program_name", "site_id", "site_mode", "market_scope", "locales_json", "route_strategy", "brief_json", "status", "current_phase", "created_by", "activated_by", "activation_reference", "revision")
GATE = ("id", "program_id", "gate_key", "gate_label", "status", "evidence_reference", "passed_by", "revision")
WEBSITE_BUILD_GATES = (
    ("brief", "站点策略"), ("content", "内容与素材"), ("visual", "可视化与响应式"),
    ("localization", "多语言与路由"), ("conversion", "转化与数据"),
    ("release", "发布与恢复"), ("operations", "7/30/90 天运营"),
)

class FactorySiteManagementService:
    def __init__(self, db: AsyncSession): self.db = db

    async def workspace(self, *, project_id: int) -> dict[str, object]:
        async def rows(model: object, order: object):
            result = await self.db.execute(select(model).where(model.project_id == project_id).order_by(order.desc()).limit(500)); return list(result.scalars().all())
        sites = await rows(FactorySiteSpace, FactorySiteSpace.created_at); versions = await rows(FactorySiteContentVersion, FactorySiteContentVersion.created_at); releases = await rows(FactorySitePublication, FactorySitePublication.prepared_at); evidence = await rows(FactorySiteManagementEvidence, FactorySiteManagementEvidence.recorded_at); programs = await rows(FactoryWebsiteBuildProgram, FactoryWebsiteBuildProgram.created_at); gates = await rows(FactoryWebsiteBuildGate, FactoryWebsiteBuildGate.passed_at)
        ready = [item for item in releases if item.status == "available" and item.available]
        build_ready = [item for item in programs if item.status == "available"]
        return {"sites": [_pick(x, SITE) for x in sites], "versions": [_pick(x, VERSION) for x in versions], "publications": [_pick(x, PUBLICATION) for x in releases], "website_build_programs": [_pick(x, PROGRAM) for x in programs], "website_build_gates": [_pick(x, GATE) for x in gates], "evidence": [{"id": x.id, "evidence_type": x.evidence_type, "evidence_reference": x.evidence_reference} for x in evidence], "metrics": {"sites": len(sites), "reviewed_versions": len([x for x in versions if x.status == "reviewed"]), "acknowledged_releases": len(ready), "website_build_programs": len(programs), "website_build_ready": len(build_ready), "evidence_records": len(evidence)}, "availability": {"application_id": APPLICATION_ID, "status": "available" if ready else "pilot", "release_version": ready[0].version_number if ready else None}, "contract": {"public_site_mutated_directly": False, "registrar_secret_stored": False, "version_self_review": False, "publication_self_approval": False, "consumer_handoff_required": True, "website_build_requires_site_receipt": True, "website_build_requires_all_configured_locales": True, "website_build_requires_independent_gate_verification": True}}

    async def create_website_build_program(self, *, project_id: int, context: TenantContext, actor: str, program_key: str, program_name: str, site_mode: str, market_scope: str, locales: list[str], route_strategy: str, brief: dict[str, object]):
        key = program_key.strip().lower(); name = program_name.strip(); cleaned_locales = list(dict.fromkeys(str(item).strip() for item in locales if str(item).strip()))
        required = ("audience", "value_proposition", "conversion_goal", "navigation_template")
        if not key or not name or site_mode not in {"b2b", "b2c", "hybrid"} or market_scope not in {"china", "overseas", "dual"} or route_strategy not in {"subdomain", "path", "single"} or not cleaned_locales or any(not str(brief.get(field, "")).strip() for field in required):
            raise ValueError("Website build program requires key, name, valid market and route strategy, locales, and a complete business brief")
        if await self.db.scalar(select(FactoryWebsiteBuildProgram.id).where(FactoryWebsiteBuildProgram.project_id == project_id, FactoryWebsiteBuildProgram.program_key == key)):
            raise ValueError("Website build program key already exists in this tenant plan")
        now = datetime.now(timezone.utc); program = FactoryWebsiteBuildProgram(id=_id("website-build"), **_context(context, project_id), program_number=_number("WBP", project_id), program_key=key[:100], program_name=name[:200], site_id=None, site_mode=site_mode, market_scope=market_scope, locales_json=cleaned_locales, route_strategy=route_strategy, brief_json={field: str(brief[field]).strip() for field in required}, status="draft", current_phase="brief", created_by=str(actor), created_at=now, updated_at=now, revision=1); self.db.add(program)
        for gate_key, gate_label in WEBSITE_BUILD_GATES:
            self.db.add(FactoryWebsiteBuildGate(id=_id("website-gate"), **_context(context, project_id), program_id=program.id, gate_key=gate_key, gate_label=gate_label, status="pending", revision=1))
        await self._event(program, "website-build-program", "website-build-program-created", program.program_number, "Program is a governed website delivery plan; it does not create or mutate a public site", actor); await self.db.flush(); return _pick(program, PROGRAM)

    async def bind_website_build_site(self, program_id: str, *, project_id: int, actor: str, expected_revision: int, site_id: str, reference: str):
        program = await self._get(FactoryWebsiteBuildProgram, program_id, project_id, "Website build program"); self._revision(program, expected_revision); site = await self._get(FactorySiteSpace, site_id, project_id, "Site")
        if program.status not in {"draft", "in-progress"} or site.status != "active" or not reference.strip(): raise ValueError("Website build program requires an active site and a non-empty binding reference")
        program.site_id = site.id; program.status = "in-progress"; program.updated_at = datetime.now(timezone.utc); program.revision += 1; await self._event(program, "website-build-program", "website-build-site-bound", reference.strip(), "The build program is bound to a tenant-scoped site space", actor); await self.db.flush(); return _pick(program, PROGRAM)

    async def verify_website_build_gate(self, program_id: str, gate_key: str, *, project_id: int, actor: str, expected_revision: int, evidence_reference: str):
        program = await self._get(FactoryWebsiteBuildProgram, program_id, project_id, "Website build program"); gate = await self._gate(program.id, gate_key, project_id); self._revision(gate, expected_revision)
        if program.status not in {"draft", "in-progress"} or str(actor) == program.created_by or gate.status != "pending" or not evidence_reference.strip(): raise ValueError("Website build gate requires an independent verifier, pending gate and evidence reference")
        gate.status = "passed"; gate.evidence_reference = evidence_reference.strip()[:255]; gate.passed_by = str(actor); gate.passed_at = datetime.now(timezone.utc); gate.revision += 1
        gates = (await self.db.execute(select(FactoryWebsiteBuildGate).where(FactoryWebsiteBuildGate.program_id == program.id).order_by(FactoryWebsiteBuildGate.gate_key))).scalars().all(); pending = next((item.gate_key for item in gates if item.id != gate.id and item.status != "passed"), None)
        program.current_phase = pending or "release"; program.status = "verified" if pending is None else "in-progress"; program.updated_at = datetime.now(timezone.utc); program.revision += 1
        await self._event(gate, "website-build-gate", "website-build-gate-passed", gate.evidence_reference, f"Independent verification passed {gate.gate_key}", actor); await self.db.flush(); return {**_pick(program, PROGRAM), "gate": _pick(gate, GATE)}

    async def activate_website_build_program(self, program_id: str, *, project_id: int, actor: str, expected_revision: int, site_publication_id: str, activation_reference: str):
        program = await self._get(FactoryWebsiteBuildProgram, program_id, project_id, "Website build program"); self._revision(program, expected_revision); publication = await self._get(FactorySitePublication, site_publication_id, project_id, "Site publication")
        gates = (await self.db.execute(select(FactoryWebsiteBuildGate).where(FactoryWebsiteBuildGate.program_id == program.id))).scalars().all()
        if program.status != "verified" or not program.site_id or publication.site_id != program.site_id or publication.status != "available" or not publication.available or str(actor) == program.created_by or len(gates) != len(WEBSITE_BUILD_GATES) or any(gate.status != "passed" for gate in gates) or not activation_reference.strip():
            raise ValueError("Website build activation requires all independent gates, an available matching site release, and a separate activation actor")
        available_locales = await self._available_release_locales(project_id=project_id, site_id=program.site_id)
        missing_locales = [locale for locale in program.locales_json if locale not in available_locales]
        if missing_locales:
            raise ValueError(f"Website build activation requires an acknowledged release for every configured locale; missing: {', '.join(missing_locales)}")
        program.status = "available"; program.current_phase = "operations"; program.activated_by = str(actor); program.activation_reference = activation_reference.strip()[:255]; program.activated_at = datetime.now(timezone.utc); program.updated_at = program.activated_at; program.revision += 1
        await self._event(program, "website-build-program", "website-build-activated", program.activation_reference, "Program is operational with a separately acknowledged site release; no direct deployment occurred", actor); await self.db.flush(); return _pick(program, PROGRAM)

    async def _available_release_locales(self, *, project_id: int, site_id: str) -> set[str]:
        releases = (await self.db.execute(select(FactorySitePublication).where(FactorySitePublication.project_id == project_id, FactorySitePublication.site_id == site_id, FactorySitePublication.status == "available", FactorySitePublication.available.is_(True)))).scalars().all()
        version_ids = [item.site_version_id for item in releases]
        if not version_ids:
            return set()
        versions = (await self.db.execute(select(FactorySiteContentVersion).where(FactorySiteContentVersion.project_id == project_id, FactorySiteContentVersion.id.in_(version_ids)))).scalars().all()
        return {item.locale for item in versions}

    async def create_site(self, *, project_id: int, context: TenantContext, actor: str, site_code: str, site_name: str, channel: str, default_locale: str, domain_reference: str):
        if not all(x.strip() for x in (site_code, site_name, default_locale, domain_reference)) or channel not in {"official", "brand", "campaign"}: raise ValueError("Site requires code, name, supported channel, locale and domain reference")
        now = datetime.now(timezone.utc); site = FactorySiteSpace(id=_id("site"), **_context(context, project_id), site_number=_number("SITE", project_id), site_code=site_code.strip().lower(), site_name=site_name.strip(), channel=channel, default_locale=default_locale.strip(), domain_reference=domain_reference.strip()[:255], status="active", created_by=str(actor), created_at=now, revision=1); self.db.add(site); await self._event(site, "site", "site-space-created", site.domain_reference, "Domain is reference-only; no registrar credential or action is stored", actor); await self.db.flush(); return _pick(site, SITE)

    async def draft_version(self, site_id: str, *, project_id: int, context: TenantContext, actor: str, locale: str, page_manifest: dict[str, object], source_reference: str):
        site = await self._get(FactorySiteSpace, site_id, project_id, "Site"); manifest = {"site_number": site.site_number, "locale": locale.strip(), "page_manifest": page_manifest, "source_reference": source_reference.strip()}
        if site.status != "active" or not locale.strip() or not page_manifest or not source_reference.strip(): raise ValueError("Version requires active site, locale, page manifest and source reference")
        version = FactorySiteContentVersion(id=_id("site-version"), **_same(site), version_number=_number("SCV", project_id), site_id=site.id, site_number=site.site_number, locale=locale.strip(), page_manifest_json=page_manifest, manifest_hash=_hash(manifest), source_reference=source_reference.strip()[:255], status="draft", authored_by=str(actor), created_at=datetime.now(timezone.utc), revision=1); self.db.add(version); await self._event(version, "version", "site-version-drafted", version.manifest_hash, "Draft is tenant-scoped content only and not a public deployment", actor); await self.db.flush(); return _pick(version, VERSION)

    async def review_version(self, version_id: str, *, project_id: int, actor: str, expected_revision: int, review_reference: str):
        version = await self._get(FactorySiteContentVersion, version_id, project_id, "Site version"); self._revision(version, expected_revision); expected = _hash({"site_number": version.site_number, "locale": version.locale, "page_manifest": version.page_manifest_json, "source_reference": version.source_reference})
        if version.status != "draft" or version.authored_by == str(actor) or not review_reference.strip() or version.manifest_hash != expected: raise ValueError("Version requires independent review of an unchanged manifest")
        version.status="reviewed"; version.reviewed_by=str(actor); version.reviewed_at=datetime.now(timezone.utc); version.review_reference=review_reference.strip()[:255]; version.revision+=1; await self._event(version, "version", "site-version-reviewed", version.review_reference, "Independent reviewer accepted pinned content manifest", actor); await self.db.flush(); return _pick(version, VERSION)

    async def prepare_publication(self, version_id: str, *, project_id: int, context: TenantContext, actor: str, target_environment: str, rollback_reference: str):
        version=await self._get(FactorySiteContentVersion, version_id, project_id, "Site version"); site=await self._get(FactorySiteSpace, version.site_id, project_id, "Site")
        if version.status != "reviewed" or target_environment not in {"staging", "production"} or not rollback_reference.strip(): raise ValueError("Release requires reviewed content, supported target and rollback reference")
        manifest={"application_id": APPLICATION_ID,"site_number":site.site_number,"version_number":version.version_number,"source_manifest_hash":version.manifest_hash,"target_environment":target_environment,"direct_public_site_mutation":False,"consumer_receipt_required":True,"rollback_reference":rollback_reference.strip()}
        release=FactorySitePublication(id=_id("site-release"), **_context(context, project_id), publication_number=_number("SPR", project_id), site_id=site.id, site_version_id=version.id, version_number=version.version_number, target_environment=target_environment, release_manifest_json=manifest, manifest_hash=_hash(manifest), rollback_reference=rollback_reference.strip()[:255], status="pending-approval", prepared_by=str(actor), available=False, prepared_at=datetime.now(timezone.utc), revision=1); self.db.add(release); await self._event(release,"publication","site-release-prepared",release.manifest_hash,"Release is a controlled consumer handoff and does not deploy a public site",actor); await self.db.flush(); return _pick(release, PUBLICATION)

    async def approve_publication(self, publication_id: str, *, project_id: int, actor: str, expected_revision: int, approval_reference: str):
        release=await self._get(FactorySitePublication, publication_id, project_id, "Site publication"); self._revision(release, expected_revision); version=await self._get(FactorySiteContentVersion, release.site_version_id, project_id, "Site version"); obj=await self.db.scalar(select(FactoryCoreObjectContract).where(FactoryCoreObjectContract.id=="site-content-version",FactoryCoreObjectContract.lifecycle_status=="frozen")); event=await self.db.scalar(select(FactoryCoreEventContract).where(FactoryCoreEventContract.id=="site-version-released",FactoryCoreEventContract.lifecycle_status=="frozen"))
        if release.status!="pending-approval" or release.prepared_by==str(actor) or not approval_reference.strip() or release.manifest_hash!=_hash(release.release_manifest_json) or version.status!="reviewed" or not obj or not event: raise ValueError("Release requires independent approval, frozen contracts and unchanged reviewed manifest")
        release.status="approved"; release.approved_by=str(actor); release.approval_reference=approval_reference.strip()[:255]; release.revision+=1; await self._event(release,"publication","site-release-approved",release.approval_reference,"Awaiting downstream consumer acknowledgement; no public deployment was performed",actor); await self.db.flush(); return _pick(release, PUBLICATION)

    async def acknowledge_publication(self, publication_id: str, *, project_id: int, actor: str, expected_revision: int, consumer_receipt_reference: str):
        release=await self._get(FactorySitePublication, publication_id, project_id, "Site publication"); self._revision(release, expected_revision)
        if release.status!="approved" or release.approved_by==str(actor) or not consumer_receipt_reference.strip(): raise ValueError("Consumer acknowledgement requires an approved release and a separate handoff actor")
        release.status="available"; release.available=True; release.consumer_receipt_reference=consumer_receipt_reference.strip()[:255]; release.acknowledged_at=datetime.now(timezone.utc); release.revision+=1; await self._event(release,"publication","site-version-released",release.consumer_receipt_reference,"Consumer receipt acknowledged the governed handoff; system did not mutate consumer site",actor); await self.db.flush(); return _pick(release, PUBLICATION)

    async def _get(self, model: object, item_id: str, project_id: int, label: str):
        item=await self.db.scalar(select(model).where(model.id==item_id,model.project_id==project_id))
        if not item: raise KeyError(f"{label} not found in this tenant plan")
        return item
    async def _gate(self, program_id: str, gate_key: str, project_id: int):
        gate = await self.db.scalar(select(FactoryWebsiteBuildGate).where(FactoryWebsiteBuildGate.project_id == project_id, FactoryWebsiteBuildGate.program_id == program_id, FactoryWebsiteBuildGate.gate_key == gate_key.strip().lower()))
        if not gate: raise KeyError("Website build gate not found in this tenant plan")
        return gate
    @staticmethod
    def _revision(item: object, expected: int):
        if int(getattr(item,"revision"))!=int(expected): raise ValueError("Revision conflict")
    async def _event(self,item: object,subject_type: str,evidence_type: str,reference: str,note: str,actor: str):
        number=next((getattr(item,name,None) for name in ("site_number","version_number","publication_number","program_number") if getattr(item,name,None)),str(getattr(item,"id")))
        self.db.add(FactorySiteManagementEvidence(id=_id("site-evidence"),**_same(item),evidence_number=_number("SME",getattr(item,"project_id")),subject_type=subject_type,subject_id=getattr(item,"id"),subject_number=number,evidence_type=evidence_type,evidence_reference=str(reference)[:255],note=note,recorded_by=str(actor),recorded_at=datetime.now(timezone.utc)))
