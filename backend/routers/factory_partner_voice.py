"""Tenant-scoped partner, academy, VOC/NPS and advocacy APIs."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.factory_partner_voice import FactoryPartnerVoiceService
from services.tenant_access import require_project_access, require_project_permission
from sqlalchemy.ext.asyncio import AsyncSession


router = APIRouter(
    prefix="/api/v1/factory-platform/projects/{project_id}/partner-voice",
    tags=["factory-platform-partner-voice"],
)

PARTNER_MANAGE = "factory.care.partner-voice.partner.manage"
PARTNER_APPROVE = "factory.care.partner-voice.partner.approve"
VOICE_MANAGE = "factory.care.partner-voice.voice.manage"
VOICE_RESOLVE = "factory.care.partner-voice.voice.resolve"
ACADEMY_MANAGE = "factory.care.partner-voice.academy.manage"
ADVOCACY_PUBLISH = "factory.care.partner-voice.advocacy.publish"


class PartnerCreate(BaseModel):
    external_reference: str = Field(min_length=1, max_length=255)
    legal_name: str = Field(min_length=2, max_length=500)
    partner_type: Literal["distributor", "dealer", "service-partner", "customer"]
    country_code: str = Field(min_length=2, max_length=2)
    territory: str = Field(min_length=1, max_length=500)
    product_scope: list[str] = Field(min_length=1, max_length=100)
    primary_contact_reference: str = Field(min_length=1, max_length=500)
    relationship_evidence_reference: str = Field(min_length=1, max_length=500)
    account_reference: str | None = Field(default=None, max_length=255)


class PartnerActivate(BaseModel):
    expected_revision: int = Field(gt=0)
    agreement_reference: str = Field(min_length=1, max_length=500)
    approval_note: str = Field(min_length=8, max_length=4000)


class AcademyEnroll(BaseModel):
    partner_id: str = Field(min_length=1, max_length=100)
    enrollment_reference: str = Field(min_length=1, max_length=255)
    learner_reference: str = Field(min_length=1, max_length=500)
    course_code: str = Field(min_length=1, max_length=100)
    course_title: str = Field(min_length=3, max_length=500)
    course_version: str = Field(min_length=1, max_length=100)
    passing_score: int = Field(ge=1, le=100)
    planned_completion_at: datetime


class AcademyComplete(BaseModel):
    expected_revision: int = Field(gt=0)
    assessment_score: float = Field(ge=0, le=100)
    completion_evidence_reference: str = Field(min_length=1, max_length=500)


class AcademyCertify(BaseModel):
    expected_revision: int = Field(gt=0)
    certification_reference: str = Field(min_length=1, max_length=500)
    certification_expires_at: datetime


class VoiceCreate(BaseModel):
    feedback_reference: str = Field(min_length=1, max_length=255)
    source_type: Literal["nps", "csat", "complaint", "suggestion", "testimonial"]
    account_reference: str = Field(default="", max_length=255)
    category: str = Field(min_length=1, max_length=50)
    severity: Literal["low", "medium", "high", "critical"]
    summary: str = Field(min_length=8, max_length=4000)
    score: int | None = None
    partner_id: str | None = Field(default=None, max_length=100)
    related_order_id: str | None = Field(default=None, max_length=100)
    related_asset_id: str | None = Field(default=None, max_length=100)


class VoiceTriage(BaseModel):
    expected_revision: int = Field(gt=0)
    triage_reference: str = Field(min_length=1, max_length=500)
    owner: str = Field(min_length=1, max_length=255)
    due_at: datetime


class VoiceAction(BaseModel):
    expected_revision: int = Field(gt=0)
    root_cause: str = Field(min_length=8, max_length=4000)
    action_plan: str = Field(min_length=8, max_length=4000)
    action_reference: str = Field(min_length=1, max_length=500)


class VoiceResolve(BaseModel):
    expected_revision: int = Field(gt=0)
    resolution_reference: str = Field(min_length=1, max_length=500)
    resolution_note: str = Field(min_length=8, max_length=4000)
    escalation_reference: str | None = Field(default=None, max_length=500)


class VoiceConfirm(BaseModel):
    expected_revision: int = Field(gt=0)
    customer_confirmation_reference: str = Field(min_length=1, max_length=500)


class VoiceClose(BaseModel):
    expected_revision: int = Field(gt=0)
    closure_reference: str = Field(min_length=1, max_length=500)


class AdvocacyInvite(BaseModel):
    expected_revision: int = Field(gt=0)
    invitation_reference: str = Field(min_length=1, max_length=500)


class AdvocacyAuthorize(BaseModel):
    expected_revision: int = Field(gt=0)
    consent_reference: str = Field(min_length=1, max_length=500)
    consent_scope: str = Field(min_length=8, max_length=4000)
    consent_expires_at: datetime


class AdvocacyPublish(BaseModel):
    expected_revision: int = Field(gt=0)
    case_study_reference: str = Field(min_length=1, max_length=500)
    publication_channel: str = Field(min_length=1, max_length=255)


def _raise(exc: Exception) -> None:
    if isinstance(exc, KeyError):
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    raise HTTPException(status_code=409, detail=str(exc)) from exc


def _audit(db: AsyncSession, request: Request, user: UserResponse, *, action: str, target_type: str, item: dict[str, object], project_id: int) -> None:
    number = item.get("partner_number") or item.get("enrollment_number") or item.get("voice_number")
    status = item.get("status") or item.get("lifecycle_status")
    record_audit_event(
        db, action=action, actor_user_id=user.id, target_type=target_type,
        target_id=str(item["id"]), ip_address=request.client.host if request.client else None,
        detail={"project_id": project_id, "number": number, "status": status,
                "advocacy_status": item.get("advocacy_status"), "revision": item.get("revision")},
    )


@router.get("")
async def list_partner_voice_workspace(project_id: int, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    await require_project_access(db, current_user=current_user, project_id=project_id)
    return await FactoryPartnerVoiceService(db).list_workspace(project_id=project_id)


@router.post("/partners")
async def create_partner(project_id: int, payload: PartnerCreate, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    resolved = await require_project_permission(db, current_user=current_user, project_id=project_id, permission=PARTNER_MANAGE)
    try:
        item = await FactoryPartnerVoiceService(db).create_partner(project_id=project_id, context=resolved.context, actor=current_user.id, **payload.model_dump())
    except (KeyError, ValueError) as exc: _raise(exc)
    _audit(db, request, current_user, action="factory_partner_voice_partner_created", target_type="factory_partner_account", item=item, project_id=project_id)
    await db.commit(); return item


@router.post("/partners/{partner_id}/activate")
async def activate_partner(project_id: int, partner_id: str, payload: PartnerActivate, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    await require_project_permission(db, current_user=current_user, project_id=project_id, permission=PARTNER_APPROVE)
    try:
        item = await FactoryPartnerVoiceService(db).activate_partner(partner_id, project_id=project_id, actor=current_user.id, **payload.model_dump())
    except (KeyError, ValueError) as exc: _raise(exc)
    _audit(db, request, current_user, action="factory_partner_voice_partner_activated", target_type="factory_partner_account", item=item, project_id=project_id)
    await db.commit(); return item


@router.post("/academy")
async def enroll_academy(project_id: int, payload: AcademyEnroll, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    resolved = await require_project_permission(db, current_user=current_user, project_id=project_id, permission=ACADEMY_MANAGE)
    try:
        item = await FactoryPartnerVoiceService(db).enroll_academy(project_id=project_id, context=resolved.context, actor=current_user.id, **payload.model_dump())
    except (KeyError, ValueError) as exc: _raise(exc)
    _audit(db, request, current_user, action="factory_partner_voice_academy_enrolled", target_type="factory_partner_academy_enrollment", item=item, project_id=project_id)
    await db.commit(); return item


@router.post("/academy/{enrollment_id}/complete")
async def complete_academy(project_id: int, enrollment_id: str, payload: AcademyComplete, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    await require_project_permission(db, current_user=current_user, project_id=project_id, permission=ACADEMY_MANAGE)
    try:
        item = await FactoryPartnerVoiceService(db).complete_academy(enrollment_id, project_id=project_id, actor=current_user.id, **payload.model_dump())
    except (KeyError, ValueError) as exc: _raise(exc)
    _audit(db, request, current_user, action="factory_partner_voice_academy_completed", target_type="factory_partner_academy_enrollment", item=item, project_id=project_id)
    await db.commit(); return item


@router.post("/academy/{enrollment_id}/certify")
async def certify_academy(project_id: int, enrollment_id: str, payload: AcademyCertify, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    await require_project_permission(db, current_user=current_user, project_id=project_id, permission=ACADEMY_MANAGE)
    try:
        item = await FactoryPartnerVoiceService(db).certify_academy(enrollment_id, project_id=project_id, actor=current_user.id, **payload.model_dump())
    except (KeyError, ValueError) as exc: _raise(exc)
    _audit(db, request, current_user, action="factory_partner_voice_academy_certified", target_type="factory_partner_academy_enrollment", item=item, project_id=project_id)
    await db.commit(); return item


@router.post("/voices")
async def create_voice(project_id: int, payload: VoiceCreate, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    resolved = await require_project_permission(db, current_user=current_user, project_id=project_id, permission=VOICE_MANAGE)
    try:
        item = await FactoryPartnerVoiceService(db).create_voice(project_id=project_id, context=resolved.context, actor=current_user.id, **payload.model_dump())
    except (KeyError, ValueError) as exc: _raise(exc)
    _audit(db, request, current_user, action="factory_partner_voice_feedback_received", target_type="factory_voice_of_customer_case", item=item, project_id=project_id)
    await db.commit(); return item


async def _voice_action(project_id, voice_id, payload, request, db, current_user, *, permission, method, action):
    await require_project_permission(db, current_user=current_user, project_id=project_id, permission=permission)
    try:
        item = await getattr(FactoryPartnerVoiceService(db), method)(voice_id, project_id=project_id, actor=current_user.id, **payload.model_dump())
    except (KeyError, ValueError) as exc: _raise(exc)
    _audit(db, request, current_user, action=action, target_type="factory_voice_of_customer_case", item=item, project_id=project_id)
    await db.commit(); return item


@router.post("/voices/{voice_id}/triage")
async def triage_voice(project_id: int, voice_id: str, payload: VoiceTriage, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    return await _voice_action(project_id, voice_id, payload, request, db, current_user, permission=VOICE_MANAGE, method="triage_voice", action="factory_partner_voice_triaged")


@router.post("/voices/{voice_id}/start-action")
async def start_voice_action(project_id: int, voice_id: str, payload: VoiceAction, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    return await _voice_action(project_id, voice_id, payload, request, db, current_user, permission=VOICE_MANAGE, method="start_action", action="factory_partner_voice_action_started")


@router.post("/voices/{voice_id}/resolve")
async def resolve_voice(project_id: int, voice_id: str, payload: VoiceResolve, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    return await _voice_action(project_id, voice_id, payload, request, db, current_user, permission=VOICE_RESOLVE, method="resolve_voice", action="factory_partner_voice_resolved")


@router.post("/voices/{voice_id}/confirm")
async def confirm_voice(project_id: int, voice_id: str, payload: VoiceConfirm, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    return await _voice_action(project_id, voice_id, payload, request, db, current_user, permission=VOICE_RESOLVE, method="confirm_voice", action="factory_partner_voice_customer_confirmed")


@router.post("/voices/{voice_id}/close")
async def close_voice(project_id: int, voice_id: str, payload: VoiceClose, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    return await _voice_action(project_id, voice_id, payload, request, db, current_user, permission=VOICE_RESOLVE, method="close_voice", action="factory_partner_voice_closed")


@router.post("/voices/{voice_id}/advocacy-invite")
async def invite_advocacy(project_id: int, voice_id: str, payload: AdvocacyInvite, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    return await _voice_action(project_id, voice_id, payload, request, db, current_user, permission=VOICE_MANAGE, method="invite_advocacy", action="factory_partner_voice_advocacy_invited")


@router.post("/voices/{voice_id}/advocacy-authorize")
async def authorize_advocacy(project_id: int, voice_id: str, payload: AdvocacyAuthorize, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    return await _voice_action(project_id, voice_id, payload, request, db, current_user, permission=ADVOCACY_PUBLISH, method="authorize_advocacy", action="factory_partner_voice_advocacy_authorized")


@router.post("/voices/{voice_id}/advocacy-publish")
async def publish_advocacy(project_id: int, voice_id: str, payload: AdvocacyPublish, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    return await _voice_action(project_id, voice_id, payload, request, db, current_user, permission=ADVOCACY_PUBLISH, method="publish_advocacy", action="factory_partner_voice_advocacy_published")
