"""API boundary for the governed customer-success renewal handoff."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from core.database import get_db
from dependencies.auth import get_current_user
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.factory_customer_success import FactoryCustomerSuccessService
from services.tenant_access import require_project_access, require_project_permission
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/api/v1/factory-platform/projects/{project_id}/customer-success", tags=["factory-platform-customer-success"])
CREATE, REVIEW, APPROVE, HANDOFF, ACK = "factory.care.success.create", "factory.care.success.review", "factory.care.success.approve", "factory.care.success.handoff", "factory.care.success.acknowledge"
class CreatePayload(BaseModel): asset_id: str = Field(min_length=1, max_length=100); success_summary: str = Field(min_length=12, max_length=4000)
class DecisionPayload(BaseModel): expected_revision: int = Field(gt=0); reference: str = Field(min_length=1, max_length=255); note: str = Field(min_length=8, max_length=4000)
class HandoffPayload(BaseModel): expected_revision: int = Field(gt=0); release_reference: str = Field(min_length=1, max_length=255)
class ReceiptPayload(BaseModel): expected_revision: int = Field(gt=0); receipt_reference: str = Field(min_length=1, max_length=255)
def fail(exc: Exception): raise HTTPException(status_code=404 if isinstance(exc, KeyError) else 409, detail=str(exc)) from exc
def audit(db, request, user, action, target, project_id, detail): record_audit_event(db, action=action, actor_user_id=user.id, target_type="factory_customer_success", target_id=target, ip_address=request.client.host if request.client else None, detail={"project_id": project_id, **detail})
@router.get("")
async def workspace(project_id: int, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    await require_project_access(db, current_user=current_user, project_id=project_id); return await FactoryCustomerSuccessService(db).list_workspace(project_id=project_id)
@router.post("")
async def create(project_id: int, payload: CreatePayload, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    resolved = await require_project_permission(db, current_user=current_user, project_id=project_id, permission=CREATE)
    try: item = await FactoryCustomerSuccessService(db).create(project_id=project_id, context=resolved.context, actor=current_user.id, **payload.model_dump())
    except (KeyError, ValueError) as exc: fail(exc)
    audit(db, request, current_user, "factory_customer_success_review_created", item["id"], project_id, {"asset_id": item["asset_id"], "review_number": item["review_number"]}); await db.commit(); return item
@router.post("/{review_id}/review")
async def review(project_id: int, review_id: str, payload: DecisionPayload, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    await require_project_permission(db, current_user=current_user, project_id=project_id, permission=REVIEW)
    try: item = await FactoryCustomerSuccessService(db).review(review_id, project_id=project_id, expected_revision=payload.expected_revision, actor=current_user.id, review_reference=payload.reference, note=payload.note)
    except (KeyError, ValueError) as exc: fail(exc)
    audit(db, request, current_user, "factory_customer_success_review_reviewed", review_id, project_id, {"reference": payload.reference}); await db.commit(); return item
@router.post("/{review_id}/approve")
async def approve(project_id: int, review_id: str, payload: DecisionPayload, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    await require_project_permission(db, current_user=current_user, project_id=project_id, permission=APPROVE)
    try: item = await FactoryCustomerSuccessService(db).approve(review_id, project_id=project_id, expected_revision=payload.expected_revision, actor=current_user.id, approval_reference=payload.reference, note=payload.note)
    except (KeyError, ValueError) as exc: fail(exc)
    audit(db, request, current_user, "factory_customer_success_review_approved", review_id, project_id, {"reference": payload.reference}); await db.commit(); return item
@router.post("/{review_id}/handoff")
async def handoff(project_id: int, review_id: str, payload: HandoffPayload, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    await require_project_permission(db, current_user=current_user, project_id=project_id, permission=HANDOFF)
    try: item = await FactoryCustomerSuccessService(db).handoff(review_id, project_id=project_id, expected_revision=payload.expected_revision, actor=current_user.id, release_reference=payload.release_reference)
    except (KeyError, ValueError) as exc: fail(exc)
    audit(db, request, current_user, "factory_customer_success_handoff_released", item["handoff"]["id"], project_id, {"review_id": review_id, "reference": payload.release_reference}); await db.commit(); return item
@router.post("/handoffs/{handoff_id}/acknowledge")
async def acknowledge(project_id: int, handoff_id: str, payload: ReceiptPayload, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    await require_project_permission(db, current_user=current_user, project_id=project_id, permission=ACK)
    try: item = await FactoryCustomerSuccessService(db).acknowledge(handoff_id, project_id=project_id, expected_revision=payload.expected_revision, actor=current_user.id, receipt_reference=payload.receipt_reference)
    except (KeyError, ValueError) as exc: fail(exc)
    audit(db, request, current_user, "factory_customer_success_handoff_acknowledged", handoff_id, project_id, {"reference": payload.receipt_reference}); await db.commit(); return item
