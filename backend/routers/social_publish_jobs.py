"""Internal social publish queue records guarded by review and OAuth state."""

from __future__ import annotations

import json
import os
import secrets
from datetime import datetime

from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter, Depends, HTTPException, Request, status
from models.social_content_review import SocialContentReview
from models.social_publish_job import SocialPublishJob
from pydantic import BaseModel, Field
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.social_publish_guard import publish_block_reasons
from services.tenant_access import require_project_access
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


router = APIRouter(prefix="/api/v1/social-publish-jobs", tags=["social-publish-jobs"])


class PublishJobCreate(BaseModel):
    project_id: int = Field(gt=0)
    content_review_id: str = Field(min_length=8, max_length=64)
    provider: str = Field(min_length=2, max_length=80)
    idempotency_key: str = Field(min_length=8, max_length=128)
    scheduled_for: datetime | None = None


def _execution_enabled() -> bool:
    return os.getenv("SOCIAL_PUBLISH_EXECUTION_ENABLED", "").strip().lower() in {"1", "true", "yes", "on"}


def _provider_key(value: str) -> str:
    normalized = " ".join(value.split()).strip().lower()
    if not normalized or any(character in normalized for character in "<>\\\"'`\n\r"):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Invalid provider")
    return normalized


def _view(item: SocialPublishJob) -> dict:
    return {
        "id": item.id,
        "project_id": item.project_id,
        "content_review_id": item.content_review_id,
        "provider": item.provider,
        "idempotency_key": item.idempotency_key,
        "status": item.status,
        "block_reasons": json.loads(item.block_reasons_json or "[]"),
        "scheduled_for": item.scheduled_for,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
        "external_dispatch_started": False,
    }


@router.get("")
async def list_publish_jobs(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    await require_project_access(db, current_user=current_user, project_id=project_id)
    items = (
        await db.execute(
            select(SocialPublishJob)
            .where(SocialPublishJob.project_id == project_id)
            .order_by(SocialPublishJob.updated_at.desc(), SocialPublishJob.created_at.desc())
        )
    ).scalars().all()
    return {"items": [_view(item) for item in items]}


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_publish_job(
    payload: PublishJobCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    resolved = await require_project_access(db, current_user=current_user, project_id=payload.project_id)
    provider = _provider_key(payload.provider)
    existing = await db.scalar(
        select(SocialPublishJob).where(
            SocialPublishJob.project_id == payload.project_id,
            SocialPublishJob.idempotency_key == payload.idempotency_key.strip(),
        )
    )
    if existing:
        return _view(existing)

    review = await db.scalar(
        select(SocialContentReview).where(
            SocialContentReview.id == payload.content_review_id,
            SocialContentReview.project_id == payload.project_id,
        )
    )
    if not review:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Approved content review was not found in this project")
    review_channels = {str(channel).strip().lower() for channel in json.loads(review.channels_json or "[]")}
    if provider not in review_channels:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Provider is not approved for this content review")

    # A later OAuth callback connector will set verified_authorization only after
    # state/PKCE/signature checks. "ready_for_oauth" is intentionally not enough.
    reasons = publish_block_reasons(
        review_approved=review.status == "approved_for_authorized_publish",
        verified_authorization=False,
        execution_enabled=_execution_enabled(),
    )
    context = resolved.context
    item = SocialPublishJob(
        id=f"social-publish-{secrets.token_urlsafe(18)}",
        project_id=payload.project_id,
        agent_path=context.agent_path,
        tenant_id=context.tenant_id,
        client_id=context.client_id,
        plan_id=context.plan_id or f"plan-{payload.project_id}",
        content_review_id=review.id,
        provider=provider,
        idempotency_key=payload.idempotency_key.strip(),
        status="blocked" if reasons else "queued",
        block_reasons_json=json.dumps(reasons),
        requested_by=current_user.id,
        scheduled_for=payload.scheduled_for,
    )
    db.add(item)
    record_audit_event(
        db,
        action="social_publish_job_created",
        actor_user_id=current_user.id,
        org_id=resolved.client.id,
        project_id=payload.project_id,
        target_type="social_publish_job",
        target_id=item.id,
        ip_address=request.client.host if request.client else None,
        detail={"provider": provider, "status": item.status, "block_reasons": reasons},
    )
    await db.commit()
    await db.refresh(item)
    return _view(item)
