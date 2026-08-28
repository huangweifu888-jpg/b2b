from fastapi import APIRouter,Depends,HTTPException,Request
from pydantic import BaseModel,Field
from core.database import get_db
from dependencies.auth import get_current_user
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.factory_ad_account import FactoryAdAccountService as S
from services.tenant_access import require_project_access,require_project_permission
from sqlalchemy.ext.asyncio import AsyncSession
router=APIRouter(prefix="/api/v1/factory-platform/projects/{project_id}/ad-accounts",tags=["factory-platform-ad-accounts"])
C,V,R,A="factory.lead.ad-accounts.create","factory.lead.ad-accounts.verify","factory.lead.ad-accounts.route","factory.lead.ad-accounts.acknowledge"
class Account(BaseModel):platform:str=Field(pattern="^(google|meta|linkedin|tiktok|baidu)$");account_reference:str=Field(min_length=2,max_length=255);vault_reference:str=Field(min_length=3,max_length=255);market_scope:str=Field(pattern="^(domestic|overseas|dual)$")
class Decision(BaseModel):expected_revision:int=Field(gt=0);reference:str=Field(min_length=2,max_length=255)
class Route(BaseModel):expected_revision:int=Field(gt=0);destination:str=Field(pattern="^(marketing-owner|agency-operator)$")
def fail(e):raise HTTPException(status_code=404 if isinstance(e,KeyError) else 409,detail=str(e))from e
def audit(db,r,u,a,t,p,d):record_audit_event(db,action=a,actor_user_id=u.id,target_type="factory_ad_account",target_id=t,project_id=p,ip_address=r.client.host if r.client else None,detail=d)
@router.get("")
async def workspace(project_id:int,db:AsyncSession=Depends(get_db),current_user:UserResponse=Depends(get_current_user)):await require_project_access(db,current_user=current_user,project_id=project_id);return await S(db).workspace(project_id)
@router.post("")
async def create(project_id:int,payload:Account,request:Request,db:AsyncSession=Depends(get_db),current_user:UserResponse=Depends(get_current_user)):
 resolved=await require_project_permission(db,current_user=current_user,project_id=project_id,permission=C)
 try:x=await S(db).create(project_id=project_id,context=resolved.context,actor=current_user.id,**payload.model_dump())
 except(KeyError,ValueError)as e:fail(e)
 audit(db,request,current_user,"factory_ad_account_created",x["id"],project_id,{"account_number":x["account_number"],"platform":x["platform"]});await db.commit();return x
@router.post("/{account_id}/verify")
async def verify(project_id:int,account_id:str,payload:Decision,request:Request,db:AsyncSession=Depends(get_db),current_user:UserResponse=Depends(get_current_user)):
 await require_project_permission(db,current_user=current_user,project_id=project_id,permission=V)
 try:x=await S(db).verify(account_id,project_id=project_id,actor=current_user.id,**payload.model_dump())
 except(KeyError,ValueError)as e:fail(e)
 audit(db,request,current_user,"factory_ad_account_verified",account_id,project_id,{});await db.commit();return x
@router.post("/{account_id}/route")
async def route(project_id:int,account_id:str,payload:Route,request:Request,db:AsyncSession=Depends(get_db),current_user:UserResponse=Depends(get_current_user)):
 resolved=await require_project_permission(db,current_user=current_user,project_id=project_id,permission=R)
 try:x=await S(db).route(account_id,project_id=project_id,context=resolved.context,actor=current_user.id,**payload.model_dump())
 except(KeyError,ValueError)as e:fail(e)
 audit(db,request,current_user,"factory_ad_account_routed",x["handoff"]["id"],project_id,{"destination":payload.destination});await db.commit();return x
@router.post("/handoffs/{handoff_id}/acknowledge")
async def acknowledge(project_id:int,handoff_id:str,payload:Decision,request:Request,db:AsyncSession=Depends(get_db),current_user:UserResponse=Depends(get_current_user)):
 await require_project_permission(db,current_user=current_user,project_id=project_id,permission=A)
 try:x=await S(db).acknowledge(handoff_id,project_id=project_id,actor=current_user.id,**payload.model_dump())
 except(KeyError,ValueError)as e:fail(e)
 audit(db,request,current_user,"factory_ad_account_acknowledged",handoff_id,project_id,{});await db.commit();return x
