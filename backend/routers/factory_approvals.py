"""Tenant-scoped cross-domain approval workflow APIs."""

from datetime import datetime
from typing import Literal

from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.factory_approvals import FactoryApprovalService
from services.tenant_access import require_project_access, require_project_permission
from sqlalchemy.ext.asyncio import AsyncSession


router = APIRouter(prefix="/api/v1/factory-platform/projects/{project_id}/approval-center", tags=["factory-platform-approval-center"])
WORKFLOW_MANAGE = "factory.operations.approvals.workflow.manage"
WORKFLOW_APPROVE = "factory.operations.approvals.workflow.approve"
REQUEST_CREATE = "factory.operations.approvals.request.create"
REQUEST_REVIEW = "factory.operations.approvals.request.review"
DELEGATION_MANAGE = "factory.operations.approvals.delegation.manage"
HANDOFF_ACKNOWLEDGE = "factory.operations.approvals.handoff.acknowledge"


class StepDefinition(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    assignee_reference: str = Field(min_length=1, max_length=255)
    due_hours: int = Field(ge=1, le=720)


class WorkflowCreate(BaseModel):
    workflow_code: str = Field(min_length=1, max_length=100)
    workflow_name: str = Field(min_length=1, max_length=255)
    subject_type: Literal["cpq-quote", "purchase-order", "finance-document", "people-contract", "recruiting-offer", "erp-posting"]
    steps: list[StepDefinition] = Field(min_length=1, max_length=8)
    sla_hours: int = Field(ge=1, le=720)
    allow_delegation: bool = True


class RevisionEvidence(BaseModel):
    expected_revision: int = Field(gt=0)
    evidence_reference: str = Field(min_length=1, max_length=500)


class ApprovalRequestCreate(BaseModel):
    workflow_id: str = Field(min_length=1, max_length=100)
    subject_id: str = Field(min_length=1, max_length=100)
    subject_revision: int = Field(gt=0)
    request_reference: str = Field(min_length=1, max_length=255)
    business_reason: str = Field(min_length=8, max_length=4000)
    evidence_reference: str = Field(min_length=1, max_length=500)


class StepReview(BaseModel):
    expected_revision: int = Field(gt=0)
    decision: Literal["approve", "reject", "return"]
    reason: str = Field(min_length=8, max_length=4000)
    evidence_reference: str = Field(min_length=1, max_length=500)
    channel: Literal["web", "mobile", "api"] = "web"


class DelegationCreate(BaseModel):
    workflow_id: str | None = Field(default=None, max_length=100)
    subject_type: Literal["cpq-quote", "purchase-order", "finance-document", "people-contract", "recruiting-offer", "erp-posting"] | None = None
    delegator_reference: str = Field(min_length=1, max_length=255)
    delegate_reference: str = Field(min_length=1, max_length=255)
    starts_at: datetime
    ends_at: datetime
    reason: str = Field(min_length=8, max_length=4000)
    evidence_reference: str = Field(min_length=1, max_length=500)


def _raise(exc):
    if isinstance(exc, KeyError):
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    raise HTTPException(status_code=409, detail=str(exc)) from exc


def _item(payload):
    return payload.get("workflow", payload) if isinstance(payload, dict) else payload


def _audit(db, request, user, *, action, target_type, item, project_id):
    item = _item(item)
    number = next((item.get(key) for key in ("workflow_number", "request_number", "handoff_number", "delegation_number") if item.get(key)), None)
    record_audit_event(db, action=action, actor_user_id=user.id, project_id=project_id,
        target_type=target_type, target_id=str(item["id"]), ip_address=request.client.host if request.client else None,
        detail={"project_id": project_id, "number": number, "status": item.get("status"), "revision": item.get("revision")})


async def _run(db, request, user, project_id, permission, action, target_type, method, *, context=False, **kwargs):
    resolved = await require_project_permission(db, current_user=user, project_id=project_id, permission=permission)
    try:
        result = await method(project_id=project_id, actor=user.id,
            **({"context": resolved.context} if context else {}), **kwargs)
    except (KeyError, ValueError) as exc:
        _raise(exc)
    _audit(db, request, user, action=action, target_type=target_type, item=result, project_id=project_id)
    await db.commit()
    return result


@router.get("")
async def workspace(project_id: int, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    await require_project_access(db, current_user=current_user, project_id=project_id)
    return await FactoryApprovalService(db).list_workspace(project_id=project_id)


@router.post("/workflows")
async def create_workflow(project_id: int, payload: WorkflowCreate, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    return await _run(db, request, current_user, project_id, WORKFLOW_MANAGE,
        "factory_approval_workflow_created", "factory_approval_workflow", FactoryApprovalService(db).create_workflow,
        context=True, **payload.model_dump())


@router.post("/workflows/{item_id}/approve")
async def approve_workflow(project_id: int, item_id: str, payload: RevisionEvidence, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    return await _run(db, request, current_user, project_id, WORKFLOW_APPROVE,
        "factory_approval_workflow_activated", "factory_approval_workflow", FactoryApprovalService(db).approve_workflow,
        item_id=item_id, expected_revision=payload.expected_revision, approval_reference=payload.evidence_reference)


@router.post("/requests")
async def create_approval_request(project_id: int, payload: ApprovalRequestCreate, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    return await _run(db, request, current_user, project_id, REQUEST_CREATE,
        "factory_approval_request_submitted", "factory_approval_request", FactoryApprovalService(db).create_request,
        context=True, **payload.model_dump())


@router.post("/requests/{item_id}/review")
async def review_approval_step(project_id: int, item_id: str, payload: StepReview, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    return await _run(db, request, current_user, project_id, REQUEST_REVIEW,
        f"factory_approval_request_{payload.decision}", "factory_approval_request", FactoryApprovalService(db).review_step,
        item_id=item_id, **payload.model_dump())


@router.post("/delegations")
async def create_delegation(project_id: int, payload: DelegationCreate, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    return await _run(db, request, current_user, project_id, DELEGATION_MANAGE,
        "factory_approval_delegation_created", "factory_approval_delegation", FactoryApprovalService(db).create_delegation,
        context=True, **payload.model_dump())


@router.post("/handoffs/{item_id}/acknowledge")
async def acknowledge_handoff(project_id: int, item_id: str, payload: RevisionEvidence, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    return await _run(db, request, current_user, project_id, HANDOFF_ACKNOWLEDGE,
        "factory_approval_handoff_acknowledged", "factory_approval_handoff", FactoryApprovalService(db).acknowledge_handoff,
        item_id=item_id, expected_revision=payload.expected_revision, acknowledgement_reference=payload.evidence_reference)
