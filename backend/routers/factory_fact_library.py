"""Permissioned AI-readable fact registry APIs."""
from typing import Any
from fastapi import APIRouter,Depends,HTTPException,Request
from pydantic import BaseModel,Field
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_db
from dependencies.auth import get_current_user
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.factory_fact_library import FactoryFactLibraryService
from services.tenant_access import require_project_access,require_project_permission
router=APIRouter(prefix="/api/v1/factory-platform/projects/{project_id}/fact-library",tags=["factory-platform-fact-library"])
MANAGE="factory.recommend.fact-library.fact.manage";VERIFY="factory.recommend.fact-library.version.verify";APPROVE="factory.recommend.fact-library.release.approve";ACK="factory.recommend.fact-library.handoff.acknowledge"
class Fact(BaseModel):fact_key:str=Field(min_length=2,max_length=160);fact_type:str=Field(pattern="^(product|company|capability|proof|service)$");source_reference:str=Field(min_length=2,max_length=255);authority_reference:str=Field(min_length=2,max_length=255)
class Version(BaseModel):fact_manifest:dict[str,Any]
class Release(BaseModel):target:str=Field(pattern="^(geo-owner|content-owner|structured-data-owner)$");handoff_manifest:dict[str,Any]
class Ref(BaseModel):expected_revision:int=Field(gt=0);reference:str=Field(min_length=1,max_length=255)
def fail(e):raise HTTPException(status_code=404 if isinstance(e,KeyError)else 409,detail=str(e))from e
async def run(db,request,user,project_id,permission,action,target_type,op,*,context=False,**kw):
 await require_project_access(db,current_user=user,project_id=project_id);r=await require_project_permission(db,current_user=user,project_id=project_id,permission=permission)
 try:i=await op(project_id=project_id,actor=user.id,**({"context":r.context}if context else{}),**kw)
 except(KeyError,ValueError)as e:fail(e)
 record_audit_event(db,action=action,actor_user_id=user.id,project_id=project_id,target_type=target_type,target_id=str(i["id"]),ip_address=request.client.host if request.client else None,detail={"status":i.get("status"),"revision":i.get("revision")});await db.commit();return i
@router.get("")
async def workspace(project_id:int,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):
 await require_project_access(db,current_user=current_user,project_id=project_id);return await FactoryFactLibraryService(db).workspace(project_id=project_id)
@router.post("/facts")
async def fact(project_id:int,payload:Fact,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await run(db,request,current_user,project_id,MANAGE,"factory.fact-library.fact.create","factory-fact-library-fact",FactoryFactLibraryService(db).create_fact,context=True,**payload.model_dump())
@router.post("/facts/{fid}/versions")
async def version(project_id:int,fid:str,payload:Version,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await run(db,request,current_user,project_id,MANAGE,"factory.fact-library.version.draft","factory-fact-library-version",FactoryFactLibraryService(db).draft_version,context=True,fid=fid,**payload.model_dump())
@router.post("/versions/{vid}/verify")
async def verify(project_id:int,vid:str,payload:Ref,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await run(db,request,current_user,project_id,VERIFY,"factory.fact-library.version.verify","factory-fact-library-version",FactoryFactLibraryService(db).verify_version,vid=vid,expected_revision=payload.expected_revision,verification_reference=payload.reference)
@router.post("/versions/{vid}/releases")
async def release(project_id:int,vid:str,payload:Release,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await run(db,request,current_user,project_id,MANAGE,"factory.fact-library.release.prepare","factory-fact-library-release",FactoryFactLibraryService(db).prepare_release,context=True,vid=vid,**payload.model_dump())
@router.post("/releases/{rid}/approve")
async def approve(project_id:int,rid:str,payload:Ref,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await run(db,request,current_user,project_id,APPROVE,"factory.fact-library.release.approve","factory-fact-library-release",FactoryFactLibraryService(db).approve_release,rid=rid,expected_revision=payload.expected_revision,approval_reference=payload.reference)
@router.post("/releases/{rid}/acknowledge")
async def acknowledge(project_id:int,rid:str,payload:Ref,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await run(db,request,current_user,project_id,ACK,"factory.fact-library.handoff.acknowledge","factory-fact-library-release",FactoryFactLibraryService(db).acknowledge_release,rid=rid,expected_revision=payload.expected_revision,consumer_receipt_reference=payload.reference)
