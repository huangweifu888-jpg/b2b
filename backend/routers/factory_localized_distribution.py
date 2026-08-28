from fastapi import APIRouter,Depends,HTTPException,Request
from pydantic import BaseModel,Field
from core.database import get_db
from dependencies.auth import get_current_user
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.factory_localized_distribution import FactoryLocalizedDistributionService as S
from services.tenant_access import require_project_access,require_project_permission
from sqlalchemy.ext.asyncio import AsyncSession
router=APIRouter(prefix="/api/v1/factory-platform/projects/{project_id}/localized-distributions",tags=["factory-platform-localized-distributions"])
C,V,L,A="factory.deepen.localized-distribution.create","factory.deepen.localized-distribution.verify","factory.deepen.localized-distribution.release","factory.deepen.localized-distribution.acknowledge"
class Create(BaseModel):distribution_key:str=Field(min_length=1,max_length=100);review_id:str=Field(min_length=8,max_length=100);pack_id:str=Field(min_length=8,max_length=100);channel:str=Field(min_length=2,max_length=80)
class Decision(BaseModel):expected_revision:int=Field(gt=0);reference:str=Field(min_length=2,max_length=255)
def fail(e):raise HTTPException(status_code=404 if isinstance(e,KeyError) else 409,detail=str(e)) from e
def audit(db,r,u,a,t,p,d):record_audit_event(db,action=a,actor_user_id=u.id,target_type="factory_localized_distribution",target_id=t,project_id=p,ip_address=r.client.host if r.client else None,detail=d)
@router.get("")
async def workspace(project_id:int,db:AsyncSession=Depends(get_db),current_user:UserResponse=Depends(get_current_user)):await require_project_access(db,current_user=current_user,project_id=project_id);return await S(db).workspace(project_id)
@router.post("")
async def create(project_id:int,payload:Create,request:Request,db:AsyncSession=Depends(get_db),current_user:UserResponse=Depends(get_current_user)):
 resolved=await require_project_permission(db,current_user=current_user,project_id=project_id,permission=C)
 try:x=await S(db).create(project_id=project_id,context=resolved.context,actor=current_user.id,**payload.model_dump())
 except (KeyError,ValueError)as e:fail(e)
 audit(db,request,current_user,"factory_localized_distribution_created",x["id"],project_id,{"distribution_number":x["distribution_number"]});await db.commit();return x
@router.post("/{distribution_id}/verify")
async def verify(project_id:int,distribution_id:str,payload:Decision,request:Request,db:AsyncSession=Depends(get_db),current_user:UserResponse=Depends(get_current_user)):
 await require_project_permission(db,current_user=current_user,project_id=project_id,permission=V)
 try:x=await S(db).verify(distribution_id,project_id=project_id,actor=current_user.id,expected_revision=payload.expected_revision)
 except (KeyError,ValueError)as e:fail(e)
 audit(db,request,current_user,"factory_localized_distribution_verified",distribution_id,project_id,{});await db.commit();return x
@router.post("/{distribution_id}/release")
async def release(project_id:int,distribution_id:str,payload:Decision,request:Request,db:AsyncSession=Depends(get_db),current_user:UserResponse=Depends(get_current_user)):
 resolved=await require_project_permission(db,current_user=current_user,project_id=project_id,permission=L)
 try:x=await S(db).release(distribution_id,project_id=project_id,context=resolved.context,actor=current_user.id,expected_revision=payload.expected_revision,reference=payload.reference)
 except (KeyError,ValueError)as e:fail(e)
 audit(db,request,current_user,"factory_localized_distribution_released",x["release"]["id"],project_id,{"reference":payload.reference});await db.commit();return x
@router.post("/releases/{release_id}/acknowledge")
async def acknowledge(project_id:int,release_id:str,payload:Decision,request:Request,db:AsyncSession=Depends(get_db),current_user:UserResponse=Depends(get_current_user)):
 await require_project_permission(db,current_user=current_user,project_id=project_id,permission=A)
 try:x=await S(db).acknowledge(release_id,project_id=project_id,actor=current_user.id,expected_revision=payload.expected_revision,reference=payload.reference)
 except (KeyError,ValueError)as e:fail(e)
 audit(db,request,current_user,"factory_localized_distribution_acknowledged",release_id,project_id,{"reference":payload.reference});await db.commit();return x
