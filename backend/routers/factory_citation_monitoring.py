from typing import Any
from fastapi import APIRouter,Depends,HTTPException,Request
from pydantic import BaseModel,Field
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_db
from dependencies.auth import get_current_user
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.factory_citation_monitoring import FactoryCitationMonitoringService
from services.tenant_access import require_project_access,require_project_permission
router=APIRouter(prefix="/api/v1/factory-platform/projects/{project_id}/citation-monitoring",tags=["factory-platform-citation-monitoring"])
MANAGE="factory.recommend.citation.monitor.manage";VERIFY="factory.recommend.citation.observation.verify"
APPROVE="factory.recommend.citation.release.approve";ACK="factory.recommend.citation.handoff.acknowledge"
class Monitor(BaseModel):monitor_key:str=Field(min_length=2,max_length=160);market:str=Field(min_length=2,max_length=80);locale:str=Field(min_length=2,max_length=32);model_provider:str=Field(min_length=2,max_length=80);question_reference:str=Field(min_length=2,max_length=255)
class Observation(BaseModel):observation_manifest:dict[str,Any]
class Ref(BaseModel):expected_revision:int=Field(gt=0);reference:str=Field(min_length=1,max_length=255)
class Release(BaseModel):target:str=Field(pattern="^(marketing-owner|executive-owner|geo-owner)$");analysis_manifest:dict[str,Any]
async def run(db,request,user,p,permission,action,audit_target,op,*,context=False,**kw):
 await require_project_access(db,current_user=user,project_id=p);r=await require_project_permission(db,current_user=user,project_id=p,permission=permission)
 try:i=await op(project_id=p,actor=user.id,**({"context":r.context}if context else{}),**kw)
 except(KeyError,ValueError)as e:raise HTTPException(status_code=404 if isinstance(e,KeyError)else 409,detail=str(e))from e
 record_audit_event(db,action=action,actor_user_id=user.id,project_id=p,target_type=audit_target,target_id=i["id"],ip_address=request.client.host if request.client else None,detail=i);await db.commit();return i
@router.get("")
async def workspace(project_id:int,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):
 await require_project_access(db,current_user=current_user,project_id=project_id);return await FactoryCitationMonitoringService(db).workspace(project_id=project_id)
@router.post("/monitors")
async def monitor(project_id:int,payload:Monitor,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await run(db,request,current_user,project_id,MANAGE,"factory.citation.monitor.create","factory-citation-monitor",FactoryCitationMonitoringService(db).create_monitor,context=True,**payload.model_dump())
@router.post("/monitors/{mid}/observations")
async def observation(project_id:int,mid:str,payload:Observation,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await run(db,request,current_user,project_id,MANAGE,"factory.citation.observation.capture","factory-citation-observation",FactoryCitationMonitoringService(db).capture,context=True,mid=mid,**payload.model_dump())
@router.post("/observations/{oid}/verify")
async def verify(project_id:int,oid:str,payload:Ref,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await run(db,request,current_user,project_id,VERIFY,"factory.citation.observation.verify","factory-citation-observation",FactoryCitationMonitoringService(db).verify,oid=oid,expected_revision=payload.expected_revision,reference=payload.reference)
@router.post("/observations/{oid}/releases")
async def release(project_id:int,oid:str,payload:Release,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await run(db,request,current_user,project_id,MANAGE,"factory.citation.release.prepare","factory-citation-release",FactoryCitationMonitoringService(db).prepare_release,context=True,oid=oid,**payload.model_dump())
@router.post("/releases/{rid}/approve")
async def approve(project_id:int,rid:str,payload:Ref,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await run(db,request,current_user,project_id,APPROVE,"factory.citation.release.approve","factory-citation-release",FactoryCitationMonitoringService(db).approve_release,rid=rid,expected_revision=payload.expected_revision,reference=payload.reference)
@router.post("/releases/{rid}/acknowledge")
async def acknowledge(project_id:int,rid:str,payload:Ref,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await run(db,request,current_user,project_id,ACK,"factory.citation.handoff.acknowledge","factory-citation-release",FactoryCitationMonitoringService(db).acknowledge_release,rid=rid,expected_revision=payload.expected_revision,reference=payload.reference)
