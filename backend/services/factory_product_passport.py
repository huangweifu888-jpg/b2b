"""Evidence-led PLM engineering and product-passport workflow."""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
import hashlib
import json
import secrets

from core.tenant_context import TenantContext
from models.factory_contract import FactoryCoreEventContract
from models.factory_customer_asset import FactoryCustomerAsset
from models.factory_fulfillment import FactoryFulfillmentOrder
from models.factory_product_passport import (
    FactoryEngineeringVersion,
    FactoryProductPassport,
    FactoryProductPassportCertificate,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


REQUIRED_FULFILLMENT_ACTIONS = (
    "allocate",
    "start-production",
    "complete-production",
    "release-quality",
    "ship",
    "deliver",
)
ACCESS_MODES = {"controlled", "customer", "public-summary"}


def _utc(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def _json(value: str | None, fallback):
    try:
        parsed = json.loads(value or "")
    except (TypeError, ValueError):
        return fallback
    return parsed if isinstance(parsed, type(fallback)) else fallback


def _event(
    contract: FactoryCoreEventContract,
    *,
    tenant_id: str,
    event_type: str,
    subject_id: str,
    correlation_id: str,
    extra: dict[str, object],
) -> dict[str, object]:
    return {
        "eventId": f"evt-{secrets.token_urlsafe(18)}",
        "tenantId": tenant_id,
        "eventType": event_type,
        "occurredAt": datetime.now(timezone.utc).isoformat(),
        "source": "fulfillment",
        "subjectId": subject_id,
        "version": contract.schema_version,
        "correlationId": correlation_id,
        **extra,
    }


def serialize_engineering(item: FactoryEngineeringVersion) -> dict[str, object]:
    return {
        "id": item.id,
        "project_id": item.project_id,
        "tenant_id": item.tenant_id,
        "client_id": item.client_id,
        "plan_id": item.plan_id,
        "engineering_number": item.engineering_number,
        "product_reference": item.product_reference,
        "sku_reference": item.sku_reference,
        "product_name": item.product_name,
        "engineering_version": item.engineering_version,
        "specification": _json(item.specification_json, {}),
        "bom_components": _json(item.bom_components_json, []),
        "lifecycle_status": item.lifecycle_status,
        "release_reference": item.release_reference,
        "release_note": item.release_note,
        "released_by": item.released_by,
        "released_at": item.released_at,
        "emitted_events": _json(item.emitted_events_json, []),
        "revision": item.revision,
        "updated_by": item.updated_by,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
    }


def serialize_certificate(item: FactoryProductPassportCertificate) -> dict[str, object]:
    return {
        "id": item.id,
        "project_id": item.project_id,
        "passport_id": item.passport_id,
        "passport_number": item.passport_number,
        "certificate_type": item.certificate_type,
        "certificate_number": item.certificate_number,
        "issuer": item.issuer,
        "jurisdiction": item.jurisdiction,
        "valid_from": item.valid_from,
        "valid_until": item.valid_until,
        "evidence_reference": item.evidence_reference,
        "verification_status": item.verification_status,
        "revision": item.revision,
        "updated_by": item.updated_by,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
    }


def serialize_passport(
    item: FactoryProductPassport,
    *,
    certificates: list[FactoryProductPassportCertificate] | None = None,
    linked_assets: list[FactoryCustomerAsset] | None = None,
) -> dict[str, object]:
    return {
        "id": item.id,
        "project_id": item.project_id,
        "tenant_id": item.tenant_id,
        "client_id": item.client_id,
        "plan_id": item.plan_id,
        "passport_number": item.passport_number,
        "engineering_version_id": item.engineering_version_id,
        "engineering_number": item.engineering_number,
        "product_reference": item.product_reference,
        "sku_reference": item.sku_reference,
        "order_id": item.order_id,
        "order_number": item.order_number,
        "account_reference": item.account_reference,
        "work_order_reference": item.work_order_reference,
        "batch_reference": item.batch_reference,
        "inspection_reference": item.inspection_reference,
        "shipment_reference": item.shipment_reference,
        "delivery_receipt_reference": item.delivery_receipt_reference,
        "target_market": item.target_market,
        "access_mode": item.access_mode,
        "lifecycle_status": item.lifecycle_status,
        "trace_digest": item.trace_digest,
        "qr_payload": item.qr_payload,
        "published_by": item.published_by,
        "published_at": item.published_at,
        "emitted_events": _json(item.emitted_events_json, []),
        "revision": item.revision,
        "certificates": [serialize_certificate(cert) for cert in certificates or []],
        "linked_assets": [
            {
                "id": asset.id,
                "asset_number": asset.asset_number,
                "serial_number": asset.serial_number,
                "status": asset.status,
                "service_count": asset.service_count,
            }
            for asset in linked_assets or []
        ],
        "updated_by": item.updated_by,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
    }


class FactoryProductPassportService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_workspace(self, *, project_id: int) -> dict[str, object]:
        engineering = (await self.db.execute(
            select(FactoryEngineeringVersion)
            .where(FactoryEngineeringVersion.project_id == project_id)
            .order_by(FactoryEngineeringVersion.created_at.desc())
        )).scalars().all()
        passports = (await self.db.execute(
            select(FactoryProductPassport)
            .where(FactoryProductPassport.project_id == project_id)
            .order_by(FactoryProductPassport.created_at.desc())
        )).scalars().all()
        certificates = (await self.db.execute(
            select(FactoryProductPassportCertificate)
            .where(FactoryProductPassportCertificate.project_id == project_id)
            .order_by(FactoryProductPassportCertificate.created_at.desc())
        )).scalars().all()
        assets = (await self.db.execute(
            select(FactoryCustomerAsset).where(FactoryCustomerAsset.project_id == project_id)
        )).scalars().all()
        orders = (await self.db.execute(
            select(FactoryFulfillmentOrder)
            .where(FactoryFulfillmentOrder.project_id == project_id, FactoryFulfillmentOrder.status == "delivered")
            .order_by(FactoryFulfillmentOrder.created_at.desc())
        )).scalars().all()
        return {
            "engineering_versions": [serialize_engineering(item) for item in engineering],
            "passports": [
                serialize_passport(
                    item,
                    certificates=[cert for cert in certificates if cert.passport_id == item.id],
                    linked_assets=[
                        asset for asset in assets
                        if asset.order_id == item.order_id
                        and asset.product_reference == item.product_reference
                        and asset.sku_reference == item.sku_reference
                    ],
                )
                for item in passports
            ],
            "eligible_orders": [
                {
                    "id": order.id,
                    "order_number": order.order_number,
                    "account_reference": order.account_reference,
                    "lines": _json(order.lines_json, []),
                    "fulfillment_evidence": _json(order.fulfillment_evidence_json, []),
                }
                for order in orders
            ],
        }

    async def create_engineering_version(
        self,
        *,
        project_id: int,
        context: TenantContext,
        actor: str,
        order_id: str,
        product_reference: str,
        sku_reference: str,
        product_name: str,
        engineering_version: str,
        specification: dict[str, str],
        bom_components: list[dict[str, object]],
    ) -> dict[str, object]:
        order = await self._delivered_order(order_id, project_id)
        product = product_reference.strip()
        sku = sku_reference.strip()
        self._require_order_line(order, product, sku)
        name = product_name.strip()
        version = engineering_version.strip()
        if len(name) < 2 or not version:
            raise ValueError("Product name and engineering version are required")
        clean_specification = {
            str(key).strip()[:100]: str(value).strip()[:500]
            for key, value in specification.items()
            if str(key).strip() and str(value).strip()
        }
        if len(clean_specification) < 2:
            raise ValueError("Engineering release requires at least two specification facts")
        clean_bom = self._normalize_bom(bom_components)
        existing = await self.db.scalar(select(FactoryEngineeringVersion.id).where(
            FactoryEngineeringVersion.tenant_id == context.tenant_id,
            FactoryEngineeringVersion.product_reference == product,
            FactoryEngineeringVersion.sku_reference == sku,
            FactoryEngineeringVersion.engineering_version == version,
        ))
        if existing:
            raise ValueError("This engineering product, SKU and version already exists in the tenant")
        now = datetime.now(timezone.utc)
        item = FactoryEngineeringVersion(
            id=f"engineering-{secrets.token_urlsafe(18)}",
            project_id=project_id,
            agent_path=context.agent_path,
            tenant_id=context.tenant_id,
            client_id=context.client_id,
            plan_id=context.plan_id or f"plan-{project_id}",
            engineering_number=f"ENG-{project_id}-{now.strftime('%Y%m%d%H%M%S')}-{secrets.token_hex(3).upper()}",
            product_reference=product,
            sku_reference=sku,
            product_name=name,
            engineering_version=version,
            specification_json=json.dumps(clean_specification, ensure_ascii=False, separators=(",", ":")),
            bom_components_json=json.dumps(clean_bom, ensure_ascii=False, separators=(",", ":")),
            updated_by=actor,
        )
        self.db.add(item)
        await self.db.flush()
        return serialize_engineering(item)

    async def release_engineering_version(
        self,
        engineering_id: str,
        *,
        project_id: int,
        expected_revision: int,
        actor: str,
        release_reference: str,
        release_note: str,
    ) -> dict[str, object]:
        item = await self._engineering(engineering_id, project_id)
        self._require_revision(item.revision, expected_revision, "Engineering version")
        if item.lifecycle_status != "draft":
            raise ValueError("Only a draft engineering version can be released")
        reference = release_reference.strip()
        note = release_note.strip()
        if not reference or len(note) < 8:
            raise ValueError("Engineering release requires an approval reference and release note")
        contract = await self._contract("engineering-version-released")
        item.lifecycle_status = "released"
        item.release_reference = reference
        item.release_note = note
        item.released_by = actor
        item.released_at = datetime.now(timezone.utc)
        item.revision += 1
        item.updated_by = actor
        item.emitted_events_json = json.dumps([
            _event(
                contract,
                tenant_id=item.tenant_id,
                event_type="engineering-version-released",
                subject_id=item.id,
                correlation_id=item.engineering_number,
                extra={
                    "engineeringVersionId": item.id,
                    "productId": item.product_reference,
                    "skuId": item.sku_reference,
                    "engineeringVersion": item.engineering_version,
                },
            )
        ], ensure_ascii=False, separators=(",", ":"))
        await self.db.flush()
        return serialize_engineering(item)

    async def create_passport(
        self,
        *,
        project_id: int,
        context: TenantContext,
        actor: str,
        engineering_version_id: str,
        order_id: str,
        target_market: str,
        access_mode: str,
    ) -> dict[str, object]:
        engineering = await self._engineering(engineering_version_id, project_id)
        if engineering.lifecycle_status != "released":
            raise ValueError("Product passport requires a released engineering version")
        order = await self._delivered_order(order_id, project_id)
        self._require_order_line(order, engineering.product_reference, engineering.sku_reference)
        evidence = _json(order.fulfillment_evidence_json, [])
        evidence_by_action = {
            str(record.get("action")): str(record.get("reference") or "").strip()
            for record in evidence
            if isinstance(record, dict)
        }
        missing = [action for action in REQUIRED_FULFILLMENT_ACTIONS if not evidence_by_action.get(action)]
        if missing:
            raise ValueError(f"Product passport requires complete fulfillment evidence: {', '.join(missing)}")
        market = target_market.strip().upper()
        mode = access_mode.strip().lower()
        if len(market) < 2 or mode not in ACCESS_MODES:
            raise ValueError("Target market and a valid passport access mode are required")
        existing = await self.db.scalar(select(FactoryProductPassport.id).where(
            FactoryProductPassport.tenant_id == context.tenant_id,
            FactoryProductPassport.engineering_version_id == engineering.id,
            FactoryProductPassport.order_id == order.id,
        ))
        if existing:
            raise ValueError("This engineering version and delivered order already has a passport")
        now = datetime.now(timezone.utc)
        item = FactoryProductPassport(
            id=f"passport-{secrets.token_urlsafe(18)}",
            project_id=project_id,
            agent_path=context.agent_path,
            tenant_id=context.tenant_id,
            client_id=context.client_id,
            plan_id=context.plan_id or f"plan-{project_id}",
            passport_number=f"DPP-{project_id}-{now.strftime('%Y%m%d%H%M%S')}-{secrets.token_hex(3).upper()}",
            engineering_version_id=engineering.id,
            engineering_number=engineering.engineering_number,
            product_reference=engineering.product_reference,
            sku_reference=engineering.sku_reference,
            order_id=order.id,
            order_number=order.order_number,
            account_reference=order.account_reference,
            work_order_reference=evidence_by_action["start-production"],
            batch_reference=evidence_by_action["complete-production"],
            inspection_reference=evidence_by_action["release-quality"],
            shipment_reference=evidence_by_action["ship"],
            delivery_receipt_reference=evidence_by_action["deliver"],
            target_market=market,
            access_mode=mode,
            updated_by=actor,
        )
        self.db.add(item)
        await self.db.flush()
        return serialize_passport(item)

    async def add_certificate(
        self,
        passport_id: str,
        *,
        project_id: int,
        context: TenantContext,
        actor: str,
        expected_revision: int,
        certificate_type: str,
        certificate_number: str,
        issuer: str,
        jurisdiction: str,
        valid_from: datetime,
        valid_until: datetime,
        evidence_reference: str,
    ) -> dict[str, object]:
        passport = await self._passport(passport_id, project_id)
        self._require_revision(passport.revision, expected_revision, "Product passport")
        if passport.lifecycle_status != "draft":
            raise ValueError("Certificates can only be attached to a draft passport")
        clean = {
            "type": certificate_type.strip(),
            "number": certificate_number.strip(),
            "issuer": issuer.strip(),
            "jurisdiction": jurisdiction.strip().upper(),
            "evidence": evidence_reference.strip(),
        }
        if any(not value for value in clean.values()):
            raise ValueError("Certificate type, number, issuer, jurisdiction and evidence are required")
        starts = _utc(valid_from)
        expires = _utc(valid_until)
        now = datetime.now(timezone.utc)
        if starts > now or expires <= now or expires <= starts:
            raise ValueError("Only a currently valid certificate can be verified")
        duplicate = await self.db.scalar(select(FactoryProductPassportCertificate.id).where(
            FactoryProductPassportCertificate.tenant_id == context.tenant_id,
            FactoryProductPassportCertificate.certificate_number == clean["number"],
        ))
        if duplicate:
            raise ValueError("Certificate number already exists in this tenant")
        item = FactoryProductPassportCertificate(
            id=f"certificate-{secrets.token_urlsafe(18)}",
            project_id=project_id,
            agent_path=context.agent_path,
            tenant_id=context.tenant_id,
            client_id=context.client_id,
            plan_id=context.plan_id or f"plan-{project_id}",
            passport_id=passport.id,
            passport_number=passport.passport_number,
            certificate_type=clean["type"],
            certificate_number=clean["number"],
            issuer=clean["issuer"],
            jurisdiction=clean["jurisdiction"],
            valid_from=starts,
            valid_until=expires,
            evidence_reference=clean["evidence"],
            updated_by=actor,
        )
        passport.revision += 1
        passport.updated_by = actor
        self.db.add(item)
        await self.db.flush()
        return {
            "passport": serialize_passport(passport, certificates=[item]),
            "certificate": serialize_certificate(item),
        }

    async def publish_passport(
        self,
        passport_id: str,
        *,
        project_id: int,
        expected_revision: int,
        actor: str,
    ) -> dict[str, object]:
        passport = await self._passport(passport_id, project_id)
        self._require_revision(passport.revision, expected_revision, "Product passport")
        if passport.lifecycle_status != "draft":
            raise ValueError("Only a draft product passport can be published")
        engineering = await self._engineering(passport.engineering_version_id, project_id)
        certificates = (await self.db.execute(select(FactoryProductPassportCertificate).where(
            FactoryProductPassportCertificate.passport_id == passport.id,
            FactoryProductPassportCertificate.project_id == project_id,
            FactoryProductPassportCertificate.verification_status == "verified",
        ))).scalars().all()
        now = datetime.now(timezone.utc)
        valid_certificates = [certificate for certificate in certificates if _utc(certificate.valid_until) > now]
        if not valid_certificates:
            raise ValueError("Product passport publication requires a currently valid verified certificate")
        contract = await self._contract("product-passport-published")
        canonical = {
            "tenantId": passport.tenant_id,
            "passportNumber": passport.passport_number,
            "engineeringNumber": engineering.engineering_number,
            "engineeringVersion": engineering.engineering_version,
            "productId": passport.product_reference,
            "skuId": passport.sku_reference,
            "bom": _json(engineering.bom_components_json, []),
            "specification": _json(engineering.specification_json, {}),
            "orderNumber": passport.order_number,
            "workOrder": passport.work_order_reference,
            "batch": passport.batch_reference,
            "inspection": passport.inspection_reference,
            "shipment": passport.shipment_reference,
            "deliveryReceipt": passport.delivery_receipt_reference,
            "certificates": [
                {
                    "type": certificate.certificate_type,
                    "number": certificate.certificate_number,
                    "issuer": certificate.issuer,
                    "jurisdiction": certificate.jurisdiction,
                    "validUntil": _utc(certificate.valid_until).isoformat(),
                    "evidence": certificate.evidence_reference,
                }
                for certificate in sorted(valid_certificates, key=lambda item: item.certificate_number)
            ],
        }
        digest = hashlib.sha256(json.dumps(canonical, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()
        passport.trace_digest = digest
        passport.qr_payload = f"factory-passport:{passport.tenant_id}:{passport.passport_number}:{digest[:20]}"
        passport.lifecycle_status = "published"
        passport.published_by = actor
        passport.published_at = now
        passport.revision += 1
        passport.updated_by = actor
        passport.emitted_events_json = json.dumps([
            _event(
                contract,
                tenant_id=passport.tenant_id,
                event_type="product-passport-published",
                subject_id=passport.id,
                correlation_id=passport.passport_number,
                extra={
                    "passportId": passport.id,
                    "productId": passport.product_reference,
                    "skuId": passport.sku_reference,
                    "batchId": passport.batch_reference,
                    "traceDigest": digest,
                },
            )
        ], ensure_ascii=False, separators=(",", ":"))
        linked_assets = (await self.db.execute(select(FactoryCustomerAsset).where(
            FactoryCustomerAsset.project_id == project_id,
            FactoryCustomerAsset.order_id == passport.order_id,
            FactoryCustomerAsset.product_reference == passport.product_reference,
            FactoryCustomerAsset.sku_reference == passport.sku_reference,
        ))).scalars().all()
        await self.db.flush()
        return serialize_passport(passport, certificates=valid_certificates, linked_assets=linked_assets)

    async def _delivered_order(self, order_id: str, project_id: int) -> FactoryFulfillmentOrder:
        order = await self.db.scalar(select(FactoryFulfillmentOrder).where(
            FactoryFulfillmentOrder.id == order_id.strip(),
            FactoryFulfillmentOrder.project_id == project_id,
            FactoryFulfillmentOrder.status == "delivered",
        ))
        if not order:
            raise ValueError("PLM adoption requires a delivered authoritative order in this tenant plan")
        return order

    @staticmethod
    def _require_order_line(order: FactoryFulfillmentOrder, product: str, sku: str) -> None:
        line = next((
            item for item in _json(order.lines_json, [])
            if str(item.get("product_reference") or "").strip() == product
            and str(item.get("sku_reference") or "").strip() == sku
        ), None)
        if not line:
            raise ValueError("Product and SKU must match the delivered order line")

    @staticmethod
    def _normalize_bom(components: list[dict[str, object]]) -> list[dict[str, object]]:
        normalized: list[dict[str, object]] = []
        for index, component in enumerate(components, start=1):
            material = str(component.get("material_reference") or "").strip()[:255]
            name = str(component.get("material_name") or "").strip()[:500]
            supplier = str(component.get("supplier_reference") or "").strip()[:255]
            unit = str(component.get("unit") or "").strip()[:30]
            origin = str(component.get("origin_country") or "").strip().upper()[:100]
            try:
                quantity = Decimal(str(component.get("quantity") or "0"))
            except (InvalidOperation, TypeError):
                quantity = Decimal(0)
            if not all((material, name, supplier, unit, origin)) or quantity <= 0:
                raise ValueError(f"BOM component {index} requires material, supplier, positive quantity, unit and origin")
            normalized.append({
                "line": index,
                "material_reference": material,
                "material_name": name,
                "supplier_reference": supplier,
                "quantity": format(quantity, "f"),
                "unit": unit,
                "origin_country": origin,
            })
        if len(normalized) < 2:
            raise ValueError("Engineering release requires at least two traceable BOM components")
        if len({item["material_reference"] for item in normalized}) != len(normalized):
            raise ValueError("BOM material references must be unique within an engineering version")
        return normalized

    async def _engineering(self, engineering_id: str, project_id: int) -> FactoryEngineeringVersion:
        item = await self.db.scalar(select(FactoryEngineeringVersion).where(
            FactoryEngineeringVersion.id == engineering_id,
            FactoryEngineeringVersion.project_id == project_id,
        ))
        if not item:
            raise KeyError("Engineering version not found in this tenant plan")
        return item

    async def _passport(self, passport_id: str, project_id: int) -> FactoryProductPassport:
        item = await self.db.scalar(select(FactoryProductPassport).where(
            FactoryProductPassport.id == passport_id,
            FactoryProductPassport.project_id == project_id,
        ))
        if not item:
            raise KeyError("Product passport not found in this tenant plan")
        return item

    @staticmethod
    def _require_revision(actual: int, expected: int, label: str) -> None:
        if actual != expected:
            raise ValueError(f"{label} changed; refresh before continuing")

    async def _contract(self, event_type: str) -> FactoryCoreEventContract:
        contract = await self.db.scalar(select(FactoryCoreEventContract).where(
            FactoryCoreEventContract.id == event_type,
            FactoryCoreEventContract.lifecycle_status == "frozen",
        ))
        if not contract:
            raise ValueError(f"The frozen {event_type} contract is required")
        return contract
