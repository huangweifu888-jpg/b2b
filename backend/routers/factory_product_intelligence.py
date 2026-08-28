"""Tenant-scoped product opportunity intelligence and availability APIs."""

from datetime import datetime
from decimal import Decimal
from typing import Literal

from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.factory_product_intelligence import FactoryProductIntelligenceService
from services.tenant_access import require_project_access, require_project_permission
from sqlalchemy.ext.asyncio import AsyncSession


router = APIRouter(prefix="/api/v1/factory-platform/projects/{project_id}/product-intelligence", tags=["factory-platform-product-intelligence"])
MANAGE = "factory.identity.product-intelligence.manage"
VERIFY = "factory.identity.product-intelligence.signal.verify"
REVIEW = "factory.identity.product-intelligence.assessment.review"
APPROVE = "factory.identity.product-intelligence.release.approve"


class StudyCreate(BaseModel):
    product_reference: str = Field(min_length=1, max_length=180)
    product_name: str = Field(min_length=1, max_length=180)
    business_objective: str = Field(min_length=8, max_length=2000)
    base_currency: str = Field(default="USD", min_length=3, max_length=3)


class SignalCreate(BaseModel):
    signal_type: Literal["demand", "margin", "growth", "competition", "capability-fit"]
    normalized_score: Decimal = Field(ge=0, le=100)
    raw_value: Decimal
    measurement_unit: str = Field(min_length=1, max_length=32)
    region: str = Field(min_length=2, max_length=32)
    source_system: str = Field(min_length=1, max_length=64)
    source_reference: str = Field(min_length=1, max_length=255)
    source_revision: str = Field(min_length=1, max_length=96)
    source_observed_at: datetime


class SignalVerify(BaseModel):
    expected_revision: int = Field(gt=0)
    verification_reference: str = Field(min_length=1, max_length=255)


class AssessmentCreate(BaseModel):
    assumptions: str = Field(min_length=8, max_length=4000)


class AssessmentReview(BaseModel):
    expected_revision: int = Field(gt=0)
    decision: Literal["approve", "reject"]
    review_reference: str = Field(min_length=1, max_length=255)
    review_note: str = Field(min_length=8, max_length=2000)


class ReleaseCreate(BaseModel):
    release_version: str = Field(min_length=1, max_length=64)
    tenant_scope: str = Field(min_length=1, max_length=255)
    region_scope: list[str] = Field(min_length=1, max_length=50)
    connector_scope: list[str] = Field(min_length=1, max_length=50)
    support_owner: str = Field(min_length=1, max_length=128)
    support_until: datetime
    end_to_end_demo_reference: str = Field(min_length=1, max_length=255)
    role_training_reference: str = Field(min_length=1, max_length=255)
    issue_closure_reference: str = Field(min_length=1, max_length=255)
    pilot_report_reference: str = Field(min_length=1, max_length=255)
    runtime_monitoring_reference: str = Field(min_length=1, max_length=255)
    rollback_drill_reference: str = Field(min_length=1, max_length=255)


class ReleaseApprove(BaseModel):
    expected_revision: int = Field(gt=0)
    approval_reference: str = Field(min_length=1, max_length=255)


def _raise(exc: Exception) -> None:
    if isinstance(exc, KeyError):
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    raise HTTPException(status_code=409, detail=str(exc)) from exc


async def _run(db: AsyncSession, request: Request, current_user: UserResponse, project_id: int, permission: str, action: str, target_type: str, operation, *, context: bool = False, **kwargs):
    await require_project_access(db, current_user=current_user, project_id=project_id)
    resolved = await require_project_permission(db, current_user=current_user, project_id=project_id, permission=permission)
    try:
        item = await operation(project_id=project_id, actor=current_user.id, **({"context": resolved.context} if context else {}), **kwargs)
    except (KeyError, ValueError) as exc:
        _raise(exc)
    record_audit_event(db, action=action, actor_user_id=current_user.id, project_id=project_id, target_type=target_type, target_id=str(item["id"]), ip_address=request.client.host if request.client else None, detail={"project_id": project_id, "status": item.get("status"), "revision": item.get("revision")})
    await db.commit()
    return item


@router.get("")
async def workspace(project_id: int, current_user: UserResponse = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await require_project_access(db, current_user=current_user, project_id=project_id)
    return await FactoryProductIntelligenceService(db).workspace(project_id=project_id)


@router.post("/studies")
async def create_study(project_id: int, payload: StudyCreate, request: Request, current_user: UserResponse = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await _run(db, request, current_user, project_id, MANAGE, "factory.product-intelligence.study.create", "factory-product-study", FactoryProductIntelligenceService(db).create_study, context=True, **payload.model_dump())


@router.post("/studies/{study_id}/signals")
async def create_signal(project_id: int, study_id: str, payload: SignalCreate, request: Request, current_user: UserResponse = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await _run(db, request, current_user, project_id, MANAGE, "factory.product-intelligence.signal.create", "factory-product-signal", FactoryProductIntelligenceService(db).add_signal, context=True, study_id=study_id, **payload.model_dump())


@router.post("/signals/{signal_id}/verify")
async def verify_signal(project_id: int, signal_id: str, payload: SignalVerify, request: Request, current_user: UserResponse = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await _run(db, request, current_user, project_id, VERIFY, "factory.product-intelligence.signal.verify", "factory-product-signal", FactoryProductIntelligenceService(db).verify_signal, signal_id=signal_id, **payload.model_dump())


@router.post("/studies/{study_id}/assessments")
async def create_assessment(project_id: int, study_id: str, payload: AssessmentCreate, request: Request, current_user: UserResponse = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await _run(db, request, current_user, project_id, MANAGE, "factory.product-intelligence.assessment.create", "factory-product-assessment", FactoryProductIntelligenceService(db).create_assessment, context=True, study_id=study_id, **payload.model_dump())


@router.post("/assessments/{assessment_id}/review")
async def review_assessment(project_id: int, assessment_id: str, payload: AssessmentReview, request: Request, current_user: UserResponse = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await _run(db, request, current_user, project_id, REVIEW, "factory.product-intelligence.assessment.review", "factory-product-assessment", FactoryProductIntelligenceService(db).review_assessment, assessment_id=assessment_id, **payload.model_dump())


@router.post("/assessments/{assessment_id}/releases")
async def prepare_release(project_id: int, assessment_id: str, payload: ReleaseCreate, request: Request, current_user: UserResponse = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await _run(db, request, current_user, project_id, MANAGE, "factory.product-intelligence.release.prepare", "factory-product-release", FactoryProductIntelligenceService(db).prepare_release, context=True, assessment_id=assessment_id, **payload.model_dump())


@router.post("/releases/{release_id}/approve")
async def approve_release(project_id: int, release_id: str, payload: ReleaseApprove, request: Request, current_user: UserResponse = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await _run(db, request, current_user, project_id, APPROVE, "factory.product-intelligence.release.approve", "factory-product-release", FactoryProductIntelligenceService(db).approve_release, release_id=release_id, **payload.model_dump())
