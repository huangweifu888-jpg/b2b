"""Tenant-scoped, redacted audit-log retrieval."""

from __future__ import annotations

from datetime import datetime

from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter, Depends, Query
from models.platform import AuditLog
from schemas.auth import UserResponse
from services.audit import actor_reference, audit_detail_from_json
from services.tenant_access import (
    require_organization_access,
    require_project_access,
    visible_organization_ids,
    visible_project_ids,
)
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession


router = APIRouter(prefix="/api/v1/audit-logs", tags=["audit-logs"])


def _serialize(entry: AuditLog) -> dict[str, object]:
    return {
        "id": entry.id,
        "action": entry.action,
        "target_type": entry.target_type,
        "target_id": entry.target_id,
        "organization_id": entry.org_id,
        "project_id": entry.project_id,
        "actor_ref": actor_reference(entry.actor_user_id),
        "detail": audit_detail_from_json(entry.detail_json),
        "created_at": entry.created_at,
    }


@router.get("")
async def list_audit_logs(
    project_id: int | None = None,
    organization_id: int | None = None,
    action: str | None = Query(default=None, min_length=1, max_length=100),
    before: datetime | None = None,
    limit: int = Query(default=100, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    """Return only records that belong to organizations or plans the caller can see."""
    if project_id is not None:
        await require_project_access(db, current_user=current_user, project_id=project_id)
    if organization_id is not None:
        await require_organization_access(db, current_user=current_user, organization_id=organization_id)

    statement = select(AuditLog)
    if project_id is not None:
        statement = statement.where(AuditLog.project_id == project_id)
    if organization_id is not None:
        statement = statement.where(AuditLog.org_id == organization_id)
    if action is not None:
        statement = statement.where(AuditLog.action == action)
    if before is not None:
        statement = statement.where(AuditLog.created_at < before)

    if current_user.role != "admin":
        organization_ids = await visible_organization_ids(db, current_user=current_user)
        project_ids = await visible_project_ids(db, current_user=current_user)
        statement = statement.where(
            or_(
                AuditLog.org_id.in_(organization_ids),
                AuditLog.project_id.in_(project_ids),
            )
        )

    entries = (await db.execute(statement.order_by(AuditLog.created_at.desc(), AuditLog.id.desc()).limit(limit))).scalars().all()
    return {"items": [_serialize(entry) for entry in entries], "limit": limit}
