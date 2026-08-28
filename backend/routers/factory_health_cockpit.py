"""Tenant-scoped operating-health cockpit APIs."""

from __future__ import annotations

from datetime import datetime

from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.factory_health_cockpit import FactoryHealthCockpitService
from services.tenant_access import require_project_access, require_project_permission
from sqlalchemy.ext.asyncio import AsyncSession


router = APIRouter(
    prefix="/api/v1/factory-platform/projects/{project_id}/health-cockpit",
    tags=["factory-platform-health-cockpit"],
)

HEALTH_REFRESH = "factory.decision.health-cockpit.refresh"
HEALTH_ALERT_MANAGE = "factory.decision.health-cockpit.alert.manage"
HEALTH_TASK_MANAGE = "factory.decision.health-cockpit.task.manage"
HEALTH_TASK_VERIFY = "factory.decision.health-cockpit.task.verify"


class SnapshotRefresh(BaseModel):
    snapshot_reference: str = Field(min_length=1, max_length=255)
    period_start: datetime
    period_end: datetime


class AlertAcknowledge(BaseModel):
    expected_revision: int = Field(gt=0)
    owner: str = Field(min_length=1, max_length=255)
    due_at: datetime
    acknowledgement_reference: str = Field(min_length=1, max_length=500)


class ResponsibilityTaskCreate(BaseModel):
    expected_alert_revision: int = Field(gt=0)
    owner: str = Field(min_length=1, max_length=255)
    action_plan: str = Field(min_length=8, max_length=4000)
    due_at: datetime
    assignment_reference: str = Field(min_length=1, max_length=500)


class TaskStart(BaseModel):
    expected_revision: int = Field(gt=0)
    start_reference: str = Field(min_length=1, max_length=500)


class TaskComplete(BaseModel):
    expected_revision: int = Field(gt=0)
    completion_note: str = Field(min_length=8, max_length=4000)
    completion_evidence_reference: str = Field(min_length=1, max_length=500)


class TaskVerify(BaseModel):
    expected_revision: int = Field(gt=0)
    verification_reference: str = Field(min_length=1, max_length=500)
    verification_note: str = Field(min_length=8, max_length=4000)


def _raise(exc: Exception) -> None:
    if isinstance(exc, KeyError):
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    raise HTTPException(status_code=409, detail=str(exc)) from exc


def _audit(db: AsyncSession, request: Request, user: UserResponse, *, action: str,
           target_type: str, item: dict[str, object], project_id: int) -> None:
    target = item.get("snapshot") if isinstance(item.get("snapshot"), dict) else item.get("task") if isinstance(item.get("task"), dict) else item
    number = target.get("snapshot_number") or target.get("alert_number") or target.get("task_number")
    record_audit_event(
        db, action=action, actor_user_id=user.id, target_type=target_type,
        target_id=str(target["id"]), ip_address=request.client.host if request.client else None,
        detail={"project_id": project_id, "number": number, "status": target.get("status"),
                "revision": target.get("revision")},
    )


@router.get("")
async def list_health_cockpit(project_id: int, db: AsyncSession = Depends(get_db),
                              current_user: UserResponse = Depends(get_current_user)):
    await require_project_access(db, current_user=current_user, project_id=project_id)
    return await FactoryHealthCockpitService(db).list_workspace(project_id=project_id)


@router.post("/refresh")
async def refresh_health_cockpit(project_id: int, payload: SnapshotRefresh, request: Request,
                                 db: AsyncSession = Depends(get_db),
                                 current_user: UserResponse = Depends(get_current_user)):
    resolved = await require_project_permission(db, current_user=current_user, project_id=project_id, permission=HEALTH_REFRESH)
    try:
        item = await FactoryHealthCockpitService(db).refresh(
            project_id=project_id, context=resolved.context, actor=current_user.id, **payload.model_dump(),
        )
    except (KeyError, ValueError) as exc:
        _raise(exc)
    _audit(db, request, current_user, action="factory_health_cockpit_refreshed",
           target_type="factory_health_cockpit_snapshot", item=item, project_id=project_id)
    await db.commit()
    return item


@router.post("/alerts/{alert_id}/acknowledge")
async def acknowledge_health_alert(project_id: int, alert_id: str, payload: AlertAcknowledge,
                                   request: Request, db: AsyncSession = Depends(get_db),
                                   current_user: UserResponse = Depends(get_current_user)):
    await require_project_permission(db, current_user=current_user, project_id=project_id, permission=HEALTH_ALERT_MANAGE)
    try:
        item = await FactoryHealthCockpitService(db).acknowledge_alert(
            alert_id, project_id=project_id, actor=current_user.id, **payload.model_dump(),
        )
    except (KeyError, ValueError) as exc:
        _raise(exc)
    _audit(db, request, current_user, action="factory_health_alert_acknowledged",
           target_type="factory_health_cockpit_alert", item=item, project_id=project_id)
    await db.commit()
    return item


@router.post("/alerts/{alert_id}/tasks")
async def create_health_task(project_id: int, alert_id: str, payload: ResponsibilityTaskCreate,
                             request: Request, db: AsyncSession = Depends(get_db),
                             current_user: UserResponse = Depends(get_current_user)):
    await require_project_permission(db, current_user=current_user, project_id=project_id, permission=HEALTH_TASK_MANAGE)
    try:
        item = await FactoryHealthCockpitService(db).create_task(
            alert_id, project_id=project_id, actor=current_user.id, **payload.model_dump(),
        )
    except (KeyError, ValueError) as exc:
        _raise(exc)
    _audit(db, request, current_user, action="factory_health_task_assigned",
           target_type="factory_health_responsibility_task", item=item, project_id=project_id)
    await db.commit()
    return item


@router.post("/tasks/{task_id}/start")
async def start_health_task(project_id: int, task_id: str, payload: TaskStart, request: Request,
                            db: AsyncSession = Depends(get_db),
                            current_user: UserResponse = Depends(get_current_user)):
    await require_project_permission(db, current_user=current_user, project_id=project_id, permission=HEALTH_TASK_MANAGE)
    try:
        item = await FactoryHealthCockpitService(db).start_task(
            task_id, project_id=project_id, actor=current_user.id, **payload.model_dump(),
        )
    except (KeyError, ValueError) as exc:
        _raise(exc)
    _audit(db, request, current_user, action="factory_health_task_started",
           target_type="factory_health_responsibility_task", item=item, project_id=project_id)
    await db.commit()
    return item


@router.post("/tasks/{task_id}/complete")
async def complete_health_task(project_id: int, task_id: str, payload: TaskComplete, request: Request,
                               db: AsyncSession = Depends(get_db),
                               current_user: UserResponse = Depends(get_current_user)):
    await require_project_permission(db, current_user=current_user, project_id=project_id, permission=HEALTH_TASK_MANAGE)
    try:
        item = await FactoryHealthCockpitService(db).complete_task(
            task_id, project_id=project_id, actor=current_user.id, **payload.model_dump(),
        )
    except (KeyError, ValueError) as exc:
        _raise(exc)
    _audit(db, request, current_user, action="factory_health_task_completed",
           target_type="factory_health_responsibility_task", item=item, project_id=project_id)
    await db.commit()
    return item


@router.post("/tasks/{task_id}/verify")
async def verify_health_task(project_id: int, task_id: str, payload: TaskVerify, request: Request,
                             db: AsyncSession = Depends(get_db),
                             current_user: UserResponse = Depends(get_current_user)):
    await require_project_permission(db, current_user=current_user, project_id=project_id, permission=HEALTH_TASK_VERIFY)
    try:
        item = await FactoryHealthCockpitService(db).verify_task(
            task_id, project_id=project_id, actor=current_user.id, **payload.model_dump(),
        )
    except (KeyError, ValueError) as exc:
        _raise(exc)
    _audit(db, request, current_user, action="factory_health_task_verified",
           target_type="factory_health_responsibility_task", item=item, project_id=project_id)
    await db.commit()
    return item
