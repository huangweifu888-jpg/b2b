"""Headquarters contract registry for the Factory Platform shared language."""

from __future__ import annotations

from typing import Literal

from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.factory_contract import FactoryContractService
from services.tenant_access import require_global_platform_access
from sqlalchemy.ext.asyncio import AsyncSession


router = APIRouter(prefix="/api/v1/factory-platform/contracts", tags=["factory-platform-contracts"])


class ObjectContractUpdate(BaseModel):
    expected_revision: int = Field(gt=0)
    system_of_record: str | None = Field(default=None, max_length=50)
    identity_rule: str | None = Field(default=None, max_length=2000)
    minimum_fields: list[str] | None = Field(default=None, max_length=40)
    lifecycle_status: Literal["draft", "frozen", "deprecated"] | None = None
    schema_version: int | None = Field(default=None, gt=0)


class EventContractUpdate(BaseModel):
    expected_revision: int = Field(gt=0)
    subject_id: str | None = Field(default=None, max_length=100)
    producer: str | None = Field(default=None, max_length=50)
    consumers: list[str] | None = Field(default=None, max_length=20)
    required_fields: list[str] | None = Field(default=None, max_length=40)
    compatibility: Literal["backward", "forward", "full", "breaking"] | None = None
    lifecycle_status: Literal["draft", "frozen", "deprecated"] | None = None
    schema_version: int | None = Field(default=None, gt=0)


@router.get("")
async def list_contracts(db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    await require_global_platform_access(current_user=current_user)
    return await FactoryContractService(db).list_registry()


@router.patch("/objects/{object_id}")
async def update_object_contract(object_id: str, payload: ObjectContractUpdate, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    await require_global_platform_access(current_user=current_user)
    changes = payload.model_dump(exclude={"expected_revision"}, exclude_none=True)
    try:
        item = await FactoryContractService(db).update_object(object_id, expected_revision=payload.expected_revision, actor=current_user.id, changes=changes)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    record_audit_event(db, action="factory_object_contract_updated", actor_user_id=current_user.id, target_type="factory_core_object_contract", target_id=object_id, ip_address=request.client.host if request.client else None, detail={"revision": item["revision"], "schema_version": item["schema_version"], "changed_fields": sorted(changes)})
    await db.commit()
    return item


@router.patch("/events/{event_id}")
async def update_event_contract(event_id: str, payload: EventContractUpdate, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    await require_global_platform_access(current_user=current_user)
    changes = payload.model_dump(exclude={"expected_revision"}, exclude_none=True)
    try:
        item = await FactoryContractService(db).update_event(event_id, expected_revision=payload.expected_revision, actor=current_user.id, changes=changes)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    record_audit_event(db, action="factory_event_contract_updated", actor_user_id=current_user.id, target_type="factory_core_event_contract", target_id=event_id, ip_address=request.client.host if request.client else None, detail={"revision": item["revision"], "schema_version": item["schema_version"], "changed_fields": sorted(changes)})
    await db.commit()
    return item


@router.post("/freeze")
async def freeze_contract_registry(request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    await require_global_platform_access(current_user=current_user)
    try:
        registry = await FactoryContractService(db).freeze_all(actor=current_user.id)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    summary = registry["summary"]
    record_audit_event(db, action="factory_contract_registry_frozen", actor_user_id=current_user.id, target_type="factory_contract_registry", target_id="core-v1", ip_address=request.client.host if request.client else None, detail=summary)
    await db.commit()
    return registry
