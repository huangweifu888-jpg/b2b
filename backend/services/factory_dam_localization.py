"""Governed DAM rights, terminology, localization review and country-pack handoffs."""

from __future__ import annotations

from datetime import date, datetime, timezone
import hashlib
import json
import secrets

from core.tenant_context import TenantContext
from models.factory_dam_localization import (
    FactoryCountryContentPack, FactoryDamAsset, FactoryDamEvidence, FactoryDamRightsGrant,
    FactoryLocalizationGlossary, FactoryLocalizationGlossaryVersion, FactoryLocalizationHandoff,
    FactoryLocalizationJob, FactoryLocalizationReview, FactoryLocalizedRendition,
)
from models.platform import ContentDownloadAsset
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


ASSET_TYPES = {"image", "video", "document", "audio", "copy-source", "archive"}
CHANNELS = {"cms", "social", "commerce", "geo", "sales-enablement"}
LICENSE_TYPES = {"owned", "exclusive", "licensed", "customer-consent", "public-domain"}
CONSUMERS = {"cms", "social", "commerce", "geo"}


def _id(kind: str) -> str: return f"{kind}-{secrets.token_urlsafe(18)}"


def _number(prefix: str, project_id: int) -> str:
    now = datetime.now(timezone.utc)
    return f"{prefix}-{project_id}-{now.strftime('%Y%m%d%H%M%S%f')}-{secrets.token_hex(3).upper()}"


def _context(context: TenantContext, project_id: int) -> dict[str, object]:
    return {"project_id": project_id, "agent_path": context.agent_path, "tenant_id": context.tenant_id,
            "client_id": context.client_id, "plan_id": context.plan_id or f"plan-{project_id}"}


def _same(item) -> dict[str, object]:
    return {key: getattr(item, key) for key in ("project_id", "agent_path", "tenant_id", "client_id", "plan_id")}


def _hash(payload) -> str:
    text = payload if isinstance(payload, str) else json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(text.encode()).hexdigest()


def _serialize(item, fields): return {field: getattr(item, field) for field in fields}


ASSET=("id","asset_number","asset_name","asset_type","source_asset_id","source_display_name","source_media_type","source_sha256","source_size_bytes","source_language","product_references_json","brand_reference","rights_owner_reference","status","authored_by","activated_by","revision")
RIGHTS=("id","grant_number","grant_code","asset_id","asset_number","territories_json","languages_json","channels_json","valid_from","valid_until","license_type","rights_evidence_reference","restrictions","status","requested_by","approved_by","revision")
GLOSSARY=("id","glossary_number","glossary_code","glossary_name","source_locale","target_locale","current_version","status","authored_by","approved_by","revision")
GLOSSARY_VERSION=("id","version_reference","glossary_id","glossary_number","version_number","terms_json","content_hash","status","created_by","activated_by")
JOB=("id","job_number","asset_id","asset_number","source_sha256","rights_grant_id","rights_grant_number","glossary_id","glossary_number","glossary_version","glossary_hash","target_market","target_locale","channel","brief","status","created_by","revision")
RENDITION=("id","rendition_number","job_id","job_number","localized_storage_reference","localized_sha256","translator_reference","ai_assisted","machine_translation_provider_reference","status","submitted_by","approved_by","revision")
REVIEW=("id","review_number","rendition_id","rendition_number","linguistic_score","terminology_score","brand_score","cultural_score","findings_json","recommendation","compliance_assessment_reference","reviewed_by")
PACK=("id","pack_number","pack_code","pack_name","version_number","target_market","target_locale","rendition_ids_json","manifest_hash","compliance_assessment_reference","tax_reviewed","privacy_reviewed","market_access_reviewed","status","created_by","published_by","revision")
HANDOFF=("id","handoff_number","pack_id","pack_number","pack_version","manifest_hash","consumer","delivery_reference","status","created_by","acknowledged_by","revision")


class FactoryDamLocalizationService:
    def __init__(self, db: AsyncSession): self.db=db

    async def list_workspace(self, *, project_id:int):
        async def rows(model, order): return (await self.db.execute(select(model).where(model.project_id==project_id).order_by(order.desc()).limit(500))).scalars().all()
        assets=await rows(FactoryDamAsset,FactoryDamAsset.created_at);rights=await rows(FactoryDamRightsGrant,FactoryDamRightsGrant.created_at)
        glossaries=await rows(FactoryLocalizationGlossary,FactoryLocalizationGlossary.created_at);versions=await rows(FactoryLocalizationGlossaryVersion,FactoryLocalizationGlossaryVersion.created_at)
        jobs=await rows(FactoryLocalizationJob,FactoryLocalizationJob.created_at);renditions=await rows(FactoryLocalizedRendition,FactoryLocalizedRendition.submitted_at)
        reviews=await rows(FactoryLocalizationReview,FactoryLocalizationReview.reviewed_at);packs=await rows(FactoryCountryContentPack,FactoryCountryContentPack.created_at)
        handoffs=await rows(FactoryLocalizationHandoff,FactoryLocalizationHandoff.created_at);events=await rows(FactoryDamEvidence,FactoryDamEvidence.recorded_at)
        sources=(await self.db.execute(select(ContentDownloadAsset).where(ContentDownloadAsset.project_id==project_id,ContentDownloadAsset.enabled.is_(True),ContentDownloadAsset.scan_status=="clean").order_by(ContentDownloadAsset.created_at.desc()).limit(200))).scalars().all()
        adopted={x.source_asset_id for x in assets}
        eligible=[{"id":x.id,"display_name":x.display_name,"media_type":x.media_type,"size_bytes":x.size_bytes,"sha256":x.sha256,"scan_status":x.scan_status} for x in sources if x.sha256 and x.id not in adopted]
        approved_r=[x for x in renditions if x.status=="approved"]
        active_rights=[x for x in rights if x.status=="active" and x.valid_until>=date.today()]
        acknowledged=[x for x in handoffs if x.status=="acknowledged"]
        return {"assets":[_serialize(x,ASSET) for x in assets],"rights_grants":[_serialize(x,RIGHTS) for x in rights],"glossaries":[_serialize(x,GLOSSARY) for x in glossaries],
            "glossary_versions":[_serialize(x,GLOSSARY_VERSION) for x in versions],"jobs":[_serialize(x,JOB) for x in jobs],"renditions":[_serialize(x,RENDITION) for x in renditions],
            "reviews":[_serialize(x,REVIEW) for x in reviews],"country_packs":[_serialize(x,PACK) for x in packs],"handoffs":[_serialize(x,HANDOFF) for x in handoffs],
            "evidence":[{"id":x.id,"subject_type":x.subject_type,"subject_id":x.subject_id,"evidence_type":x.evidence_type,"evidence_reference":x.evidence_reference,"recorded_by":x.recorded_by} for x in events],
            "eligible_sources":eligible,"metrics":{"active_assets":sum(x.status=="active" for x in assets),"rights_coverage_percent":round(len(active_rights)*100/max(1,len(assets)),2),
                "approved_renditions":len(approved_r),"localization_approval_percent":round(len(approved_r)*100/max(1,len(renditions)),2),"published_country_packs":sum(x.status=="published" for x in packs),
                "handoff_acknowledgement_percent":round(len(acknowledged)*100/max(1,len(handoffs)),2)},
            "contract":{"original_bytes_stored_in_dam":False,"private_storage_is_authority":True,"source_sha256_pinned":True,"rights_required_before_localization":True,
                "glossary_versions_mutable":False,"machine_translation_direct_publish":False,"translator_self_review":False,"regional_legal_assessment_replaced":False,
                "consumer_system_mutated":False,"handoff_acknowledgement_required":True,"product_master_copied":False}}

    async def adopt_asset(self,*,project_id:int,context:TenantContext,actor:str,source_asset_id:str,asset_name:str,asset_type:str,source_language:str,product_references:list[str],brand_reference:str,rights_owner_reference:str):
        if asset_type not in ASSET_TYPES or any(not str(x).strip() for x in (asset_name,source_language,brand_reference,rights_owner_reference)):raise ValueError("DAM asset identity, language, brand and rights owner are required")
        source=await self._source(source_asset_id,project_id)
        duplicate=await self.db.scalar(select(FactoryDamAsset.id).where(FactoryDamAsset.project_id==project_id,FactoryDamAsset.source_asset_id==source.id))
        if duplicate:raise ValueError("Private source asset is already adopted into this DAM")
        now=datetime.now(timezone.utc);item=FactoryDamAsset(id=_id("dam-asset"),**_context(context,project_id),asset_number=_number("DAMA",project_id),asset_name=asset_name.strip()[:255],asset_type=asset_type,
            source_asset_id=source.id,source_display_name=source.display_name,source_media_type=source.media_type or "application/octet-stream",source_sha256=source.sha256,source_size_bytes=source.size_bytes,
            source_language=source_language.strip()[:16],product_references_json=product_references,brand_reference=brand_reference.strip()[:255],rights_owner_reference=rights_owner_reference.strip()[:255],
            status="draft",authored_by=str(actor),updated_by=str(actor),revision=1,created_at=now,updated_at=now);self.db.add(item)
        await self._event(item,"asset","asset-adopted",f"private-asset:{source.id}@{source.sha256}","Adopted scanned private asset metadata without copying original bytes",actor);await self.db.flush();return _serialize(item,ASSET)

    async def request_rights(self,asset_id:str,*,project_id:int,context:TenantContext,actor:str,grant_code:str,territories:list[str],languages:list[str],channels:list[str],valid_from:date,valid_until:date,license_type:str,rights_evidence_reference:str,restrictions:str|None):
        asset=await self._get(FactoryDamAsset,asset_id,project_id,"DAM asset")
        if asset.status not in {"draft","active"} or license_type not in LICENSE_TYPES or not territories or not languages or not channels or not set(channels)<=CHANNELS or valid_until<=valid_from or valid_until<date.today() or not rights_evidence_reference.strip():raise ValueError("Rights grant requires valid scope, dates, license and evidence")
        await self._validate_source(asset);now=datetime.now(timezone.utc);item=FactoryDamRightsGrant(id=_id("dam-rights"),**_same(asset),grant_number=_number("DAMR",project_id),grant_code=grant_code.strip()[:64],asset_id=asset.id,asset_number=asset.asset_number,
            territories_json=sorted(set(territories)),languages_json=sorted(set(languages)),channels_json=sorted(set(channels)),valid_from=valid_from,valid_until=valid_until,license_type=license_type,
            rights_evidence_reference=rights_evidence_reference.strip()[:255],restrictions=(restrictions or "").strip() or None,status="pending",requested_by=str(actor),revision=1,created_at=now);self.db.add(item)
        await self._event(item,"rights","rights-requested",rights_evidence_reference,"Requested governed territory, language and channel usage rights",actor);await self.db.flush();return _serialize(item,RIGHTS)

    async def approve_rights(self,rights_id:str,*,project_id:int,actor:str,expected_revision:int,approval_reference:str):
        item=await self._get(FactoryDamRightsGrant,rights_id,project_id,"DAM rights grant");self._revision(item,expected_revision)
        if item.status!="pending" or item.requested_by==str(actor) or not approval_reference.strip():raise ValueError("Rights grant requires independent approval evidence")
        asset=await self._get(FactoryDamAsset,item.asset_id,project_id,"DAM asset");await self._validate_source(asset);now=datetime.now(timezone.utc)
        item.status="active";item.approved_by=str(actor);item.approved_at=now;item.approval_reference=approval_reference.strip()[:255];item.revision+=1
        asset.status="active";asset.activated_by=str(actor);asset.activated_at=now;asset.updated_by=str(actor);asset.updated_at=now;asset.revision+=1
        await self._event(item,"rights","rights-approved",approval_reference,"Independently approved bounded rights and activated DAM asset",actor);await self.db.flush();return {"rights":_serialize(item,RIGHTS),"asset":_serialize(asset,ASSET)}

    async def create_glossary(self,*,project_id:int,context:TenantContext,actor:str,glossary_code:str,glossary_name:str,source_locale:str,target_locale:str,terms:list[dict]):
        normalized=[]
        for term in terms:
            source=str(term.get("source","" )).strip();target=str(term.get("target","" )).strip();note=str(term.get("note","" )).strip()
            if not source or not target:raise ValueError("Every glossary term requires source and approved target")
            normalized.append({"source":source[:255],"target":target[:255],"note":note[:1000]})
        if len(normalized)<3 or source_locale==target_locale or any(not str(x).strip() for x in (glossary_code,glossary_name,source_locale,target_locale)):raise ValueError("Glossary requires distinct locales and at least three governed terms")
        now=datetime.now(timezone.utc);item=FactoryLocalizationGlossary(id=_id("localization-glossary"),**_context(context,project_id),glossary_number=_number("DAMG",project_id),glossary_code=glossary_code.strip()[:64],glossary_name=glossary_name.strip()[:180],source_locale=source_locale,target_locale=target_locale,current_version=1,status="draft",authored_by=str(actor),revision=1,created_at=now)
        version=FactoryLocalizationGlossaryVersion(id=_id("glossary-version"),**_context(context,project_id),version_reference=_number("DAMV",project_id),glossary_id=item.id,glossary_number=item.glossary_number,version_number=1,terms_json=normalized,content_hash=_hash(normalized),status="draft",created_by=str(actor),created_at=now)
        self.db.add_all([item,version]);await self._event(item,"glossary","glossary-authored",f"glossary:{version.content_hash}","Created immutable terminology version 1",actor);await self.db.flush();return {"glossary":_serialize(item,GLOSSARY),"version":_serialize(version,GLOSSARY_VERSION)}

    async def approve_glossary(self,glossary_id:str,*,project_id:int,actor:str,expected_revision:int,approval_reference:str):
        item=await self._get(FactoryLocalizationGlossary,glossary_id,project_id,"Localization glossary");self._revision(item,expected_revision)
        if item.status!="draft" or item.authored_by==str(actor) or not approval_reference.strip():raise ValueError("Glossary requires independent approval evidence")
        version=await self._version(item);now=datetime.now(timezone.utc);item.status="active";item.approved_by=str(actor);item.approved_at=now;item.revision+=1;version.status="active";version.activated_by=str(actor);version.activated_at=now
        await self._event(item,"glossary","glossary-approved",approval_reference,"Independently activated immutable terminology version",actor);await self.db.flush();return _serialize(item,GLOSSARY)

    async def create_job(self,*,project_id:int,context:TenantContext,actor:str,asset_id:str,rights_grant_id:str,glossary_id:str,target_market:str,target_locale:str,channel:str,brief:str):
        asset=await self._get(FactoryDamAsset,asset_id,project_id,"DAM asset");rights=await self._get(FactoryDamRightsGrant,rights_grant_id,project_id,"DAM rights grant");glossary=await self._get(FactoryLocalizationGlossary,glossary_id,project_id,"Localization glossary")
        if asset.status!="active" or rights.asset_id!=asset.id or rights.status!="active" or rights.valid_until<date.today() or glossary.status!="active" or channel not in CHANNELS or len(brief.strip())<8:raise ValueError("Localization job requires active asset, rights, glossary, supported channel and brief")
        if target_market not in rights.territories_json and "GLOBAL" not in rights.territories_json:raise ValueError("Rights grant does not cover target market")
        if target_locale not in rights.languages_json or channel not in rights.channels_json or glossary.target_locale!=target_locale or glossary.source_locale!=asset.source_language:raise ValueError("Rights or glossary do not cover the requested locale and channel")
        await self._validate_source(asset);version=await self._version(glossary);now=datetime.now(timezone.utc);item=FactoryLocalizationJob(id=_id("localization-job"),**_context(context,project_id),job_number=_number("DAMJ",project_id),asset_id=asset.id,asset_number=asset.asset_number,source_sha256=asset.source_sha256,
            rights_grant_id=rights.id,rights_grant_number=rights.grant_number,glossary_id=glossary.id,glossary_number=glossary.glossary_number,glossary_version=version.version_number,glossary_hash=version.content_hash,
            target_market=target_market,target_locale=target_locale,channel=channel,brief=brief.strip(),status="draft",created_by=str(actor),revision=1,created_at=now);self.db.add(item)
        await self._event(item,"job","localization-job-created",f"asset:{asset.source_sha256}|glossary:{version.content_hash}","Created localization job with pinned source, rights and terminology",actor);await self.db.flush();return _serialize(item,JOB)

    async def submit_rendition(self,job_id:str,*,project_id:int,context:TenantContext,actor:str,expected_revision:int,localized_storage_reference:str,localized_sha256:str,translator_reference:str,ai_assisted:bool,machine_translation_provider_reference:str|None):
        job=await self._get(FactoryLocalizationJob,job_id,project_id,"Localization job");self._revision(job,expected_revision);await self._validate_job(job)
        if job.status!="draft" or len(localized_sha256)!=64 or any(not str(x).strip() for x in (localized_storage_reference,translator_reference)):raise ValueError("Rendition requires draft job, private storage reference, SHA-256 and translator")
        if ai_assisted and not str(machine_translation_provider_reference or "").strip():raise ValueError("AI-assisted rendition requires provider evidence reference")
        now=datetime.now(timezone.utc);item=FactoryLocalizedRendition(id=_id("localized-rendition"),**_context(context,project_id),rendition_number=_number("DAML",project_id),job_id=job.id,job_number=job.job_number,
            localized_storage_reference=localized_storage_reference.strip()[:500],localized_sha256=localized_sha256.lower(),translator_reference=translator_reference.strip()[:255],ai_assisted=bool(ai_assisted),
            machine_translation_provider_reference=(machine_translation_provider_reference or "").strip() or None,status="review",submitted_by=str(actor),submitted_at=now,revision=1);self.db.add(item);job.status="review";job.revision+=1
        await self._event(item,"rendition","rendition-submitted",localized_storage_reference,"Submitted localized rendition for independent human quality review",actor);await self.db.flush();return _serialize(item,RENDITION)

    async def review_rendition(self,rendition_id:str,*,project_id:int,context:TenantContext,actor:str,expected_revision:int,linguistic_score:int,terminology_score:int,brand_score:int,cultural_score:int,findings:list[dict],recommendation:str,compliance_assessment_reference:str):
        item=await self._get(FactoryLocalizedRendition,rendition_id,project_id,"Localized rendition");self._revision(item,expected_revision);job=await self._get(FactoryLocalizationJob,item.job_id,project_id,"Localization job");await self._validate_job(job)
        scores=[linguistic_score,terminology_score,brand_score,cultural_score]
        if item.status!="review" or item.submitted_by==str(actor) or recommendation not in {"approve","reject"} or any(x<0 or x>100 for x in scores) or not compliance_assessment_reference.strip():raise ValueError("Rendition requires independent scored review and compliance assessment")
        if recommendation=="approve" and min(scores)<80:raise ValueError("Approved localization requires every quality dimension to score at least 80")
        now=datetime.now(timezone.utc);review=FactoryLocalizationReview(id=_id("localization-review"),**_context(context,project_id),review_number=_number("DAMQ",project_id),rendition_id=item.id,rendition_number=item.rendition_number,
            linguistic_score=linguistic_score,terminology_score=terminology_score,brand_score=brand_score,cultural_score=cultural_score,findings_json=findings,recommendation=recommendation,
            compliance_assessment_reference=compliance_assessment_reference.strip()[:255],reviewed_by=str(actor),reviewed_at=now);self.db.add(review)
        item.status="approved" if recommendation=="approve" else "rejected";item.approved_by=str(actor) if recommendation=="approve" else None;item.approved_at=now if recommendation=="approve" else None;item.revision+=1
        job.status=item.status;job.revision+=1;await self._event(item,"rendition",f"rendition-{recommendation}",compliance_assessment_reference,"Independent linguistic, terminology, brand and cultural review completed",actor);await self.db.flush();return {"rendition":_serialize(item,RENDITION),"review":_serialize(review,REVIEW)}

    async def create_pack(self,*,project_id:int,context:TenantContext,actor:str,pack_code:str,pack_name:str,target_market:str,target_locale:str,rendition_ids:list[str],compliance_assessment_reference:str,tax_reviewed:bool,privacy_reviewed:bool,market_access_reviewed:bool):
        if not rendition_ids or len(set(rendition_ids))!=len(rendition_ids) or not all((tax_reviewed,privacy_reviewed,market_access_reviewed)) or any(not str(x).strip() for x in (pack_code,pack_name,target_market,target_locale,compliance_assessment_reference)):raise ValueError("Country pack requires unique approved renditions and completed tax, privacy and market-access reviews")
        renditions=[];manifest=[]
        for rendition_id in rendition_ids:
            rendition=await self._get(FactoryLocalizedRendition,rendition_id,project_id,"Localized rendition");job=await self._get(FactoryLocalizationJob,rendition.job_id,project_id,"Localization job");await self._validate_job(job)
            if rendition.status!="approved" or job.target_market!=target_market or job.target_locale!=target_locale:raise ValueError("Every country-pack rendition must be approved for the same market and locale")
            renditions.append(rendition);manifest.append({"rendition_id":rendition.id,"sha256":rendition.localized_sha256,"job":job.job_number,"source":job.source_sha256,"glossary":job.glossary_hash})
        now=datetime.now(timezone.utc);item=FactoryCountryContentPack(id=_id("country-content-pack"),**_context(context,project_id),pack_number=_number("DAMP",project_id),pack_code=pack_code.strip()[:64],pack_name=pack_name.strip()[:180],version_number=1,target_market=target_market,target_locale=target_locale,
            rendition_ids_json=rendition_ids,manifest_hash=_hash(manifest),compliance_assessment_reference=compliance_assessment_reference.strip()[:255],tax_reviewed=True,privacy_reviewed=True,market_access_reviewed=True,status="draft",created_by=str(actor),revision=1,created_at=now);self.db.add(item)
        await self._event(item,"pack","country-pack-created",compliance_assessment_reference,"Created immutable country content manifest after regional reviews",actor);await self.db.flush();return _serialize(item,PACK)

    async def publish_pack(self,pack_id:str,*,project_id:int,context:TenantContext,actor:str,expected_revision:int,consumer:str,delivery_reference:str):
        item=await self._get(FactoryCountryContentPack,pack_id,project_id,"Country content pack");self._revision(item,expected_revision)
        if item.status!="draft" or item.created_by==str(actor) or consumer not in CONSUMERS or not delivery_reference.strip():raise ValueError("Country pack requires independent publisher, supported consumer and delivery evidence")
        await self._validate_pack(item);now=datetime.now(timezone.utc);item.status="published";item.published_by=str(actor);item.published_at=now;item.revision+=1
        handoff=FactoryLocalizationHandoff(id=_id("localization-handoff"),**_context(context,project_id),handoff_number=_number("DAMH",project_id),pack_id=item.id,pack_number=item.pack_number,pack_version=item.version_number,manifest_hash=item.manifest_hash,
            consumer=consumer,delivery_reference=delivery_reference.strip()[:255],status="pending",created_by=str(actor),created_at=now,revision=1);self.db.add(handoff)
        await self._event(item,"pack","country-pack-published",delivery_reference,"Published immutable pack contract without mutating the consumer",actor);await self._event(handoff,"handoff","handoff-created",delivery_reference,"Created explicit downstream acknowledgement handoff",actor);await self.db.flush();return {"pack":_serialize(item,PACK),"handoff":_serialize(handoff,HANDOFF)}

    async def acknowledge_handoff(self,handoff_id:str,*,project_id:int,actor:str,expected_revision:int,acknowledgement_reference:str):
        item=await self._get(FactoryLocalizationHandoff,handoff_id,project_id,"Localization handoff");self._revision(item,expected_revision)
        if item.status!="pending" or item.created_by==str(actor) or not acknowledgement_reference.strip():raise ValueError("Downstream acknowledgement must be independent and evidenced")
        pack=await self._get(FactoryCountryContentPack,item.pack_id,project_id,"Country content pack");await self._validate_pack(pack)
        now=datetime.now(timezone.utc);item.status="acknowledged";item.acknowledged_by=str(actor);item.acknowledged_at=now;item.acknowledgement_reference=acknowledgement_reference.strip()[:255];item.revision+=1
        await self._event(item,"handoff","handoff-acknowledged",acknowledgement_reference,"Consumer acknowledged exact country-pack manifest",actor);await self.db.flush();return _serialize(item,HANDOFF)

    async def _source(self,source_id,project_id):
        item=await self.db.scalar(select(ContentDownloadAsset).where(ContentDownloadAsset.id==source_id,ContentDownloadAsset.project_id==project_id))
        if not item:raise KeyError("Private source asset not found")
        if not item.enabled or item.scan_status!="clean" or not item.sha256 or len(item.sha256)!=64:raise ValueError("Private source asset must be enabled, clean-scanned and SHA-256 verified")
        return item

    async def _validate_source(self,asset):
        source=await self._source(asset.source_asset_id,asset.project_id)
        if source.sha256!=asset.source_sha256 or source.size_bytes!=asset.source_size_bytes:raise ValueError("Private source asset changed; re-adoption is required")

    async def _version(self,glossary):
        item=await self.db.scalar(select(FactoryLocalizationGlossaryVersion).where(FactoryLocalizationGlossaryVersion.glossary_id==glossary.id,FactoryLocalizationGlossaryVersion.version_number==glossary.current_version))
        if not item:raise ValueError("Glossary version is missing")
        return item

    async def _validate_job(self,job):
        asset=await self._get(FactoryDamAsset,job.asset_id,job.project_id,"DAM asset");await self._validate_source(asset)
        rights=await self._get(FactoryDamRightsGrant,job.rights_grant_id,job.project_id,"DAM rights grant");glossary=await self._get(FactoryLocalizationGlossary,job.glossary_id,job.project_id,"Localization glossary");version=await self._version(glossary)
        if asset.source_sha256!=job.source_sha256 or rights.status!="active" or rights.valid_until<date.today() or version.version_number!=job.glossary_version or version.content_hash!=job.glossary_hash:raise ValueError("Pinned asset, rights or glossary changed; localization is blocked")

    async def _validate_pack(self,pack):
        manifest=[]
        for rendition_id in pack.rendition_ids_json:
            rendition=await self._get(FactoryLocalizedRendition,rendition_id,pack.project_id,"Localized rendition");job=await self._get(FactoryLocalizationJob,rendition.job_id,pack.project_id,"Localization job");await self._validate_job(job)
            if rendition.status!="approved":raise ValueError("Country pack contains unapproved rendition")
            manifest.append({"rendition_id":rendition.id,"sha256":rendition.localized_sha256,"job":job.job_number,"source":job.source_sha256,"glossary":job.glossary_hash})
        if _hash(manifest)!=pack.manifest_hash:raise ValueError("Country pack manifest changed")

    async def _get(self,model,item_id,project_id,label):
        item=await self.db.scalar(select(model).where(model.id==item_id,model.project_id==project_id))
        if not item:raise KeyError(f"{label} not found")
        return item

    @staticmethod
    def _revision(item,expected):
        if int(item.revision)!=int(expected):raise ValueError("Revision conflict")

    async def _event(self,item,subject_type,evidence_type,reference,note,actor):
        number=next((getattr(item,key,None) for key in ("asset_number","grant_number","glossary_number","job_number","rendition_number","pack_number","handoff_number") if getattr(item,key,None)),str(item.id))
        self.db.add(FactoryDamEvidence(id=_id("dam-evidence"),**_same(item),evidence_number=_number("DAMX",item.project_id),subject_type=subject_type,subject_id=item.id,subject_number=number,evidence_type=evidence_type,evidence_reference=str(reference)[:255],note=note,recorded_by=str(actor),recorded_at=datetime.now(timezone.utc)))
