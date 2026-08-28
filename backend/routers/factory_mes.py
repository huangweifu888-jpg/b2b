"""Tenant-scoped MES work-order, operation and downtime APIs."""

from __future__ import annotations

from decimal import Decimal
from typing import Literal

from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.factory_mes import FactoryMesService
from services.tenant_access import require_project_access, require_project_permission
from sqlalchemy.ext.asyncio import AsyncSession


router = APIRouter(
    prefix="/api/v1/factory-platform/projects/{project_id}/manufacturing-execution",
    tags=["factory-platform-manufacturing-execution"],
)

MES_MANAGE = "factory.fulfillment.mes.manage"
MES_OPERATE = "factory.fulfillment.mes.operate"
MES_SUPERVISE = "factory.fulfillment.mes.supervise"


class MaterialLot(BaseModel):
    material_reference: str = Field(min_length=1, max_length=255)
    lot_reference: str = Field(min_length=1, max_length=255)
    issued_quantity: Decimal = Field(gt=0)
    source_receiving_reference: str = Field(min_length=1, max_length=500)


class RoutingOperation(BaseModel):
    operation_sequence: int = Field(gt=0)
    operation_code: str = Field(min_length=1, max_length=100)
    operation_name: str = Field(min_length=1, max_length=500)
    work_center_reference: str = Field(min_length=1, max_length=255)


class WorkOrderCreate(BaseModel):
    production_plan_id: str = Field(min_length=1, max_length=100)
    batch_reference: str = Field(min_length=1, max_length=255)
    material_lots: list[MaterialLot] = Field(min_length=1, max_length=100)
    routing: list[RoutingOperation] = Field(min_length=2, max_length=12)


class WorkOrderTransition(BaseModel):
    expected_revision: int = Field(gt=0)
    action: Literal["release", "complete"]
    evidence_reference: str = Field(min_length=1, max_length=500)


class OperationStart(BaseModel):
    expected_revision: int = Field(gt=0)
    operator_reference: str = Field(min_length=1, max_length=255)
    evidence_reference: str = Field(min_length=1, max_length=500)


class OperationComplete(BaseModel):
    expected_revision: int = Field(gt=0)
    good_quantity: Decimal = Field(ge=0)
    scrap_quantity: Decimal = Field(ge=0)
    evidence_reference: str = Field(min_length=1, max_length=500)


class DowntimeCreate(BaseModel):
    reason_code: str = Field(min_length=1, max_length=100)
    reason_note: str = Field(min_length=8, max_length=2000)


class DowntimeResolve(BaseModel):
    expected_revision: int = Field(gt=0)
    resolution_note: str = Field(min_length=8, max_length=2000)
    evidence_reference: str = Field(min_length=1, max_length=500)


@router.get("")
async def list_manufacturing_workspace(
    project_id: int, db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    await require_project_access(db, current_user=current_user, project_id=project_id)
    return await FactoryMesService(db).list_workspace(project_id=project_id)


@router.post("")
async def create_manufacturing_work_order(
    project_id: int, payload: WorkOrderCreate, request: Request,
    db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user),
):
    resolved = await require_project_permission(db, current_user=current_user, project_id=project_id, permission=MES_MANAGE)
    try:
        item = await FactoryMesService(db).create_work_order(
            project_id=project_id, context=resolved.context, actor=current_user.id,
            production_plan_id=payload.production_plan_id, batch_reference=payload.batch_reference,
            material_lots=[row.model_dump() for row in payload.material_lots],
            routing=[row.model_dump() for row in payload.routing],
        )
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    record_audit_event(db, action="factory_mes_work_order_created", actor_user_id=current_user.id, target_type="factory_manufacturing_work_order", target_id=item["id"], ip_address=request.client.host if request.client else None, detail={"project_id": project_id, "work_order_number": item["work_order_number"], "production_plan_number": item["production_plan_number"], "batch_reference": item["batch_reference"], "operation_count": len(item["operations"]), "material_lot_count": len(item["material_lots"])})
    await db.commit()
    return item


@router.post("/{work_order_id}/transition")
async def transition_manufacturing_work_order(
    project_id: int, work_order_id: str, payload: WorkOrderTransition, request: Request,
    db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user),
):
    await require_project_permission(db, current_user=current_user, project_id=project_id, permission=MES_MANAGE)
    try:
        item = await FactoryMesService(db).transition_work_order(work_order_id, project_id=project_id, actor=current_user.id, **payload.model_dump())
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    record_audit_event(db, action=f"factory_mes_work_order_{payload.action}", actor_user_id=current_user.id, target_type="factory_manufacturing_work_order", target_id=work_order_id, ip_address=request.client.host if request.client else None, detail={"project_id": project_id, "work_order_number": item["work_order_number"], "status": item["lifecycle_status"], "evidence_reference": payload.evidence_reference, "completed_quantity": item["completed_quantity"], "scrap_quantity": item["scrap_quantity"], "revision": item["revision"]})
    await db.commit()
    return item


@router.post("/operations/{operation_id}/start")
async def start_manufacturing_operation(
    project_id: int, operation_id: str, payload: OperationStart, request: Request,
    db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user),
):
    await require_project_permission(db, current_user=current_user, project_id=project_id, permission=MES_OPERATE)
    try:
        item = await FactoryMesService(db).start_operation(operation_id, project_id=project_id, actor=current_user.id, **payload.model_dump())
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    operation = next(row for row in item["operations"] if row["id"] == operation_id)
    record_audit_event(db, action="factory_mes_operation_started", actor_user_id=current_user.id, target_type="factory_manufacturing_operation", target_id=operation_id, ip_address=request.client.host if request.client else None, detail={"project_id": project_id, "work_order_number": item["work_order_number"], "operation_code": operation["operation_code"], "operator_reference": operation["operator_reference"], "input_quantity": operation["input_quantity"], "evidence_reference": payload.evidence_reference})
    await db.commit()
    return item


@router.post("/operations/{operation_id}/complete")
async def complete_manufacturing_operation(
    project_id: int, operation_id: str, payload: OperationComplete, request: Request,
    db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user),
):
    await require_project_permission(db, current_user=current_user, project_id=project_id, permission=MES_OPERATE)
    try:
        item = await FactoryMesService(db).complete_operation(operation_id, project_id=project_id, actor=current_user.id, **payload.model_dump())
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    operation = next(row for row in item["operations"] if row["id"] == operation_id)
    record_audit_event(db, action="factory_mes_operation_completed", actor_user_id=current_user.id, target_type="factory_manufacturing_operation", target_id=operation_id, ip_address=request.client.host if request.client else None, detail={"project_id": project_id, "work_order_number": item["work_order_number"], "operation_code": operation["operation_code"], "good_quantity": operation["good_quantity"], "scrap_quantity": operation["scrap_quantity"], "evidence_reference": payload.evidence_reference, "work_order_status": item["lifecycle_status"]})
    await db.commit()
    return item


@router.post("/operations/{operation_id}/downtimes")
async def open_manufacturing_downtime(
    project_id: int, operation_id: str, payload: DowntimeCreate, request: Request,
    db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user),
):
    resolved = await require_project_permission(db, current_user=current_user, project_id=project_id, permission=MES_SUPERVISE)
    try:
        item = await FactoryMesService(db).open_downtime(operation_id, project_id=project_id, context=resolved.context, actor=current_user.id, **payload.model_dump())
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    downtime = next(row for row in item["downtimes"] if row["lifecycle_status"] == "open")
    record_audit_event(db, action="factory_mes_downtime_opened", actor_user_id=current_user.id, target_type="factory_manufacturing_downtime", target_id=downtime["id"], ip_address=request.client.host if request.client else None, detail={"project_id": project_id, "work_order_number": item["work_order_number"], "operation_code": downtime["operation_code"], "downtime_number": downtime["downtime_number"], "reason_code": downtime["reason_code"]})
    await db.commit()
    return item


@router.post("/downtimes/{downtime_id}/resolve")
async def resolve_manufacturing_downtime(
    project_id: int, downtime_id: str, payload: DowntimeResolve, request: Request,
    db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user),
):
    await require_project_permission(db, current_user=current_user, project_id=project_id, permission=MES_SUPERVISE)
    try:
        item = await FactoryMesService(db).resolve_downtime(downtime_id, project_id=project_id, actor=current_user.id, **payload.model_dump())
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    downtime = next(row for row in item["downtimes"] if row["id"] == downtime_id)
    record_audit_event(db, action="factory_mes_downtime_resolved", actor_user_id=current_user.id, target_type="factory_manufacturing_downtime", target_id=downtime_id, ip_address=request.client.host if request.client else None, detail={"project_id": project_id, "work_order_number": item["work_order_number"], "downtime_number": downtime["downtime_number"], "duration_minutes": downtime["duration_minutes"], "evidence_reference": payload.evidence_reference})
    await db.commit()
    return item
