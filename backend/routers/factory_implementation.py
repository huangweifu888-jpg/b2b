"""Tenant-scoped APIs for Factory Platform customer implementation programs."""

from __future__ import annotations

from typing import Literal

from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.factory_implementation import FactoryImplementationService
from services.tenant_access import require_project_access
from sqlalchemy.ext.asyncio import AsyncSession


router = APIRouter(prefix="/api/v1/factory-platform/projects/{project_id}/implementation-programs", tags=["factory-platform-implementation"])


class ImplementationCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    golden_flow: Literal["revenue", "manufacturing", "asset-renewal", "global-compliance", "intelligent-action"]
    baseline_summary: str = Field(min_length=1, max_length=4000)
    target_outcome: str = Field(min_length=1, max_length=4000)


class ImplementationUpdate(BaseModel):
    expected_revision: int = Field(gt=0)
    artifacts: dict[str, str] | None = None
    blockers: list[str] | None = None
    next_action: str | None = Field(default=None, max_length=2000)
    status: Literal["active", "blocked"] | None = None


class ImplementationAdvance(BaseModel):
    expected_revision: int = Field(gt=0)


@router.get("")
async def list_implementation_programs(project_id: int, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    await require_project_access(db, current_user=current_user, project_id=project_id)
    return {"items": await FactoryImplementationService(db).list(project_id=project_id)}


@router.post("")
async def create_implementation_program(project_id: int, payload: ImplementationCreate, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    resolved = await require_project_access(db, current_user=current_user, project_id=project_id)
    try:
        item = await FactoryImplementationService(db).create(project_id=project_id, context=resolved.context, actor=current_user.id, **payload.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    record_audit_event(db, action="factory_implementation_created", actor_user_id=current_user.id, target_type="factory_implementation_program", target_id=item["id"], ip_address=request.client.host if request.client else None, detail={"project_id": project_id, "golden_flow": item["golden_flow"]})
    await db.commit()
    return item


@router.patch("/{program_id}")
async def update_implementation_program(project_id: int, program_id: str, payload: ImplementationUpdate, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    await require_project_access(db, current_user=current_user, project_id=project_id)
    try:
        values = payload.model_dump(exclude_unset=True)
        expected_revision = values.pop("expected_revision")
        item = await FactoryImplementationService(db).update(program_id, project_id=project_id, expected_revision=expected_revision, actor=current_user.id, **values)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    record_audit_event(db, action="factory_implementation_updated", actor_user_id=current_user.id, target_type="factory_implementation_program", target_id=program_id, ip_address=request.client.host if request.client else None, detail={"project_id": project_id, "stage": item["current_stage"], "revision": item["revision"]})
    await db.commit()
    return item


@router.post("/{program_id}/advance")
async def advance_implementation_program(project_id: int, program_id: str, payload: ImplementationAdvance, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    await require_project_access(db, current_user=current_user, project_id=project_id)
    try:
        item = await FactoryImplementationService(db).advance(program_id, project_id=project_id, expected_revision=payload.expected_revision, actor=current_user.id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    record_audit_event(db, action="factory_implementation_advanced", actor_user_id=current_user.id, target_type="factory_implementation_program", target_id=program_id, ip_address=request.client.host if request.client else None, detail={"project_id": project_id, "stage": item["current_stage"], "revision": item["revision"]})
    await db.commit()
    return item
