"""Tenant-scoped consent-governed identity resolution APIs."""
from datetime import datetime
from typing import Literal

from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.factory_identity_resolution import FactoryIdentityResolutionService
from services.tenant_access import require_project_access, require_project_permission
from sqlalchemy.ext.asyncio import AsyncSession


router = APIRouter(prefix="/api/v1/factory-platform/projects/{project_id}/identity-resolution", tags=["factory-platform-identity-resolution"])
CONSENT_MANAGE="factory.portrait.identity.consent.manage"; CONSENT_APPROVE="factory.portrait.identity.consent.approve"; SIGNAL_MANAGE="factory.portrait.identity.signal.manage"; SIGNAL_VERIFY="factory.portrait.identity.signal.verify"; MATCH_PROPOSE="factory.portrait.identity.match.propose"; MATCH_DECIDE="factory.portrait.identity.match.decide"; PROFILE_PUBLISH="factory.portrait.identity.profile.publish"; ACK="factory.portrait.identity.handoff.acknowledge"


class ConsentCreate(BaseModel):
    subject_reference: str = Field(min_length=1,max_length=180)
    account_reference: str = Field(min_length=1,max_length=180)
    consent_reference: str = Field(min_length=1,max_length=255)
    lawful_basis: Literal["consent","contract","legitimate-interest"]
    purposes: list[str] = Field(min_length=1,max_length=16)
    expires_at: datetime


class RevisionReference(BaseModel):
    expected_revision: int = Field(gt=0)
    reference: str = Field(min_length=1,max_length=255)


class SignalCreate(BaseModel):
    consent_id: str = Field(min_length=1,max_length=100)
    signal_type: Literal["account","contact","email","phone","device"]
    identifier_hash: str = Field(min_length=64,max_length=64)
    display_hint: str = Field(default="",max_length=12)
    source_type: str = Field(min_length=1,max_length=40)
    source_reference: str = Field(min_length=1,max_length=255)
    source_revision: int = Field(gt=0)
    source_fingerprint: str = Field(min_length=64,max_length=64)


class MatchCreate(BaseModel):
    account_reference: str = Field(min_length=1,max_length=180)
    signal_ids: list[str] = Field(min_length=2,max_length=32)
    match_method: Literal["deterministic","probabilistic","manual"]
    match_score: float = Field(ge=0,le=100)
    reasons: list[str] = Field(min_length=1,max_length=16)


class MatchDecision(BaseModel):
    expected_revision: int = Field(gt=0)
    decision: Literal["approved","rejected"]
    reference: str = Field(min_length=1,max_length=255)


class ProfilePublish(BaseModel):
    expected_revision: int = Field(gt=0)
    consumers: list[Literal["cdp","crm","ads","service"]] = Field(min_length=1,max_length=4)
    remote_reference_prefix: str = Field(min_length=1,max_length=180)


def _raise(exc):
    if isinstance(exc,KeyError): raise HTTPException(status_code=404,detail=str(exc)) from exc
    raise HTTPException(status_code=409,detail=str(exc)) from exc


def _item(payload):
    if isinstance(payload,dict):
        for key in ("profile","version"):
            if isinstance(payload.get(key),dict): return payload[key]
    return payload


def _audit(db,request,user,action,target_type,item,project_id):
    item=_item(item);record_audit_event(db,action=action,actor_user_id=user.id,project_id=project_id,target_type=target_type,target_id=str(item["id"]),ip_address=request.client.host if request.client else None,detail={"project_id":project_id,"status":item.get("status"),"revision":item.get("revision")})


async def _run(db,request,user,project_id,permission,action,target_type,method,*,context=False,**kwargs):
    resolved=await require_project_permission(db,current_user=user,project_id=project_id,permission=permission)
    try: result=await method(project_id=project_id,actor=user.id,**({"context":resolved.context} if context else {}),**kwargs)
    except (KeyError,ValueError) as exc: _raise(exc)
    _audit(db,request,user,action,target_type,result,project_id);await db.commit();return result


@router.get("")
async def workspace(project_id:int,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):
    await require_project_access(db,current_user=current_user,project_id=project_id);return await FactoryIdentityResolutionService(db).list_workspace(project_id=project_id)


@router.post("/consents")
async def create_consent(project_id:int,payload:ConsentCreate,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)): return await _run(db,request,current_user,project_id,CONSENT_MANAGE,"factory.identity.consent.create","factory-identity-consent",FactoryIdentityResolutionService(db).create_consent,context=True,**payload.model_dump())


@router.post("/consents/{consent_id}/approve")
async def approve_consent(project_id:int,consent_id:str,payload:RevisionReference,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)): return await _run(db,request,current_user,project_id,CONSENT_APPROVE,"factory.identity.consent.approve","factory-identity-consent",FactoryIdentityResolutionService(db).approve_consent,consent_id=consent_id,**payload.model_dump())


@router.post("/consents/{consent_id}/revoke")
async def revoke_consent(project_id:int,consent_id:str,payload:RevisionReference,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)): return await _run(db,request,current_user,project_id,CONSENT_MANAGE,"factory.identity.consent.revoke","factory-identity-consent",FactoryIdentityResolutionService(db).revoke_consent,consent_id=consent_id,**payload.model_dump())


@router.post("/signals")
async def create_signal(project_id:int,payload:SignalCreate,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)): return await _run(db,request,current_user,project_id,SIGNAL_MANAGE,"factory.identity.signal.create","factory-identity-signal",FactoryIdentityResolutionService(db).add_signal,context=True,**payload.model_dump())


@router.post("/signals/{signal_id}/verify")
async def verify_signal(project_id:int,signal_id:str,payload:RevisionReference,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)): return await _run(db,request,current_user,project_id,SIGNAL_VERIFY,"factory.identity.signal.verify","factory-identity-signal",FactoryIdentityResolutionService(db).verify_signal,signal_id=signal_id,**payload.model_dump())


@router.post("/matches")
async def propose_match(project_id:int,payload:MatchCreate,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)): return await _run(db,request,current_user,project_id,MATCH_PROPOSE,"factory.identity.match.propose","factory-identity-match",FactoryIdentityResolutionService(db).propose_match,context=True,**payload.model_dump())


@router.post("/matches/{case_id}/decide")
async def decide_match(project_id:int,case_id:str,payload:MatchDecision,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)): return await _run(db,request,current_user,project_id,MATCH_DECIDE,"factory.identity.match.decide","factory-identity-match",FactoryIdentityResolutionService(db).decide_match,case_id=case_id,**payload.model_dump())


@router.post("/matches/{case_id}/profiles")
async def create_profile(project_id:int,case_id:str,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)): return await _run(db,request,current_user,project_id,MATCH_PROPOSE,"factory.identity.profile.create","factory-golden-profile",FactoryIdentityResolutionService(db).create_profile,context=True,case_id=case_id)


@router.post("/profiles/{profile_id}/publish")
async def publish_profile(project_id:int,profile_id:str,payload:ProfilePublish,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)): return await _run(db,request,current_user,project_id,PROFILE_PUBLISH,"factory.identity.profile.publish","factory-golden-profile",FactoryIdentityResolutionService(db).publish_profile,context=True,profile_id=profile_id,**payload.model_dump())


@router.post("/publications/{publication_id}/acknowledge")
async def acknowledge_publication(project_id:int,publication_id:str,payload:RevisionReference,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)): return await _run(db,request,current_user,project_id,ACK,"factory.identity.handoff.acknowledge","factory-identity-publication",FactoryIdentityResolutionService(db).acknowledge_publication,publication_id=publication_id,**payload.model_dump())
