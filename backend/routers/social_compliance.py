"""Social data retention, deletion review and truthful capability APIs."""

from __future__ import annotations

import secrets
from datetime import datetime
from typing import Literal

from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter, Depends, HTTPException, Request, status
from models.social_compliance_policy import SocialCompliancePolicy
from pydantic import BaseModel, Field
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.social_compliance import DEFAULT_RETENTION_DAYS, observability_readiness, social_capability_matrix, validate_retention_days
from services.tenant_access import require_global_platform_access, require_project_access
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


router = APIRouter(prefix="/api/v1/social-compliance", tags=["social-compliance"])


class RetentionUpdate(BaseModel):
    project_id: int = Field(gt=0)
    retention_days: int


class DeletionReviewAction(BaseModel):
    action: Literal["approve", "reject"]


def _view(item: SocialCompliancePolicy | None, project_id: int) -> dict:
    if item is None:
        return {"project_id": project_id, "retention_days": DEFAULT_RETENTION_DAYS, "deletion_status": "active", "deletion_requested_at": None, "deletion_reviewed_at": None, "external_deletion_started": False}
    return {"project_id": item.project_id, "retention_days": item.retention_days, "deletion_status": item.deletion_status, "deletion_requested_at": item.deletion_requested_at, "deletion_reviewed_at": item.deletion_reviewed_at, "external_deletion_started": False}


async def _policy(db: AsyncSession, project_id: int) -> SocialCompliancePolicy | None:
    return await db.scalar(select(SocialCompliancePolicy).where(SocialCompliancePolicy.project_id == project_id))


@router.get("/capabilities")
async def list_capabilities(current_user: UserResponse = Depends(get_current_user)):
    return {"items": social_capability_matrix(), "external_execution_enabled": False}


@router.get("/observability")
async def get_observability(current_user: UserResponse = Depends(get_current_user)):
    await require_global_platform_access(current_user=current_user)
    return {"readiness": observability_readiness(), "external_monitoring_connected": False}


@router.get("/retention")
async def get_retention(project_id: int, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    await require_project_access(db, current_user=current_user, project_id=project_id)
    return _view(await _policy(db, project_id), project_id)


@router.put("/retention")
async def update_retention(payload: RetentionUpdate, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    resolved = await require_project_access(db, current_user=current_user, project_id=payload.project_id)
    try:
        retention_days = validate_retention_days(payload.retention_days)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc)) from exc
    item = await _policy(db, payload.project_id)
    if item is None:
        context = resolved.context
        item = SocialCompliancePolicy(id=f"social-policy-{secrets.token_urlsafe(18)}", project_id=payload.project_id, agent_path=context.agent_path, tenant_id=context.tenant_id, client_id=context.client_id, plan_id=context.plan_id or f"plan-{payload.project_id}", retention_days=retention_days)
        db.add(item)
    else:
        item.retention_days = retention_days
    record_audit_event(db, action="social_retention_updated", actor_user_id=current_user.id, org_id=resolved.client.id, project_id=payload.project_id, target_type="social_compliance_policy", target_id=item.id, ip_address=request.client.host if request.client else None, detail={"retention_days": retention_days})
    await db.commit(); await db.refresh(item)
    return _view(item, payload.project_id)


@router.post("/retention/request-deletion")
async def request_social_data_deletion(project_id: int, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    resolved = await require_project_access(db, current_user=current_user, project_id=project_id)
    item = await _policy(db, project_id)
    if item is None:
        context = resolved.context
        item = SocialCompliancePolicy(id=f"social-policy-{secrets.token_urlsafe(18)}", project_id=project_id, agent_path=context.agent_path, tenant_id=context.tenant_id, client_id=context.client_id, plan_id=context.plan_id or f"plan-{project_id}")
        db.add(item)
    if item.deletion_status != "active":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A deletion request is already being reviewed")
    item.deletion_status, item.deletion_requested_by, item.deletion_requested_at = "pending_manual_review", current_user.id, datetime.now()
    record_audit_event(db, action="social_data_deletion_requested", actor_user_id=current_user.id, org_id=resolved.client.id, project_id=project_id, target_type="social_compliance_policy", target_id=item.id, ip_address=request.client.host if request.client else None, detail={})
    await db.commit(); await db.refresh(item)
    return _view(item, project_id)


@router.post("/retention/{project_id}/review")
async def review_social_data_deletion(project_id: int, payload: DeletionReviewAction, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    await require_project_access(db, current_user=current_user, project_id=project_id)
    await require_global_platform_access(current_user=current_user)
    item = await _policy(db, project_id)
    if item is None or item.deletion_status != "pending_manual_review":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="No deletion request is awaiting review")
    item.deletion_status = "approved_pending_execution" if payload.action == "approve" else "active"
    item.deletion_reviewed_by, item.deletion_reviewed_at = current_user.id, datetime.now()
    record_audit_event(db, action=f"social_data_deletion_{payload.action}ed", actor_user_id=current_user.id, project_id=project_id, target_type="social_compliance_policy", target_id=item.id, ip_address=request.client.host if request.client else None, detail={"external_deletion_started": False})
    await db.commit(); await db.refresh(item)
    return _view(item, project_id)
