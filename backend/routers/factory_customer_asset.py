"""Tenant-scoped customer asset, service and renewal APIs."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.factory_customer_asset import FactoryCustomerAssetService
from services.tenant_access import require_project_access, require_project_permission
from sqlalchemy.ext.asyncio import AsyncSession


router = APIRouter(prefix="/api/v1/factory-platform/projects/{project_id}/customer-assets", tags=["factory-platform-customer-assets"])

ASSET_REGISTER = "factory.care.asset.register"
SERVICE_MANAGE = "factory.care.service.manage"
RENEWAL_MANAGE = "factory.care.renewal.manage"


class AssetRegistration(BaseModel):
    order_id: str = Field(min_length=1, max_length=100)
    product_reference: str = Field(min_length=1, max_length=255)
    sku_reference: str = Field(min_length=1, max_length=255)
    serial_number: str = Field(min_length=1, max_length=255)
    installation_location: str = Field(min_length=1, max_length=500)
    installed_at: datetime
    warranty_until: datetime
    next_service_due_at: datetime


class TicketCreate(BaseModel):
    issue_summary: str = Field(min_length=4, max_length=1000)
    severity: Literal["critical", "high", "medium", "low"] = "medium"


class TicketTransition(BaseModel):
    expected_revision: int = Field(gt=0)
    action: Literal["schedule", "start", "resolve"]
    assigned_to: str | None = Field(default=None, max_length=255)
    scheduled_for: datetime | None = None
    resolution_reference: str | None = Field(default=None, max_length=255)
    resolution_note: str | None = Field(default=None, max_length=2000)
    next_service_due_at: datetime | None = None


class WarrantyAction(BaseModel):
    expected_revision: int = Field(gt=0)
    renewal_owner: str = Field(min_length=1, max_length=255)
    renewal_action: str = Field(min_length=4, max_length=2000)


@router.get("")
async def list_customer_assets(project_id: int, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    await require_project_access(db, current_user=current_user, project_id=project_id)
    return await FactoryCustomerAssetService(db).list_workspace(project_id=project_id)


@router.post("")
async def register_customer_asset(project_id: int, payload: AssetRegistration, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    resolved = await require_project_permission(db, current_user=current_user, project_id=project_id, permission=ASSET_REGISTER)
    try:
        item = await FactoryCustomerAssetService(db).register_asset(project_id=project_id, context=resolved.context, actor=current_user.id, **payload.model_dump())
    except (KeyError, ValueError) as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    record_audit_event(db, action="factory_customer_asset_registered", actor_user_id=current_user.id, target_type="factory_customer_asset", target_id=item["id"], ip_address=request.client.host if request.client else None, detail={"project_id": project_id, "asset_number": item["asset_number"], "order_id": item["order_id"], "serial_number": item["serial_number"]})
    await db.commit()
    return item


@router.post("/{asset_id}/tickets")
async def create_service_ticket(project_id: int, asset_id: str, payload: TicketCreate, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    resolved = await require_project_permission(db, current_user=current_user, project_id=project_id, permission=SERVICE_MANAGE)
    try:
        item = await FactoryCustomerAssetService(db).create_ticket(asset_id, project_id=project_id, context=resolved.context, actor=current_user.id, issue_summary=payload.issue_summary, severity=payload.severity)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    ticket = item["ticket"]
    record_audit_event(db, action="factory_asset_service_ticket_created", actor_user_id=current_user.id, target_type="factory_asset_service_ticket", target_id=ticket["id"], ip_address=request.client.host if request.client else None, detail={"project_id": project_id, "asset_id": asset_id, "ticket_number": ticket["ticket_number"], "severity": ticket["severity"], "sla_due_at": str(ticket["sla_due_at"])})
    await db.commit()
    return item


@router.post("/tickets/{ticket_id}/transition")
async def transition_service_ticket(project_id: int, ticket_id: str, payload: TicketTransition, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    await require_project_permission(db, current_user=current_user, project_id=project_id, permission=SERVICE_MANAGE)
    try:
        item = await FactoryCustomerAssetService(db).transition_ticket(ticket_id, project_id=project_id, actor=current_user.id, **payload.model_dump())
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    ticket = item["ticket"]
    record_audit_event(db, action=f"factory_asset_service_ticket_{payload.action}", actor_user_id=current_user.id, target_type="factory_asset_service_ticket", target_id=ticket_id, ip_address=request.client.host if request.client else None, detail={"project_id": project_id, "asset_id": ticket["asset_id"], "ticket_number": ticket["ticket_number"], "status": ticket["status"], "revision": ticket["revision"], "resolution_reference": ticket["resolution_reference"]})
    await db.commit()
    return item


@router.post("/{asset_id}/warranty-action")
async def flag_warranty_action(project_id: int, asset_id: str, payload: WarrantyAction, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    await require_project_permission(db, current_user=current_user, project_id=project_id, permission=RENEWAL_MANAGE)
    try:
        item = await FactoryCustomerAssetService(db).flag_warranty(asset_id, project_id=project_id, expected_revision=payload.expected_revision, actor=current_user.id, renewal_owner=payload.renewal_owner, renewal_action=payload.renewal_action)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    record_audit_event(db, action="factory_customer_asset_warranty_flagged", actor_user_id=current_user.id, target_type="factory_customer_asset", target_id=asset_id, ip_address=request.client.host if request.client else None, detail={"project_id": project_id, "asset_number": item["asset_number"], "renewal_status": item["renewal_status"], "renewal_owner": item["renewal_owner"]})
    await db.commit()
    return item
