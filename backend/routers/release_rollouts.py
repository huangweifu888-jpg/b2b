"""Headquarters-only staged release control plane; it records decisions but never deploys."""

from __future__ import annotations

from typing import Literal

from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.release_rollouts import ReleaseRolloutService
from services.tenant_access import require_global_platform_access
from sqlalchemy.ext.asyncio import AsyncSession


router = APIRouter(prefix="/api/v1/release-rollouts", tags=["release-rollouts"])


class RolloutCreate(BaseModel):
    version: str = Field(min_length=1, max_length=100)
    release_role: Literal["hq", "agency", "client"]
    deployment_id: str = Field(min_length=1, max_length=100)
    manifest_sha256: str = Field(pattern=r"^[a-fA-F0-9]{64}$")
    change_summary: str | None = Field(default=None, max_length=2000)


class RolloutAction(BaseModel):
    stage_key: Literal["hq", "test_agency", "test_client_plan", "full_rollout"]
    action: Literal["start", "approve", "fail"]
    note: str | None = Field(default=None, max_length=2000)


class RollbackRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=1000)


async def _audit(db: AsyncSession, request: Request, user: UserResponse, action: str, rollout_id: int, detail: dict) -> None:
    record_audit_event(db, action=action, actor_user_id=user.id, target_type="release_rollout", target_id=rollout_id, ip_address=request.client.host if request.client else None, detail=detail)
    await db.commit()


@router.get("")
async def list_rollouts(db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    await require_global_platform_access(current_user=current_user)
    return {"items": await ReleaseRolloutService(db).list()}


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_rollout(payload: RolloutCreate, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    await require_global_platform_access(current_user=current_user)
    try:
        result = await ReleaseRolloutService(db).create({**payload.model_dump(), "created_by": current_user.id})
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    await _audit(db, request, current_user, "release_rollout_created", result["id"], {"version": result["version"], "deployment_id": result["deployment_id"]})
    return result


@router.post("/{rollout_id}/action")
async def act_rollout(rollout_id: int, payload: RolloutAction, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    await require_global_platform_access(current_user=current_user)
    try:
        result = await ReleaseRolloutService(db).act(rollout_id, actor=current_user.id, **payload.model_dump())
    except KeyError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    await _audit(db, request, current_user, "release_rollout_stage_action", rollout_id, {"stage": payload.stage_key, "action": payload.action})
    return result


@router.post("/{rollout_id}/rollback")
async def rollback_rollout(rollout_id: int, payload: RollbackRequest, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    await require_global_platform_access(current_user=current_user)
    try:
        result = await ReleaseRolloutService(db).rollback(rollout_id, reason=payload.reason, actor=current_user.id)
    except KeyError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    await _audit(db, request, current_user, "release_rollout_rolled_back", rollout_id, {"reason": payload.reason})
    return result
