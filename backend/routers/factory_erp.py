"""Tenant-scoped operating ERP master, posting and period-close APIs."""

from datetime import date
from typing import Literal

from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.factory_erp import FactoryErpService
from services.tenant_access import require_project_access, require_project_permission
from sqlalchemy.ext.asyncio import AsyncSession


router = APIRouter(prefix="/api/v1/factory-platform/projects/{project_id}/erp", tags=["factory-platform-erp"])
MASTER_MANAGE = "factory.operations.erp.master.manage"
MASTER_APPROVE = "factory.operations.erp.master.approve"
PROJECT_REGISTER = "factory.operations.erp.order-project.register"
POSTING_MANAGE = "factory.operations.erp.posting.manage"
POSTING_APPROVE = "factory.operations.erp.posting.approve"
PERIOD_MANAGE = "factory.operations.erp.period.manage"
PERIOD_CLOSE = "factory.operations.erp.period.close"


class UnitCreate(BaseModel):
    unit_reference: str = Field(min_length=1, max_length=255)
    unit_code: str = Field(min_length=2, max_length=100)
    unit_name: str = Field(min_length=1, max_length=255)
    unit_type: Literal["legal-entity", "factory", "branch"]
    base_currency: str = Field(min_length=3, max_length=3)
    manager: str = Field(min_length=1, max_length=255)


class CostCenterCreate(BaseModel):
    operating_unit_id: str = Field(min_length=1, max_length=100)
    center_reference: str = Field(min_length=1, max_length=255)
    center_code: str = Field(min_length=2, max_length=100)
    center_name: str = Field(min_length=1, max_length=255)
    center_type: Literal["sales", "production", "procurement", "quality", "service", "administration"]
    owner: str = Field(min_length=1, max_length=255)


class OrderProjectCreate(BaseModel):
    operating_unit_id: str = Field(min_length=1, max_length=100)
    order_id: str = Field(min_length=1, max_length=100)
    project_reference: str = Field(min_length=1, max_length=255)


class PeriodCreate(BaseModel):
    operating_unit_id: str = Field(min_length=1, max_length=100)
    period_reference: str = Field(min_length=1, max_length=255)
    period_code: str = Field(pattern=r"^20\d{2}-(0[1-9]|1[0-2])$")


class PostingCreate(BaseModel):
    posting_reference: str = Field(min_length=1, max_length=255)
    period_id: str = Field(min_length=1, max_length=100)
    order_project_id: str = Field(min_length=1, max_length=100)
    cost_center_id: str = Field(min_length=1, max_length=100)
    posting_date: date
    category: Literal["order-revenue", "material", "labor", "logistics", "service", "overhead", "adjustment"]
    direction: Literal["inflow", "outflow"]
    amount: str = Field(min_length=1, max_length=40)
    description: str = Field(min_length=8, max_length=4000)
    evidence_reference: str = Field(min_length=1, max_length=500)
    correction_of_posting_id: str | None = Field(default=None, max_length=100)


class RevisionEvidence(BaseModel):
    expected_revision: int = Field(gt=0)
    evidence_reference: str = Field(min_length=1, max_length=500)


def _raise(exc: Exception):
    if isinstance(exc, KeyError): raise HTTPException(status_code=404, detail=str(exc)) from exc
    raise HTTPException(status_code=409, detail=str(exc)) from exc


def _audit(db: AsyncSession, request: Request, user: UserResponse, *, action: str,
           target_type: str, item: dict[str, object], project_id: int):
    number = next((item.get(key) for key in ("unit_number", "center_number", "erp_project_number",
        "period_number", "posting_number") if item.get(key)), None)
    record_audit_event(db, action=action, actor_user_id=user.id, project_id=project_id,
        target_type=target_type, target_id=str(item["id"]),
        ip_address=request.client.host if request.client else None,
        detail={"project_id": project_id, "number": number, "status": item.get("status"),
                "revision": item.get("revision")})


@router.get("")
async def workspace(project_id: int, db: AsyncSession = Depends(get_db),
                    current_user: UserResponse = Depends(get_current_user)):
    await require_project_access(db, current_user=current_user, project_id=project_id)
    return await FactoryErpService(db).list_workspace(project_id=project_id)


@router.post("/operating-units")
async def create_unit(project_id: int, payload: UnitCreate, request: Request,
                      db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    resolved = await require_project_permission(db, current_user=current_user, project_id=project_id, permission=MASTER_MANAGE)
    try: item = await FactoryErpService(db).create_unit(project_id=project_id, context=resolved.context, actor=current_user.id, **payload.model_dump())
    except (KeyError, ValueError) as exc: _raise(exc)
    _audit(db, request, current_user, action="factory_erp_unit_created", target_type="factory_erp_operating_unit", item=item, project_id=project_id)
    await db.commit(); return item


@router.post("/operating-units/{item_id}/approve")
async def approve_unit(project_id: int, item_id: str, payload: RevisionEvidence, request: Request,
                       db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    await require_project_permission(db, current_user=current_user, project_id=project_id, permission=MASTER_APPROVE)
    try: item = await FactoryErpService(db).approve_unit(item_id, project_id=project_id, actor=current_user.id,
        expected_revision=payload.expected_revision, approval_reference=payload.evidence_reference)
    except (KeyError, ValueError) as exc: _raise(exc)
    _audit(db, request, current_user, action="factory_erp_unit_activated", target_type="factory_erp_operating_unit", item=item, project_id=project_id)
    await db.commit(); return item


@router.post("/cost-centers")
async def create_center(project_id: int, payload: CostCenterCreate, request: Request,
                        db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    resolved = await require_project_permission(db, current_user=current_user, project_id=project_id, permission=MASTER_MANAGE)
    try: item = await FactoryErpService(db).create_cost_center(project_id=project_id, context=resolved.context, actor=current_user.id, **payload.model_dump())
    except (KeyError, ValueError) as exc: _raise(exc)
    _audit(db, request, current_user, action="factory_erp_cost_center_created", target_type="factory_erp_cost_center", item=item, project_id=project_id)
    await db.commit(); return item


@router.post("/order-projects")
async def create_order_project(project_id: int, payload: OrderProjectCreate, request: Request,
                               db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    resolved = await require_project_permission(db, current_user=current_user, project_id=project_id, permission=PROJECT_REGISTER)
    try: item = await FactoryErpService(db).register_order_project(project_id=project_id, context=resolved.context, actor=current_user.id, **payload.model_dump())
    except (KeyError, ValueError) as exc: _raise(exc)
    _audit(db, request, current_user, action="factory_erp_order_project_registered", target_type="factory_erp_order_project", item=item, project_id=project_id)
    await db.commit(); return item


@router.post("/periods")
async def create_period(project_id: int, payload: PeriodCreate, request: Request,
                        db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    resolved = await require_project_permission(db, current_user=current_user, project_id=project_id, permission=PERIOD_MANAGE)
    try: item = await FactoryErpService(db).open_period(project_id=project_id, context=resolved.context, actor=current_user.id, **payload.model_dump())
    except (KeyError, ValueError) as exc: _raise(exc)
    _audit(db, request, current_user, action="factory_erp_period_opened", target_type="factory_erp_period", item=item, project_id=project_id)
    await db.commit(); return item


@router.post("/postings")
async def create_posting(project_id: int, payload: PostingCreate, request: Request,
                         db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    resolved = await require_project_permission(db, current_user=current_user, project_id=project_id, permission=POSTING_MANAGE)
    try: item = await FactoryErpService(db).create_posting(project_id=project_id, context=resolved.context, actor=current_user.id, **payload.model_dump())
    except (KeyError, ValueError) as exc: _raise(exc)
    _audit(db, request, current_user, action="factory_erp_posting_created", target_type="factory_erp_posting", item=item, project_id=project_id)
    await db.commit(); return item


@router.post("/postings/{item_id}/submit")
async def submit_posting(project_id: int, item_id: str, payload: RevisionEvidence, request: Request,
                         db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    await require_project_permission(db, current_user=current_user, project_id=project_id, permission=POSTING_MANAGE)
    try: item = await FactoryErpService(db).submit_posting(item_id, project_id=project_id, actor=current_user.id,
        expected_revision=payload.expected_revision, evidence_reference=payload.evidence_reference)
    except (KeyError, ValueError) as exc: _raise(exc)
    _audit(db, request, current_user, action="factory_erp_posting_submitted", target_type="factory_erp_posting", item=item, project_id=project_id)
    await db.commit(); return item


@router.post("/postings/{item_id}/approve")
async def approve_posting(project_id: int, item_id: str, payload: RevisionEvidence, request: Request,
                          db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    await require_project_permission(db, current_user=current_user, project_id=project_id, permission=POSTING_APPROVE)
    try: item = await FactoryErpService(db).approve_posting(item_id, project_id=project_id, actor=current_user.id,
        expected_revision=payload.expected_revision, approval_reference=payload.evidence_reference)
    except (KeyError, ValueError) as exc: _raise(exc)
    _audit(db, request, current_user, action="factory_erp_posting_posted", target_type="factory_erp_posting", item=item, project_id=project_id)
    await db.commit(); return item


@router.post("/periods/{item_id}/submit-close")
async def submit_close(project_id: int, item_id: str, payload: RevisionEvidence, request: Request,
                       db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    await require_project_permission(db, current_user=current_user, project_id=project_id, permission=PERIOD_MANAGE)
    try: result = await FactoryErpService(db).submit_period_close(item_id, project_id=project_id, actor=current_user.id,
        expected_revision=payload.expected_revision, evidence_reference=payload.evidence_reference)
    except (KeyError, ValueError) as exc: _raise(exc)
    _audit(db, request, current_user, action="factory_erp_period_close_submitted", target_type="factory_erp_period", item=result["period"], project_id=project_id)
    await db.commit(); return result


@router.post("/periods/{item_id}/close")
async def close_period(project_id: int, item_id: str, payload: RevisionEvidence, request: Request,
                       db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    await require_project_permission(db, current_user=current_user, project_id=project_id, permission=PERIOD_CLOSE)
    try: item = await FactoryErpService(db).close_period(item_id, project_id=project_id, actor=current_user.id,
        expected_revision=payload.expected_revision, approval_reference=payload.evidence_reference)
    except (KeyError, ValueError) as exc: _raise(exc)
    _audit(db, request, current_user, action="factory_erp_period_closed", target_type="factory_erp_period", item=item, project_id=project_id)
    await db.commit(); return item
