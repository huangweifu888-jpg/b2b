"""Controlled product-channel content workflow; it never owns engineering facts."""
from datetime import datetime, timezone
import hashlib, json, secrets
from typing import Any

from core.tenant_context import TenantContext
from models.factory_contract import FactoryCoreEventContract, FactoryCoreObjectContract
from models.factory_product_content import FactoryProductContentAsset, FactoryProductContentEvidence, FactoryProductContentPublication, FactoryProductContentVersion
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

APPLICATION_ID = "content.product"
_PROHIBITED_KEYS = {"password", "secret", "token", "private_key", "api_key", "credential", "bom", "inventory", "standard_cost", "cost_price"}
_TARGETS = {"website-product", "channel-listing", "sales-enablement", "seo-content"}
ASSET = ("id", "asset_number", "product_reference", "display_name", "status", "revision")
VERSION = ("id", "version_number", "asset_id", "asset_number", "locale", "document_hash", "product_fact_reference", "status", "authored_by", "reviewed_by", "revision")
PUBLICATION = ("id", "publication_number", "asset_id", "content_version_id", "version_number", "target", "status", "available", "consumer_receipt_reference", "revision")
def _id(prefix: str): return f"{prefix}-{secrets.token_urlsafe(18)}"
def _number(prefix: str, project_id: int): return f"{prefix}-{project_id}-{datetime.now(timezone.utc):%Y%m%d%H%M%S%f}-{secrets.token_hex(3).upper()}"
def _hash(value: object): return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str).encode()).hexdigest()
def _context(context: TenantContext, project_id: int): return {"project_id": project_id, "agent_path": context.agent_path, "tenant_id": context.tenant_id, "client_id": context.client_id, "plan_id": context.plan_id or f"plan-{project_id}"}
def _same(row: object): return {name: getattr(row, name) for name in ("project_id", "agent_path", "tenant_id", "client_id", "plan_id")}
def _pick(row: object, names: tuple[str, ...]): return {name: getattr(row, name) for name in names}
def _unsafe(value: object) -> bool:
    if isinstance(value, dict): return any(str(key).casefold() in _PROHIBITED_KEYS or _unsafe(item) for key, item in value.items())
    if isinstance(value, list): return any(_unsafe(item) for item in value)
    return isinstance(value, str) and ("javascript:" in value.casefold() or "<script" in value.casefold())


class FactoryProductContentService:
    def __init__(self, db: AsyncSession): self.db = db

    async def workspace(self, *, project_id: int):
        async def rows(model: Any, order: Any):
            result = await self.db.execute(select(model).where(model.project_id == project_id).order_by(order.desc()).limit(500)); return list(result.scalars().all())
        assets = await rows(FactoryProductContentAsset, FactoryProductContentAsset.created_at); versions = await rows(FactoryProductContentVersion, FactoryProductContentVersion.created_at); publications = await rows(FactoryProductContentPublication, FactoryProductContentPublication.prepared_at); evidence = await rows(FactoryProductContentEvidence, FactoryProductContentEvidence.recorded_at); ready = [item for item in publications if item.status == "available" and item.available]
        return {"assets": [_pick(x, ASSET) for x in assets], "versions": [_pick(x, VERSION) for x in versions], "publications": [_pick(x, PUBLICATION) for x in publications], "evidence": [{"id": x.id, "evidence_type": x.evidence_type, "evidence_reference": x.evidence_reference} for x in evidence], "metrics": {"assets": len(assets), "reviewed_versions": sum(x.status == "reviewed" for x in versions), "acknowledged_releases": len(ready), "evidence_records": len(evidence)}, "availability": {"application_id": APPLICATION_ID, "status": "available" if ready else "pilot", "release_version": ready[0].version_number if ready else None}, "contract": {"product_master_mutated_directly": False, "engineering_facts_copied": False, "bom_inventory_or_cost_stored": False, "version_self_review": False, "publication_self_approval": False, "consumer_handoff_required": True}}

    async def create_asset(self, *, project_id: int, context: TenantContext, actor: str, product_reference: str, display_name: str):
        if not product_reference.strip() or not display_name.strip(): raise ValueError("Content asset requires a product reference and display name")
        now = datetime.now(timezone.utc); item = FactoryProductContentAsset(id=_id("product-content"), **_context(context, project_id), asset_number=_number("PCA", project_id), product_reference=product_reference.strip()[:160], display_name=display_name.strip()[:200], status="active", created_by=str(actor), created_at=now, revision=1); self.db.add(item); await self._event(item, "asset", "product-content-asset-created", item.product_reference, "Content asset references product facts; it does not modify product master", actor); await self.db.flush(); return _pick(item, ASSET)

    async def draft_version(self, asset_id: str, *, project_id: int, context: TenantContext, actor: str, locale: str, content_document: dict[str, object], product_fact_reference: str):
        asset = await self._get(FactoryProductContentAsset, asset_id, project_id, "Product content asset")
        if asset.status != "active" or not locale.strip() or not content_document or not product_fact_reference.strip(): raise ValueError("Version requires active asset, locale, content and product fact reference")
        if _unsafe(content_document): raise ValueError("Content document must not contain unsafe markup, credentials, BOM, inventory or cost")
        document = {"asset_number": asset.asset_number, "locale": locale.strip(), "content_document": content_document, "product_fact_reference": product_fact_reference.strip()}; version = FactoryProductContentVersion(id=_id("product-content-version"), **_same(asset), version_number=_number("PCV", project_id), asset_id=asset.id, asset_number=asset.asset_number, locale=locale.strip(), content_document_json=content_document, document_hash=_hash(document), product_fact_reference=product_fact_reference.strip()[:255], status="draft", authored_by=str(actor), created_at=datetime.now(timezone.utc), revision=1); self.db.add(version); await self._event(version, "version", "product-content-drafted", version.document_hash, "Pinned channel content only; product master and engineering facts remain external", actor); await self.db.flush(); return _pick(version, VERSION)

    async def review_version(self, version_id: str, *, project_id: int, actor: str, expected_revision: int, review_reference: str):
        version = await self._get(FactoryProductContentVersion, version_id, project_id, "Product content version"); self._revision(version, expected_revision); expected = _hash({"asset_number": version.asset_number, "locale": version.locale, "content_document": version.content_document_json, "product_fact_reference": version.product_fact_reference})
        if version.status != "draft" or version.authored_by == str(actor) or not review_reference.strip() or version.document_hash != expected: raise ValueError("Version requires independent review of unchanged content and product fact reference")
        version.status = "reviewed"; version.reviewed_by = str(actor); version.reviewed_at = datetime.now(timezone.utc); version.review_reference = review_reference.strip()[:255]; version.revision += 1; await self._event(version, "version", "product-content-reviewed", version.review_reference, "Independent reviewer accepted channel content without taking ownership of product facts", actor); await self.db.flush(); return _pick(version, VERSION)

    async def prepare_publication(self, version_id: str, *, project_id: int, context: TenantContext, actor: str, target: str, rollback_reference: str):
        version = await self._get(FactoryProductContentVersion, version_id, project_id, "Product content version")
        if version.status != "reviewed" or target not in _TARGETS or not rollback_reference.strip(): raise ValueError("Release requires reviewed content, supported target and rollback reference")
        manifest = {"application_id": APPLICATION_ID, "asset_number": version.asset_number, "version_number": version.version_number, "source_document_hash": version.document_hash, "product_fact_reference": version.product_fact_reference, "target": target, "product_master_mutated_directly": False, "engineering_facts_copied": False, "consumer_receipt_required": True, "rollback_reference": rollback_reference.strip()}; publication = FactoryProductContentPublication(id=_id("product-content-release"), **_context(context, project_id), publication_number=_number("PCP", project_id), asset_id=version.asset_id, content_version_id=version.id, version_number=version.version_number, target=target, release_manifest_json=manifest, manifest_hash=_hash(manifest), rollback_reference=rollback_reference.strip()[:255], status="pending-approval", prepared_by=str(actor), available=False, prepared_at=datetime.now(timezone.utc), revision=1); self.db.add(publication); await self._event(publication, "publication", "product-content-release-prepared", publication.manifest_hash, "Controlled handoff; no site, channel, product master or engineering record is written", actor); await self.db.flush(); return _pick(publication, PUBLICATION)

    async def approve_publication(self, publication_id: str, *, project_id: int, actor: str, expected_revision: int, approval_reference: str):
        publication = await self._get(FactoryProductContentPublication, publication_id, project_id, "Product content publication"); self._revision(publication, expected_revision); version = await self._get(FactoryProductContentVersion, publication.content_version_id, project_id, "Product content version"); obj = await self.db.scalar(select(FactoryCoreObjectContract).where(FactoryCoreObjectContract.id == "product-content-version", FactoryCoreObjectContract.lifecycle_status == "frozen")); event = await self.db.scalar(select(FactoryCoreEventContract).where(FactoryCoreEventContract.id == "product-content-released", FactoryCoreEventContract.lifecycle_status == "frozen"))
        if publication.status != "pending-approval" or publication.prepared_by == str(actor) or not approval_reference.strip() or publication.manifest_hash != _hash(publication.release_manifest_json) or version.status != "reviewed" or not obj or not event: raise ValueError("Release requires independent approval, frozen contracts and unchanged reviewed content")
        publication.status = "approved"; publication.approved_by = str(actor); publication.approval_reference = approval_reference.strip()[:255]; publication.revision += 1; await self._event(publication, "publication", "product-content-release-approved", publication.approval_reference, "Awaiting consumer acknowledgement; no direct channel publication occurred", actor); await self.db.flush(); return _pick(publication, PUBLICATION)

    async def acknowledge_publication(self, publication_id: str, *, project_id: int, actor: str, expected_revision: int, consumer_receipt_reference: str):
        publication = await self._get(FactoryProductContentPublication, publication_id, project_id, "Product content publication"); self._revision(publication, expected_revision)
        if publication.status != "approved" or publication.approved_by == str(actor) or not consumer_receipt_reference.strip(): raise ValueError("Consumer acknowledgement requires an approved release and separate handoff actor")
        publication.status = "available"; publication.available = True; publication.consumer_receipt_reference = consumer_receipt_reference.strip()[:255]; publication.acknowledged_at = datetime.now(timezone.utc); publication.revision += 1; await self._event(publication, "publication", "product-content-released", publication.consumer_receipt_reference, "Consumer receipt accepted a content handoff without direct site or product-master mutation", actor); await self.db.flush(); return _pick(publication, PUBLICATION)

    async def _get(self, model: Any, item_id: str, project_id: int, label: str):
        item = await self.db.scalar(select(model).where(model.id == item_id, model.project_id == project_id))
        if not item: raise KeyError(f"{label} not found in this tenant plan")
        return item
    @staticmethod
    def _revision(item: object, expected: int):
        if int(getattr(item, "revision")) != int(expected): raise ValueError("Revision conflict")
    async def _event(self, item: object, subject_type: str, evidence_type: str, reference: str, note: str, actor: str):
        number = next((getattr(item, name, None) for name in ("asset_number", "version_number", "publication_number") if getattr(item, name, None)), str(getattr(item, "id"))); self.db.add(FactoryProductContentEvidence(id=_id("product-content-evidence"), **_same(item), evidence_number=_number("PCE", getattr(item, "project_id")), subject_type=subject_type, subject_id=getattr(item, "id"), subject_number=number, evidence_type=evidence_type, evidence_reference=str(reference)[:255], note=note, recorded_by=str(actor), recorded_at=datetime.now(timezone.utc)))
