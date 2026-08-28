"""Tenant-scoped governed analytical warehouse APIs."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.factory_data_warehouse import FactoryDataWarehouseService
from services.tenant_access import require_project_access, require_project_permission
from sqlalchemy.ext.asyncio import AsyncSession


router = APIRouter(
    prefix="/api/v1/factory-platform/projects/{project_id}/data-warehouse",
    tags=["factory-platform-data-warehouse"],
)

WAREHOUSE_SOURCE_MANAGE = "factory.decision.data-warehouse.source.manage"
WAREHOUSE_SOURCE_APPROVE = "factory.decision.data-warehouse.source.approve"
WAREHOUSE_LOAD_EXECUTE = "factory.decision.data-warehouse.load.execute"
WAREHOUSE_LOAD_VALIDATE = "factory.decision.data-warehouse.load.validate"
WAREHOUSE_LOAD_PUBLISH = "factory.decision.data-warehouse.load.publish"


class WarehouseSourceCreate(BaseModel):
    source_reference: str = Field(min_length=1, max_length=255)
    source_code: Literal[
        "quotes", "orders", "quality", "assets", "revenue", "partner-voice",
        "capacity-resources", "production-plans", "purchase-orders",
    ]
    owner: str = Field(min_length=1, max_length=255)
    purpose: str = Field(min_length=8, max_length=4000)
    retention_days: int = Field(default=730, ge=30, le=3650)


class WarehouseSourceActivate(BaseModel):
    expected_revision: int = Field(gt=0)
    schema_contract_reference: str = Field(min_length=1, max_length=500)
    approval_reference: str = Field(min_length=1, max_length=500)


class WarehouseExtract(BaseModel):
    expected_source_revision: int = Field(gt=0)
    load_reference: str = Field(min_length=1, max_length=255)
    cutoff_at: datetime


class WarehouseValidate(BaseModel):
    expected_revision: int = Field(gt=0)
    validation_reference: str = Field(min_length=1, max_length=500)


class WarehousePublish(BaseModel):
    expected_revision: int = Field(gt=0)
    publication_reference: str = Field(min_length=1, max_length=500)


def _raise(exc: Exception) -> None:
    if isinstance(exc, KeyError):
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    raise HTTPException(status_code=409, detail=str(exc)) from exc


def _audit(db: AsyncSession, request: Request, user: UserResponse, *, action: str,
           target_type: str, item: dict[str, object], project_id: int) -> None:
    target = item.get("run") if isinstance(item.get("run"), dict) else item
    number = target.get("source_number") or target.get("run_number")
    record_audit_event(
        db, action=action, actor_user_id=user.id, project_id=project_id, target_type=target_type,
        target_id=str(target["id"]), ip_address=request.client.host if request.client else None,
        detail={"project_id": project_id, "number": number, "status": target.get("status"),
                "revision": target.get("revision")},
    )


@router.get("")
async def list_data_warehouse(project_id: int, db: AsyncSession = Depends(get_db),
                              current_user: UserResponse = Depends(get_current_user)):
    await require_project_access(db, current_user=current_user, project_id=project_id)
    return await FactoryDataWarehouseService(db).list_workspace(project_id=project_id)


@router.post("/sources")
async def create_warehouse_source(project_id: int, payload: WarehouseSourceCreate, request: Request,
                                  db: AsyncSession = Depends(get_db),
                                  current_user: UserResponse = Depends(get_current_user)):
    resolved = await require_project_permission(db, current_user=current_user, project_id=project_id, permission=WAREHOUSE_SOURCE_MANAGE)
    try:
        item = await FactoryDataWarehouseService(db).create_source(
            project_id=project_id, context=resolved.context, actor=current_user.id, **payload.model_dump(),
        )
    except (KeyError, ValueError) as exc:
        _raise(exc)
    _audit(db, request, current_user, action="factory_warehouse_source_registered",
           target_type="factory_warehouse_source", item=item, project_id=project_id)
    await db.commit()
    return item


@router.post("/sources/{source_id}/activate")
async def activate_warehouse_source(project_id: int, source_id: str, payload: WarehouseSourceActivate,
                                    request: Request, db: AsyncSession = Depends(get_db),
                                    current_user: UserResponse = Depends(get_current_user)):
    await require_project_permission(db, current_user=current_user, project_id=project_id, permission=WAREHOUSE_SOURCE_APPROVE)
    try:
        item = await FactoryDataWarehouseService(db).activate_source(
            source_id, project_id=project_id, actor=current_user.id, **payload.model_dump(),
        )
    except (KeyError, ValueError) as exc:
        _raise(exc)
    _audit(db, request, current_user, action="factory_warehouse_source_activated",
           target_type="factory_warehouse_source", item=item, project_id=project_id)
    await db.commit()
    return item


@router.post("/sources/{source_id}/extract")
async def extract_warehouse_source(project_id: int, source_id: str, payload: WarehouseExtract,
                                   request: Request, db: AsyncSession = Depends(get_db),
                                   current_user: UserResponse = Depends(get_current_user)):
    await require_project_permission(db, current_user=current_user, project_id=project_id, permission=WAREHOUSE_LOAD_EXECUTE)
    try:
        item = await FactoryDataWarehouseService(db).extract(
            source_id, project_id=project_id, actor=current_user.id, **payload.model_dump(),
        )
    except (KeyError, ValueError) as exc:
        _raise(exc)
    _audit(db, request, current_user, action="factory_warehouse_load_extracted",
           target_type="factory_warehouse_load_run", item=item, project_id=project_id)
    await db.commit()
    return item


@router.post("/runs/{run_id}/validate")
async def validate_warehouse_run(project_id: int, run_id: str, payload: WarehouseValidate,
                                 request: Request, db: AsyncSession = Depends(get_db),
                                 current_user: UserResponse = Depends(get_current_user)):
    await require_project_permission(db, current_user=current_user, project_id=project_id, permission=WAREHOUSE_LOAD_VALIDATE)
    try:
        item = await FactoryDataWarehouseService(db).validate(
            run_id, project_id=project_id, actor=current_user.id, **payload.model_dump(),
        )
    except (KeyError, ValueError) as exc:
        _raise(exc)
    action = "factory_warehouse_load_validated" if item["status"] == "validated" else "factory_warehouse_load_failed"
    _audit(db, request, current_user, action=action,
           target_type="factory_warehouse_load_run", item=item, project_id=project_id)
    await db.commit()
    return item


@router.post("/runs/{run_id}/publish")
async def publish_warehouse_run(project_id: int, run_id: str, payload: WarehousePublish,
                                request: Request, db: AsyncSession = Depends(get_db),
                                current_user: UserResponse = Depends(get_current_user)):
    await require_project_permission(db, current_user=current_user, project_id=project_id, permission=WAREHOUSE_LOAD_PUBLISH)
    try:
        item = await FactoryDataWarehouseService(db).publish(
            run_id, project_id=project_id, actor=current_user.id, **payload.model_dump(),
        )
    except (KeyError, ValueError) as exc:
        _raise(exc)
    _audit(db, request, current_user, action="factory_warehouse_load_published",
           target_type="factory_warehouse_load_run", item=item, project_id=project_id)
    await db.commit()
    return item
