"""Permissioned public-mention assessment and response handoff APIs."""
from typing import Any
from fastapi import APIRouter,Depends,HTTPException,Request
from pydantic import BaseModel,Field
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_db
from dependencies.auth import get_current_user
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.factory_reputation import FactoryReputationService
from services.tenant_access import require_project_access,require_project_permission
router=APIRouter(prefix="/api/v1/factory-platform/projects/{project_id}/reputation",tags=["factory-platform-reputation"])
MANAGE="factory.trust.reputation.mention.manage";VERIFY="factory.trust.reputation.assessment.verify";APPROVE="factory.trust.reputation.release.approve";ACK="factory.trust.reputation.handoff.acknowledge"
class MentionCreate(BaseModel):public_reference:str=Field(min_length=2,max_length=255);channel:str=Field(min_length=2,max_length=48);sentiment:str=Field(pattern="^(positive|neutral|negative)$");observed_on:str=Field(min_length=8,max_length=32)
class AssessmentCreate(BaseModel):assessment_manifest:dict[str,Any]
class ReleaseCreate(BaseModel):target:str=Field(pattern="^(marketing-owner|service-owner|pr-owner)$");response_manifest:dict[str,Any];rollback_reference:str=Field(min_length=1,max_length=255)
class RevisionReference(BaseModel):expected_revision:int=Field(gt=0);reference:str=Field(min_length=1,max_length=255)
def _fail(error):raise HTTPException(status_code=404 if isinstance(error,KeyError) else 409,detail=str(error)) from error
async def _run(db,request,user,project_id,permission,action,target_type,operation,*,context=False,**kwargs):
 await require_project_access(db,current_user=user,project_id=project_id);resolved=await require_project_permission(db,current_user=user,project_id=project_id,permission=permission)
 try:item=await operation(project_id=project_id,actor=user.id,**({"context":resolved.context} if context else {}),**kwargs)
 except(KeyError,ValueError)as error:_fail(error)
 record_audit_event(db,action=action,actor_user_id=user.id,project_id=project_id,target_type=target_type,target_id=str(item.get("id")),ip_address=request.client.host if request.client else None,detail={"project_id":project_id,"status":item.get("status"),"revision":item.get("revision")});await db.commit();return item
@router.get("")
async def workspace(project_id:int,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):
 await require_project_access(db,current_user=current_user,project_id=project_id);return await FactoryReputationService(db).workspace(project_id=project_id)
@router.post("/mentions")
async def create_mention(project_id:int,payload:MentionCreate,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,MANAGE,"factory.reputation.mention.create","factory-reputation-mention",FactoryReputationService(db).create_mention,context=True,**payload.model_dump())
@router.post("/mentions/{mention_id}/assessments")
async def draft_assessment(project_id:int,mention_id:str,payload:AssessmentCreate,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,MANAGE,"factory.reputation.assessment.draft","factory-reputation-assessment",FactoryReputationService(db).draft_assessment,context=True,mention_id=mention_id,**payload.model_dump())
@router.post("/assessments/{assessment_id}/verify")
async def verify_assessment(project_id:int,assessment_id:str,payload:RevisionReference,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,VERIFY,"factory.reputation.assessment.verify","factory-reputation-assessment",FactoryReputationService(db).verify_assessment,assessment_id=assessment_id,expected_revision=payload.expected_revision,verification_reference=payload.reference)
@router.post("/assessments/{assessment_id}/releases")
async def prepare_release(project_id:int,assessment_id:str,payload:ReleaseCreate,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,MANAGE,"factory.reputation.release.prepare","factory-reputation-release",FactoryReputationService(db).prepare_release,context=True,assessment_id=assessment_id,**payload.model_dump())
@router.post("/releases/{release_id}/approve")
async def approve_release(project_id:int,release_id:str,payload:RevisionReference,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,APPROVE,"factory.reputation.release.approve","factory-reputation-release",FactoryReputationService(db).approve_release,release_id=release_id,expected_revision=payload.expected_revision,approval_reference=payload.reference)
@router.post("/releases/{release_id}/acknowledge")
async def acknowledge_release(project_id:int,release_id:str,payload:RevisionReference,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,ACK,"factory.reputation.handoff.acknowledge","factory-reputation-release",FactoryReputationService(db).acknowledge_release,release_id=release_id,expected_revision=payload.expected_revision,consumer_receipt_reference=payload.reference)
