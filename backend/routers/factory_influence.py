from fastapi import APIRouter,Depends,HTTPException,Request
from pydantic import BaseModel,Field
from core.database import get_db
from dependencies.auth import get_current_user
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.factory_influence import FactoryInfluenceService as S
from services.tenant_access import require_project_access,require_project_permission
from sqlalchemy.ext.asyncio import AsyncSession
router=APIRouter(prefix="/api/v1/factory-platform/projects/{project_id}/influence",tags=["factory-platform-influence"])
C,V,A,K="factory.deepen.influence.create","factory.deepen.influence.verify","factory.deepen.influence.authorize","factory.deepen.influence.acknowledge"
class Brief(BaseModel):brief_key:str=Field(min_length=1,max_length=100);activation_id:str=Field(min_length=1,max_length=100);advocate_role:str=Field(pattern="^(expert|customer|employee)$");topic:str=Field(min_length=2,max_length=255)
class Decision(BaseModel):expected_revision:int=Field(gt=0);reference:str=Field(min_length=2,max_length=255)
class Authorize(Decision):destination:str=Field(pattern="^(marketing-owner|event-owner|service-owner)$")
def fail(e):raise HTTPException(status_code=404 if isinstance(e,KeyError) else 409,detail=str(e))from e
def audit(db,r,u,a,t,p,d):record_audit_event(db,action=a,actor_user_id=u.id,target_type="factory_influence",target_id=t,project_id=p,ip_address=r.client.host if r.client else None,detail=d)
@router.get("")
async def workspace(project_id:int,db:AsyncSession=Depends(get_db),current_user:UserResponse=Depends(get_current_user)):await require_project_access(db,current_user=current_user,project_id=project_id);return await S(db).workspace(project_id)
@router.post("")
async def create(project_id:int,payload:Brief,request:Request,db:AsyncSession=Depends(get_db),current_user:UserResponse=Depends(get_current_user)):
 resolved=await require_project_permission(db,current_user=current_user,project_id=project_id,permission=C)
 try:x=await S(db).create(project_id=project_id,context=resolved.context,actor=current_user.id,**payload.model_dump())
 except(KeyError,ValueError)as e:fail(e)
 audit(db,request,current_user,"factory_influence_brief_created",x["id"],project_id,{"brief_number":x["brief_number"]});await db.commit();return x
@router.post("/{brief_id}/verify")
async def verify(project_id:int,brief_id:str,payload:Decision,request:Request,db:AsyncSession=Depends(get_db),current_user:UserResponse=Depends(get_current_user)):
 await require_project_permission(db,current_user=current_user,project_id=project_id,permission=V)
 try:x=await S(db).verify(brief_id,project_id=project_id,actor=current_user.id,**payload.model_dump())
 except(KeyError,ValueError)as e:fail(e)
 audit(db,request,current_user,"factory_influence_brief_verified",brief_id,project_id,{});await db.commit();return x
@router.post("/{brief_id}/authorize")
async def authorize(project_id:int,brief_id:str,payload:Authorize,request:Request,db:AsyncSession=Depends(get_db),current_user:UserResponse=Depends(get_current_user)):
 resolved=await require_project_permission(db,current_user=current_user,project_id=project_id,permission=A)
 try:x=await S(db).authorize(brief_id,project_id=project_id,context=resolved.context,actor=current_user.id,**payload.model_dump())
 except(KeyError,ValueError)as e:fail(e)
 audit(db,request,current_user,"factory_influence_authorized",x["release"]["id"],project_id,{"destination":payload.destination});await db.commit();return x
@router.post("/releases/{release_id}/acknowledge")
async def acknowledge(project_id:int,release_id:str,payload:Decision,request:Request,db:AsyncSession=Depends(get_db),current_user:UserResponse=Depends(get_current_user)):
 await require_project_permission(db,current_user=current_user,project_id=project_id,permission=K)
 try:x=await S(db).acknowledge(release_id,project_id=project_id,actor=current_user.id,**payload.model_dump())
 except(KeyError,ValueError)as e:fail(e)
 audit(db,request,current_user,"factory_influence_acknowledged",release_id,project_id,{});await db.commit();return x
