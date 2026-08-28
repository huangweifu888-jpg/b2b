"""Tenant-scoped field-service dispatch, onsite evidence and SLA APIs."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Literal

from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.factory_field_service import FactoryFieldService
from services.tenant_access import require_project_access, require_project_permission
from sqlalchemy.ext.asyncio import AsyncSession


router = APIRouter(
    prefix="/api/v1/factory-platform/projects/{project_id}/field-service",
    tags=["factory-platform-field-service"],
)

FIELD_SERVICE_MANAGE = "factory.care.field-service.manage"
FIELD_SERVICE_DISPATCH = "factory.care.field-service.dispatch"
FIELD_SERVICE_EXECUTE = "factory.care.field-service.execute"
FIELD_SERVICE_COMPLETE = "factory.care.field-service.complete"


class ServiceTicketCreate(BaseModel):
    asset_id: str = Field(min_length=1, max_length=100)
    issue_summary: str = Field(min_length=8, max_length=2000)
    severity: Literal["low", "medium", "high", "critical"]


class TechnicianCreate(BaseModel):
    technician_reference: str = Field(min_length=1, max_length=255)
    technician_name: str = Field(min_length=1, max_length=500)
    skills: list[str] = Field(min_length=1, max_length=50)
    service_regions: list[str] = Field(min_length=1, max_length=50)


class TechnicianApprove(BaseModel):
    expected_revision: int = Field(gt=0)
    approval_reference: str = Field(min_length=1, max_length=500)


class FieldDispatch(BaseModel):
    technician_id: str = Field(min_length=1, max_length=100)
    scheduled_for: datetime
    escalation_reference: str | None = Field(default=None, max_length=500)


class VisitTransition(BaseModel):
    expected_revision: int = Field(gt=0)
    action: Literal["depart", "arrive", "start"]
    evidence_reference: str = Field(min_length=1, max_length=500)
    arrival_location: str | None = Field(default=None, max_length=500)


class WorkEntryCreate(BaseModel):
    entry_type: Literal["diagnostic", "labor", "part"]
    description: str = Field(min_length=8, max_length=4000)
    evidence_reference: str = Field(min_length=1, max_length=500)
    labor_minutes: int = Field(default=0, ge=0)
    part_reference: str | None = Field(default=None, max_length=255)
    quantity: Decimal = Field(default=Decimal("0"), ge=0)
    unit: str | None = Field(default=None, max_length=50)
    stock_evidence_reference: str | None = Field(default=None, max_length=500)


class VisitComplete(BaseModel):
    expected_revision: int = Field(gt=0)
    resolution_reference: str = Field(min_length=1, max_length=500)
    resolution_note: str = Field(min_length=8, max_length=4000)
    customer_signer: str = Field(min_length=1, max_length=500)
    customer_signoff_reference: str = Field(min_length=1, max_length=500)
    next_service_due_at: datetime
    escalation_reference: str | None = Field(default=None, max_length=500)


def _not_found(exc: KeyError) -> HTTPException:
    return HTTPException(status_code=404, detail=str(exc).strip("'"))


def _conflict(exc: ValueError) -> HTTPException:
    return HTTPException(status_code=409, detail=str(exc))


@router.get("")
async def list_field_service_workspace(
    project_id: int, db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    await require_project_access(db, current_user=current_user, project_id=project_id)
    return await FactoryFieldService(db).list_workspace(project_id=project_id)


@router.post("/tickets")
async def create_field_service_ticket(
    project_id: int, payload: ServiceTicketCreate, request: Request,
    db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user),
):
    resolved = await require_project_permission(db, current_user=current_user, project_id=project_id, permission=FIELD_SERVICE_MANAGE)
    try:
        item = await FactoryFieldService(db).create_ticket(
            payload.asset_id, project_id=project_id, context=resolved.context,
            actor=current_user.id, issue_summary=payload.issue_summary, severity=payload.severity,
        )
    except KeyError as exc:
        raise _not_found(exc) from exc
    except ValueError as exc:
        raise _conflict(exc) from exc
    ticket = item["ticket"]
    record_audit_event(db, action="factory_field_service_ticket_created", actor_user_id=current_user.id, target_type="factory_asset_service_ticket", target_id=ticket["id"], ip_address=request.client.host if request.client else None, detail={"project_id": project_id, "ticket_number": ticket["ticket_number"], "asset_number": ticket["asset_number"], "severity": ticket["severity"], "sla_due_at": str(ticket["sla_due_at"])})
    await db.commit()
    return item


@router.post("/technicians")
async def create_field_service_technician(
    project_id: int, payload: TechnicianCreate, request: Request,
    db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user),
):
    resolved = await require_project_permission(db, current_user=current_user, project_id=project_id, permission=FIELD_SERVICE_MANAGE)
    try:
        item = await FactoryFieldService(db).create_technician(project_id=project_id, context=resolved.context, actor=current_user.id, **payload.model_dump())
    except ValueError as exc:
        raise _conflict(exc) from exc
    record_audit_event(db, action="factory_field_service_technician_created", actor_user_id=current_user.id, target_type="factory_field_service_technician", target_id=item["id"], ip_address=request.client.host if request.client else None, detail={"project_id": project_id, "technician_number": item["technician_number"], "skills": item["skills"], "service_regions": item["service_regions"]})
    await db.commit()
    return item


@router.post("/technicians/{technician_id}/approve")
async def approve_field_service_technician(
    project_id: int, technician_id: str, payload: TechnicianApprove, request: Request,
    db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user),
):
    await require_project_permission(db, current_user=current_user, project_id=project_id, permission=FIELD_SERVICE_MANAGE)
    try:
        item = await FactoryFieldService(db).approve_technician(technician_id, project_id=project_id, actor=current_user.id, **payload.model_dump())
    except KeyError as exc:
        raise _not_found(exc) from exc
    except ValueError as exc:
        raise _conflict(exc) from exc
    record_audit_event(db, action="factory_field_service_technician_approved", actor_user_id=current_user.id, target_type="factory_field_service_technician", target_id=item["id"], ip_address=request.client.host if request.client else None, detail={"project_id": project_id, "technician_number": item["technician_number"], "approval_reference": item["approval_reference"], "revision": item["revision"]})
    await db.commit()
    return item


@router.post("/tickets/{ticket_id}/dispatch")
async def dispatch_field_service_visit(
    project_id: int, ticket_id: str, payload: FieldDispatch, request: Request,
    db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user),
):
    resolved = await require_project_permission(db, current_user=current_user, project_id=project_id, permission=FIELD_SERVICE_DISPATCH)
    try:
        item = await FactoryFieldService(db).dispatch(ticket_id, project_id=project_id, context=resolved.context, actor=current_user.id, **payload.model_dump())
    except KeyError as exc:
        raise _not_found(exc) from exc
    except ValueError as exc:
        raise _conflict(exc) from exc
    visit = item["visit"]
    record_audit_event(db, action="factory_field_service_visit_dispatched", actor_user_id=current_user.id, target_type="factory_field_service_visit", target_id=visit["id"], ip_address=request.client.host if request.client else None, detail={"project_id": project_id, "visit_number": visit["visit_number"], "ticket_number": visit["service_ticket_number"], "technician_number": visit["technician_number"], "scheduled_for": str(visit["scheduled_for"]), "sla_due_at": str(visit["sla_due_at"]), "escalation_reference": visit["escalation_reference"]})
    await db.commit()
    return item


@router.post("/visits/{visit_id}/transition")
async def transition_field_service_visit(
    project_id: int, visit_id: str, payload: VisitTransition, request: Request,
    db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user),
):
    await require_project_permission(db, current_user=current_user, project_id=project_id, permission=FIELD_SERVICE_EXECUTE)
    try:
        item = await FactoryFieldService(db).transition_visit(visit_id, project_id=project_id, actor=current_user.id, **payload.model_dump())
    except KeyError as exc:
        raise _not_found(exc) from exc
    except ValueError as exc:
        raise _conflict(exc) from exc
    visit = item["visit"]
    record_audit_event(db, action=f"factory_field_service_visit_{payload.action}", actor_user_id=current_user.id, target_type="factory_field_service_visit", target_id=visit["id"], ip_address=request.client.host if request.client else None, detail={"project_id": project_id, "visit_number": visit["visit_number"], "lifecycle_status": visit["lifecycle_status"], "evidence_reference": payload.evidence_reference, "arrival_location": payload.arrival_location, "revision": visit["revision"]})
    await db.commit()
    return item


@router.post("/visits/{visit_id}/entries")
async def add_field_service_entry(
    project_id: int, visit_id: str, payload: WorkEntryCreate, request: Request,
    db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user),
):
    resolved = await require_project_permission(db, current_user=current_user, project_id=project_id, permission=FIELD_SERVICE_EXECUTE)
    try:
        item = await FactoryFieldService(db).add_entry(visit_id, project_id=project_id, context=resolved.context, actor=current_user.id, **payload.model_dump())
    except KeyError as exc:
        raise _not_found(exc) from exc
    except ValueError as exc:
        raise _conflict(exc) from exc
    entry = item["entry"]
    record_audit_event(db, action="factory_field_service_entry_recorded", actor_user_id=current_user.id, target_type="factory_field_service_entry", target_id=entry["id"], ip_address=request.client.host if request.client else None, detail={"project_id": project_id, "visit_number": entry["visit_number"], "entry_number": entry["entry_number"], "entry_type": entry["entry_type"], "evidence_reference": entry["evidence_reference"], "stock_evidence_reference": entry["stock_evidence_reference"]})
    await db.commit()
    return item


@router.post("/visits/{visit_id}/complete")
async def complete_field_service_visit(
    project_id: int, visit_id: str, payload: VisitComplete, request: Request,
    db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user),
):
    await require_project_permission(db, current_user=current_user, project_id=project_id, permission=FIELD_SERVICE_COMPLETE)
    try:
        item = await FactoryFieldService(db).complete_visit(visit_id, project_id=project_id, actor=current_user.id, **payload.model_dump())
    except KeyError as exc:
        raise _not_found(exc) from exc
    except ValueError as exc:
        raise _conflict(exc) from exc
    visit = item["visit"]
    record_audit_event(db, action="factory_field_service_visit_completed", actor_user_id=current_user.id, target_type="factory_field_service_visit", target_id=visit["id"], ip_address=request.client.host if request.client else None, detail={"project_id": project_id, "visit_number": visit["visit_number"], "ticket_number": visit["service_ticket_number"], "sla_status": visit["sla_status"], "customer_signer": visit["customer_signer"], "customer_signoff_reference": visit["customer_signoff_reference"], "resolution_reference": visit["resolution_reference"], "labor_minutes": visit["total_labor_minutes"], "parts": visit["parts_summary"], "revision": visit["revision"]})
    await db.commit()
    return item
