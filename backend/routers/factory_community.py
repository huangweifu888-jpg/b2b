from fastapi import APIRouter,Depends,HTTPException,Request
from pydantic import BaseModel,Field
from core.database import get_db
from dependencies.auth import get_current_user
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.factory_community import FactoryCommunityService as S
from services.tenant_access import require_project_access,require_project_permission
from sqlalchemy.ext.asyncio import AsyncSession
router=APIRouter(prefix="/api/v1/factory-platform/projects/{project_id}/communities",tags=["factory-platform-communities"])
C,V,P,A,K="factory.deepen.community.create","factory.deepen.community.verify","factory.deepen.community.activation.plan","factory.deepen.community.activation.approve","factory.deepen.community.activation.acknowledge"
class Community(BaseModel):community_key:str=Field(min_length=1,max_length=100);account_id:str=Field(min_length=1,max_length=100);community_name:str=Field(min_length=2,max_length=255);audience_kind:str=Field(pattern="^(customer|dealer|partner)$")
class Decision(BaseModel):expected_revision:int=Field(gt=0);reference:str=Field(min_length=2,max_length=255)
class Activation(BaseModel):activation_key:str=Field(min_length=1,max_length=100);event_title:str=Field(min_length=2,max_length=255);event_type:str=Field(pattern="^(education|product|service)$");scheduled_on:str=Field(min_length=8,max_length=32)
def fail(e):raise HTTPException(status_code=404 if isinstance(e,KeyError) else 409,detail=str(e)) from e
def audit(db,r,u,a,t,p,d):record_audit_event(db,action=a,actor_user_id=u.id,target_type="factory_community",target_id=t,project_id=p,ip_address=r.client.host if r.client else None,detail=d)
@router.get("")
async def workspace(project_id:int,db:AsyncSession=Depends(get_db),current_user:UserResponse=Depends(get_current_user)):await require_project_access(db,current_user=current_user,project_id=project_id);return await S(db).workspace(project_id)
@router.post("")
async def create(project_id:int,payload:Community,request:Request,db:AsyncSession=Depends(get_db),current_user:UserResponse=Depends(get_current_user)):
 resolved=await require_project_permission(db,current_user=current_user,project_id=project_id,permission=C)
 try:x=await S(db).create_community(project_id=project_id,context=resolved.context,actor=current_user.id,**payload.model_dump())
 except(KeyError,ValueError)as e:fail(e)
 audit(db,request,current_user,"factory_community_created",x["id"],project_id,{"community_number":x["community_number"]});await db.commit();return x
@router.post("/{community_id}/verify")
async def verify(project_id:int,community_id:str,payload:Decision,request:Request,db:AsyncSession=Depends(get_db),current_user:UserResponse=Depends(get_current_user)):
 await require_project_permission(db,current_user=current_user,project_id=project_id,permission=V)
 try:x=await S(db).verify_community(community_id,project_id=project_id,actor=current_user.id,**payload.model_dump())
 except(KeyError,ValueError)as e:fail(e)
 audit(db,request,current_user,"factory_community_verified",community_id,project_id,{});await db.commit();return x
@router.post("/{community_id}/activations")
async def plan(project_id:int,community_id:str,payload:Activation,request:Request,db:AsyncSession=Depends(get_db),current_user:UserResponse=Depends(get_current_user)):
 resolved=await require_project_permission(db,current_user=current_user,project_id=project_id,permission=P)
 try:x=await S(db).plan_activation(community_id,project_id=project_id,context=resolved.context,actor=current_user.id,**payload.model_dump())
 except(KeyError,ValueError)as e:fail(e)
 audit(db,request,current_user,"factory_community_activation_planned",x["id"],project_id,{"activation_number":x["activation_number"]});await db.commit();return x
@router.post("/activations/{activation_id}/approve")
async def approve(project_id:int,activation_id:str,payload:Decision,request:Request,db:AsyncSession=Depends(get_db),current_user:UserResponse=Depends(get_current_user)):
 await require_project_permission(db,current_user=current_user,project_id=project_id,permission=A)
 try:x=await S(db).approve_activation(activation_id,project_id=project_id,actor=current_user.id,**payload.model_dump())
 except(KeyError,ValueError)as e:fail(e)
 audit(db,request,current_user,"factory_community_activation_approved",activation_id,project_id,{});await db.commit();return x
@router.post("/activations/{activation_id}/acknowledge")
async def acknowledge(project_id:int,activation_id:str,payload:Decision,request:Request,db:AsyncSession=Depends(get_db),current_user:UserResponse=Depends(get_current_user)):
 await require_project_permission(db,current_user=current_user,project_id=project_id,permission=K)
 try:x=await S(db).acknowledge_activation(activation_id,project_id=project_id,actor=current_user.id,**payload.model_dump())
 except(KeyError,ValueError)as e:fail(e)
 audit(db,request,current_user,"factory_community_activation_acknowledged",activation_id,project_id,{});await db.commit();return x
