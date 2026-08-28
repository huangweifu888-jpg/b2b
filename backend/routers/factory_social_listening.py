from fastapi import APIRouter,Depends,HTTPException,Request
from pydantic import BaseModel,Field
from core.database import get_db
from dependencies.auth import get_current_user
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.factory_social_listening import FactorySocialListeningService as S
from services.tenant_access import require_project_access,require_project_permission
from sqlalchemy.ext.asyncio import AsyncSession
router=APIRouter(prefix="/api/v1/factory-platform/projects/{project_id}/social-listening",tags=["factory-platform-social-listening"])
C,V,R,A="factory.deepen.listening.capture","factory.deepen.listening.verify","factory.deepen.listening.route","factory.deepen.listening.acknowledge"
class Capture(BaseModel):signal_key:str=Field(min_length=1,max_length=100);assessment_id:str=Field(min_length=1,max_length=100);signal_type:str=Field(pattern="^(brand|competitor|demand|issue)$");priority:str=Field(pattern="^(low|medium|high)$")
class Decision(BaseModel):expected_revision:int=Field(gt=0);reference:str=Field(min_length=2,max_length=255)
class Route(Decision):destination:str=Field(pattern="^(marketing-owner|sales-owner|service-owner)$")
def fail(e):raise HTTPException(status_code=404 if isinstance(e,KeyError) else 409,detail=str(e))from e
def audit(db,r,u,a,t,p,d):record_audit_event(db,action=a,actor_user_id=u.id,target_type="factory_social_listening",target_id=t,project_id=p,ip_address=r.client.host if r.client else None,detail=d)
@router.get("")
async def workspace(project_id:int,db:AsyncSession=Depends(get_db),current_user:UserResponse=Depends(get_current_user)):await require_project_access(db,current_user=current_user,project_id=project_id);return await S(db).workspace(project_id)
@router.post("")
async def capture(project_id:int,payload:Capture,request:Request,db:AsyncSession=Depends(get_db),current_user:UserResponse=Depends(get_current_user)):
 resolved=await require_project_permission(db,current_user=current_user,project_id=project_id,permission=C)
 try:x=await S(db).capture(project_id=project_id,context=resolved.context,actor=current_user.id,**payload.model_dump())
 except(KeyError,ValueError)as e:fail(e)
 audit(db,request,current_user,"factory_social_listening_captured",x["id"],project_id,{"signal_number":x["signal_number"]});await db.commit();return x
@router.post("/{signal_id}/verify")
async def verify(project_id:int,signal_id:str,payload:Decision,request:Request,db:AsyncSession=Depends(get_db),current_user:UserResponse=Depends(get_current_user)):
 await require_project_permission(db,current_user=current_user,project_id=project_id,permission=V)
 try:x=await S(db).verify(signal_id,project_id=project_id,actor=current_user.id,expected_revision=payload.expected_revision)
 except(KeyError,ValueError)as e:fail(e)
 audit(db,request,current_user,"factory_social_listening_verified",signal_id,project_id,{});await db.commit();return x
@router.post("/{signal_id}/route")
async def route(project_id:int,signal_id:str,payload:Route,request:Request,db:AsyncSession=Depends(get_db),current_user:UserResponse=Depends(get_current_user)):
 resolved=await require_project_permission(db,current_user=current_user,project_id=project_id,permission=R)
 try:x=await S(db).route(signal_id,project_id=project_id,context=resolved.context,actor=current_user.id,expected_revision=payload.expected_revision,destination=payload.destination,reference=payload.reference)
 except(KeyError,ValueError)as e:fail(e)
 audit(db,request,current_user,"factory_social_listening_routed",x["handoff"]["id"],project_id,{"destination":payload.destination});await db.commit();return x
@router.post("/handoffs/{handoff_id}/acknowledge")
async def acknowledge(project_id:int,handoff_id:str,payload:Decision,request:Request,db:AsyncSession=Depends(get_db),current_user:UserResponse=Depends(get_current_user)):
 await require_project_permission(db,current_user=current_user,project_id=project_id,permission=A)
 try:x=await S(db).acknowledge(handoff_id,project_id=project_id,actor=current_user.id,expected_revision=payload.expected_revision,reference=payload.reference)
 except(KeyError,ValueError)as e:fail(e)
 audit(db,request,current_user,"factory_social_listening_acknowledged",handoff_id,project_id,{});await db.commit();return x
