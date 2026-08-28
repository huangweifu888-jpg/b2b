"""Tenant-scoped AI SDR APIs."""
from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter,Depends,HTTPException,Request
from pydantic import BaseModel,Field
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.factory_ai_sdr import FactoryAiSdrService
from services.tenant_access import require_project_access,require_project_permission
from sqlalchemy.ext.asyncio import AsyncSession
router=APIRouter(prefix="/api/v1/factory-platform/projects/{project_id}/ai-sdr",tags=["factory-platform-ai-sdr"])
MANAGE="factory.convert.ai-sdr.manage";REVIEW="factory.convert.ai-sdr.review";HANDOFF="factory.convert.ai-sdr.handoff";ACK="factory.convert.ai-sdr.handoff.acknowledge"
class LeadCreate(BaseModel):assessment_id:str
class RecommendationCreate(BaseModel):model_reference:str=Field(min_length=1,max_length=255);prompt_reference:str=Field(min_length=1,max_length=4000);enrichment_summary:str=Field(min_length=1,max_length=4000);intent_score:int=Field(ge=0,le=100);qualification_proposal:str;reply_subject:str=Field(min_length=1,max_length=180);reply_body:str=Field(min_length=1,max_length=4000);next_action:str=Field(min_length=1,max_length=255)
class Review(BaseModel):expected_revision:int=Field(gt=0);decision:str;review_reference:str=Field(min_length=1,max_length=255);review_note:str=Field(min_length=1,max_length=4000)
class Handoff(BaseModel):owner_team:str=Field(min_length=1,max_length=64);sla_minutes:int=Field(ge=5,le=10080);delivery_reference:str=Field(min_length=1,max_length=255)
class Ack(BaseModel):expected_revision:int=Field(gt=0);acknowledgement_reference:str=Field(min_length=1,max_length=255)
def _raise(e):
 if isinstance(e,KeyError):raise HTTPException(status_code=404,detail=str(e)) from e
 raise HTTPException(status_code=409,detail=str(e)) from e
async def _run(db,r,u,p,permission,action,target,method,*,context=False,**kw):
 await require_project_access(db,current_user=u,project_id=p);resolved=await require_project_permission(db,current_user=u,project_id=p,permission=permission)
 try:x=await method(project_id=p,actor=u.id,**({"context":resolved.context} if context else {}),**kw)
 except (KeyError,ValueError) as e:_raise(e)
 record_audit_event(db,action=action,actor_user_id=u.id,project_id=p,target_type=target,target_id=str(x["id"]),ip_address=r.client.host if r.client else None,detail={"project_id":p,"status":x.get("status"),"revision":x.get("revision")});await db.commit();return x
@router.get("")
async def workspace(project_id:int,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):await require_project_access(db,current_user=current_user,project_id=project_id);return await FactoryAiSdrService(db).list_workspace(project_id=project_id)
@router.post("/leads")
async def create_lead(project_id:int,payload:LeadCreate,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,MANAGE,"factory.ai-sdr.lead.create","factory-ai-sdr-lead",FactoryAiSdrService(db).create_lead,context=True,**payload.model_dump())
@router.post("/leads/{lead_id}/recommendations")
async def generate(project_id:int,lead_id:str,payload:RecommendationCreate,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,MANAGE,"factory.ai-sdr.recommendation.generate","factory-ai-sdr-recommendation",FactoryAiSdrService(db).generate_recommendation,context=True,lead_id=lead_id,**payload.model_dump())
@router.post("/recommendations/{recommendation_id}/review")
async def review(project_id:int,recommendation_id:str,payload:Review,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,REVIEW,"factory.ai-sdr.recommendation.review","factory-ai-sdr-recommendation",FactoryAiSdrService(db).review_recommendation,recommendation_id=recommendation_id,**payload.model_dump())
@router.post("/recommendations/{recommendation_id}/handoff")
async def handoff(project_id:int,recommendation_id:str,payload:Handoff,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,HANDOFF,"factory.ai-sdr.handoff.create","factory-ai-sdr-handoff",FactoryAiSdrService(db).create_handoff,context=True,recommendation_id=recommendation_id,**payload.model_dump())
@router.post("/handoffs/{handoff_id}/acknowledge")
async def acknowledge(project_id:int,handoff_id:str,payload:Ack,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,ACK,"factory.ai-sdr.handoff.acknowledge","factory-ai-sdr-handoff",FactoryAiSdrService(db).acknowledge_handoff,handoff_id=handoff_id,**payload.model_dump())
