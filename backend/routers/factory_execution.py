"""Headquarters-only API for the governed Factory Platform execution desk."""

from __future__ import annotations

from typing import Literal

from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.factory_execution import FactoryExecutionService
from services.tenant_access import require_global_platform_access
from sqlalchemy.ext.asyncio import AsyncSession


router = APIRouter(prefix="/api/v1/factory-platform/execution", tags=["factory-platform-execution"])


class WorkstreamUpdate(BaseModel):
    expected_revision: int = Field(gt=0)
    status: Literal["active", "queued", "blocked", "done"] | None = None
    current_gate: Literal["intake-review", "contract-freeze", "security-review", "development-acceptance", "business-acceptance", "release-readiness", "value-review"] | None = None
    owner_roles: list[str] | None = Field(default=None, max_length=30)
    deliverables: list[str] | None = Field(default=None, max_length=30)
    blockers: list[str] | None = Field(default=None, max_length=30)
    evidence: list[str] | None = Field(default=None, max_length=30)
    next_action: str | None = Field(default=None, max_length=2000)


@router.get("/workstreams")
async def list_workstreams(db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    await require_global_platform_access(current_user=current_user)
    return {"items": await FactoryExecutionService(db).list()}


@router.patch("/workstreams/{workstream_id}")
async def update_workstream(workstream_id: str, payload: WorkstreamUpdate, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    await require_global_platform_access(current_user=current_user)
    changes = payload.model_dump(exclude={"expected_revision"}, exclude_none=True)
    try:
        item = await FactoryExecutionService(db).update(workstream_id, expected_revision=payload.expected_revision, actor=current_user.id, changes=changes)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    record_audit_event(db, action="factory_execution_workstream_updated", actor_user_id=current_user.id, target_type="factory_execution_workstream", target_id=workstream_id, ip_address=request.client.host if request.client else None, detail={"revision": item["revision"], "changed_fields": sorted(changes)})
    await db.commit()
    return item
