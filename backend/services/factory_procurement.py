"""Governed SRM supplier qualification, purchase approval and receiving workflow."""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
import json
import secrets

from core.tenant_context import TenantContext
from models.factory_fulfillment import FactoryFulfillmentOrder
from models.factory_procurement import FactoryPurchaseOrder, FactorySupplier
from models.factory_product_passport import FactoryEngineeringVersion
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


MONEY = Decimal("0.01")
ELIGIBLE_DEMAND_STATUSES = ("confirmed", "allocated", "in-production", "production-completed", "quality-released", "shipped", "delivered")
PURCHASE_TRANSITIONS = {
    "submit": ("draft", "pending-approval"),
    "approve": ("pending-approval", "approved"),
    "issue": ("approved", "issued"),
    "acknowledge": ("issued", "acknowledged"),
    "receive": ("acknowledged", "received"),
}


def _json(value: str | None, fallback):
    try:
        parsed = json.loads(value or "")
    except (TypeError, ValueError):
        return fallback
    return parsed if isinstance(parsed, type(fallback)) else fallback


def _decimal(value: object, label: str) -> Decimal:
    try:
        result = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise ValueError(f"{label} must be a valid number") from exc
    if result <= 0:
        raise ValueError(f"{label} must be positive")
    return result


def _utc(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def serialize_supplier(item: FactorySupplier) -> dict[str, object]:
    return {
        "id": item.id, "project_id": item.project_id, "tenant_id": item.tenant_id,
        "client_id": item.client_id, "plan_id": item.plan_id, "supplier_number": item.supplier_number,
        "supplier_reference": item.supplier_reference, "legal_name": item.legal_name,
        "country_code": item.country_code, "currency": item.currency,
        "standard_lead_time_days": item.standard_lead_time_days,
        "qualified_materials": _json(item.qualified_materials_json, []),
        "qualification_evidence_reference": item.qualification_evidence_reference,
        "risk_level": item.risk_level, "lifecycle_status": item.lifecycle_status,
        "approval_reference": item.approval_reference, "approval_note": item.approval_note,
        "approved_by": item.approved_by, "approved_at": item.approved_at,
        "revision": item.revision, "updated_by": item.updated_by,
        "created_at": item.created_at, "updated_at": item.updated_at,
    }


def serialize_purchase_order(item: FactoryPurchaseOrder) -> dict[str, object]:
    return {
        "id": item.id, "project_id": item.project_id, "tenant_id": item.tenant_id,
        "client_id": item.client_id, "plan_id": item.plan_id,
        "purchase_order_number": item.purchase_order_number,
        "supplier_id": item.supplier_id, "supplier_number": item.supplier_number,
        "supplier_reference": item.supplier_reference, "demand_order_id": item.demand_order_id,
        "demand_order_number": item.demand_order_number,
        "engineering_version_id": item.engineering_version_id, "engineering_number": item.engineering_number,
        "product_reference": item.product_reference, "sku_reference": item.sku_reference,
        "currency": item.currency, "lines": _json(item.lines_json, []), "subtotal": f"{Decimal(item.subtotal):.2f}",
        "needed_by": item.needed_by, "lifecycle_status": item.lifecycle_status,
        "review_note": item.review_note, "approval_reference": item.approval_reference,
        "issue_document_reference": item.issue_document_reference,
        "acknowledgement_reference": item.acknowledgement_reference,
        "promised_delivery_at": item.promised_delivery_at,
        "receiving_reference": item.receiving_reference,
        "received_quantities": _json(item.received_quantities_json, []),
        "received_at": item.received_at, "milestones": _json(item.milestones_json, []),
        "revision": item.revision, "updated_by": item.updated_by,
        "created_at": item.created_at, "updated_at": item.updated_at,
    }


class FactoryProcurementService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_workspace(self, *, project_id: int) -> dict[str, object]:
        suppliers = (await self.db.execute(select(FactorySupplier).where(
            FactorySupplier.project_id == project_id,
        ).order_by(FactorySupplier.created_at.desc()))).scalars().all()
        purchase_orders = (await self.db.execute(select(FactoryPurchaseOrder).where(
            FactoryPurchaseOrder.project_id == project_id,
        ).order_by(FactoryPurchaseOrder.created_at.desc()))).scalars().all()
        engineering = (await self.db.execute(select(FactoryEngineeringVersion).where(
            FactoryEngineeringVersion.project_id == project_id,
            FactoryEngineeringVersion.lifecycle_status == "released",
        ).order_by(FactoryEngineeringVersion.created_at.desc()))).scalars().all()
        orders = (await self.db.execute(select(FactoryFulfillmentOrder).where(
            FactoryFulfillmentOrder.project_id == project_id,
            FactoryFulfillmentOrder.status.in_(ELIGIBLE_DEMAND_STATUSES),
        ).order_by(FactoryFulfillmentOrder.created_at.desc()))).scalars().all()
        return {
            "suppliers": [serialize_supplier(item) for item in suppliers],
            "purchase_orders": [serialize_purchase_order(item) for item in purchase_orders],
            "released_engineering_versions": [{
                "id": item.id, "engineering_number": item.engineering_number,
                "product_reference": item.product_reference, "sku_reference": item.sku_reference,
                "engineering_version": item.engineering_version,
                "bom_components": _json(item.bom_components_json, []),
            } for item in engineering],
            "eligible_demand_orders": [{
                "id": item.id, "order_number": item.order_number, "status": item.status,
                "lines": _json(item.lines_json, []),
            } for item in orders],
        }

    async def create_supplier(
        self, *, project_id: int, context: TenantContext, actor: str,
        supplier_reference: str, legal_name: str, country_code: str, currency: str,
        standard_lead_time_days: int, qualified_materials: list[str],
        qualification_evidence_reference: str, risk_level: str,
    ) -> dict[str, object]:
        reference = supplier_reference.strip()[:255]
        name = legal_name.strip()[:500]
        country = country_code.strip().upper()
        normalized_currency = currency.strip().upper()
        evidence = qualification_evidence_reference.strip()[:500]
        materials = list(dict.fromkeys(value.strip()[:255] for value in qualified_materials if value.strip()))
        if not reference or not name or len(country) != 2 or len(normalized_currency) != 3 or not evidence:
            raise ValueError("Supplier identity, country, currency and qualification evidence are required")
        if not 1 <= standard_lead_time_days <= 3650 or risk_level not in {"low", "medium", "high"}:
            raise ValueError("Supplier lead time and risk level are invalid")
        if not materials or len(materials) > 100:
            raise ValueError("Supplier qualification requires 1 to 100 material references")
        duplicate = await self.db.scalar(select(FactorySupplier.id).where(
            FactorySupplier.tenant_id == context.tenant_id,
            FactorySupplier.supplier_reference == reference,
        ))
        if duplicate:
            raise ValueError("Supplier reference already exists in this tenant")
        now = datetime.now(timezone.utc)
        item = FactorySupplier(
            id=f"supplier-{secrets.token_urlsafe(18)}", project_id=project_id,
            agent_path=context.agent_path, tenant_id=context.tenant_id, client_id=context.client_id,
            plan_id=context.plan_id or f"plan-{project_id}",
            supplier_number=f"SUP-{project_id}-{now:%Y%m%d%H%M%S}-{secrets.token_hex(3).upper()}",
            supplier_reference=reference, legal_name=name, country_code=country,
            currency=normalized_currency, standard_lead_time_days=standard_lead_time_days,
            qualified_materials_json=json.dumps(materials, ensure_ascii=False, separators=(",", ":")),
            qualification_evidence_reference=evidence, risk_level=risk_level, updated_by=actor,
        )
        self.db.add(item)
        await self.db.flush()
        return serialize_supplier(item)

    async def approve_supplier(
        self, supplier_id: str, *, project_id: int, expected_revision: int, actor: str,
        approval_reference: str, approval_note: str,
    ) -> dict[str, object]:
        item = await self._supplier(supplier_id, project_id)
        self._require_revision(item.revision, expected_revision, "Supplier")
        if item.lifecycle_status != "draft":
            raise ValueError("Only a draft supplier qualification can be approved")
        reference = approval_reference.strip()[:255]
        note = approval_note.strip()
        if not reference or len(note) < 8:
            raise ValueError("Supplier approval requires an approval reference and review note")
        item.lifecycle_status = "approved"
        item.approval_reference = reference
        item.approval_note = note
        item.approved_by = actor
        item.approved_at = datetime.now(timezone.utc)
        item.revision += 1
        item.updated_by = actor
        await self.db.flush()
        return serialize_supplier(item)

    async def create_purchase_order(
        self, *, project_id: int, context: TenantContext, actor: str, supplier_id: str,
        demand_order_id: str, engineering_version_id: str, needed_by: datetime,
        unit_prices: list[dict[str, object]],
    ) -> dict[str, object]:
        supplier = await self._supplier(supplier_id, project_id)
        if supplier.lifecycle_status != "approved":
            raise ValueError("Purchase orders require an approved supplier")
        engineering = await self.db.scalar(select(FactoryEngineeringVersion).where(
            FactoryEngineeringVersion.id == engineering_version_id,
            FactoryEngineeringVersion.project_id == project_id,
            FactoryEngineeringVersion.lifecycle_status == "released",
        ))
        if not engineering:
            raise ValueError("Purchase orders require a released engineering version in this tenant plan")
        order = await self.db.scalar(select(FactoryFulfillmentOrder).where(
            FactoryFulfillmentOrder.id == demand_order_id,
            FactoryFulfillmentOrder.project_id == project_id,
            FactoryFulfillmentOrder.status.in_(ELIGIBLE_DEMAND_STATUSES),
        ))
        if not order:
            raise ValueError("Purchase orders require an authoritative confirmed demand order")
        order_line = next((line for line in _json(order.lines_json, [])
                           if str(line.get("product_reference") or "") == engineering.product_reference
                           and str(line.get("sku_reference") or "") == engineering.sku_reference), None)
        if not order_line:
            raise ValueError("Engineering product and SKU must match the demand order line")
        order_quantity = _decimal(order_line.get("quantity"), "Demand order quantity")
        bom = _json(engineering.bom_components_json, [])
        qualified = set(_json(supplier.qualified_materials_json, []))
        material_refs = [str(component.get("material_reference") or "").strip() for component in bom]
        if not bom or any(not reference or reference not in qualified for reference in material_refs):
            raise ValueError("Approved supplier scope must cover every engineering BOM material")
        price_map: dict[str, Decimal] = {}
        for item in unit_prices:
            reference = str(item.get("material_reference") or "").strip()
            if not reference or reference in price_map:
                raise ValueError("Each BOM material needs exactly one unit price")
            price_map[reference] = _decimal(item.get("unit_price"), f"Unit price for {reference}")
        if set(material_refs) != set(price_map):
            raise ValueError("Unit prices must cover the released engineering BOM exactly")
        lines: list[dict[str, object]] = []
        subtotal = Decimal("0")
        for index, component in enumerate(bom, start=1):
            reference = str(component["material_reference"])
            required_quantity = (order_quantity * _decimal(component.get("quantity"), f"BOM quantity for {reference}"))
            unit_price = price_map[reference]
            line_total = (required_quantity * unit_price).quantize(MONEY, rounding=ROUND_HALF_UP)
            subtotal += line_total
            lines.append({
                "line_number": index, "material_reference": reference,
                "material_name": str(component.get("material_name") or reference)[:500],
                "required_quantity": str(required_quantity), "unit": str(component.get("unit") or "EA")[:30],
                "unit_price": str(unit_price.quantize(MONEY, rounding=ROUND_HALF_UP)),
                "line_total": str(line_total), "engineering_supplier_reference": component.get("supplier_reference"),
            })
        required_at = _utc(needed_by)
        if required_at <= datetime.now(timezone.utc):
            raise ValueError("Purchase order needed-by date must be in the future")
        now = datetime.now(timezone.utc)
        item = FactoryPurchaseOrder(
            id=f"purchase-{secrets.token_urlsafe(18)}", project_id=project_id,
            agent_path=context.agent_path, tenant_id=context.tenant_id, client_id=context.client_id,
            plan_id=context.plan_id or f"plan-{project_id}",
            purchase_order_number=f"PO-{project_id}-{now:%Y%m%d%H%M%S}-{secrets.token_hex(3).upper()}",
            supplier_id=supplier.id, supplier_number=supplier.supplier_number,
            supplier_reference=supplier.supplier_reference, demand_order_id=order.id,
            demand_order_number=order.order_number, engineering_version_id=engineering.id,
            engineering_number=engineering.engineering_number, product_reference=engineering.product_reference,
            sku_reference=engineering.sku_reference, currency=supplier.currency,
            lines_json=json.dumps(lines, ensure_ascii=False, separators=(",", ":")),
            subtotal=subtotal.quantize(MONEY), needed_by=required_at, updated_by=actor,
        )
        self.db.add(item)
        await self.db.flush()
        return serialize_purchase_order(item)

    async def transition_purchase_order(
        self, purchase_order_id: str, *, project_id: int, expected_revision: int, actor: str,
        action: str, note: str | None = None, approval_reference: str | None = None,
        issue_document_reference: str | None = None, acknowledgement_reference: str | None = None,
        promised_delivery_at: datetime | None = None, receiving_reference: str | None = None,
        received_quantities: list[dict[str, object]] | None = None,
    ) -> dict[str, object]:
        item = await self._purchase_order(purchase_order_id, project_id)
        self._require_revision(item.revision, expected_revision, "Purchase order")
        transition = PURCHASE_TRANSITIONS.get(action)
        if not transition:
            raise ValueError("Unsupported purchase-order action")
        expected, target = transition
        if item.lifecycle_status != expected:
            raise ValueError(f"Purchase-order action {action} requires status {expected}")
        clean_note = (note or "").strip()
        evidence = ""
        if action == "submit":
            if len(clean_note) < 8:
                raise ValueError("Purchase review submission requires a business justification")
            item.review_note = clean_note
            evidence = "review-submitted"
        elif action == "approve":
            evidence = (approval_reference or "").strip()[:255]
            if not evidence or len(clean_note) < 8:
                raise ValueError("Purchase approval requires approval evidence and a review note")
            item.approval_reference = evidence
            item.review_note = clean_note
        elif action == "issue":
            evidence = (issue_document_reference or "").strip()[:500]
            if not evidence:
                raise ValueError("Purchase issue requires the authorized purchase document reference")
            item.issue_document_reference = evidence
        elif action == "acknowledge":
            evidence = (acknowledgement_reference or "").strip()[:500]
            promised = _utc(promised_delivery_at) if promised_delivery_at else None
            if not evidence or not promised or promised <= datetime.now(timezone.utc):
                raise ValueError("Supplier acknowledgement requires evidence and a future promised delivery")
            item.acknowledgement_reference = evidence
            item.promised_delivery_at = promised
        elif action == "receive":
            evidence = (receiving_reference or "").strip()[:500]
            expected_lines = {str(line["material_reference"]): Decimal(str(line["required_quantity"])) for line in _json(item.lines_json, [])}
            actual: dict[str, Decimal] = {}
            for row in received_quantities or []:
                reference = str(row.get("material_reference") or "").strip()
                if not reference or reference in actual:
                    raise ValueError("Receiving evidence requires one quantity per purchase material")
                actual[reference] = _decimal(row.get("received_quantity"), f"Received quantity for {reference}")
            if not evidence or actual != expected_lines:
                raise ValueError("Goods receipt requires independent evidence and exact ordered quantities")
            item.receiving_reference = evidence
            item.received_quantities_json = json.dumps([
                {"material_reference": reference, "received_quantity": str(quantity)}
                for reference, quantity in actual.items()
            ], ensure_ascii=False, separators=(",", ":"))
            item.received_at = datetime.now(timezone.utc)
        milestones = _json(item.milestones_json, [])
        milestones.append({
            "action": action, "status": target, "evidenceReference": evidence,
            "note": clean_note, "recordedBy": actor, "occurredAt": datetime.now(timezone.utc).isoformat(),
        })
        item.milestones_json = json.dumps(milestones, ensure_ascii=False, separators=(",", ":"))
        item.lifecycle_status = target
        item.revision += 1
        item.updated_by = actor
        await self.db.flush()
        return serialize_purchase_order(item)

    async def _supplier(self, supplier_id: str, project_id: int) -> FactorySupplier:
        item = await self.db.scalar(select(FactorySupplier).where(
            FactorySupplier.id == supplier_id, FactorySupplier.project_id == project_id,
        ))
        if not item:
            raise KeyError("Supplier not found in this tenant plan")
        return item

    async def _purchase_order(self, purchase_order_id: str, project_id: int) -> FactoryPurchaseOrder:
        item = await self.db.scalar(select(FactoryPurchaseOrder).where(
            FactoryPurchaseOrder.id == purchase_order_id, FactoryPurchaseOrder.project_id == project_id,
        ))
        if not item:
            raise KeyError("Purchase order not found in this tenant plan")
        return item

    @staticmethod
    def _require_revision(actual: int, expected: int, label: str) -> None:
        if actual != expected:
            raise ValueError(f"{label} changed; refresh before continuing")
