"""Tenant-scoped S&OP/MRP/finite-capacity planning APIs."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Literal

from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.factory_planning import FactoryPlanningService
from services.tenant_access import require_project_access, require_project_permission
from sqlalchemy.ext.asyncio import AsyncSession


router = APIRouter(
    prefix="/api/v1/factory-platform/projects/{project_id}/production-plans",
    tags=["factory-platform-production-planning"],
)

CAPACITY_MANAGE = "factory.fulfillment.capacity.manage"
PLANNING_MANAGE = "factory.fulfillment.planning.manage"
PLANNING_APPROVE = "factory.fulfillment.planning.approve"
PLANNING_RELEASE = "factory.fulfillment.planning.release"


class ResourceCreate(BaseModel):
    resource_reference: str = Field(min_length=1, max_length=255)
    resource_name: str = Field(min_length=1, max_length=500)
    daily_capacity: Decimal = Field(gt=0)
    shift_hours: Decimal = Field(gt=0, le=24)
    efficiency_percent: Decimal = Field(gt=0, le=100)
    calendar_evidence_reference: str = Field(min_length=1, max_length=500)


class ResourceApproval(BaseModel):
    expected_revision: int = Field(gt=0)
    approval_reference: str = Field(min_length=1, max_length=255)
    approval_note: str = Field(min_length=8, max_length=2000)


class ProductionPlanCreate(BaseModel):
    demand_order_id: str = Field(min_length=1, max_length=100)
    engineering_version_id: str = Field(min_length=1, max_length=100)
    resource_id: str = Field(min_length=1, max_length=100)
    due_at: datetime


class RevisionPayload(BaseModel):
    expected_revision: int = Field(gt=0)


class ProductionPlanTransition(BaseModel):
    expected_revision: int = Field(gt=0)
    action: Literal["submit", "approve", "release"]
    note: str | None = Field(default=None, max_length=2000)
    approval_reference: str | None = Field(default=None, max_length=255)
    release_reference: str | None = Field(default=None, max_length=255)


@router.get("")
async def list_planning_workspace(
    project_id: int, db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    await require_project_access(db, current_user=current_user, project_id=project_id)
    return await FactoryPlanningService(db).list_workspace(project_id=project_id)


@router.post("/resources")
async def create_planning_resource(
    project_id: int, payload: ResourceCreate, request: Request,
    db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user),
):
    resolved = await require_project_permission(db, current_user=current_user, project_id=project_id, permission=CAPACITY_MANAGE)
    try:
        item = await FactoryPlanningService(db).create_resource(
            project_id=project_id, context=resolved.context, actor=current_user.id, **payload.model_dump(),
        )
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    record_audit_event(db, action="factory_planning_resource_created", actor_user_id=current_user.id, target_type="factory_planning_resource", target_id=item["id"], ip_address=request.client.host if request.client else None, detail={"project_id": project_id, "resource_number": item["resource_number"], "resource_reference": item["resource_reference"], "daily_capacity": item["daily_capacity"], "efficiency_percent": item["efficiency_percent"]})
    await db.commit()
    return item


@router.post("/resources/{resource_id}/approve")
async def approve_planning_resource(
    project_id: int, resource_id: str, payload: ResourceApproval, request: Request,
    db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user),
):
    await require_project_permission(db, current_user=current_user, project_id=project_id, permission=CAPACITY_MANAGE)
    try:
        item = await FactoryPlanningService(db).approve_resource(resource_id, project_id=project_id, actor=current_user.id, **payload.model_dump())
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    record_audit_event(db, action="factory_planning_resource_approved", actor_user_id=current_user.id, target_type="factory_planning_resource", target_id=resource_id, ip_address=request.client.host if request.client else None, detail={"project_id": project_id, "resource_number": item["resource_number"], "approval_reference": item["approval_reference"], "revision": item["revision"]})
    await db.commit()
    return item


@router.post("")
async def create_production_plan(
    project_id: int, payload: ProductionPlanCreate, request: Request,
    db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user),
):
    resolved = await require_project_permission(db, current_user=current_user, project_id=project_id, permission=PLANNING_MANAGE)
    try:
        item = await FactoryPlanningService(db).create_plan(project_id=project_id, context=resolved.context, actor=current_user.id, **payload.model_dump())
    except (KeyError, ValueError) as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    record_audit_event(db, action="factory_production_plan_created", actor_user_id=current_user.id, target_type="factory_production_plan", target_id=item["id"], ip_address=request.client.host if request.client else None, detail={"project_id": project_id, "production_plan_number": item["production_plan_number"], "demand_order_number": item["demand_order_number"], "engineering_number": item["engineering_number"], "resource_number": item["resource_number"], "material_readiness_status": item["material_readiness_status"], "schedule_status": item["schedule_status"]})
    await db.commit()
    return item


@router.post("/{production_plan_id}/recalculate")
async def recalculate_production_plan(
    project_id: int, production_plan_id: str, payload: RevisionPayload, request: Request,
    db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user),
):
    await require_project_permission(db, current_user=current_user, project_id=project_id, permission=PLANNING_MANAGE)
    try:
        item = await FactoryPlanningService(db).recalculate_plan(production_plan_id, project_id=project_id, actor=current_user.id, **payload.model_dump())
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    record_audit_event(db, action="factory_production_plan_recalculated", actor_user_id=current_user.id, target_type="factory_production_plan", target_id=production_plan_id, ip_address=request.client.host if request.client else None, detail={"project_id": project_id, "production_plan_number": item["production_plan_number"], "material_readiness_status": item["material_readiness_status"], "schedule_status": item["schedule_status"], "revision": item["revision"]})
    await db.commit()
    return item


@router.post("/{production_plan_id}/transition")
async def transition_production_plan(
    project_id: int, production_plan_id: str, payload: ProductionPlanTransition, request: Request,
    db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user),
):
    permission = PLANNING_APPROVE if payload.action == "approve" else PLANNING_RELEASE if payload.action == "release" else PLANNING_MANAGE
    await require_project_permission(db, current_user=current_user, project_id=project_id, permission=permission)
    try:
        item = await FactoryPlanningService(db).transition_plan(production_plan_id, project_id=project_id, actor=current_user.id, **payload.model_dump())
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    record_audit_event(db, action=f"factory_production_plan_{payload.action}", actor_user_id=current_user.id, target_type="factory_production_plan", target_id=production_plan_id, ip_address=request.client.host if request.client else None, detail={"project_id": project_id, "production_plan_number": item["production_plan_number"], "status": item["lifecycle_status"], "material_readiness_status": item["material_readiness_status"], "schedule_status": item["schedule_status"], "evidence_reference": item["milestones"][-1]["evidenceReference"], "work_order_intent_reference": item["work_order_intent_reference"], "revision": item["revision"]})
    await db.commit()
    return item
