"""Tenant-scoped RFQ clarification and sample lifecycle APIs."""
from datetime import date,datetime
from decimal import Decimal
from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter,Depends,HTTPException,Request
from pydantic import BaseModel,Field
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.factory_rfq_sample import FactoryRfqSampleService
from services.tenant_access import require_project_access,require_project_permission
from sqlalchemy.ext.asyncio import AsyncSession
router=APIRouter(prefix="/api/v1/factory-platform/projects/{project_id}/rfq-samples",tags=["factory-platform-rfq-samples"])
MANAGE="factory.convert.rfq.manage";REQ_APPROVE="factory.convert.rfq.requirement.approve";SAMPLE_APPROVE="factory.convert.rfq.sample.approve";DISPATCH="factory.convert.rfq.sample.dispatch";FEEDBACK="factory.convert.rfq.feedback.record";ACK="factory.convert.rfq.feedback.acknowledge"
class CaseCreate(BaseModel):source_flow_id:str;objective:str=Field(min_length=1,max_length=255)
class RequirementCreate(BaseModel):requirement_code:str=Field(min_length=1,max_length=64);requirement_name:str=Field(min_length=1,max_length=180);specification:str=Field(min_length=1,max_length=4000);quantity:int=Field(gt=0,le=1000000);target_date:date;critical:bool=False
class Approval(BaseModel):expected_revision:int=Field(gt=0);approval_reference:str=Field(min_length=1,max_length=255)
class SampleCreate(BaseModel):sample_code:str=Field(min_length=1,max_length=64);requirement_ids:list[str]=Field(min_length=1);quantity:int=Field(gt=0,le=100000);unit_cost:Decimal=Field(ge=0);currency:str=Field(min_length=1,max_length=8);promised_at:datetime
class Dispatch(BaseModel):expected_revision:int=Field(gt=0);shipping_reference:str=Field(min_length=1,max_length=255)
class FeedbackCreate(BaseModel):outcome:str;quality_score:int=Field(ge=1,le=100);feedback_note:str=Field(min_length=1,max_length=4000);conversion_intent:bool=False
class AckPayload(BaseModel):expected_revision:int=Field(gt=0);acknowledgement_reference:str=Field(min_length=1,max_length=255)
def _raise(e):
 if isinstance(e,KeyError):raise HTTPException(status_code=404,detail=str(e)) from e
 raise HTTPException(status_code=409,detail=str(e)) from e
async def _run(db,r,u,p,permission,action,target,method,*,context=False,**kw):
 await require_project_access(db,current_user=u,project_id=p);resolved=await require_project_permission(db,current_user=u,project_id=p,permission=permission)
 try:x=await method(project_id=p,actor=u.id,**({"context":resolved.context} if context else {}),**kw)
 except (KeyError,ValueError) as e:_raise(e)
 record_audit_event(db,action=action,actor_user_id=u.id,project_id=p,target_type=target,target_id=str(x["id"]),ip_address=r.client.host if r.client else None,detail={"project_id":p,"status":x.get("status"),"revision":x.get("revision")});await db.commit();return x
@router.get("")
async def workspace(project_id:int,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):await require_project_access(db,current_user=current_user,project_id=project_id);return await FactoryRfqSampleService(db).list_workspace(project_id=project_id)
@router.post("/cases")
async def create_case(project_id:int,payload:CaseCreate,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,MANAGE,"factory.rfq.case.create","factory-rfq-case",FactoryRfqSampleService(db).create_case,context=True,**payload.model_dump())
@router.post("/cases/{case_id}/requirements")
async def add_requirement(project_id:int,case_id:str,payload:RequirementCreate,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,MANAGE,"factory.rfq.requirement.create","factory-rfq-requirement",FactoryRfqSampleService(db).add_requirement,context=True,case_id=case_id,**payload.model_dump())
@router.post("/requirements/{requirement_id}/approve")
async def approve_requirement(project_id:int,requirement_id:str,payload:Approval,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,REQ_APPROVE,"factory.rfq.requirement.approve","factory-rfq-requirement",FactoryRfqSampleService(db).approve_requirement,requirement_id=requirement_id,**payload.model_dump())
@router.post("/cases/{case_id}/samples")
async def create_sample(project_id:int,case_id:str,payload:SampleCreate,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,MANAGE,"factory.rfq.sample.create","factory-sample-task",FactoryRfqSampleService(db).create_sample,context=True,case_id=case_id,**payload.model_dump())
@router.post("/samples/{sample_id}/approve")
async def approve_sample(project_id:int,sample_id:str,payload:Approval,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,SAMPLE_APPROVE,"factory.rfq.sample.approve","factory-sample-task",FactoryRfqSampleService(db).approve_sample,sample_id=sample_id,**payload.model_dump())
@router.post("/samples/{sample_id}/dispatch")
async def dispatch_sample(project_id:int,sample_id:str,payload:Dispatch,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,DISPATCH,"factory.rfq.sample.dispatch","factory-sample-task",FactoryRfqSampleService(db).dispatch_sample,sample_id=sample_id,**payload.model_dump())
@router.post("/samples/{sample_id}/feedback")
async def record_feedback(project_id:int,sample_id:str,payload:FeedbackCreate,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,FEEDBACK,"factory.rfq.feedback.record","factory-sample-feedback",FactoryRfqSampleService(db).record_feedback,context=True,sample_id=sample_id,**payload.model_dump())
@router.post("/feedback/{feedback_id}/acknowledge")
async def acknowledge_feedback(project_id:int,feedback_id:str,payload:AckPayload,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,ACK,"factory.rfq.feedback.acknowledge","factory-sample-feedback",FactoryRfqSampleService(db).acknowledge_feedback,feedback_id=feedback_id,**payload.model_dump())
