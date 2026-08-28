"""Governed multi-channel product feed generation and listing handoff."""
from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
import hashlib
import json
import secrets

from core.tenant_context import TenantContext
from models.factory_channel_feed import FactoryChannelAccount, FactoryChannelCatalog, FactoryChannelEvidence, FactoryChannelFeedRelease, FactoryChannelFeedRun, FactoryChannelListing, FactoryChannelPublication
from models.factory_structured_data import FactoryStructuredDataRelease
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


PLATFORMS = {"google-merchant", "amazon", "alibaba", "industry-marketplace"}
CATALOG = ("id", "catalog_number", "catalog_code", "catalog_name", "source_release_id", "source_release_number", "source_release_version", "source_document_hash", "default_locale", "status", "authored_by", "published_by", "revision")
ACCOUNT = ("id", "account_number", "platform", "account_reference", "credential_reference", "territory", "locale", "currency", "status", "requested_by", "approved_by", "revision")
LISTING = ("id", "listing_number", "catalog_id", "catalog_number", "account_id", "account_number", "external_sku", "product_name", "product_identifier", "source_product_hash", "price_mode", "price_amount", "currency", "price_reference", "inventory_mode", "availability_status", "inventory_reference", "channel_attributes_json", "status", "created_by", "validated_by", "revision")
RUN = ("id", "run_number", "catalog_id", "catalog_number", "source_document_hash", "listing_count", "error_count", "warning_count", "report_json", "payload_json", "payload_hash", "status", "executed_by")
RELEASE = ("id", "release_number", "catalog_id", "catalog_number", "run_id", "run_number", "version_number", "payload_json", "payload_hash", "channel_count", "listing_count", "status", "published_by")
PUBLICATION = ("id", "publication_number", "catalog_id", "release_id", "release_number", "account_id", "account_number", "payload_hash", "remote_reference", "consumer_mutated", "status", "created_by", "acknowledged_by", "revision")


def _id(kind): return f"{kind}-{secrets.token_urlsafe(18)}"
def _number(prefix, project_id): return f"{prefix}-{project_id}-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S%f')}-{secrets.token_hex(3).upper()}"
def _context(context, project_id): return {"project_id": project_id, "agent_path": context.agent_path, "tenant_id": context.tenant_id, "client_id": context.client_id, "plan_id": context.plan_id or f"plan-{project_id}"}
def _same(item): return {key: getattr(item, key) for key in ("project_id", "agent_path", "tenant_id", "client_id", "plan_id")}
def _hash(payload): return hashlib.sha256(json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
def _serialize(item, fields): return {field: getattr(item, field) for field in fields}


class FactoryChannelFeedService:
    def __init__(self, db: AsyncSession): self.db = db

    async def list_workspace(self, *, project_id: int):
        async def rows(model, order): return (await self.db.execute(select(model).where(model.project_id == project_id).order_by(order.desc()).limit(500))).scalars().all()
        catalogs = await rows(FactoryChannelCatalog, FactoryChannelCatalog.created_at); accounts = await rows(FactoryChannelAccount, FactoryChannelAccount.created_at); listings = await rows(FactoryChannelListing, FactoryChannelListing.created_at); runs = await rows(FactoryChannelFeedRun, FactoryChannelFeedRun.executed_at); releases = await rows(FactoryChannelFeedRelease, FactoryChannelFeedRelease.published_at); publications = await rows(FactoryChannelPublication, FactoryChannelPublication.created_at); evidence = await rows(FactoryChannelEvidence, FactoryChannelEvidence.recorded_at)
        approved = [item for item in accounts if item.status == "approved"]; validated = [item for item in listings if item.status == "validated"]; passed = [item for item in runs if item.status == "passed"]; acknowledged = [item for item in publications if item.status == "acknowledged"]
        source_releases = await self._source_releases(project_id)
        return {"catalogs": [_serialize(x, CATALOG) for x in catalogs], "accounts": [_serialize(x, ACCOUNT) for x in accounts], "listings": [_serialize(x, LISTING) for x in listings], "runs": [_serialize(x, RUN) for x in runs], "releases": [_serialize(x, RELEASE) for x in releases], "publications": [_serialize(x, PUBLICATION) for x in publications], "evidence": [{"id": x.id, "subject_type": x.subject_type, "subject_id": x.subject_id, "evidence_type": x.evidence_type, "evidence_reference": x.evidence_reference, "recorded_by": x.recorded_by} for x in evidence], "source_releases": source_releases, "metrics": {"approved_channels": len(approved), "channel_coverage_percent": round(len({x.platform for x in approved}) * 100 / len(PLATFORMS), 2), "validated_listings": len(validated), "listing_validation_percent": round(len(validated) * 100 / max(1, len(listings)), 2), "passed_feed_runs": len(passed), "publication_acknowledgement_percent": round(len(acknowledged) * 100 / max(1, len(publications)), 2)}, "contract": {"credential_secret_stored": False, "product_master_copied": False, "structured_release_pinned": True, "price_inventory_source_reference_required": True, "catalog_only_default": True, "listing_self_validation": False, "failed_feed_publishable": False, "catalog_author_self_publish": False, "published_release_mutable": False, "consumer_system_mutated": False, "publication_acknowledgement_required": True}}

    async def create_account(self, *, project_id: int, context: TenantContext, actor: str, platform: str, account_reference: str, credential_reference: str, territory: str, locale: str, currency: str):
        if platform not in PLATFORMS or not account_reference.strip() or not credential_reference.strip() or len(currency.strip()) != 3: raise ValueError("Channel account requires supported platform, vault credential reference and currency")
        now = datetime.now(timezone.utc); item = FactoryChannelAccount(id=_id("channel-account"), **_context(context, project_id), account_number=_number("CHA", project_id), platform=platform, account_reference=account_reference.strip()[:180], credential_reference=credential_reference.strip()[:255], territory=territory.strip().upper()[:16], locale=locale.strip()[:16], currency=currency.strip().upper(), status="pending", requested_by=str(actor), revision=1, created_at=now); self.db.add(item); await self._event(item, "account", "account-requested", credential_reference, "Registered credential reference only; no channel secret was stored", actor); await self.db.flush(); return _serialize(item, ACCOUNT)

    async def approve_account(self, account_id: str, *, project_id: int, actor: str, expected_revision: int, reference: str):
        item = await self._get(FactoryChannelAccount, account_id, project_id, "Channel account"); self._revision(item, expected_revision)
        if item.status != "pending" or item.requested_by == str(actor) or not reference.strip(): raise ValueError("Channel account requires independent approval evidence")
        item.status = "approved"; item.approved_by = str(actor); item.approved_at = datetime.now(timezone.utc); item.approval_reference = reference.strip()[:255]; item.revision += 1; await self._event(item, "account", "account-approved", reference, "Independently approved channel account and credential reference", actor); await self.db.flush(); return _serialize(item, ACCOUNT)

    async def create_catalog(self, *, project_id: int, context: TenantContext, actor: str, catalog_code: str, catalog_name: str, source_release_id: str, default_locale: str):
        source = await self._get(FactoryStructuredDataRelease, source_release_id, project_id, "Structured-data release"); self._validate_source_release(source); self._product_nodes(source)
        now = datetime.now(timezone.utc); item = FactoryChannelCatalog(id=_id("channel-catalog"), **_context(context, project_id), catalog_number=_number("CHC", project_id), catalog_code=catalog_code.strip()[:64], catalog_name=catalog_name.strip()[:180], source_release_id=source.id, source_release_number=source.release_number, source_release_version=source.version_number, source_document_hash=source.document_hash, default_locale=default_locale.strip()[:16], status="draft", authored_by=str(actor), revision=1, created_at=now, updated_at=now); self.db.add(item); await self._event(item, "catalog", "catalog-created", source.release_number, "Pinned immutable structured-data release without copying product master", actor); await self.db.flush(); return _serialize(item, CATALOG)

    async def add_listing(self, catalog_id: str, *, project_id: int, context: TenantContext, actor: str, account_id: str, external_sku: str, product_identifier: str, price_mode: str, price_amount, currency: str | None, price_reference: str | None, inventory_mode: str, availability_status: str, inventory_reference: str | None, channel_attributes: dict):
        catalog = await self._get(FactoryChannelCatalog, catalog_id, project_id, "Channel catalog"); account = await self._get(FactoryChannelAccount, account_id, project_id, "Channel account")
        if catalog.status != "draft" or account.status != "approved" or not external_sku.strip() or not channel_attributes: raise ValueError("Listing requires draft catalog, approved channel, SKU and channel attributes")
        source = await self._validate_catalog_source(catalog); products = self._product_nodes(source); product = next((x for x in products if str(x.get("identifier")) == product_identifier), None)
        if not product: raise ValueError("Product identifier is absent from pinned structured-data release")
        if price_mode == "catalog-only":
            if price_amount is not None or currency or price_reference or inventory_mode != "on-request" or inventory_reference: raise ValueError("Catalog-only listing cannot fabricate price or inventory facts")
        elif price_mode == "connector-reference":
            if Decimal(str(price_amount or 0)) <= 0 or not currency or not price_reference or inventory_mode != "connector-reference" or not inventory_reference or availability_status not in {"in_stock", "out_of_stock", "preorder"}: raise ValueError("Connector listing requires positive price, currency and authoritative price/inventory references")
        else: raise ValueError("Unsupported listing price mode")
        now = datetime.now(timezone.utc); item = FactoryChannelListing(id=_id("channel-listing"), **_context(context, project_id), listing_number=_number("CHL", project_id), catalog_id=catalog.id, catalog_number=catalog.catalog_number, account_id=account.id, account_number=account.account_number, external_sku=external_sku.strip()[:120], product_name=str(product.get("name") or "")[:255], product_identifier=product_identifier[:180], source_product_hash=_hash(product), price_mode=price_mode, price_amount=price_amount, currency=currency.upper() if currency else None, price_reference=price_reference.strip()[:255] if price_reference else None, inventory_mode=inventory_mode, availability_status=availability_status, inventory_reference=inventory_reference.strip()[:255] if inventory_reference else None, channel_attributes_json=channel_attributes, status="pending", created_by=str(actor), revision=1, created_at=now); self.db.add(item); await self._event(item, "listing", "listing-created", product_identifier, "Created channel projection pinned to immutable Product JSON-LD", actor); await self.db.flush(); return _serialize(item, LISTING)

    async def validate_listing(self, listing_id: str, *, project_id: int, actor: str, expected_revision: int, reference: str):
        item = await self._get(FactoryChannelListing, listing_id, project_id, "Channel listing"); self._revision(item, expected_revision)
        if item.status != "pending" or item.created_by == str(actor) or not reference.strip(): raise ValueError("Channel listing requires independent validation evidence")
        await self._validate_listing_source(item); item.status = "validated"; item.validated_by = str(actor); item.validated_at = datetime.now(timezone.utc); item.validation_reference = reference.strip()[:255]; item.revision += 1; await self._event(item, "listing", "listing-validated", reference, "Independently validated source, channel and commercial fact boundaries", actor); await self.db.flush(); return _serialize(item, LISTING)

    async def run_feed(self, catalog_id: str, *, project_id: int, context: TenantContext, actor: str, expected_revision: int, reference: str):
        catalog = await self._get(FactoryChannelCatalog, catalog_id, project_id, "Channel catalog"); self._revision(catalog, expected_revision)
        if catalog.status != "draft" or catalog.authored_by == str(actor) or not reference.strip(): raise ValueError("Feed validation requires independent operator and evidence")
        await self._validate_catalog_source(catalog); listings = (await self.db.execute(select(FactoryChannelListing).where(FactoryChannelListing.catalog_id == catalog.id, FactoryChannelListing.status == "validated"))).scalars().all()
        if not listings: raise ValueError("Feed requires at least one independently validated listing")
        payload_items = []
        for item in sorted(listings, key=lambda x: (x.account_number, x.external_sku)):
            account = await self._validate_listing_source(item); payload_items.append({"channel": account.platform, "account_reference": account.account_reference, "external_sku": item.external_sku, "product": {"identifier": item.product_identifier, "name": item.product_name, "source_hash": item.source_product_hash}, "commercial": {"price_mode": item.price_mode, "price": str(item.price_amount) if item.price_amount is not None else None, "currency": item.currency, "price_reference": item.price_reference, "inventory_mode": item.inventory_mode, "availability": item.availability_status, "inventory_reference": item.inventory_reference}, "attributes": item.channel_attributes_json})
        payload = {"catalog_number": catalog.catalog_number, "source_document_hash": catalog.source_document_hash, "generated_locale": catalog.default_locale, "items": payload_items}; now = datetime.now(timezone.utc); item = FactoryChannelFeedRun(id=_id("channel-feed-run"), **_context(context, project_id), run_number=_number("CHF", project_id), catalog_id=catalog.id, catalog_number=catalog.catalog_number, source_document_hash=catalog.source_document_hash, listing_count=len(listings), error_count=0, warning_count=0, report_json={"reference": reference, "validated_listing_numbers": [x.listing_number for x in listings]}, payload_json=payload, payload_hash=_hash(payload), status="passed", executed_by=str(actor), executed_at=now); self.db.add(item); await self._event(item, "feed-run", "feed-passed", reference, "Generated deterministic feed with zero validation errors", actor); await self.db.flush(); return _serialize(item, RUN)

    async def publish_catalog(self, catalog_id: str, *, project_id: int, context: TenantContext, actor: str, expected_revision: int, run_id: str, remote_reference_prefix: str):
        catalog = await self._get(FactoryChannelCatalog, catalog_id, project_id, "Channel catalog"); run = await self._get(FactoryChannelFeedRun, run_id, project_id, "Channel feed run"); self._revision(catalog, expected_revision)
        if catalog.status != "draft" or catalog.authored_by == str(actor) or not remote_reference_prefix.strip(): raise ValueError("Channel feed requires independent publisher and remote reference")
        if run.catalog_id != catalog.id or run.status != "passed" or run.error_count != 0 or run.source_document_hash != catalog.source_document_hash or run.payload_hash != _hash(run.payload_json): raise ValueError("Only unchanged passing feed can be published")
        await self._validate_catalog_source(catalog); account_ids = sorted({x.account_id for x in (await self.db.execute(select(FactoryChannelListing).where(FactoryChannelListing.catalog_id == catalog.id, FactoryChannelListing.status == "validated"))).scalars().all()}); now = datetime.now(timezone.utc); current = await self.db.scalar(select(FactoryChannelFeedRelease.version_number).where(FactoryChannelFeedRelease.catalog_id == catalog.id).order_by(FactoryChannelFeedRelease.version_number.desc()).limit(1)) or 0
        release = FactoryChannelFeedRelease(id=_id("channel-feed-release"), **_context(context, project_id), release_number=_number("CHR", project_id), catalog_id=catalog.id, catalog_number=catalog.catalog_number, run_id=run.id, run_number=run.run_number, version_number=int(current) + 1, payload_json=run.payload_json, payload_hash=run.payload_hash, channel_count=len(account_ids), listing_count=run.listing_count, status="published", published_by=str(actor), published_at=now); self.db.add(release); publications = []
        for account_id in account_ids:
            account = await self._get(FactoryChannelAccount, account_id, project_id, "Channel account"); publication = FactoryChannelPublication(id=_id("channel-publication"), **_context(context, project_id), publication_number=_number("CHP", project_id), catalog_id=catalog.id, release_id=release.id, release_number=release.release_number, account_id=account.id, account_number=account.account_number, payload_hash=release.payload_hash, remote_reference=f"{remote_reference_prefix.strip()[:180]}:{account.platform}", consumer_mutated=False, status="pending", created_by=str(actor), created_at=now, revision=1); self.db.add(publication); publications.append(publication); await self._event(publication, "publication", "publication-created", publication.remote_reference, "Created explicit channel acknowledgement for exact feed hash", actor)
        catalog.status = "published"; catalog.published_by = str(actor); catalog.published_at = now; catalog.revision += 1; catalog.updated_at = now; await self._event(catalog, "catalog", "catalog-published", release.release_number, "Published immutable multi-channel feed without mutating consumers", actor); await self.db.flush(); return {"catalog": _serialize(catalog, CATALOG), "release": _serialize(release, RELEASE), "publications": [_serialize(x, PUBLICATION) for x in publications]}

    async def acknowledge_publication(self, publication_id: str, *, project_id: int, actor: str, expected_revision: int, reference: str):
        item = await self._get(FactoryChannelPublication, publication_id, project_id, "Channel publication"); self._revision(item, expected_revision)
        if item.status != "pending" or item.created_by == str(actor) or not reference.strip(): raise ValueError("Channel acknowledgement must be independent and evidenced")
        release = await self._get(FactoryChannelFeedRelease, item.release_id, project_id, "Channel feed release")
        if release.status != "published" or release.payload_hash != item.payload_hash or _hash(release.payload_json) != item.payload_hash: raise ValueError("Published channel feed changed")
        item.status = "acknowledged"; item.acknowledged_by = str(actor); item.acknowledged_at = datetime.now(timezone.utc); item.acknowledgement_reference = reference.strip()[:255]; item.revision += 1; await self._event(item, "publication", "publication-acknowledged", reference, "Channel acknowledged exact immutable feed hash", actor); await self.db.flush(); return _serialize(item, PUBLICATION)

    async def _source_releases(self, project_id):
        rows = (await self.db.execute(select(FactoryStructuredDataRelease).where(FactoryStructuredDataRelease.project_id == project_id, FactoryStructuredDataRelease.status == "published").order_by(FactoryStructuredDataRelease.published_at.desc()))).scalars().all(); result = []
        for item in rows:
            try: products = self._product_nodes(item)
            except ValueError: continue
            result.append({"id": item.id, "release_number": item.release_number, "version_number": item.version_number, "document_hash": item.document_hash, "products": [{"identifier": str(x.get("identifier")), "name": str(x.get("name")), "source_product_hash": _hash(x)} for x in products]})
        return result

    @staticmethod
    def _validate_source_release(source):
        if source.status != "published" or _hash(source.document_json) != source.document_hash: raise ValueError("Structured-data release must be published and hash-valid")

    @staticmethod
    def _product_nodes(source):
        nodes = source.document_json.get("@graph", []) if isinstance(source.document_json, dict) else []; products = [x for x in nodes if isinstance(x, dict) and x.get("@type") == "Product" and x.get("identifier") and x.get("name")]
        if not products: raise ValueError("Pinned structured-data release has no valid Product node")
        return products

    async def _validate_catalog_source(self, catalog):
        source = await self._get(FactoryStructuredDataRelease, catalog.source_release_id, catalog.project_id, "Structured-data release"); self._validate_source_release(source)
        if source.release_number != catalog.source_release_number or source.version_number != catalog.source_release_version or source.document_hash != catalog.source_document_hash: raise ValueError("Pinned structured-data release changed")
        return source

    async def _validate_listing_source(self, item):
        catalog = await self._get(FactoryChannelCatalog, item.catalog_id, item.project_id, "Channel catalog"); account = await self._get(FactoryChannelAccount, item.account_id, item.project_id, "Channel account"); source = await self._validate_catalog_source(catalog); product = next((x for x in self._product_nodes(source) if str(x.get("identifier")) == item.product_identifier), None)
        if account.status != "approved" or not product or _hash(product) != item.source_product_hash: raise ValueError("Pinned product or approved channel changed")
        return account

    async def _get(self, model, item_id, project_id, label):
        item = await self.db.scalar(select(model).where(model.id == item_id, model.project_id == project_id))
        if not item: raise KeyError(f"{label} not found")
        return item

    @staticmethod
    def _revision(item, expected):
        if int(item.revision) != int(expected): raise ValueError("Revision conflict")

    async def _event(self, item, subject_type, evidence_type, reference, note, actor):
        number = next((getattr(item, key, None) for key in ("catalog_number", "account_number", "listing_number", "run_number", "release_number", "publication_number") if getattr(item, key, None)), str(item.id)); self.db.add(FactoryChannelEvidence(id=_id("channel-evidence"), **_same(item), evidence_number=_number("CHX", item.project_id), subject_type=subject_type, subject_id=item.id, subject_number=number, evidence_type=evidence_type, evidence_reference=str(reference)[:255], note=note, recorded_by=str(actor), recorded_at=datetime.now(timezone.utc)))
