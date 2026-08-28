"""Tenant-scoped governed AI question, scenario and action-handoff APIs."""

from datetime import datetime

from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.factory_ai_command import FactoryAiCommandService
from services.tenant_access import require_project_access, require_project_permission
from sqlalchemy.ext.asyncio import AsyncSession


router = APIRouter(
    prefix="/api/v1/factory-platform/projects/{project_id}/ai-command",
    tags=["factory-platform-ai-command"],
)

QUERY_EXECUTE = "factory.decision.ai-command.query.execute"
SCENARIO_EXECUTE = "factory.decision.ai-command.scenario.execute"
RECOMMENDATION_MANAGE = "factory.decision.ai-command.recommendation.manage"
RECOMMENDATION_APPROVE = "factory.decision.ai-command.recommendation.approve"
HANDOFF_MANAGE = "factory.decision.ai-command.handoff.manage"


class QueryCreate(BaseModel):
    query_reference: str = Field(min_length=1, max_length=255)
    question: str = Field(min_length=4, max_length=4000)


class ScenarioCreate(BaseModel):
    scenario_reference: str = Field(min_length=1, max_length=255)
    name: str = Field(min_length=1, max_length=255)
    demand_change_percent: str = Field(min_length=1, max_length=30)
    capacity_change_percent: str = Field(min_length=1, max_length=30)
    cash_in_change_percent: str = Field(min_length=1, max_length=30)
    cash_out_change_percent: str = Field(min_length=1, max_length=30)


class RecommendationCreate(BaseModel):
    query_id: str | None = Field(default=None, max_length=100)
    scenario_id: str | None = Field(default=None, max_length=100)
    title: str = Field(min_length=1, max_length=255)
    rationale: str = Field(min_length=8, max_length=4000)
    target_system: str = Field(min_length=2, max_length=60)
    owner: str = Field(min_length=1, max_length=255)
    due_at: datetime
    risk_level: str = Field(pattern="^(low|medium|high|critical)$")


class RevisionEvidence(BaseModel):
    expected_revision: int = Field(gt=0)
    evidence_reference: str = Field(min_length=1, max_length=500)


def _raise(exc: Exception) -> None:
    if isinstance(exc, KeyError):
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    raise HTTPException(status_code=409, detail=str(exc)) from exc


def _audit(db: AsyncSession, request: Request, user: UserResponse, *, action: str,
           target_type: str, item: dict[str, object], project_id: int) -> None:
    number = next((item.get(key) for key in (
        "query_number", "scenario_number", "recommendation_number", "handoff_number",
    ) if item.get(key)), None)
    record_audit_event(
        db, action=action, actor_user_id=user.id, project_id=project_id,
        target_type=target_type, target_id=str(item["id"]),
        ip_address=request.client.host if request.client else None,
        detail={"project_id": project_id, "number": number,
                "status": item.get("status"), "revision": item.get("revision")},
    )


@router.get("")
async def list_workspace(project_id: int, db: AsyncSession = Depends(get_db),
                         current_user: UserResponse = Depends(get_current_user)):
    await require_project_access(db, current_user=current_user, project_id=project_id)
    return await FactoryAiCommandService(db).list_workspace(project_id=project_id)


@router.post("/queries")
async def ask(project_id: int, payload: QueryCreate, request: Request,
              db: AsyncSession = Depends(get_db),
              current_user: UserResponse = Depends(get_current_user)):
    resolved = await require_project_permission(
        db, current_user=current_user, project_id=project_id, permission=QUERY_EXECUTE)
    try:
        result = await FactoryAiCommandService(db).ask(
            project_id=project_id, context=resolved.context, actor=current_user.id, **payload.model_dump())
    except (KeyError, ValueError) as exc: _raise(exc)
    _audit(db, request, current_user, action="factory_ai_command_query_answered",
           target_type="factory_ai_command_query", item=result["query"], project_id=project_id)
    await db.commit(); return result


@router.post("/scenarios")
async def simulate(project_id: int, payload: ScenarioCreate, request: Request,
                   db: AsyncSession = Depends(get_db),
                   current_user: UserResponse = Depends(get_current_user)):
    resolved = await require_project_permission(
        db, current_user=current_user, project_id=project_id, permission=SCENARIO_EXECUTE)
    try:
        item = await FactoryAiCommandService(db).simulate(
            project_id=project_id, context=resolved.context, actor=current_user.id, **payload.model_dump())
    except (KeyError, ValueError) as exc: _raise(exc)
    _audit(db, request, current_user, action="factory_ai_command_scenario_calculated",
           target_type="factory_ai_command_scenario", item=item, project_id=project_id)
    await db.commit(); return item


@router.post("/recommendations")
async def create_recommendation(project_id: int, payload: RecommendationCreate, request: Request,
                                db: AsyncSession = Depends(get_db),
                                current_user: UserResponse = Depends(get_current_user)):
    resolved = await require_project_permission(
        db, current_user=current_user, project_id=project_id, permission=RECOMMENDATION_MANAGE)
    try:
        item = await FactoryAiCommandService(db).create_recommendation(
            project_id=project_id, context=resolved.context, actor=current_user.id, **payload.model_dump())
    except (KeyError, ValueError) as exc: _raise(exc)
    _audit(db, request, current_user, action="factory_ai_command_recommendation_created",
           target_type="factory_ai_command_recommendation", item=item, project_id=project_id)
    await db.commit(); return item


@router.post("/recommendations/{item_id}/approve")
async def approve_recommendation(project_id: int, item_id: str, payload: RevisionEvidence,
                                 request: Request, db: AsyncSession = Depends(get_db),
                                 current_user: UserResponse = Depends(get_current_user)):
    await require_project_permission(
        db, current_user=current_user, project_id=project_id, permission=RECOMMENDATION_APPROVE)
    try:
        item = await FactoryAiCommandService(db).approve_recommendation(
            item_id, project_id=project_id, actor=current_user.id,
            expected_revision=payload.expected_revision, approval_reference=payload.evidence_reference)
    except (KeyError, ValueError) as exc: _raise(exc)
    _audit(db, request, current_user, action="factory_ai_command_recommendation_approved",
           target_type="factory_ai_command_recommendation", item=item, project_id=project_id)
    await db.commit(); return item


@router.post("/recommendations/{item_id}/handoff")
async def handoff(project_id: int, item_id: str, payload: RevisionEvidence, request: Request,
                  db: AsyncSession = Depends(get_db),
                  current_user: UserResponse = Depends(get_current_user)):
    await require_project_permission(
        db, current_user=current_user, project_id=project_id, permission=HANDOFF_MANAGE)
    try:
        result = await FactoryAiCommandService(db).handoff(
            item_id, project_id=project_id, actor=current_user.id,
            expected_revision=payload.expected_revision, handoff_reference=payload.evidence_reference)
    except (KeyError, ValueError) as exc: _raise(exc)
    _audit(db, request, current_user, action="factory_ai_command_recommendation_handed_off",
           target_type="factory_ai_command_handoff", item=result["handoff"], project_id=project_id)
    await db.commit(); return result


@router.post("/handoffs/{item_id}/close")
async def close_handoff(project_id: int, item_id: str, payload: RevisionEvidence, request: Request,
                        db: AsyncSession = Depends(get_db),
                        current_user: UserResponse = Depends(get_current_user)):
    await require_project_permission(
        db, current_user=current_user, project_id=project_id, permission=HANDOFF_MANAGE)
    try:
        result = await FactoryAiCommandService(db).close_handoff(
            item_id, project_id=project_id, actor=current_user.id,
            expected_revision=payload.expected_revision, execution_reference=payload.evidence_reference)
    except (KeyError, ValueError) as exc: _raise(exc)
    _audit(db, request, current_user, action="factory_ai_command_handoff_closed",
           target_type="factory_ai_command_handoff", item=result["handoff"], project_id=project_id)
    await db.commit(); return result
