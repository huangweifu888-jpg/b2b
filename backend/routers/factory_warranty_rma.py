"""Tenant-scoped warranty eligibility, return and remedy APIs."""

from __future__ import annotations

from decimal import Decimal
from typing import Literal

from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.factory_warranty_rma import FactoryWarrantyRmaService
from services.tenant_access import require_project_access, require_project_permission
from sqlalchemy.ext.asyncio import AsyncSession


router = APIRouter(
    prefix="/api/v1/factory-platform/projects/{project_id}/warranty-rma",
    tags=["factory-platform-warranty-rma"],
)

RMA_MANAGE = "factory.care.rma.manage"
RMA_AUTHORIZE = "factory.care.rma.authorize"
RMA_RECEIVE = "factory.care.rma.receive"
RMA_INSPECT = "factory.care.rma.inspect"
RMA_DISPOSITION = "factory.care.rma.disposition"


class RmaCaseCreate(BaseModel):
    asset_id: str = Field(min_length=1, max_length=100)
    service_ticket_id: str = Field(min_length=1, max_length=100)
    claim_reference: str = Field(min_length=1, max_length=255)
    claim_summary: str = Field(min_length=8, max_length=4000)
    requested_remedy: Literal["repair", "replace", "refund"]


class RmaSubmit(BaseModel):
    expected_revision: int = Field(gt=0)
    submission_reference: str = Field(min_length=1, max_length=500)


class RmaAuthorize(BaseModel):
    expected_revision: int = Field(gt=0)
    authorization_reference: str = Field(min_length=1, max_length=500)
    return_instructions: str = Field(min_length=8, max_length=4000)
    goodwill_reference: str | None = Field(default=None, max_length=500)


class RmaShip(BaseModel):
    expected_revision: int = Field(gt=0)
    return_shipment_reference: str = Field(min_length=1, max_length=500)


class RmaReceive(BaseModel):
    expected_revision: int = Field(gt=0)
    warehouse_receipt_reference: str = Field(min_length=1, max_length=500)
    received_condition: str = Field(min_length=8, max_length=4000)


class RmaInspect(BaseModel):
    expected_revision: int = Field(gt=0)
    inspection_reference: str = Field(min_length=1, max_length=500)
    inspection_result: Literal["manufacturing-defect", "customer-damage", "logistics-damage", "no-fault-found"]
    inspection_note: str = Field(min_length=8, max_length=4000)
    quality_evidence_reference: str | None = Field(default=None, max_length=500)


class RmaDisposition(BaseModel):
    expected_revision: int = Field(gt=0)
    disposition: Literal["repair", "replace", "refund", "reject", "scrap"]
    responsibility: Literal["manufacturer", "customer", "logistics", "supplier"]
    disposition_approval_reference: str = Field(min_length=1, max_length=500)
    currency: str = Field(min_length=3, max_length=3)
    estimated_parts_cost: Decimal = Field(ge=0)
    estimated_labor_cost: Decimal = Field(ge=0)
    estimated_logistics_cost: Decimal = Field(ge=0)
    finance_followup_reference: str | None = Field(default=None, max_length=500)
    supplier_recovery_reference: str | None = Field(default=None, max_length=500)


class RmaClose(BaseModel):
    expected_revision: int = Field(gt=0)
    remedy_evidence_reference: str = Field(min_length=1, max_length=500)
    customer_acknowledgement_reference: str = Field(min_length=1, max_length=500)


def _not_found(exc: KeyError) -> HTTPException:
    return HTTPException(status_code=404, detail=str(exc).strip("'"))


def _conflict(exc: ValueError) -> HTTPException:
    return HTTPException(status_code=409, detail=str(exc))


def _audit(
    db: AsyncSession, request: Request, current_user: UserResponse,
    *, action: str, item: dict[str, object], project_id: int,
) -> None:
    record_audit_event(
        db, action=action, actor_user_id=current_user.id,
        target_type="factory_warranty_rma_case", target_id=str(item["id"]),
        ip_address=request.client.host if request.client else None,
        detail={
            "project_id": project_id, "rma_number": item["rma_number"],
            "claim_reference": item["claim_reference"],
            "asset_number": item["asset_number"],
            "service_ticket_number": item["service_ticket_number"],
            "lifecycle_status": item["lifecycle_status"],
            "eligibility_status": item["eligibility_status"],
            "disposition": item["disposition"], "responsibility": item["responsibility"],
            "estimated_total_cost": item["estimated_total_cost"],
            "revision": item["revision"],
        },
    )


async def _run(task):
    try:
        return await task
    except KeyError as exc:
        raise _not_found(exc) from exc
    except ValueError as exc:
        raise _conflict(exc) from exc


@router.get("")
async def list_warranty_rma_workspace(
    project_id: int, db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    await require_project_access(db, current_user=current_user, project_id=project_id)
    return await FactoryWarrantyRmaService(db).list_workspace(project_id=project_id)


@router.post("")
async def create_warranty_rma_case(
    project_id: int, payload: RmaCaseCreate, request: Request,
    db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user),
):
    resolved = await require_project_permission(db, current_user=current_user, project_id=project_id, permission=RMA_MANAGE)
    item = await _run(FactoryWarrantyRmaService(db).create_case(project_id=project_id, context=resolved.context, actor=current_user.id, **payload.model_dump()))
    _audit(db, request, current_user, action="factory_warranty_rma_created", item=item, project_id=project_id)
    await db.commit()
    return item


@router.post("/{case_id}/submit")
async def submit_warranty_rma_case(
    project_id: int, case_id: str, payload: RmaSubmit, request: Request,
    db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user),
):
    await require_project_permission(db, current_user=current_user, project_id=project_id, permission=RMA_MANAGE)
    item = await _run(FactoryWarrantyRmaService(db).submit_case(case_id, project_id=project_id, actor=current_user.id, **payload.model_dump()))
    _audit(db, request, current_user, action="factory_warranty_rma_submitted", item=item, project_id=project_id)
    await db.commit()
    return item


@router.post("/{case_id}/authorize")
async def authorize_warranty_rma_case(
    project_id: int, case_id: str, payload: RmaAuthorize, request: Request,
    db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user),
):
    await require_project_permission(db, current_user=current_user, project_id=project_id, permission=RMA_AUTHORIZE)
    item = await _run(FactoryWarrantyRmaService(db).authorize_case(case_id, project_id=project_id, actor=current_user.id, **payload.model_dump()))
    _audit(db, request, current_user, action="factory_warranty_rma_authorized", item=item, project_id=project_id)
    await db.commit()
    return item


@router.post("/{case_id}/ship")
async def ship_warranty_rma_return(
    project_id: int, case_id: str, payload: RmaShip, request: Request,
    db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user),
):
    await require_project_permission(db, current_user=current_user, project_id=project_id, permission=RMA_MANAGE)
    item = await _run(FactoryWarrantyRmaService(db).ship_return(case_id, project_id=project_id, actor=current_user.id, **payload.model_dump()))
    _audit(db, request, current_user, action="factory_warranty_rma_return_shipped", item=item, project_id=project_id)
    await db.commit()
    return item


@router.post("/{case_id}/receive")
async def receive_warranty_rma_return(
    project_id: int, case_id: str, payload: RmaReceive, request: Request,
    db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user),
):
    await require_project_permission(db, current_user=current_user, project_id=project_id, permission=RMA_RECEIVE)
    item = await _run(FactoryWarrantyRmaService(db).receive_return(case_id, project_id=project_id, actor=current_user.id, **payload.model_dump()))
    _audit(db, request, current_user, action="factory_warranty_rma_return_received", item=item, project_id=project_id)
    await db.commit()
    return item


@router.post("/{case_id}/inspect")
async def inspect_warranty_rma_return(
    project_id: int, case_id: str, payload: RmaInspect, request: Request,
    db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user),
):
    await require_project_permission(db, current_user=current_user, project_id=project_id, permission=RMA_INSPECT)
    item = await _run(FactoryWarrantyRmaService(db).inspect_return(case_id, project_id=project_id, actor=current_user.id, **payload.model_dump()))
    _audit(db, request, current_user, action="factory_warranty_rma_inspected", item=item, project_id=project_id)
    await db.commit()
    return item


@router.post("/{case_id}/disposition")
async def approve_warranty_rma_disposition(
    project_id: int, case_id: str, payload: RmaDisposition, request: Request,
    db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user),
):
    await require_project_permission(db, current_user=current_user, project_id=project_id, permission=RMA_DISPOSITION)
    item = await _run(FactoryWarrantyRmaService(db).approve_disposition(case_id, project_id=project_id, actor=current_user.id, **payload.model_dump()))
    _audit(db, request, current_user, action="factory_warranty_rma_disposition_approved", item=item, project_id=project_id)
    await db.commit()
    return item


@router.post("/{case_id}/close")
async def close_warranty_rma_case(
    project_id: int, case_id: str, payload: RmaClose, request: Request,
    db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user),
):
    await require_project_permission(db, current_user=current_user, project_id=project_id, permission=RMA_DISPOSITION)
    item = await _run(FactoryWarrantyRmaService(db).close_case(case_id, project_id=project_id, actor=current_user.id, **payload.model_dump()))
    _audit(db, request, current_user, action="factory_warranty_rma_closed", item=item, project_id=project_id)
    await db.commit()
    return item
