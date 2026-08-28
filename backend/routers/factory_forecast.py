"""Tenant-scoped governed rolling forecast APIs."""

from datetime import datetime
from typing import Literal

from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.factory_forecast import FactoryForecastService
from services.tenant_access import require_project_access, require_project_permission
from sqlalchemy.ext.asyncio import AsyncSession


router = APIRouter(
    prefix="/api/v1/factory-platform/projects/{project_id}/forecast",
    tags=["factory-platform-forecast"],
)

POLICY_MANAGE = "factory.decision.forecast.policy.manage"
POLICY_APPROVE = "factory.decision.forecast.policy.approve"
RUN_EXECUTE = "factory.decision.forecast.run.execute"
RUN_VERIFY = "factory.decision.forecast.run.verify"


class ForecastVersionPayload(BaseModel):
    version_reference: str = Field(min_length=1, max_length=255)
    label: str = Field(min_length=1, max_length=255)
    model_type: Literal["weighted-pipeline-capacity-cash"]
    horizon_days: int = Field(ge=7, le=365)
    bucket_days: int = Field(ge=1, le=365)
    demand_growth_percent: str = Field(min_length=1, max_length=30)
    pipeline_probability_percent: str = Field(min_length=1, max_length=30)
    collection_percent: str = Field(min_length=1, max_length=30)
    capacity_buffer_percent: str = Field(min_length=1, max_length=30)
    procurement_payment_percent: str = Field(min_length=1, max_length=30)
    effective_from: datetime
    change_reason: str = Field(min_length=8, max_length=4000)


class ForecastPolicyCreate(ForecastVersionPayload):
    policy_reference: str = Field(min_length=1, max_length=255)
    policy_code: str = Field(min_length=3, max_length=100)
    owner: str = Field(min_length=1, max_length=255)
    purpose: str = Field(min_length=8, max_length=4000)


class ForecastVersionCreate(ForecastVersionPayload):
    expected_policy_revision: int = Field(gt=0)


class RevisionEvidence(BaseModel):
    expected_revision: int = Field(gt=0)
    evidence_reference: str = Field(min_length=1, max_length=500)


class ForecastCalculate(BaseModel):
    policy_version_id: str = Field(min_length=1, max_length=100)
    forecast_reference: str = Field(min_length=1, max_length=255)
    as_of_at: datetime


class ForecastVerify(BaseModel):
    expected_revision: int = Field(gt=0)
    verification_reference: str = Field(min_length=1, max_length=500)
    verification_note: str = Field(min_length=8, max_length=4000)


def _raise(exc: Exception) -> None:
    if isinstance(exc, KeyError):
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    raise HTTPException(status_code=409, detail=str(exc)) from exc


def _audit(db: AsyncSession, request: Request, user: UserResponse, *, action: str,
           target_type: str, item: dict[str, object], project_id: int) -> None:
    number = next((item.get(key) for key in (
        "policy_number", "version_number_record", "run_number",
    ) if item.get(key)), None)
    record_audit_event(
        db, action=action, actor_user_id=user.id, project_id=project_id,
        target_type=target_type, target_id=str(item["id"]),
        ip_address=request.client.host if request.client else None,
        detail={"project_id": project_id, "number": number,
                "status": item.get("status"), "revision": item.get("revision")},
    )


@router.get("")
async def list_forecast(project_id: int, db: AsyncSession = Depends(get_db),
                        current_user: UserResponse = Depends(get_current_user)):
    await require_project_access(db, current_user=current_user, project_id=project_id)
    return await FactoryForecastService(db).list_workspace(project_id=project_id)


@router.post("/policies")
async def create_policy(project_id: int, payload: ForecastPolicyCreate, request: Request,
                        db: AsyncSession = Depends(get_db),
                        current_user: UserResponse = Depends(get_current_user)):
    resolved = await require_project_permission(
        db, current_user=current_user, project_id=project_id, permission=POLICY_MANAGE,
    )
    try:
        result = await FactoryForecastService(db).create_policy(
            project_id=project_id, context=resolved.context, actor=current_user.id,
            **payload.model_dump(),
        )
    except (KeyError, ValueError) as exc: _raise(exc)
    _audit(db, request, current_user, action="factory_forecast_policy_created",
           target_type="factory_forecast_policy", item=result["policy"], project_id=project_id)
    await db.commit(); return result


@router.post("/policies/{policy_id}/versions")
async def create_version(project_id: int, policy_id: str, payload: ForecastVersionCreate,
                         request: Request, db: AsyncSession = Depends(get_db),
                         current_user: UserResponse = Depends(get_current_user)):
    await require_project_permission(
        db, current_user=current_user, project_id=project_id, permission=POLICY_MANAGE,
    )
    try:
        result = await FactoryForecastService(db).create_policy_version(
            policy_id, project_id=project_id, actor=current_user.id, **payload.model_dump(),
        )
    except (KeyError, ValueError) as exc: _raise(exc)
    _audit(db, request, current_user, action="factory_forecast_policy_version_created",
           target_type="factory_forecast_policy_version", item=result["version"], project_id=project_id)
    await db.commit(); return result


@router.post("/policy-versions/{version_id}/submit")
async def submit_version(project_id: int, version_id: str, payload: RevisionEvidence,
                         request: Request, db: AsyncSession = Depends(get_db),
                         current_user: UserResponse = Depends(get_current_user)):
    await require_project_permission(
        db, current_user=current_user, project_id=project_id, permission=POLICY_MANAGE,
    )
    try:
        item = await FactoryForecastService(db).submit_policy_version(
            version_id, project_id=project_id, actor=current_user.id, **payload.model_dump(),
        )
    except (KeyError, ValueError) as exc: _raise(exc)
    _audit(db, request, current_user, action="factory_forecast_policy_submitted",
           target_type="factory_forecast_policy_version", item=item, project_id=project_id)
    await db.commit(); return item


@router.post("/policy-versions/{version_id}/approve")
async def approve_version(project_id: int, version_id: str, payload: RevisionEvidence,
                          request: Request, db: AsyncSession = Depends(get_db),
                          current_user: UserResponse = Depends(get_current_user)):
    await require_project_permission(
        db, current_user=current_user, project_id=project_id, permission=POLICY_APPROVE,
    )
    try:
        result = await FactoryForecastService(db).approve_policy_version(
            version_id, project_id=project_id, actor=current_user.id, **payload.model_dump(),
        )
    except (KeyError, ValueError) as exc: _raise(exc)
    _audit(db, request, current_user, action="factory_forecast_policy_published",
           target_type="factory_forecast_policy_version", item=result["version"], project_id=project_id)
    await db.commit(); return result


@router.post("/runs")
async def calculate(project_id: int, payload: ForecastCalculate, request: Request,
                    db: AsyncSession = Depends(get_db),
                    current_user: UserResponse = Depends(get_current_user)):
    resolved = await require_project_permission(
        db, current_user=current_user, project_id=project_id, permission=RUN_EXECUTE,
    )
    try:
        result = await FactoryForecastService(db).calculate(
            project_id=project_id, context=resolved.context, actor=current_user.id,
            **payload.model_dump(),
        )
    except (KeyError, ValueError) as exc: _raise(exc)
    _audit(db, request, current_user, action="factory_forecast_run_calculated",
           target_type="factory_forecast_run", item=result["run"], project_id=project_id)
    await db.commit(); return result


@router.post("/runs/{run_id}/verify")
async def verify(project_id: int, run_id: str, payload: ForecastVerify, request: Request,
                 db: AsyncSession = Depends(get_db),
                 current_user: UserResponse = Depends(get_current_user)):
    await require_project_permission(
        db, current_user=current_user, project_id=project_id, permission=RUN_VERIFY,
    )
    try:
        item = await FactoryForecastService(db).verify(
            run_id, project_id=project_id, actor=current_user.id, **payload.model_dump(),
        )
    except (KeyError, ValueError) as exc: _raise(exc)
    _audit(db, request, current_user, action="factory_forecast_run_published",
           target_type="factory_forecast_run", item=item, project_id=project_id)
    await db.commit(); return item
