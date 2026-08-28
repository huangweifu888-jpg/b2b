"""Tenant-scoped consent segment APIs."""
from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter,Depends,HTTPException,Request
from pydantic import BaseModel,Field
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.factory_segments_consent import FactorySegmentsConsentService
from services.tenant_access import require_project_access,require_project_permission
from sqlalchemy.ext.asyncio import AsyncSession
router=APIRouter(prefix="/api/v1/factory-platform/projects/{project_id}/segments-consent",tags=["factory-platform-segments-consent"])
MANAGE="factory.portrait.segment.manage";RULE="factory.portrait.segment.rule.approve";EVALUATE="factory.portrait.segment.membership.evaluate";VERIFY="factory.portrait.segment.membership.verify";PUBLISH="factory.portrait.segment.publish";ACK="factory.portrait.segment.activation.acknowledge"
class SegmentCreate(BaseModel):segment_code:str=Field(min_length=1,max_length=64);segment_name:str=Field(min_length=1,max_length=180);business_purpose:str=Field(min_length=1,max_length=255);allowed_channels:list[str]=Field(min_length=1,max_length=4)
class RuleCreate(BaseModel):rule_code:str=Field(min_length=1,max_length=64);rule_name:str=Field(min_length=1,max_length=180);minimum_high_intent_events:int=Field(ge=0,le=1000);required_source_types:list[str]=Field(min_length=1,max_length=5);required_consent_purposes:list[str]=Field(min_length=1,max_length=20)
class MembershipEvaluate(BaseModel):rule_id:str=Field(min_length=1,max_length=100);contact_signal_id:str=Field(min_length=1,max_length=100)
class RevisionReference(BaseModel):expected_revision:int=Field(gt=0);reference:str=Field(min_length=1,max_length=255)
class PublishSegment(BaseModel):expected_revision:int=Field(gt=0);consumers:list[str]=Field(min_length=1,max_length=4);delivery_reference_prefix:str=Field(min_length=1,max_length=180)
def _raise(e):
 if isinstance(e,KeyError):raise HTTPException(status_code=404,detail=str(e)) from e
 raise HTTPException(status_code=409,detail=str(e)) from e
def _item(x):
 if isinstance(x,dict):
  for k in ("segment","version"):
   if isinstance(x.get(k),dict):return x[k]
 return x
def _audit(db,r,u,a,t,x,p):x=_item(x);record_audit_event(db,action=a,actor_user_id=u.id,project_id=p,target_type=t,target_id=str(x["id"]),ip_address=r.client.host if r.client else None,detail={"project_id":p,"status":x.get("status"),"revision":x.get("revision")})
async def _run(db,r,u,p,permission,a,t,m,*,context=False,**kw):
 resolved=await require_project_permission(db,current_user=u,project_id=p,permission=permission)
 try:x=await m(project_id=p,actor=u.id,**({"context":resolved.context} if context else {}),**kw)
 except (KeyError,ValueError) as e:_raise(e)
 _audit(db,r,u,a,t,x,p);await db.commit();return x
@router.get("")
async def workspace(project_id:int,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):await require_project_access(db,current_user=current_user,project_id=project_id);return await FactorySegmentsConsentService(db).list_workspace(project_id=project_id)
@router.post("/segments")
async def create(project_id:int,payload:SegmentCreate,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,MANAGE,"factory.segment.create","factory-audience-segment",FactorySegmentsConsentService(db).create_segment,context=True,**payload.model_dump())
@router.post("/segments/{segment_id}/rules")
async def create_rule(project_id:int,segment_id:str,payload:RuleCreate,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,MANAGE,"factory.segment.rule.create","factory-audience-rule",FactorySegmentsConsentService(db).create_rule,context=True,segment_id=segment_id,**payload.model_dump())
@router.post("/rules/{rule_id}/approve")
async def approve_rule(project_id:int,rule_id:str,payload:RevisionReference,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,RULE,"factory.segment.rule.approve","factory-audience-rule",FactorySegmentsConsentService(db).approve_rule,rule_id=rule_id,**payload.model_dump())
@router.post("/segments/{segment_id}/memberships")
async def evaluate(project_id:int,segment_id:str,payload:MembershipEvaluate,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,EVALUATE,"factory.segment.membership.evaluate","factory-audience-membership",FactorySegmentsConsentService(db).evaluate_membership,context=True,segment_id=segment_id,**payload.model_dump())
@router.post("/memberships/{membership_id}/verify")
async def verify(project_id:int,membership_id:str,payload:RevisionReference,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,VERIFY,"factory.segment.membership.verify","factory-audience-membership",FactorySegmentsConsentService(db).verify_membership,membership_id=membership_id,**payload.model_dump())
@router.post("/segments/{segment_id}/publish")
async def publish(project_id:int,segment_id:str,payload:PublishSegment,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,PUBLISH,"factory.segment.publish","factory-audience-segment",FactorySegmentsConsentService(db).publish_segment,context=True,segment_id=segment_id,**payload.model_dump())
@router.post("/activations/{activation_id}/acknowledge")
async def acknowledge(project_id:int,activation_id:str,payload:RevisionReference,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,ACK,"factory.segment.activation.acknowledge","factory-audience-activation",FactorySegmentsConsentService(db).acknowledge_activation,activation_id=activation_id,**payload.model_dump())
