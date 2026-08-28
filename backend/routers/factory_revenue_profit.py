"""Tenant-scoped governed attribution and management contribution APIs."""

from datetime import datetime
from typing import Literal

from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.factory_revenue_profit import FactoryRevenueProfitService
from services.tenant_access import require_project_access, require_project_permission
from sqlalchemy.ext.asyncio import AsyncSession


router = APIRouter(
    prefix="/api/v1/factory-platform/projects/{project_id}/revenue-profit",
    tags=["factory-platform-revenue-profit"],
)

POLICY_MANAGE = "factory.decision.revenue-profit.policy.manage"
POLICY_APPROVE = "factory.decision.revenue-profit.policy.approve"
EVIDENCE_RECORD = "factory.decision.revenue-profit.evidence.record"
BINDING_VERIFY = "factory.decision.revenue-profit.binding.verify"
ANALYSIS_EXECUTE = "factory.decision.revenue-profit.analysis.execute"
ANALYSIS_VERIFY = "factory.decision.revenue-profit.analysis.verify"


class PolicyVersionPayload(BaseModel):
    version_reference: str = Field(min_length=1, max_length=255)
    label: str = Field(min_length=1, max_length=255)
    model_type: Literal["first-touch", "last-touch", "linear"]
    lookback_days: int = Field(ge=1, le=365)
    effective_from: datetime
    change_reason: str = Field(min_length=8, max_length=4000)


class PolicyCreate(PolicyVersionPayload):
    policy_reference: str = Field(min_length=1, max_length=255)
    policy_code: str = Field(min_length=3, max_length=100)
    owner: str = Field(min_length=1, max_length=255)
    purpose: str = Field(min_length=8, max_length=4000)


class PolicyVersionCreate(PolicyVersionPayload):
    expected_policy_revision: int = Field(gt=0)


class RevisionEvidence(BaseModel):
    expected_revision: int = Field(gt=0)
    evidence_reference: str = Field(min_length=1, max_length=500)


class TouchpointCreate(BaseModel):
    external_event_reference: str = Field(min_length=1, max_length=255)
    correlation_id: str = Field(min_length=1, max_length=100)
    account_reference: str = Field(min_length=1, max_length=255)
    channel: str = Field(min_length=1, max_length=100)
    campaign_reference: str = Field(min_length=1, max_length=255)
    content_reference: str | None = Field(default=None, max_length=255)
    occurred_at: datetime
    spend_amount: str = Field(min_length=1, max_length=50)
    currency: str = Field(min_length=3, max_length=3)
    consent_reference: str = Field(min_length=1, max_length=500)


class BindingCreate(BaseModel):
    binding_reference: str = Field(min_length=1, max_length=255)
    revenue_load_run_id: str = Field(min_length=1, max_length=100)
    revenue_fact_id: str = Field(min_length=1, max_length=100)
    quote_load_run_id: str = Field(min_length=1, max_length=100)
    quote_fact_id: str = Field(min_length=1, max_length=100)


class AnalysisCreate(BaseModel):
    binding_id: str = Field(min_length=1, max_length=100)
    policy_version_id: str = Field(min_length=1, max_length=100)
    analysis_reference: str = Field(min_length=1, max_length=255)


class AnalysisVerify(BaseModel):
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
        "policy_number", "version_number_record", "touchpoint_number",
        "binding_number", "run_number",
    ) if item.get(key)), None)
    record_audit_event(
        db, action=action, actor_user_id=user.id, project_id=project_id, target_type=target_type,
        target_id=str(item["id"]), ip_address=request.client.host if request.client else None,
        detail={"project_id": project_id, "number": number,
                "status": item.get("status"), "revision": item.get("revision")},
    )


@router.get("")
async def list_revenue_profit(project_id: int, db: AsyncSession = Depends(get_db),
                              current_user: UserResponse = Depends(get_current_user)):
    await require_project_access(db, current_user=current_user, project_id=project_id)
    return await FactoryRevenueProfitService(db).list_workspace(project_id=project_id)


@router.post("/policies")
async def create_policy(project_id: int, payload: PolicyCreate, request: Request,
                        db: AsyncSession = Depends(get_db),
                        current_user: UserResponse = Depends(get_current_user)):
    resolved = await require_project_permission(db, current_user=current_user, project_id=project_id, permission=POLICY_MANAGE)
    try:
        result = await FactoryRevenueProfitService(db).create_policy(
            project_id=project_id, context=resolved.context, actor=current_user.id, **payload.model_dump(),
        )
    except (KeyError, ValueError) as exc: _raise(exc)
    _audit(db, request, current_user, action="factory_attribution_policy_created",
           target_type="factory_attribution_policy", item=result["policy"], project_id=project_id)
    await db.commit(); return result


@router.post("/policies/{policy_id}/versions")
async def create_policy_version(project_id: int, policy_id: str, payload: PolicyVersionCreate,
                                request: Request, db: AsyncSession = Depends(get_db),
                                current_user: UserResponse = Depends(get_current_user)):
    await require_project_permission(db, current_user=current_user, project_id=project_id, permission=POLICY_MANAGE)
    try:
        result = await FactoryRevenueProfitService(db).create_policy_version(
            policy_id, project_id=project_id, actor=current_user.id, **payload.model_dump(),
        )
    except (KeyError, ValueError) as exc: _raise(exc)
    _audit(db, request, current_user, action="factory_attribution_policy_version_created",
           target_type="factory_attribution_policy_version", item=result["version"], project_id=project_id)
    await db.commit(); return result


@router.post("/policy-versions/{version_id}/submit")
async def submit_policy_version(project_id: int, version_id: str, payload: RevisionEvidence,
                                request: Request, db: AsyncSession = Depends(get_db),
                                current_user: UserResponse = Depends(get_current_user)):
    await require_project_permission(db, current_user=current_user, project_id=project_id, permission=POLICY_MANAGE)
    try:
        item = await FactoryRevenueProfitService(db).submit_policy_version(
            version_id, project_id=project_id, actor=current_user.id,
            expected_revision=payload.expected_revision, submission_reference=payload.evidence_reference,
        )
    except (KeyError, ValueError) as exc: _raise(exc)
    _audit(db, request, current_user, action="factory_attribution_policy_submitted",
           target_type="factory_attribution_policy_version", item=item, project_id=project_id)
    await db.commit(); return item


@router.post("/policy-versions/{version_id}/approve")
async def approve_policy_version(project_id: int, version_id: str, payload: RevisionEvidence,
                                 request: Request, db: AsyncSession = Depends(get_db),
                                 current_user: UserResponse = Depends(get_current_user)):
    await require_project_permission(db, current_user=current_user, project_id=project_id, permission=POLICY_APPROVE)
    try:
        result = await FactoryRevenueProfitService(db).approve_policy_version(
            version_id, project_id=project_id, actor=current_user.id,
            expected_revision=payload.expected_revision, approval_reference=payload.evidence_reference,
        )
    except (KeyError, ValueError) as exc: _raise(exc)
    _audit(db, request, current_user, action="factory_attribution_policy_published",
           target_type="factory_attribution_policy_version", item=result["version"], project_id=project_id)
    await db.commit(); return result


@router.post("/touchpoints")
async def create_touchpoint(project_id: int, payload: TouchpointCreate, request: Request,
                            db: AsyncSession = Depends(get_db),
                            current_user: UserResponse = Depends(get_current_user)):
    resolved = await require_project_permission(db, current_user=current_user, project_id=project_id, permission=EVIDENCE_RECORD)
    try:
        item = await FactoryRevenueProfitService(db).record_touchpoint(
            project_id=project_id, context=resolved.context, actor=current_user.id, **payload.model_dump(),
        )
    except (KeyError, ValueError) as exc: _raise(exc)
    _audit(db, request, current_user, action="factory_attribution_touchpoint_recorded",
           target_type="factory_attribution_touchpoint", item=item, project_id=project_id)
    await db.commit(); return item


@router.post("/bindings")
async def create_binding(project_id: int, payload: BindingCreate, request: Request,
                         db: AsyncSession = Depends(get_db),
                         current_user: UserResponse = Depends(get_current_user)):
    resolved = await require_project_permission(db, current_user=current_user, project_id=project_id, permission=EVIDENCE_RECORD)
    try:
        item = await FactoryRevenueProfitService(db).create_binding(
            project_id=project_id, context=resolved.context, actor=current_user.id, **payload.model_dump(),
        )
    except (KeyError, ValueError) as exc: _raise(exc)
    _audit(db, request, current_user, action="factory_revenue_profit_binding_created",
           target_type="factory_revenue_profit_binding", item=item, project_id=project_id)
    await db.commit(); return item


@router.post("/bindings/{binding_id}/verify")
async def verify_binding(project_id: int, binding_id: str, payload: RevisionEvidence,
                         request: Request, db: AsyncSession = Depends(get_db),
                         current_user: UserResponse = Depends(get_current_user)):
    await require_project_permission(db, current_user=current_user, project_id=project_id, permission=BINDING_VERIFY)
    try:
        item = await FactoryRevenueProfitService(db).verify_binding(
            binding_id, project_id=project_id, actor=current_user.id,
            expected_revision=payload.expected_revision, verification_reference=payload.evidence_reference,
        )
    except (KeyError, ValueError) as exc: _raise(exc)
    _audit(db, request, current_user, action="factory_revenue_profit_binding_verified",
           target_type="factory_revenue_profit_binding", item=item, project_id=project_id)
    await db.commit(); return item


@router.post("/analyses")
async def calculate_analysis(project_id: int, payload: AnalysisCreate, request: Request,
                             db: AsyncSession = Depends(get_db),
                             current_user: UserResponse = Depends(get_current_user)):
    await require_project_permission(db, current_user=current_user, project_id=project_id, permission=ANALYSIS_EXECUTE)
    try:
        result = await FactoryRevenueProfitService(db).calculate(
            project_id=project_id, actor=current_user.id, **payload.model_dump(),
        )
    except (KeyError, ValueError) as exc: _raise(exc)
    _audit(db, request, current_user, action="factory_revenue_profit_analysis_calculated",
           target_type="factory_revenue_profit_run", item=result["run"], project_id=project_id)
    await db.commit(); return result


@router.post("/analyses/{run_id}/verify")
async def verify_analysis(project_id: int, run_id: str, payload: AnalysisVerify,
                          request: Request, db: AsyncSession = Depends(get_db),
                          current_user: UserResponse = Depends(get_current_user)):
    await require_project_permission(db, current_user=current_user, project_id=project_id, permission=ANALYSIS_VERIFY)
    try:
        item = await FactoryRevenueProfitService(db).verify_analysis(
            run_id, project_id=project_id, actor=current_user.id, **payload.model_dump(),
        )
    except (KeyError, ValueError) as exc: _raise(exc)
    _audit(db, request, current_user, action="factory_revenue_profit_analysis_published",
           target_type="factory_revenue_profit_run", item=item, project_id=project_id)
    await db.commit(); return item
