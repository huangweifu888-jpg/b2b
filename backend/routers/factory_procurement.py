"""Tenant-scoped supplier and purchase-order APIs."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.factory_procurement import FactoryProcurementService
from services.tenant_access import require_project_access, require_project_permission
from sqlalchemy.ext.asyncio import AsyncSession


router = APIRouter(
    prefix="/api/v1/factory-platform/projects/{project_id}/procurement",
    tags=["factory-platform-procurement"],
)

SUPPLIER_MANAGE = "factory.fulfillment.supplier.manage"
PURCHASE_MANAGE = "factory.fulfillment.purchase.manage"
PURCHASE_APPROVE = "factory.fulfillment.purchase.approve"
RECEIVING_RECORD = "factory.fulfillment.receiving.record"


class SupplierCreate(BaseModel):
    supplier_reference: str = Field(min_length=1, max_length=255)
    legal_name: str = Field(min_length=1, max_length=500)
    country_code: str = Field(min_length=2, max_length=2)
    currency: str = Field(min_length=3, max_length=3)
    standard_lead_time_days: int = Field(gt=0, le=3650)
    qualified_materials: list[str] = Field(min_length=1, max_length=100)
    qualification_evidence_reference: str = Field(min_length=1, max_length=500)
    risk_level: Literal["low", "medium", "high"] = "medium"


class SupplierApproval(BaseModel):
    expected_revision: int = Field(gt=0)
    approval_reference: str = Field(min_length=1, max_length=255)
    approval_note: str = Field(min_length=8, max_length=2000)


class MaterialPrice(BaseModel):
    material_reference: str = Field(min_length=1, max_length=255)
    unit_price: str = Field(min_length=1, max_length=50)


class PurchaseOrderCreate(BaseModel):
    supplier_id: str = Field(min_length=1, max_length=100)
    demand_order_id: str = Field(min_length=1, max_length=100)
    engineering_version_id: str = Field(min_length=1, max_length=100)
    needed_by: datetime
    unit_prices: list[MaterialPrice] = Field(min_length=1, max_length=100)


class ReceivedQuantity(BaseModel):
    material_reference: str = Field(min_length=1, max_length=255)
    received_quantity: str = Field(min_length=1, max_length=50)


class PurchaseOrderTransition(BaseModel):
    expected_revision: int = Field(gt=0)
    action: Literal["submit", "approve", "issue", "acknowledge", "receive"]
    note: str | None = Field(default=None, max_length=2000)
    approval_reference: str | None = Field(default=None, max_length=255)
    issue_document_reference: str | None = Field(default=None, max_length=500)
    acknowledgement_reference: str | None = Field(default=None, max_length=500)
    promised_delivery_at: datetime | None = None
    receiving_reference: str | None = Field(default=None, max_length=500)
    received_quantities: list[ReceivedQuantity] | None = Field(default=None, max_length=100)


@router.get("")
async def list_procurement_workspace(
    project_id: int, db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    await require_project_access(db, current_user=current_user, project_id=project_id)
    return await FactoryProcurementService(db).list_workspace(project_id=project_id)


@router.post("/suppliers")
async def create_supplier(
    project_id: int, payload: SupplierCreate, request: Request,
    db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user),
):
    resolved = await require_project_permission(db, current_user=current_user, project_id=project_id, permission=SUPPLIER_MANAGE)
    try:
        item = await FactoryProcurementService(db).create_supplier(
            project_id=project_id, context=resolved.context, actor=current_user.id, **payload.model_dump(),
        )
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    record_audit_event(db, action="factory_supplier_created", actor_user_id=current_user.id, target_type="factory_supplier", target_id=item["id"], ip_address=request.client.host if request.client else None, detail={"project_id": project_id, "supplier_number": item["supplier_number"], "supplier_reference": item["supplier_reference"], "risk_level": item["risk_level"], "qualified_material_count": len(item["qualified_materials"])})
    await db.commit()
    return item


@router.post("/suppliers/{supplier_id}/approve")
async def approve_supplier(
    project_id: int, supplier_id: str, payload: SupplierApproval, request: Request,
    db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user),
):
    await require_project_permission(db, current_user=current_user, project_id=project_id, permission=SUPPLIER_MANAGE)
    try:
        item = await FactoryProcurementService(db).approve_supplier(
            supplier_id, project_id=project_id, actor=current_user.id, **payload.model_dump(),
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    record_audit_event(db, action="factory_supplier_approved", actor_user_id=current_user.id, target_type="factory_supplier", target_id=supplier_id, ip_address=request.client.host if request.client else None, detail={"project_id": project_id, "supplier_number": item["supplier_number"], "approval_reference": item["approval_reference"], "revision": item["revision"]})
    await db.commit()
    return item


@router.post("/purchase-orders")
async def create_purchase_order(
    project_id: int, payload: PurchaseOrderCreate, request: Request,
    db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user),
):
    resolved = await require_project_permission(db, current_user=current_user, project_id=project_id, permission=PURCHASE_MANAGE)
    try:
        item = await FactoryProcurementService(db).create_purchase_order(
            project_id=project_id, context=resolved.context, actor=current_user.id,
            **payload.model_dump(),
        )
    except (KeyError, ValueError) as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    record_audit_event(db, action="factory_purchase_order_created", actor_user_id=current_user.id, target_type="factory_purchase_order", target_id=item["id"], ip_address=request.client.host if request.client else None, detail={"project_id": project_id, "purchase_order_number": item["purchase_order_number"], "supplier_number": item["supplier_number"], "demand_order_number": item["demand_order_number"], "engineering_number": item["engineering_number"], "subtotal": item["subtotal"], "currency": item["currency"]})
    await db.commit()
    return item


@router.post("/purchase-orders/{purchase_order_id}/transition")
async def transition_purchase_order(
    project_id: int, purchase_order_id: str, payload: PurchaseOrderTransition, request: Request,
    db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user),
):
    permission = PURCHASE_APPROVE if payload.action == "approve" else RECEIVING_RECORD if payload.action == "receive" else PURCHASE_MANAGE
    await require_project_permission(db, current_user=current_user, project_id=project_id, permission=permission)
    try:
        item = await FactoryProcurementService(db).transition_purchase_order(
            purchase_order_id, project_id=project_id, actor=current_user.id, **payload.model_dump(),
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    record_audit_event(db, action=f"factory_purchase_order_{payload.action}", actor_user_id=current_user.id, target_type="factory_purchase_order", target_id=purchase_order_id, ip_address=request.client.host if request.client else None, detail={"project_id": project_id, "purchase_order_number": item["purchase_order_number"], "status": item["lifecycle_status"], "supplier_number": item["supplier_number"], "evidence_reference": item["milestones"][-1]["evidenceReference"], "revision": item["revision"]})
    await db.commit()
    return item
