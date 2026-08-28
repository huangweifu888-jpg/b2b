"""Tenant-scoped APIs for governed AI site plans and digital-asset handoff."""

from datetime import datetime
from typing import Any

from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.factory_digital_assets import FactoryDigitalAssetService
from services.tenant_access import require_project_access, require_project_permission
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/api/v1/factory-platform/projects/{project_id}/digital-assets", tags=["factory-platform-digital-assets"])
MANAGE = "factory.identity.digital-assets.manage"
SUGGESTION_REVIEW = "factory.identity.digital-assets.suggestion.review"
ASSET_APPROVE = "factory.identity.digital-assets.asset.approve"
PLAN_APPROVE = "factory.identity.digital-assets.plan.approve"
HANDOFF_APPROVE = "factory.identity.digital-assets.handoff.approve"


class PlanCreate(BaseModel):
    business_goal: str = Field(min_length=8, max_length=4000)
    target_market: str = Field(min_length=2, max_length=120)
    target_audience: str = Field(min_length=8, max_length=4000)
    site_scope: str = Field(min_length=8, max_length=4000)


class SuggestionCreate(BaseModel):
    suggestion_type: str = Field(min_length=2, max_length=64)
    recommendation: dict[str, Any]
    source_reference: str = Field(min_length=1, max_length=255)


class AssetCreate(BaseModel):
    asset_kind: str = Field(pattern="^(domain|trademark|authorization)$")
    asset_identifier: str = Field(min_length=1, max_length=255)
    ownership_reference: str = Field(min_length=1, max_length=255)
    rights_scope: str = Field(min_length=4, max_length=4000)


class RevisionReference(BaseModel):
    expected_revision: int = Field(gt=0)
    reference: str = Field(min_length=1, max_length=255)


class HandoffCreate(BaseModel):
    release_version: str = Field(min_length=1, max_length=64)
    support_owner: str = Field(min_length=1, max_length=128)
    support_until: datetime
    customer_trial_reference: str = Field(min_length=1, max_length=255)
    role_training_reference: str = Field(min_length=1, max_length=255)
    issue_closure_reference: str = Field(min_length=1, max_length=255)
    monitoring_reference: str = Field(min_length=1, max_length=255)
    rollback_reference: str = Field(min_length=1, max_length=255)


def _fail(error: Exception) -> None:
    raise HTTPException(status_code=404 if isinstance(error, KeyError) else 409, detail=str(error)) from error


async def _run(db: AsyncSession, request: Request, user: UserResponse, project_id: int, permission: str, action: str, target: str, operation: Any, *, context: bool = False, **kwargs: Any) -> dict[str, object]:
    await require_project_access(db, current_user=user, project_id=project_id)
    resolved = await require_project_permission(db, current_user=user, project_id=project_id, permission=permission)
    try:
        item = await operation(project_id=project_id, actor=user.id, **({"context": resolved.context} if context else {}), **kwargs)
    except (KeyError, ValueError) as error:
        _fail(error)
    record = item.get("id", item.get("plan", {}).get("id"))
    record_audit_event(db, action=action, actor_user_id=user.id, project_id=project_id, target_type=target, target_id=str(record), ip_address=request.client.host if request.client else None, detail={"project_id": project_id, "status": item.get("status"), "revision": item.get("revision")})
    await db.commit()
    return item


@router.get("")
async def workspace(project_id: int, current_user: UserResponse = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await require_project_access(db, current_user=current_user, project_id=project_id)
    return await FactoryDigitalAssetService(db).workspace(project_id=project_id)


@router.post("/plans")
async def create_plan(project_id: int, payload: PlanCreate, request: Request, current_user: UserResponse = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await _run(db, request, current_user, project_id, MANAGE, "factory.digital-assets.plan.create", "factory-digital-asset-plan", FactoryDigitalAssetService(db).create_plan, context=True, **payload.model_dump())


@router.post("/plans/{plan_id}/suggestions")
async def generate_suggestion(project_id: int, plan_id: str, payload: SuggestionCreate, request: Request, current_user: UserResponse = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await _run(db, request, current_user, project_id, MANAGE, "factory.digital-assets.suggestion.generate", "factory-digital-asset-suggestion", FactoryDigitalAssetService(db).generate_suggestion, context=True, plan_id=plan_id, **payload.model_dump())


@router.post("/suggestions/{suggestion_id}/review")
async def review_suggestion(project_id: int, suggestion_id: str, payload: RevisionReference, request: Request, current_user: UserResponse = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await _run(db, request, current_user, project_id, SUGGESTION_REVIEW, "factory.digital-assets.suggestion.review", "factory-digital-asset-suggestion", FactoryDigitalAssetService(db).review_suggestion, suggestion_id=suggestion_id, expected_revision=payload.expected_revision, review_reference=payload.reference)


@router.post("/plans/{plan_id}/assets")
async def register_asset(project_id: int, plan_id: str, payload: AssetCreate, request: Request, current_user: UserResponse = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await _run(db, request, current_user, project_id, MANAGE, "factory.digital-assets.asset.register", "factory-digital-asset-register", FactoryDigitalAssetService(db).register_asset, context=True, plan_id=plan_id, **payload.model_dump())


@router.post("/assets/{asset_id}/approve")
async def approve_asset(project_id: int, asset_id: str, payload: RevisionReference, request: Request, current_user: UserResponse = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await _run(db, request, current_user, project_id, ASSET_APPROVE, "factory.digital-assets.asset.approve", "factory-digital-asset-register", FactoryDigitalAssetService(db).approve_asset, asset_id=asset_id, expected_revision=payload.expected_revision, approval_reference=payload.reference)


@router.post("/plans/{plan_id}/approve")
async def approve_plan(project_id: int, plan_id: str, payload: RevisionReference, request: Request, current_user: UserResponse = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await _run(db, request, current_user, project_id, PLAN_APPROVE, "factory.digital-assets.plan.approve", "factory-digital-asset-plan", FactoryDigitalAssetService(db).approve_plan, plan_id=plan_id, expected_revision=payload.expected_revision, approval_reference=payload.reference)


@router.post("/plans/{plan_id}/handoffs")
async def prepare_handoff(project_id: int, plan_id: str, payload: HandoffCreate, request: Request, current_user: UserResponse = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await _run(db, request, current_user, project_id, MANAGE, "factory.digital-assets.handoff.prepare", "factory-digital-asset-handoff", FactoryDigitalAssetService(db).prepare_handoff, context=True, plan_id=plan_id, **payload.model_dump())


@router.post("/handoffs/{handoff_id}/approve")
async def approve_handoff(project_id: int, handoff_id: str, payload: RevisionReference, request: Request, current_user: UserResponse = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await _run(db, request, current_user, project_id, HANDOFF_APPROVE, "factory.digital-assets.handoff.approve", "factory-digital-asset-handoff", FactoryDigitalAssetService(db).approve_handoff, handoff_id=handoff_id, expected_revision=payload.expected_revision, approval_reference=payload.reference)
