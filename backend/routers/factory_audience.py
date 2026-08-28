from fastapi import APIRouter,Depends,HTTPException,Request
from pydantic import BaseModel,Field
from core.database import get_db
from dependencies.auth import get_current_user
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.factory_audience import FactoryAudienceService as S
from services.tenant_access import require_project_access,require_project_permission
from sqlalchemy.ext.asyncio import AsyncSession
router=APIRouter(prefix="/api/v1/factory-platform/projects/{project_id}/audiences",tags=["factory-platform-audiences"])
C,V,R,A="factory.lead.audience.create","factory.lead.audience.verify","factory.lead.audience.activate","factory.lead.audience.acknowledge"
class Audience(BaseModel):audience_key:str=Field(min_length=2,max_length=120);source_reference:str=Field(min_length=2,max_length=255);consent_receipt:str=Field(min_length=4,max_length=255);market_scope:str=Field(pattern="^(domestic|overseas|dual)$")
class Decision(BaseModel):expected_revision:int=Field(gt=0);reference:str=Field(min_length=2,max_length=255)
class Activate(BaseModel):expected_revision:int=Field(gt=0);destination:str=Field(pattern="^(marketing-owner|agency-operator)$")
def fail(e):raise HTTPException(status_code=404 if isinstance(e,KeyError) else 409,detail=str(e))from e
def audit(db,r,u,a,t,p,d):record_audit_event(db,action=a,actor_user_id=u.id,target_type="factory_audience",target_id=t,project_id=p,ip_address=r.client.host if r.client else None,detail=d)
@router.get("")
async def workspace(project_id:int,db:AsyncSession=Depends(get_db),current_user:UserResponse=Depends(get_current_user)):await require_project_access(db,current_user=current_user,project_id=project_id);return await S(db).workspace(project_id)
@router.post("")
async def create(project_id:int,payload:Audience,request:Request,db:AsyncSession=Depends(get_db),current_user:UserResponse=Depends(get_current_user)):
 resolved=await require_project_permission(db,current_user=current_user,project_id=project_id,permission=C)
 try:x=await S(db).create(project_id=project_id,context=resolved.context,actor=current_user.id,**payload.model_dump())
 except(KeyError,ValueError)as e:fail(e)
 audit(db,request,current_user,"factory_audience_created",x["id"],project_id,{"audience_number":x["audience_number"]});await db.commit();return x
@router.post("/{audience_id}/verify")
async def verify(project_id:int,audience_id:str,payload:Decision,request:Request,db:AsyncSession=Depends(get_db),current_user:UserResponse=Depends(get_current_user)):
 await require_project_permission(db,current_user=current_user,project_id=project_id,permission=V)
 try:x=await S(db).verify(audience_id,project_id=project_id,actor=current_user.id,**payload.model_dump())
 except(KeyError,ValueError)as e:fail(e)
 audit(db,request,current_user,"factory_audience_verified",audience_id,project_id,{});await db.commit();return x
@router.post("/{audience_id}/activate")
async def activate(project_id:int,audience_id:str,payload:Activate,request:Request,db:AsyncSession=Depends(get_db),current_user:UserResponse=Depends(get_current_user)):
 resolved=await require_project_permission(db,current_user=current_user,project_id=project_id,permission=R)
 try:x=await S(db).activate(audience_id,project_id=project_id,context=resolved.context,actor=current_user.id,**payload.model_dump())
 except(KeyError,ValueError)as e:fail(e)
 audit(db,request,current_user,"factory_audience_activated",x["activation"]["id"],project_id,{"destination":payload.destination});await db.commit();return x
@router.post("/activations/{activation_id}/acknowledge")
async def acknowledge(project_id:int,activation_id:str,payload:Decision,request:Request,db:AsyncSession=Depends(get_db),current_user:UserResponse=Depends(get_current_user)):
 await require_project_permission(db,current_user=current_user,project_id=project_id,permission=A)
 try:x=await S(db).acknowledge(activation_id,project_id=project_id,actor=current_user.id,**payload.model_dump())
 except(KeyError,ValueError)as e:fail(e)
 audit(db,request,current_user,"factory_audience_acknowledged",activation_id,project_id,{});await db.commit();return x
