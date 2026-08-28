"""Permissioned GEO/AEO source-bound answer handoff APIs."""
from typing import Any
from fastapi import APIRouter,Depends,HTTPException,Request
from pydantic import BaseModel,Field
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_db
from dependencies.auth import get_current_user
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.factory_geo_aeo import FactoryGeoAeoService
from services.tenant_access import require_project_access,require_project_permission
router=APIRouter(prefix="/api/v1/factory-platform/projects/{project_id}/geo-aeo",tags=["factory-platform-geo-aeo"])
MANAGE="factory.recommend.geo-aeo.question.manage";VERIFY="factory.recommend.geo-aeo.answer.verify";APPROVE="factory.recommend.geo-aeo.release.approve";ACK="factory.recommend.geo-aeo.handoff.acknowledge"
class Question(BaseModel):question_reference:str=Field(min_length=2,max_length=255);market:str=Field(min_length=2,max_length=80);locale:str=Field(min_length=2,max_length=32)
class Answer(BaseModel):answer_manifest:dict[str,Any]
class Release(BaseModel):target:str=Field(pattern="^(content-owner|geo-owner|marketing-owner)$");handoff_manifest:dict[str,Any]
class Ref(BaseModel):expected_revision:int=Field(gt=0);reference:str=Field(min_length=1,max_length=255)
def fail(e):raise HTTPException(status_code=404 if isinstance(e,KeyError)else 409,detail=str(e))from e
async def run(db,request,user,project_id,permission,action,target_type,op,*,context=False,**kw):
 await require_project_access(db,current_user=user,project_id=project_id);r=await require_project_permission(db,current_user=user,project_id=project_id,permission=permission)
 try:i=await op(project_id=project_id,actor=user.id,**({"context":r.context}if context else{}),**kw)
 except(KeyError,ValueError)as e:fail(e)
 record_audit_event(db,action=action,actor_user_id=user.id,project_id=project_id,target_type=target_type,target_id=str(i["id"]),ip_address=request.client.host if request.client else None,detail={"status":i.get("status"),"revision":i.get("revision")});await db.commit();return i
@router.get("")
async def workspace(project_id:int,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):
 await require_project_access(db,current_user=current_user,project_id=project_id);return await FactoryGeoAeoService(db).workspace(project_id=project_id)
@router.post("/questions")
async def question(project_id:int,payload:Question,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await run(db,request,current_user,project_id,MANAGE,"factory.geo.question.create","factory-geo-aeo-question",FactoryGeoAeoService(db).create_question,context=True,**payload.model_dump())
@router.post("/questions/{qid}/answers")
async def answer(project_id:int,qid:str,payload:Answer,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await run(db,request,current_user,project_id,MANAGE,"factory.geo.answer.draft","factory-geo-aeo-answer",FactoryGeoAeoService(db).draft_answer,context=True,qid=qid,**payload.model_dump())
@router.post("/answers/{vid}/verify")
async def verify(project_id:int,vid:str,payload:Ref,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await run(db,request,current_user,project_id,VERIFY,"factory.geo.answer.verify","factory-geo-aeo-answer",FactoryGeoAeoService(db).verify_answer,vid=vid,expected_revision=payload.expected_revision,verification_reference=payload.reference)
@router.post("/answers/{vid}/releases")
async def release(project_id:int,vid:str,payload:Release,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await run(db,request,current_user,project_id,MANAGE,"factory.geo.release.prepare","factory-geo-aeo-release",FactoryGeoAeoService(db).prepare_release,context=True,vid=vid,**payload.model_dump())
@router.post("/releases/{rid}/approve")
async def approve(project_id:int,rid:str,payload:Ref,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await run(db,request,current_user,project_id,APPROVE,"factory.geo.release.approve","factory-geo-aeo-release",FactoryGeoAeoService(db).approve_release,rid=rid,expected_revision=payload.expected_revision,reference=payload.reference)
@router.post("/releases/{rid}/acknowledge")
async def acknowledge(project_id:int,rid:str,payload:Ref,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await run(db,request,current_user,project_id,ACK,"factory.geo.handoff.acknowledge","factory-geo-aeo-release",FactoryGeoAeoService(db).acknowledge_release,rid=rid,expected_revision=payload.expected_revision,reference=payload.reference)
