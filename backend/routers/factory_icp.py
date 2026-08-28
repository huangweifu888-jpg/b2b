"""Tenant-scoped ICP definition, evidence, scoring and activation APIs."""

from decimal import Decimal
from typing import Literal

from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.factory_icp import FactoryIcpService
from services.tenant_access import require_project_access, require_project_permission
from sqlalchemy.ext.asyncio import AsyncSession


router = APIRouter(prefix="/api/v1/factory-platform/projects/{project_id}/icp-profiles", tags=["factory-platform-icp"])
PROFILE_MANAGE = "factory.identity.icp.profile.manage"
PROFILE_APPROVE = "factory.identity.icp.profile.approve"
EVIDENCE_CAPTURE = "factory.identity.icp.evidence.capture"
EVIDENCE_VERIFY = "factory.identity.icp.evidence.verify"
FIT_ASSESS = "factory.identity.icp.fit.assess"
FIT_VERIFY = "factory.identity.icp.fit.verify"
ACTIVATION_MANAGE = "factory.identity.icp.activation.manage"
ACTIVATION_ACK = "factory.identity.icp.activation.acknowledge"


class ProfileCreate(BaseModel):
    profile_code: str = Field(min_length=1, max_length=64)
    profile_name: str = Field(min_length=1, max_length=180)
    market_mode: Literal["domestic", "overseas", "global"]
    customer_type: Literal["b2b", "b2c", "hybrid"]
    objective: str = Field(min_length=8, max_length=4000)
    countries: list[str] = Field(min_length=1, max_length=100)
    industries: list[str] = Field(min_length=1, max_length=100)
    company_size_bands: list[str] = Field(min_length=1, max_length=50)
    product_references: list[str] = Field(min_length=1, max_length=200)
    required_roles: list[str] = Field(min_length=1, max_length=50)
    buying_triggers: list[str] = Field(min_length=1, max_length=100)
    minimum_potential_value: Decimal = Field(ge=0)
    currency: str = Field(min_length=3, max_length=8)
    scoring_weights: dict[str, int]


class BuyingRoleCreate(BaseModel):
    role_code: str = Field(min_length=1, max_length=64)
    role_name: str = Field(min_length=1, max_length=128)
    influence_type: Literal["economic-buyer", "technical-buyer", "champion", "user", "blocker"]
    pains: list[str] = Field(min_length=1, max_length=50)
    proof_requirements: list[str] = Field(min_length=1, max_length=50)
    preferred_channels: list[str] = Field(default_factory=list, max_length=50)


class ScenarioCreate(BaseModel):
    scenario_code: str = Field(min_length=1, max_length=64)
    scenario_name: str = Field(min_length=1, max_length=128)
    job_to_be_done: str = Field(min_length=8, max_length=4000)
    buying_trigger: str = Field(min_length=1, max_length=255)
    product_references: list[str] = Field(min_length=1, max_length=200)
    success_outcomes: list[str] = Field(min_length=1, max_length=50)
    disqualifiers: list[str] = Field(default_factory=list, max_length=50)


class RevisionReference(BaseModel):
    expected_revision: int = Field(gt=0)
    reference: str = Field(min_length=1, max_length=255)


class AccountEvidenceCreate(BaseModel):
    source_type: Literal["cpq-quote", "fulfillment-order", "customer-asset", "voice-of-customer"]
    source_id: str = Field(min_length=1, max_length=100)
    firmographic_country: str | None = Field(default=None, max_length=64)
    firmographic_industry: str | None = Field(default=None, max_length=128)
    firmographic_company_size: str | None = Field(default=None, max_length=64)
    firmographic_evidence_reference: str | None = Field(default=None, max_length=255)
    observed_roles: list[str] = Field(default_factory=list, max_length=50)
    observed_triggers: list[str] = Field(default_factory=list, max_length=100)
    observed_products: list[str] = Field(default_factory=list, max_length=200)


class AssessmentCreate(BaseModel):
    account_evidence_id: str = Field(min_length=1, max_length=100)


class ActivationCreate(BaseModel):
    consumer: Literal["lead-routing", "abm", "content-personalization", "sales-playbook"]
    minimum_fit_tier: Literal["A", "B", "C", "D"]
    delivery_reference: str = Field(min_length=1, max_length=255)


def _raise(exc):
    if isinstance(exc, KeyError):
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    raise HTTPException(status_code=409, detail=str(exc)) from exc


def _audit(db, request, user, *, action, target_type, item, project_id):
    if isinstance(item, dict) and isinstance(item.get("profile"), dict):
        item = item["profile"]
    record_audit_event(
        db, action=action, actor_user_id=user.id, project_id=project_id, target_type=target_type,
        target_id=str(item["id"]), ip_address=request.client.host if request.client else None,
        detail={"project_id": project_id, "status": item.get("status") or item.get("verification_status"), "revision": item.get("revision")},
    )


async def _run(db, request, user, project_id, permission, action, target_type, method, *, context=False, **kwargs):
    resolved = await require_project_permission(db, current_user=user, project_id=project_id, permission=permission)
    try:
        result = await method(project_id=project_id, actor=user.id, **({"context": resolved.context} if context else {}), **kwargs)
    except (KeyError, ValueError) as exc:
        _raise(exc)
    _audit(db, request, user, action=action, target_type=target_type, item=result, project_id=project_id)
    await db.commit()
    return result


@router.get("")
async def workspace(project_id: int, current_user: UserResponse = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await require_project_access(db, current_user=current_user, project_id=project_id)
    return await FactoryIcpService(db).list_workspace(project_id=project_id)


@router.post("")
async def create_profile(project_id: int, payload: ProfileCreate, request: Request, current_user: UserResponse = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await _run(db, request, current_user, project_id, PROFILE_MANAGE, "factory.icp.profile.create", "factory-icp-profile", FactoryIcpService(db).create_profile, context=True, **payload.model_dump())


@router.post("/{profile_id}/roles")
async def add_role(project_id: int, profile_id: str, payload: BuyingRoleCreate, request: Request, current_user: UserResponse = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await _run(db, request, current_user, project_id, PROFILE_MANAGE, "factory.icp.role.create", "factory-icp-role", FactoryIcpService(db).add_role, context=True, profile_id=profile_id, **payload.model_dump())


@router.post("/{profile_id}/scenarios")
async def add_scenario(project_id: int, profile_id: str, payload: ScenarioCreate, request: Request, current_user: UserResponse = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await _run(db, request, current_user, project_id, PROFILE_MANAGE, "factory.icp.scenario.create", "factory-icp-scenario", FactoryIcpService(db).add_scenario, context=True, profile_id=profile_id, **payload.model_dump())


@router.post("/{profile_id}/approve")
async def approve_profile(project_id: int, profile_id: str, payload: RevisionReference, request: Request, current_user: UserResponse = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await _run(db, request, current_user, project_id, PROFILE_APPROVE, "factory.icp.profile.approve", "factory-icp-profile", FactoryIcpService(db).approve_profile, profile_id=profile_id, expected_revision=payload.expected_revision, approval_reference=payload.reference)


@router.post("/{profile_id}/account-evidence")
async def capture_evidence(project_id: int, profile_id: str, payload: AccountEvidenceCreate, request: Request, current_user: UserResponse = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await _run(db, request, current_user, project_id, EVIDENCE_CAPTURE, "factory.icp.evidence.capture", "factory-icp-account-evidence", FactoryIcpService(db).capture_account_evidence, context=True, profile_id=profile_id, **payload.model_dump())


@router.post("/account-evidence/{evidence_id}/verify")
async def verify_evidence(project_id: int, evidence_id: str, payload: RevisionReference, request: Request, current_user: UserResponse = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await _run(db, request, current_user, project_id, EVIDENCE_VERIFY, "factory.icp.evidence.verify", "factory-icp-account-evidence", FactoryIcpService(db).verify_account_evidence, evidence_id=evidence_id, expected_revision=payload.expected_revision, verification_reference=payload.reference)


@router.post("/{profile_id}/assessments")
async def assess(project_id: int, profile_id: str, payload: AssessmentCreate, request: Request, current_user: UserResponse = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await _run(db, request, current_user, project_id, FIT_ASSESS, "factory.icp.fit.assess", "factory-icp-assessment", FactoryIcpService(db).assess_fit, context=True, profile_id=profile_id, **payload.model_dump())


@router.post("/assessments/{assessment_id}/verify")
async def verify_assessment(project_id: int, assessment_id: str, payload: RevisionReference, request: Request, current_user: UserResponse = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await _run(db, request, current_user, project_id, FIT_VERIFY, "factory.icp.fit.verify", "factory-icp-assessment", FactoryIcpService(db).verify_assessment, assessment_id=assessment_id, expected_revision=payload.expected_revision, verification_reference=payload.reference)


@router.post("/{profile_id}/activations")
async def activate(project_id: int, profile_id: str, payload: ActivationCreate, request: Request, current_user: UserResponse = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await _run(db, request, current_user, project_id, ACTIVATION_MANAGE, "factory.icp.activation.create", "factory-icp-activation", FactoryIcpService(db).create_activation, context=True, profile_id=profile_id, **payload.model_dump())


@router.post("/activations/{activation_id}/acknowledge")
async def acknowledge(project_id: int, activation_id: str, payload: RevisionReference, request: Request, current_user: UserResponse = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await _run(db, request, current_user, project_id, ACTIVATION_ACK, "factory.icp.activation.acknowledge", "factory-icp-activation", FactoryIcpService(db).acknowledge_activation, activation_id=activation_id, expected_revision=payload.expected_revision, acknowledgement_reference=payload.reference)


@router.post("/{profile_id}/retire")
async def retire(project_id: int, profile_id: str, payload: RevisionReference, request: Request, current_user: UserResponse = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await _run(db, request, current_user, project_id, PROFILE_APPROVE, "factory.icp.profile.retire", "factory-icp-profile", FactoryIcpService(db).retire_profile, profile_id=profile_id, expected_revision=payload.expected_revision, retirement_reference=payload.reference)
