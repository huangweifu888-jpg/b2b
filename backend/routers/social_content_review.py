"""Two-stage social content review APIs.

Client plans submit content to their own tenant record.  An eligible agency in
the plan lineage performs the first review; headquarters completes the second
review.  Approval only makes a task eligible for a future OAuth publisher and
never sends content to a social platform.
"""

from __future__ import annotations

import json
import secrets
from datetime import datetime
from typing import Literal

from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter, Depends, HTTPException, Request, status
from models.platform import Membership, Organization
from models.social_content_review import SocialContentReview
from pydantic import BaseModel, Field
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.tenant_access import require_global_platform_access, require_project_access, visible_project_ids
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


router = APIRouter(prefix="/api/v1/social-content-reviews", tags=["social-content-reviews"])


class ContentReviewCreate(BaseModel):
    project_id: int = Field(gt=0)
    title: str = Field(min_length=1, max_length=255)
    content_text: str = Field(min_length=1, max_length=20000)
    channels: list[str] = Field(min_length=1, max_length=30)


class ContentReviewAction(BaseModel):
    action: Literal["agency_approve", "headquarters_approve", "return", "resubmit"]
    note: str | None = Field(default=None, max_length=2000)


def _view(item: SocialContentReview) -> dict:
    return {
        "id": item.id,
        "project_id": item.project_id,
        "title": item.title,
        "content_text": item.content_text,
        "channels": json.loads(item.channels_json or "[]"),
        "status": item.status,
        "submitted_by": item.submitted_by,
        "agency_reviewed_by": item.agency_reviewed_by,
        "agency_reviewed_at": item.agency_reviewed_at,
        "headquarters_reviewed_by": item.headquarters_reviewed_by,
        "headquarters_reviewed_at": item.headquarters_reviewed_at,
        "review_note": item.review_note,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
    }


async def _require_agency_reviewer(
    db: AsyncSession, *, current_user: UserResponse, project_id: int
) -> None:
    resolved = await require_project_access(db, current_user=current_user, project_id=project_id)
    memberships = (
        await db.execute(
            select(Membership).where(
                Membership.user_id == current_user.id,
                Membership.status == "active",
                Membership.project_id.is_(None),
                Membership.org_id.in_(resolved.ancestor_org_ids),
            )
        )
    ).scalars().all()
    org_ids = {membership.org_id for membership in memberships}
    agencies = (
        await db.execute(
            select(Organization.id).where(
                Organization.id.in_(org_ids),
                Organization.org_type.in_(("agency", "sub_agency")),
            )
        )
    ).scalars().all()
    if not agencies:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Agency reviewer access required")


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_content_review(
    payload: ContentReviewCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    resolved = await require_project_access(db, current_user=current_user, project_id=payload.project_id)
    context = resolved.context
    channels = sorted({channel.strip() for channel in payload.channels if channel.strip()})
    if not channels:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="At least one channel is required")
    record = SocialContentReview(
        id=f"social-content-{secrets.token_urlsafe(18)}",
        project_id=payload.project_id,
        agent_path=context.agent_path,
        tenant_id=context.tenant_id,
        client_id=context.client_id,
        plan_id=context.plan_id or f"plan-{payload.project_id}",
        title=payload.title.strip(),
        content_text=payload.content_text.strip(),
        channels_json=json.dumps(channels, ensure_ascii=False),
        status="pending_agency_review",
        submitted_by=current_user.id,
    )
    db.add(record)
    record_audit_event(
        db,
        action="social_content_submitted_for_agency_review",
        actor_user_id=current_user.id,
        org_id=resolved.client.id,
        project_id=payload.project_id,
        target_type="social_content_review",
        target_id=record.id,
        ip_address=request.client.host if request.client else None,
        detail={"channel_count": len(channels)},
    )
    await db.commit()
    await db.refresh(record)
    return _view(record)


@router.get("")
async def list_content_reviews(
    project_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    if project_id is not None:
        await require_project_access(db, current_user=current_user, project_id=project_id)
        project_ids = {project_id}
    else:
        project_ids = await visible_project_ids(db, current_user=current_user)
    if not project_ids:
        return {"items": []}
    records = (
        await db.execute(
            select(SocialContentReview)
            .where(SocialContentReview.project_id.in_(project_ids))
            .order_by(SocialContentReview.updated_at.desc(), SocialContentReview.created_at.desc())
        )
    ).scalars().all()
    return {"items": [_view(record) for record in records]}


@router.post("/{review_id}/action")
async def act_on_content_review(
    review_id: str,
    payload: ContentReviewAction,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    record = await db.scalar(select(SocialContentReview).where(SocialContentReview.id == review_id))
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Content review not found")
    await require_project_access(db, current_user=current_user, project_id=record.project_id)
    note = (payload.note or "").strip() or None

    if payload.action == "resubmit":
        if record.submitted_by != current_user.id or record.status != "returned":
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Only the submitting client can resubmit a returned item")
        record.status = "pending_agency_review"
        record.review_note = None
    elif payload.action == "agency_approve":
        if record.status != "pending_agency_review":
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Item is not awaiting agency review")
        if record.submitted_by == current_user.id:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Submitter cannot review the same item")
        await _require_agency_reviewer(db, current_user=current_user, project_id=record.project_id)
        record.status = "pending_headquarters_review"
        record.agency_reviewed_by = current_user.id
        record.agency_reviewed_at = datetime.now()
        record.review_note = note
    elif payload.action == "headquarters_approve":
        if record.status != "pending_headquarters_review":
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Item is not awaiting headquarters review")
        await require_global_platform_access(current_user=current_user)
        record.status = "approved_for_authorized_publish"
        record.headquarters_reviewed_by = current_user.id
        record.headquarters_reviewed_at = datetime.now()
        record.review_note = note
    else:
        if record.status not in {"pending_agency_review", "pending_headquarters_review"}:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Item is not reviewable")
        if record.status == "pending_agency_review":
            await _require_agency_reviewer(db, current_user=current_user, project_id=record.project_id)
            record.agency_reviewed_by = current_user.id
            record.agency_reviewed_at = datetime.now()
        else:
            await require_global_platform_access(current_user=current_user)
            record.headquarters_reviewed_by = current_user.id
            record.headquarters_reviewed_at = datetime.now()
        record.status = "returned"
        record.review_note = note or "Review returned the item for revision"

    record_audit_event(
        db,
        action=f"social_content_review_{payload.action}",
        actor_user_id=current_user.id,
        project_id=record.project_id,
        target_type="social_content_review",
        target_id=record.id,
        ip_address=request.client.host if request.client else None,
        detail={"next_status": record.status},
    )
    await db.commit()
    await db.refresh(record)
    return _view(record)
