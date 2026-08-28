"""Tenant-scoped metric vocabulary, publication and evaluation APIs."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.factory_metric_semantics import FactoryMetricSemanticsService
from services.tenant_access import require_project_access, require_project_permission
from sqlalchemy.ext.asyncio import AsyncSession


router = APIRouter(
    prefix="/api/v1/factory-platform/projects/{project_id}/metric-center",
    tags=["factory-platform-metric-center"],
)

METRIC_DEFINITION_MANAGE = "factory.decision.metrics.definition.manage"
METRIC_VERSION_APPROVE = "factory.decision.metrics.version.approve"
METRIC_EVALUATION_EXECUTE = "factory.decision.metrics.evaluation.execute"
METRIC_EVALUATION_VERIFY = "factory.decision.metrics.evaluation.verify"


class MetricFormulaPayload(BaseModel):
    version_reference: str = Field(min_length=1, max_length=255)
    label: str = Field(min_length=1, max_length=255)
    description: str = Field(min_length=8, max_length=4000)
    unit: str = Field(min_length=1, max_length=50)
    aggregation: Literal["count", "sum", "average", "ratio", "percentage"]
    source_id: str = Field(min_length=1, max_length=100)
    value_field: str | None = Field(default=None, max_length=100)
    numerator_field: str | None = Field(default=None, max_length=100)
    denominator_field: str | None = Field(default=None, max_length=100)
    filter_field: str | None = Field(default=None, max_length=100)
    filter_operator: Literal["eq", "ne"] | None = None
    filter_value: str | None = Field(default=None, max_length=500)
    dimensions: list[str] = Field(default_factory=list, max_length=2)
    effective_from: datetime
    change_reason: str = Field(min_length=8, max_length=4000)


class MetricDefinitionCreate(MetricFormulaPayload):
    definition_reference: str = Field(min_length=1, max_length=255)
    metric_code: str = Field(min_length=3, max_length=100)
    domain: str = Field(min_length=1, max_length=50)
    owner: str = Field(min_length=1, max_length=255)
    purpose: str = Field(min_length=8, max_length=4000)


class MetricVersionCreate(MetricFormulaPayload):
    expected_definition_revision: int = Field(gt=0)


class MetricVersionSubmit(BaseModel):
    expected_revision: int = Field(gt=0)
    submission_reference: str = Field(min_length=1, max_length=500)


class MetricVersionApprove(BaseModel):
    expected_revision: int = Field(gt=0)
    approval_reference: str = Field(min_length=1, max_length=500)


class MetricEvaluate(BaseModel):
    warehouse_load_run_id: str = Field(min_length=1, max_length=100)
    evaluation_reference: str = Field(min_length=1, max_length=255)


class MetricEvaluationVerify(BaseModel):
    expected_revision: int = Field(gt=0)
    verification_reference: str = Field(min_length=1, max_length=500)
    verification_note: str = Field(min_length=8, max_length=4000)


def _raise(exc: Exception) -> None:
    if isinstance(exc, KeyError):
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    raise HTTPException(status_code=409, detail=str(exc)) from exc


def _audit(db: AsyncSession, request: Request, user: UserResponse, *, action: str,
           target_type: str, item: dict[str, object], project_id: int) -> None:
    number = item.get("definition_number") or item.get("version_number_record") or item.get("run_number")
    record_audit_event(
        db, action=action, actor_user_id=user.id, target_type=target_type,
        target_id=str(item["id"]), ip_address=request.client.host if request.client else None,
        detail={"project_id": project_id, "number": number, "status": item.get("status"),
                "revision": item.get("revision")},
    )


@router.get("")
async def list_metric_center(project_id: int, db: AsyncSession = Depends(get_db),
                             current_user: UserResponse = Depends(get_current_user)):
    await require_project_access(db, current_user=current_user, project_id=project_id)
    return await FactoryMetricSemanticsService(db).list_workspace(project_id=project_id)


@router.post("/definitions")
async def create_metric_definition(project_id: int, payload: MetricDefinitionCreate, request: Request,
                                   db: AsyncSession = Depends(get_db),
                                   current_user: UserResponse = Depends(get_current_user)):
    resolved = await require_project_permission(db, current_user=current_user, project_id=project_id, permission=METRIC_DEFINITION_MANAGE)
    try:
        result = await FactoryMetricSemanticsService(db).create_definition(
            project_id=project_id, context=resolved.context, actor=current_user.id, **payload.model_dump(),
        )
    except (KeyError, ValueError) as exc:
        _raise(exc)
    _audit(db, request, current_user, action="factory_metric_definition_created",
           target_type="factory_metric_definition", item=result["definition"], project_id=project_id)
    await db.commit()
    return result


@router.post("/definitions/{definition_id}/versions")
async def create_metric_version(project_id: int, definition_id: str, payload: MetricVersionCreate,
                                request: Request, db: AsyncSession = Depends(get_db),
                                current_user: UserResponse = Depends(get_current_user)):
    await require_project_permission(db, current_user=current_user, project_id=project_id, permission=METRIC_DEFINITION_MANAGE)
    try:
        result = await FactoryMetricSemanticsService(db).create_version(
            definition_id, project_id=project_id, actor=current_user.id, **payload.model_dump(),
        )
    except (KeyError, ValueError) as exc:
        _raise(exc)
    _audit(db, request, current_user, action="factory_metric_version_created",
           target_type="factory_metric_version", item=result["version"], project_id=project_id)
    await db.commit()
    return result


@router.post("/versions/{version_id}/submit")
async def submit_metric_version(project_id: int, version_id: str, payload: MetricVersionSubmit,
                                request: Request, db: AsyncSession = Depends(get_db),
                                current_user: UserResponse = Depends(get_current_user)):
    await require_project_permission(db, current_user=current_user, project_id=project_id, permission=METRIC_DEFINITION_MANAGE)
    try:
        item = await FactoryMetricSemanticsService(db).submit_version(
            version_id, project_id=project_id, actor=current_user.id, **payload.model_dump(),
        )
    except (KeyError, ValueError) as exc:
        _raise(exc)
    _audit(db, request, current_user, action="factory_metric_version_submitted",
           target_type="factory_metric_version", item=item, project_id=project_id)
    await db.commit()
    return item


@router.post("/versions/{version_id}/approve")
async def approve_metric_version(project_id: int, version_id: str, payload: MetricVersionApprove,
                                 request: Request, db: AsyncSession = Depends(get_db),
                                 current_user: UserResponse = Depends(get_current_user)):
    await require_project_permission(db, current_user=current_user, project_id=project_id, permission=METRIC_VERSION_APPROVE)
    try:
        result = await FactoryMetricSemanticsService(db).approve_version(
            version_id, project_id=project_id, actor=current_user.id, **payload.model_dump(),
        )
    except (KeyError, ValueError) as exc:
        _raise(exc)
    _audit(db, request, current_user, action="factory_metric_version_published",
           target_type="factory_metric_version", item=result["version"], project_id=project_id)
    await db.commit()
    return result


@router.post("/versions/{version_id}/evaluate")
async def evaluate_metric_version(project_id: int, version_id: str, payload: MetricEvaluate,
                                  request: Request, db: AsyncSession = Depends(get_db),
                                  current_user: UserResponse = Depends(get_current_user)):
    await require_project_permission(db, current_user=current_user, project_id=project_id, permission=METRIC_EVALUATION_EXECUTE)
    try:
        result = await FactoryMetricSemanticsService(db).evaluate(
            version_id, project_id=project_id, actor=current_user.id, **payload.model_dump(),
        )
    except (KeyError, ValueError) as exc:
        _raise(exc)
    _audit(db, request, current_user, action="factory_metric_evaluation_completed",
           target_type="factory_metric_evaluation_run", item=result["run"], project_id=project_id)
    await db.commit()
    return result


@router.post("/evaluation-runs/{run_id}/verify")
async def verify_metric_evaluation(project_id: int, run_id: str, payload: MetricEvaluationVerify,
                                   request: Request, db: AsyncSession = Depends(get_db),
                                   current_user: UserResponse = Depends(get_current_user)):
    await require_project_permission(db, current_user=current_user, project_id=project_id, permission=METRIC_EVALUATION_VERIFY)
    try:
        item = await FactoryMetricSemanticsService(db).verify_evaluation(
            run_id, project_id=project_id, actor=current_user.id, **payload.model_dump(),
        )
    except (KeyError, ValueError) as exc:
        _raise(exc)
    _audit(db, request, current_user, action="factory_metric_evaluation_published",
           target_type="factory_metric_evaluation_run", item=item, project_id=project_id)
    await db.commit()
    return item
