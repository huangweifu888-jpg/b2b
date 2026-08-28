"""Tenant-scoped governed recruiting, interview, offer and onboarding APIs."""

from datetime import date, datetime
from typing import Literal

from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.factory_recruiting import FactoryRecruitingService
from services.tenant_access import require_project_access, require_project_permission
from sqlalchemy.ext.asyncio import AsyncSession


router = APIRouter(prefix="/api/v1/factory-platform/projects/{project_id}/recruiting", tags=["factory-platform-recruiting"])
REQ_MANAGE="factory.operations.recruiting.requisition.manage"; REQ_APPROVE="factory.operations.recruiting.requisition.approve"
CANDIDATE_MANAGE="factory.operations.recruiting.candidate.manage"; APPLICATION_MANAGE="factory.operations.recruiting.application.manage"
INTERVIEW_MANAGE="factory.operations.recruiting.interview.manage"; INTERVIEW_ASSESS="factory.operations.recruiting.interview.assess"
DECISION_MAKE="factory.operations.recruiting.decision.make"; OFFER_MANAGE="factory.operations.recruiting.offer.manage"
OFFER_APPROVE="factory.operations.recruiting.offer.approve"


class RequisitionCreate(BaseModel):
    requisition_reference:str=Field(min_length=1,max_length=255); position_id:str=Field(min_length=1,max_length=100)
    opening_count:int=Field(ge=1,le=10000); employment_type:Literal["full-time","part-time","fixed-term","contractor","intern"]
    work_location:str=Field(min_length=1,max_length=255); target_start_date:date
    hiring_reason:str=Field(min_length=8,max_length=4000); rubric_version:str=Field(min_length=1,max_length=40)
    rubric:dict[str,str]


class CandidateCreate(BaseModel):
    candidate_reference:str=Field(min_length=1,max_length=255); display_name:str=Field(min_length=1,max_length=255)
    email:EmailStr; country_code:str=Field(pattern=r"^[A-Za-z]{2}$")
    source_type:Literal["candidate-direct","employee-referral","recruiting-agency"]
    source_reference:str=Field(min_length=1,max_length=500); consent_reference:str=Field(min_length=1,max_length=500)
    privacy_notice_reference:str=Field(min_length=1,max_length=500); retention_until:date
    profile_reference:str=Field(min_length=1,max_length=500)


class ApplicationCreate(BaseModel):
    requisition_id:str=Field(min_length=1,max_length=100); candidate_id:str=Field(min_length=1,max_length=100)
    application_reference:str=Field(min_length=1,max_length=255); submitted_evidence_reference:str=Field(min_length=1,max_length=500)


class InterviewCreate(BaseModel):
    application_id:str=Field(min_length=1,max_length=100)
    interview_type:Literal["structured-human","structured-ai-assisted"]
    scheduled_at:datetime; interviewer_reference:str=Field(min_length=1,max_length=500)


class InterviewComplete(BaseModel):
    expected_revision:int=Field(gt=0); skills_score:str=Field(min_length=1,max_length=20)
    evidence_score:str=Field(min_length=1,max_length=20); communication_score:str=Field(min_length=1,max_length=20)
    integrity_score:str=Field(min_length=1,max_length=20); transcript_reference:str=Field(min_length=1,max_length=500)
    citation_references:list[str]=Field(min_length=2,max_length=100)
    assessor_comment:str=Field(min_length=8,max_length=4000); ai_assisted:bool=False
    ai_model_reference:str|None=Field(default=None,max_length=500)


class ApplicationDecision(BaseModel):
    expected_revision:int=Field(gt=0); decision:Literal["advance","reject"]
    decision_reason:str=Field(min_length=8,max_length=4000); decision_reference:str=Field(min_length=1,max_length=500)


class OfferCreate(BaseModel):
    application_id:str=Field(min_length=1,max_length=100); offer_reference:str=Field(min_length=1,max_length=255)
    proposed_start_date:date; compensation_band:str=Field(min_length=1,max_length=100)
    offer_document_reference:str=Field(min_length=1,max_length=500)


class RevisionEvidence(BaseModel):
    expected_revision:int=Field(gt=0); evidence_reference:str=Field(min_length=1,max_length=500)


class OfferResponse(BaseModel):
    expected_revision:int=Field(gt=0); response:Literal["accepted","declined"]
    response_reference:str=Field(min_length=1,max_length=500)


def _raise(exc):
    if isinstance(exc,KeyError): raise HTTPException(status_code=404,detail=str(exc)) from exc
    raise HTTPException(status_code=409,detail=str(exc)) from exc


def _audit(db,request,user,*,action,target_type,item,project_id):
    if "interview" in item and "assessment" in item: item=item["interview"]
    number=next((item.get(k) for k in ("requisition_number","candidate_number","application_number","interview_number","offer_number") if item.get(k)),None)
    record_audit_event(db,action=action,actor_user_id=user.id,project_id=project_id,target_type=target_type,target_id=str(item["id"]),ip_address=request.client.host if request.client else None,detail={"project_id":project_id,"number":number,"status":item.get("status"),"revision":item.get("revision")})


async def _run(db,request,user,project_id,permission,action,target_type,method,*,context=False,**kwargs):
    resolved=await require_project_permission(db,current_user=user,project_id=project_id,permission=permission)
    try: item=await method(project_id=project_id,actor=user.id,**({"context":resolved.context} if context else {}),**kwargs)
    except (KeyError,ValueError) as exc: _raise(exc)
    _audit(db,request,user,action=action,target_type=target_type,item=item,project_id=project_id); await db.commit(); return item


@router.get("")
async def workspace(project_id:int,db:AsyncSession=Depends(get_db),current_user:UserResponse=Depends(get_current_user)):
    await require_project_access(db,current_user=current_user,project_id=project_id); return await FactoryRecruitingService(db).list_workspace(project_id=project_id)


@router.post("/requisitions")
async def create_requisition(project_id:int,payload:RequisitionCreate,request:Request,db:AsyncSession=Depends(get_db),current_user:UserResponse=Depends(get_current_user)):
    return await _run(db,request,current_user,project_id,REQ_MANAGE,"factory_recruiting_requisition_created","factory_recruiting_requisition",FactoryRecruitingService(db).create_requisition,context=True,**payload.model_dump())


@router.post("/requisitions/{item_id}/approve")
async def approve_requisition(project_id:int,item_id:str,payload:RevisionEvidence,request:Request,db:AsyncSession=Depends(get_db),current_user:UserResponse=Depends(get_current_user)):
    return await _run(db,request,current_user,project_id,REQ_APPROVE,"factory_recruiting_requisition_opened","factory_recruiting_requisition",FactoryRecruitingService(db).approve_requisition,item_id=item_id,expected_revision=payload.expected_revision,approval_reference=payload.evidence_reference)


@router.post("/candidates")
async def create_candidate(project_id:int,payload:CandidateCreate,request:Request,db:AsyncSession=Depends(get_db),current_user:UserResponse=Depends(get_current_user)):
    return await _run(db,request,current_user,project_id,CANDIDATE_MANAGE,"factory_recruiting_candidate_created","factory_recruiting_candidate",FactoryRecruitingService(db).create_candidate,context=True,**payload.model_dump())


@router.post("/applications")
async def create_application(project_id:int,payload:ApplicationCreate,request:Request,db:AsyncSession=Depends(get_db),current_user:UserResponse=Depends(get_current_user)):
    return await _run(db,request,current_user,project_id,APPLICATION_MANAGE,"factory_recruiting_application_submitted","factory_recruiting_application",FactoryRecruitingService(db).submit_application,context=True,**payload.model_dump())


@router.post("/interviews")
async def create_interview(project_id:int,payload:InterviewCreate,request:Request,db:AsyncSession=Depends(get_db),current_user:UserResponse=Depends(get_current_user)):
    return await _run(db,request,current_user,project_id,INTERVIEW_MANAGE,"factory_recruiting_interview_scheduled","factory_recruiting_interview",FactoryRecruitingService(db).schedule_interview,context=True,**payload.model_dump())


@router.post("/interviews/{item_id}/complete")
async def complete_interview(project_id:int,item_id:str,payload:InterviewComplete,request:Request,db:AsyncSession=Depends(get_db),current_user:UserResponse=Depends(get_current_user)):
    return await _run(db,request,current_user,project_id,INTERVIEW_ASSESS,"factory_recruiting_interview_assessed","factory_recruiting_interview",FactoryRecruitingService(db).complete_interview,item_id=item_id,**payload.model_dump())


@router.post("/applications/{item_id}/decide")
async def decide_application(project_id:int,item_id:str,payload:ApplicationDecision,request:Request,db:AsyncSession=Depends(get_db),current_user:UserResponse=Depends(get_current_user)):
    return await _run(db,request,current_user,project_id,DECISION_MAKE,"factory_recruiting_application_decided","factory_recruiting_application",FactoryRecruitingService(db).decide_application,item_id=item_id,**payload.model_dump())


@router.post("/offers")
async def create_offer(project_id:int,payload:OfferCreate,request:Request,db:AsyncSession=Depends(get_db),current_user:UserResponse=Depends(get_current_user)):
    return await _run(db,request,current_user,project_id,OFFER_MANAGE,"factory_recruiting_offer_created","factory_recruiting_offer",FactoryRecruitingService(db).create_offer,context=True,**payload.model_dump())


@router.post("/offers/{item_id}/approve")
async def approve_offer(project_id:int,item_id:str,payload:RevisionEvidence,request:Request,db:AsyncSession=Depends(get_db),current_user:UserResponse=Depends(get_current_user)):
    return await _run(db,request,current_user,project_id,OFFER_APPROVE,"factory_recruiting_offer_approved","factory_recruiting_offer",FactoryRecruitingService(db).approve_offer,item_id=item_id,expected_revision=payload.expected_revision,approval_reference=payload.evidence_reference)


@router.post("/offers/{item_id}/send")
async def send_offer(project_id:int,item_id:str,payload:RevisionEvidence,request:Request,db:AsyncSession=Depends(get_db),current_user:UserResponse=Depends(get_current_user)):
    return await _run(db,request,current_user,project_id,OFFER_MANAGE,"factory_recruiting_offer_sent","factory_recruiting_offer",FactoryRecruitingService(db).send_offer,item_id=item_id,expected_revision=payload.expected_revision,delivery_reference=payload.evidence_reference)


@router.post("/offers/{item_id}/respond")
async def respond_offer(project_id:int,item_id:str,payload:OfferResponse,request:Request,db:AsyncSession=Depends(get_db),current_user:UserResponse=Depends(get_current_user)):
    return await _run(db,request,current_user,project_id,OFFER_MANAGE,"factory_recruiting_offer_responded","factory_recruiting_offer",FactoryRecruitingService(db).respond_offer,item_id=item_id,**payload.model_dump())
