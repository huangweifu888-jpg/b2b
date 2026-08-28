"""Tenant-scoped QMS inspection, nonconformance and release APIs."""

from __future__ import annotations

from typing import Literal

from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.factory_quality import FactoryQualityService
from services.tenant_access import require_project_access, require_project_permission
from sqlalchemy.ext.asyncio import AsyncSession


router = APIRouter(
    prefix="/api/v1/factory-platform/projects/{project_id}/quality-inspections",
    tags=["factory-platform-quality"],
)

QUALITY_INSPECT = "factory.fulfillment.quality.inspect"
QUALITY_RESOLVE = "factory.fulfillment.quality.resolve"
QUALITY_RELEASE = "factory.fulfillment.quality.release"


class InspectionCreate(BaseModel):
    order_id: str = Field(min_length=1, max_length=100)
    product_reference: str = Field(min_length=1, max_length=255)
    sku_reference: str = Field(min_length=1, max_length=255)
    inspection_reference: str = Field(min_length=1, max_length=255)
    inspection_type: Literal["incoming", "in-process", "final"] = "final"
    sample_size: int = Field(gt=0, le=1000000)


class InspectionStart(BaseModel):
    expected_revision: int = Field(gt=0)
    inspector: str = Field(min_length=1, max_length=255)


class CheckResult(BaseModel):
    check_code: Literal["appearance", "dimensions", "performance", "safety", "documentation"]
    passed: bool
    measured_value: str = Field(min_length=1, max_length=500)
    evidence_reference: str = Field(min_length=1, max_length=500)


class InspectionResults(BaseModel):
    expected_revision: int = Field(gt=0)
    accepted_quantity: int = Field(ge=0)
    rejected_quantity: int = Field(ge=0)
    check_results: list[CheckResult] = Field(min_length=5, max_length=5)


class FindingCreate(BaseModel):
    expected_revision: int = Field(gt=0)
    check_code: Literal["appearance", "dimensions", "performance", "safety", "documentation"]
    severity: Literal["minor", "major", "critical"]
    description: str = Field(min_length=4, max_length=1000)
    affected_quantity: int = Field(gt=0)


class FindingResolve(BaseModel):
    expected_revision: int = Field(gt=0)
    expected_inspection_revision: int = Field(gt=0)
    disposition: Literal["rework", "scrap", "use-as-is", "return-supplier"]
    root_cause: str = Field(min_length=8, max_length=2000)
    corrective_action: str = Field(min_length=8, max_length=2000)
    resolution_evidence_reference: str = Field(min_length=1, max_length=500)


class InspectionRelease(BaseModel):
    expected_revision: int = Field(gt=0)
    approval_reference: str = Field(min_length=1, max_length=255)
    release_note: str = Field(min_length=8, max_length=2000)


@router.get("")
async def list_quality_inspections(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    await require_project_access(db, current_user=current_user, project_id=project_id)
    return await FactoryQualityService(db).list_workspace(project_id=project_id)


@router.post("")
async def create_quality_inspection(
    project_id: int,
    payload: InspectionCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    resolved = await require_project_permission(db, current_user=current_user, project_id=project_id, permission=QUALITY_INSPECT)
    try:
        item = await FactoryQualityService(db).create_inspection(
            project_id=project_id,
            context=resolved.context,
            actor=current_user.id,
            **payload.model_dump(),
        )
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    record_audit_event(db, action="factory_quality_inspection_created", actor_user_id=current_user.id, target_type="factory_quality_inspection", target_id=item["id"], ip_address=request.client.host if request.client else None, detail={"project_id": project_id, "inspection_number": item["inspection_number"], "inspection_reference": item["inspection_reference"], "order_id": item["order_id"], "batch_reference": item["batch_reference"], "sample_size": item["sample_size"]})
    await db.commit()
    return item


@router.post("/{inspection_id}/start")
async def start_quality_inspection(
    project_id: int,
    inspection_id: str,
    payload: InspectionStart,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    await require_project_permission(db, current_user=current_user, project_id=project_id, permission=QUALITY_INSPECT)
    try:
        item = await FactoryQualityService(db).start_inspection(inspection_id, project_id=project_id, actor=current_user.id, **payload.model_dump())
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    record_audit_event(db, action="factory_quality_inspection_started", actor_user_id=current_user.id, target_type="factory_quality_inspection", target_id=inspection_id, ip_address=request.client.host if request.client else None, detail={"project_id": project_id, "inspection_number": item["inspection_number"], "inspector": item["inspector"], "revision": item["revision"]})
    await db.commit()
    return item


@router.post("/{inspection_id}/results")
async def record_quality_results(
    project_id: int,
    inspection_id: str,
    payload: InspectionResults,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    await require_project_permission(db, current_user=current_user, project_id=project_id, permission=QUALITY_INSPECT)
    try:
        item = await FactoryQualityService(db).record_results(inspection_id, project_id=project_id, actor=current_user.id, **payload.model_dump())
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    record_audit_event(db, action="factory_quality_results_recorded", actor_user_id=current_user.id, target_type="factory_quality_inspection", target_id=inspection_id, ip_address=request.client.host if request.client else None, detail={"project_id": project_id, "inspection_number": item["inspection_number"], "accepted_quantity": item["accepted_quantity"], "rejected_quantity": item["rejected_quantity"], "failed_check_count": sum(not result["passed"] for result in item["check_results"]), "revision": item["revision"]})
    await db.commit()
    return item


@router.post("/{inspection_id}/findings")
async def create_quality_finding(
    project_id: int,
    inspection_id: str,
    payload: FindingCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    resolved = await require_project_permission(db, current_user=current_user, project_id=project_id, permission=QUALITY_RESOLVE)
    try:
        item = await FactoryQualityService(db).create_finding(inspection_id, project_id=project_id, context=resolved.context, actor=current_user.id, **payload.model_dump())
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    finding = item["finding"]
    record_audit_event(db, action="factory_quality_finding_created", actor_user_id=current_user.id, target_type="factory_quality_finding", target_id=finding["id"], ip_address=request.client.host if request.client else None, detail={"project_id": project_id, "inspection_id": inspection_id, "finding_number": finding["finding_number"], "check_code": finding["check_code"], "severity": finding["severity"], "affected_quantity": finding["affected_quantity"]})
    await db.commit()
    return item


@router.post("/findings/{finding_id}/resolve")
async def resolve_quality_finding(
    project_id: int,
    finding_id: str,
    payload: FindingResolve,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    await require_project_permission(db, current_user=current_user, project_id=project_id, permission=QUALITY_RESOLVE)
    try:
        item = await FactoryQualityService(db).resolve_finding(finding_id, project_id=project_id, actor=current_user.id, **payload.model_dump())
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    finding = item["finding"]
    record_audit_event(db, action="factory_quality_finding_resolved", actor_user_id=current_user.id, target_type="factory_quality_finding", target_id=finding_id, ip_address=request.client.host if request.client else None, detail={"project_id": project_id, "inspection_id": finding["inspection_id"], "finding_number": finding["finding_number"], "disposition": finding["disposition"], "resolution_evidence_reference": finding["resolution_evidence_reference"], "revision": finding["revision"]})
    await db.commit()
    return item


@router.post("/{inspection_id}/release")
async def release_quality_inspection(
    project_id: int,
    inspection_id: str,
    payload: InspectionRelease,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    await require_project_permission(db, current_user=current_user, project_id=project_id, permission=QUALITY_RELEASE)
    try:
        item = await FactoryQualityService(db).release_inspection(inspection_id, project_id=project_id, actor=current_user.id, **payload.model_dump())
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    record_audit_event(db, action="factory_quality_inspection_released", actor_user_id=current_user.id, target_type="factory_quality_inspection", target_id=inspection_id, ip_address=request.client.host if request.client else None, detail={"project_id": project_id, "inspection_number": item["inspection_number"], "inspection_reference": item["inspection_reference"], "batch_reference": item["batch_reference"], "approval_reference": item["approval_reference"], "revision": item["revision"]})
    await db.commit()
    return item
