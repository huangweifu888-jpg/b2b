"""Tenant-scoped formal finance book, document, posting and close APIs."""

from datetime import date
from typing import Literal

from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.factory_finance import FactoryFinanceService
from services.tenant_access import require_project_access, require_project_permission
from sqlalchemy.ext.asyncio import AsyncSession


router = APIRouter(prefix="/api/v1/factory-platform/projects/{project_id}/finance", tags=["factory-platform-finance"])
BOOK_MANAGE = "factory.operations.finance.book.manage"
BOOK_APPROVE = "factory.operations.finance.book.approve"
DOCUMENT_MANAGE = "factory.operations.finance.document.manage"
DOCUMENT_POST = "factory.operations.finance.document.post"
PERIOD_MANAGE = "factory.operations.finance.period.manage"
PERIOD_CLOSE = "factory.operations.finance.period.close"


class BookCreate(BaseModel):
    operating_unit_id: str = Field(min_length=1, max_length=100)
    book_reference: str = Field(min_length=1, max_length=255)
    book_code: str = Field(min_length=2, max_length=100)
    book_name: str = Field(min_length=1, max_length=255)


class PeriodCreate(BaseModel):
    book_id: str = Field(min_length=1, max_length=100)
    period_reference: str = Field(min_length=1, max_length=255)
    period_code: str = Field(pattern=r"^20\d{2}-(0[1-9]|1[0-2])$")


class DocumentCreate(BaseModel):
    book_id: str = Field(min_length=1, max_length=100)
    period_id: str = Field(min_length=1, max_length=100)
    document_reference: str = Field(min_length=1, max_length=255)
    document_type: Literal["ar-invoice", "ap-bill", "cash-receipt", "cash-payment", "budget"]
    document_date: date
    due_date: date | None = None
    source_id: str | None = Field(default=None, max_length=100)
    settlement_of_document_id: str | None = Field(default=None, max_length=100)
    amount: str = Field(min_length=1, max_length=40)
    description: str = Field(min_length=8, max_length=4000)
    source_evidence_reference: str = Field(min_length=1, max_length=500)


class RevisionEvidence(BaseModel):
    expected_revision: int = Field(gt=0)
    evidence_reference: str = Field(min_length=1, max_length=500)


def _raise(exc: Exception):
    if isinstance(exc, KeyError):
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    raise HTTPException(status_code=409, detail=str(exc)) from exc


def _audit(db: AsyncSession, request: Request, user: UserResponse, *, action: str,
           target_type: str, item: dict[str, object], project_id: int):
    number = next((item.get(key) for key in ("book_number", "period_number", "document_number")
        if item.get(key)), None)
    record_audit_event(db, action=action, actor_user_id=user.id, project_id=project_id,
        target_type=target_type, target_id=str(item["id"]),
        ip_address=request.client.host if request.client else None,
        detail={"project_id": project_id, "number": number, "status": item.get("status"),
                "revision": item.get("revision")})


@router.get("")
async def workspace(project_id: int, db: AsyncSession = Depends(get_db),
                    current_user: UserResponse = Depends(get_current_user)):
    await require_project_access(db, current_user=current_user, project_id=project_id)
    return await FactoryFinanceService(db).list_workspace(project_id=project_id)


@router.post("/books")
async def create_book(project_id: int, payload: BookCreate, request: Request,
                      db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    resolved = await require_project_permission(db, current_user=current_user, project_id=project_id, permission=BOOK_MANAGE)
    try:
        item = await FactoryFinanceService(db).create_book(project_id=project_id, context=resolved.context,
            actor=current_user.id, **payload.model_dump())
    except (KeyError, ValueError) as exc: _raise(exc)
    _audit(db, request, current_user, action="factory_finance_book_created", target_type="factory_finance_book", item=item, project_id=project_id)
    await db.commit(); return item


@router.post("/books/{item_id}/approve")
async def approve_book(project_id: int, item_id: str, payload: RevisionEvidence, request: Request,
                       db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    await require_project_permission(db, current_user=current_user, project_id=project_id, permission=BOOK_APPROVE)
    try:
        item = await FactoryFinanceService(db).approve_book(item_id, project_id=project_id, actor=current_user.id,
            expected_revision=payload.expected_revision, approval_reference=payload.evidence_reference)
    except (KeyError, ValueError) as exc: _raise(exc)
    _audit(db, request, current_user, action="factory_finance_book_activated", target_type="factory_finance_book", item=item, project_id=project_id)
    await db.commit(); return item


@router.post("/periods")
async def create_period(project_id: int, payload: PeriodCreate, request: Request,
                        db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    resolved = await require_project_permission(db, current_user=current_user, project_id=project_id, permission=PERIOD_MANAGE)
    try:
        item = await FactoryFinanceService(db).open_period(project_id=project_id, context=resolved.context,
            actor=current_user.id, **payload.model_dump())
    except (KeyError, ValueError) as exc: _raise(exc)
    _audit(db, request, current_user, action="factory_finance_period_opened", target_type="factory_finance_period", item=item, project_id=project_id)
    await db.commit(); return item


@router.post("/documents")
async def create_document(project_id: int, payload: DocumentCreate, request: Request,
                          db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    resolved = await require_project_permission(db, current_user=current_user, project_id=project_id, permission=DOCUMENT_MANAGE)
    try:
        item = await FactoryFinanceService(db).create_document(project_id=project_id, context=resolved.context,
            actor=current_user.id, **payload.model_dump())
    except (KeyError, ValueError) as exc: _raise(exc)
    _audit(db, request, current_user, action="factory_finance_document_created", target_type="factory_finance_document", item=item, project_id=project_id)
    await db.commit(); return item


@router.post("/documents/{item_id}/approve")
async def approve_document(project_id: int, item_id: str, payload: RevisionEvidence, request: Request,
                           db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    await require_project_permission(db, current_user=current_user, project_id=project_id, permission=DOCUMENT_POST)
    try:
        item = await FactoryFinanceService(db).approve_document(item_id, project_id=project_id, actor=current_user.id,
            expected_revision=payload.expected_revision, approval_reference=payload.evidence_reference)
    except (KeyError, ValueError) as exc: _raise(exc)
    _audit(db, request, current_user, action="factory_finance_document_posted", target_type="factory_finance_document", item=item, project_id=project_id)
    await db.commit(); return item


@router.post("/periods/{item_id}/submit-close")
async def submit_close(project_id: int, item_id: str, payload: RevisionEvidence, request: Request,
                       db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    await require_project_permission(db, current_user=current_user, project_id=project_id, permission=PERIOD_MANAGE)
    try:
        item = await FactoryFinanceService(db).submit_period_close(item_id, project_id=project_id, actor=current_user.id,
            expected_revision=payload.expected_revision, evidence_reference=payload.evidence_reference)
    except (KeyError, ValueError) as exc: _raise(exc)
    _audit(db, request, current_user, action="factory_finance_period_close_submitted", target_type="factory_finance_period", item=item, project_id=project_id)
    await db.commit(); return item


@router.post("/periods/{item_id}/close")
async def close_period(project_id: int, item_id: str, payload: RevisionEvidence, request: Request,
                       db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    await require_project_permission(db, current_user=current_user, project_id=project_id, permission=PERIOD_CLOSE)
    try:
        item = await FactoryFinanceService(db).close_period(item_id, project_id=project_id, actor=current_user.id,
            expected_revision=payload.expected_revision, approval_reference=payload.evidence_reference)
    except (KeyError, ValueError) as exc: _raise(exc)
    _audit(db, request, current_user, action="factory_finance_period_closed", target_type="factory_finance_period", item=item, project_id=project_id)
    await db.commit(); return item
