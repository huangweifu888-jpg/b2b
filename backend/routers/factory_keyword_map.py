"""Permissioned source-dated keyword topic-map handoff APIs."""
from typing import Any
from fastapi import APIRouter,Depends,HTTPException,Request
from pydantic import BaseModel,Field
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_db
from dependencies.auth import get_current_user
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.factory_keyword_map import FactoryKeywordMapService
from services.tenant_access import require_project_access,require_project_permission
router=APIRouter(prefix="/api/v1/factory-platform/projects/{project_id}/keyword-map",tags=["factory-platform-keyword-map"])
MANAGE="factory.trust.keyword-map.study.manage";VERIFY="factory.trust.keyword-map.version.verify";APPROVE="factory.trust.keyword-map.release.approve";ACK="factory.trust.keyword-map.handoff.acknowledge"
class StudyCreate(BaseModel):market:str=Field(min_length=2,max_length=80);source_reference:str=Field(min_length=2,max_length=255);observed_on:str=Field(min_length=4,max_length=32)
class VersionCreate(BaseModel):topic_manifest:dict[str,Any]
class ReleaseCreate(BaseModel):target:str=Field(pattern="^(content-team|seo-operations|sales-enablement)$");activation_manifest:dict[str,Any];rollback_reference:str=Field(min_length=1,max_length=255)
class RevisionReference(BaseModel):expected_revision:int=Field(gt=0);reference:str=Field(min_length=1,max_length=255)
def _fail(error):raise HTTPException(status_code=404 if isinstance(error,KeyError) else 409,detail=str(error)) from error
async def _run(db,request,user,project_id,permission,action,target_type,operation,*,context=False,**kwargs):
 await require_project_access(db,current_user=user,project_id=project_id);resolved=await require_project_permission(db,current_user=user,project_id=project_id,permission=permission)
 try:item=await operation(project_id=project_id,actor=user.id,**({"context":resolved.context} if context else {}),**kwargs)
 except(KeyError,ValueError)as error:_fail(error)
 record_audit_event(db,action=action,actor_user_id=user.id,project_id=project_id,target_type=target_type,target_id=str(item.get("id")),ip_address=request.client.host if request.client else None,detail={"project_id":project_id,"status":item.get("status"),"revision":item.get("revision")});await db.commit();return item
@router.get("")
async def workspace(project_id:int,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):
 await require_project_access(db,current_user=current_user,project_id=project_id);return await FactoryKeywordMapService(db).workspace(project_id=project_id)
@router.post("/studies")
async def create_study(project_id:int,payload:StudyCreate,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,MANAGE,"factory.keyword-map.study.create","factory-keyword-map-study",FactoryKeywordMapService(db).create_study,context=True,**payload.model_dump())
@router.post("/studies/{study_id}/versions")
async def draft_version(project_id:int,study_id:str,payload:VersionCreate,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,MANAGE,"factory.keyword-map.version.draft","factory-keyword-map-version",FactoryKeywordMapService(db).draft_version,context=True,study_id=study_id,**payload.model_dump())
@router.post("/versions/{version_id}/verify")
async def verify_version(project_id:int,version_id:str,payload:RevisionReference,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,VERIFY,"factory.keyword-map.version.verify","factory-keyword-map-version",FactoryKeywordMapService(db).verify_version,version_id=version_id,expected_revision=payload.expected_revision,verification_reference=payload.reference)
@router.post("/versions/{version_id}/releases")
async def prepare_release(project_id:int,version_id:str,payload:ReleaseCreate,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,MANAGE,"factory.keyword-map.release.prepare","factory-keyword-map-release",FactoryKeywordMapService(db).prepare_release,context=True,version_id=version_id,**payload.model_dump())
@router.post("/releases/{release_id}/approve")
async def approve_release(project_id:int,release_id:str,payload:RevisionReference,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,APPROVE,"factory.keyword-map.release.approve","factory-keyword-map-release",FactoryKeywordMapService(db).approve_release,release_id=release_id,expected_revision=payload.expected_revision,approval_reference=payload.reference)
@router.post("/releases/{release_id}/acknowledge")
async def acknowledge_release(project_id:int,release_id:str,payload:RevisionReference,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,ACK,"factory.keyword-map.handoff.acknowledge","factory-keyword-map-release",FactoryKeywordMapService(db).acknowledge_release,release_id=release_id,expected_revision=payload.expected_revision,consumer_receipt_reference=payload.reference)
