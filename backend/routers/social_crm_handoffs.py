"""Human-reviewed, external-dispatch-disabled social CRM handoffs."""

from __future__ import annotations

import json
import os
import secrets
from datetime import datetime
from typing import Literal

from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter, Depends, HTTPException, Request, status
from models.social_crm_handoff import SocialCrmHandoff
from models.social_workspace import SocialPlanWorkspace
from pydantic import BaseModel, Field
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.social_crm_handoff import initial_handoff_status, validate_contact_reference
from services.tenant_access import require_global_platform_access, require_project_access
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


router = APIRouter(prefix="/api/v1/social-crm-handoffs", tags=["social-crm-handoffs"])


class CrmHandoffCreate(BaseModel):
    project_id: int = Field(gt=0)
    provider: str = Field(min_length=2, max_length=80)
    contact_reference: str = Field(min_length=2, max_length=160)
    lead_summary: str = Field(min_length=3, max_length=4000)


class CrmHandoffAction(BaseModel):
    action: Literal["approve_for_crm", "return", "mark_dispatched"]
    note: str | None = Field(default=None, max_length=1000)


def _crm_execution_enabled() -> bool:
    return os.getenv("SOCIAL_CRM_HANDOFF_EXECUTION_ENABLED", "").strip().lower() in {"1", "true", "yes", "on"}


async def _auto_handoff_enabled(db: AsyncSession, project_id: int) -> bool:
    """Read the plan plugin switch without making workspace state a secret store."""
    workspace = await db.scalar(select(SocialPlanWorkspace).where(SocialPlanWorkspace.project_id == project_id))
    if not workspace:
        return False
    try:
        state = json.loads(workspace.state_json or "{}")
        settings = state.get("settings") if isinstance(state, dict) else None
        return bool(settings.get("crmAutoHandoffEnabled")) if isinstance(settings, dict) else False
    except (TypeError, ValueError):
        return False


def _view(item: SocialCrmHandoff) -> dict:
    return {"id": item.id, "project_id": item.project_id, "provider": item.provider, "contact_reference": item.contact_reference, "lead_summary": item.lead_summary, "status": item.status, "review_required": item.status == "pending_manual_review", "review_note": item.review_note, "created_at": item.created_at, "reviewed_at": item.reviewed_at, "dispatched_at": item.dispatched_at, "external_dispatch_started": False}


@router.get("")
async def list_crm_handoffs(project_id: int, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    await require_project_access(db, current_user=current_user, project_id=project_id)
    items = (await db.execute(select(SocialCrmHandoff).where(SocialCrmHandoff.project_id == project_id).order_by(SocialCrmHandoff.updated_at.desc()))).scalars().all()
    return {"items": [_view(item) for item in items]}


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_crm_handoff(payload: CrmHandoffCreate, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    resolved = await require_project_access(db, current_user=current_user, project_id=payload.project_id)
    try:
        reference = validate_contact_reference(payload.contact_reference)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc)) from exc
    context = resolved.context
    auto_handoff = await _auto_handoff_enabled(db, payload.project_id)
    item = SocialCrmHandoff(id=f"social-crm-{secrets.token_urlsafe(18)}", project_id=payload.project_id, agent_path=context.agent_path, tenant_id=context.tenant_id, client_id=context.client_id, plan_id=context.plan_id or f"plan-{payload.project_id}", provider=" ".join(payload.provider.split()).strip().lower(), contact_reference=reference, lead_summary=payload.lead_summary.strip(), status=initial_handoff_status(auto_handoff_enabled=auto_handoff), submitted_by=current_user.id)
    db.add(item)
    record_audit_event(db, action="social_crm_handoff_submitted", actor_user_id=current_user.id, org_id=resolved.client.id, project_id=payload.project_id, target_type="social_crm_handoff", target_id=item.id, ip_address=request.client.host if request.client else None, detail={"provider": item.provider, "auto_handoff": auto_handoff})
    await db.commit(); await db.refresh(item)
    return _view(item)


@router.post("/{handoff_id}/action")
async def act_on_crm_handoff(handoff_id: str, payload: CrmHandoffAction, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    item = await db.scalar(select(SocialCrmHandoff).where(SocialCrmHandoff.id == handoff_id))
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="CRM handoff not found")
    await require_project_access(db, current_user=current_user, project_id=item.project_id)
    await require_global_platform_access(current_user=current_user)
    note = (payload.note or "").strip() or None
    if payload.action == "approve_for_crm":
        if item.status != "pending_manual_review":
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Handoff is not awaiting review")
        item.status = "approved_for_crm"
        item.reviewed_by, item.reviewed_at, item.review_note = current_user.id, datetime.now(), note
    elif payload.action == "return":
        if item.status != "pending_manual_review":
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Handoff is not awaiting review")
        item.status = "returned"
        item.reviewed_by, item.reviewed_at, item.review_note = current_user.id, datetime.now(), note or "Returned for revision"
    else:
        if item.status != "approved_for_crm":
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Handoff requires approval before CRM dispatch")
        if not _crm_execution_enabled():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="CRM dispatch is disabled until an approved connector is configured")
        item.status, item.dispatched_at = "dispatched", datetime.now()
    record_audit_event(db, action=f"social_crm_handoff_{payload.action}", actor_user_id=current_user.id, project_id=item.project_id, target_type="social_crm_handoff", target_id=item.id, ip_address=request.client.host if request.client else None, detail={"next_status": item.status})
    await db.commit(); await db.refresh(item)
    return _view(item)
