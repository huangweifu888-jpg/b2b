"""Tenant-scoped enterprise targeting and ABM APIs."""
from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter,Depends,HTTPException,Request
from pydantic import BaseModel,Field
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.factory_abm import FactoryAbmService
from services.tenant_access import require_project_access,require_project_permission
from sqlalchemy.ext.asyncio import AsyncSession
router=APIRouter(prefix="/api/v1/factory-platform/projects/{project_id}/abm",tags=["factory-platform-abm"])
MANAGE="factory.lead.abm.manage";VERIFY="factory.lead.abm.target.verify";APPROVE="factory.lead.abm.play.approve";PUBLISH="factory.lead.abm.publish";ACK="factory.lead.abm.activation.acknowledge"
class ProgramCreate(BaseModel):program_code:str=Field(min_length=1,max_length=64);program_name:str=Field(min_length=1,max_length=180);business_objective:str=Field(min_length=1,max_length=255);allowed_consumers:list[str]=Field(min_length=1,max_length=4)
class TargetCreate(BaseModel):audience_segment_id:str=Field(min_length=1,max_length=100);buying_committee_id:str=Field(min_length=1,max_length=100);priority_tier:str=Field(min_length=1,max_length=16);fit_score:float=Field(ge=0,le=100)
class PlayCreate(BaseModel):committee_member_id:str=Field(min_length=1,max_length=100);owner_team:str=Field(min_length=1,max_length=24);channel:str=Field(min_length=1,max_length=32);action_code:str=Field(min_length=1,max_length=64);message_intent:str=Field(min_length=1,max_length=255);success_signal:str=Field(min_length=1,max_length=180);sequence_order:int=Field(ge=1,le=1000)
class RevisionReference(BaseModel):expected_revision:int=Field(gt=0);reference:str=Field(min_length=1,max_length=255)
class PublishProgram(BaseModel):expected_revision:int=Field(gt=0);consumers:list[str]=Field(min_length=1,max_length=4);delivery_reference_prefix:str=Field(min_length=1,max_length=180)
def _raise(e):
 if isinstance(e,KeyError):raise HTTPException(status_code=404,detail=str(e)) from e
 raise HTTPException(status_code=409,detail=str(e)) from e
def _item(x):
 if isinstance(x,dict):
  for k in ("program","version"):
   if isinstance(x.get(k),dict):return x[k]
 return x
def _audit(db,r,u,a,t,x,p):x=_item(x);record_audit_event(db,action=a,actor_user_id=u.id,project_id=p,target_type=t,target_id=str(x["id"]),ip_address=r.client.host if r.client else None,detail={"project_id":p,"status":x.get("status"),"revision":x.get("revision")})
async def _run(db,r,u,p,permission,a,t,m,*,context=False,**kw):
 resolved=await require_project_permission(db,current_user=u,project_id=p,permission=permission)
 try:x=await m(project_id=p,actor=u.id,**({"context":resolved.context} if context else {}),**kw)
 except (KeyError,ValueError) as e:_raise(e)
 _audit(db,r,u,a,t,x,p);await db.commit();return x
@router.get("")
async def workspace(project_id:int,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):await require_project_access(db,current_user=current_user,project_id=project_id);return await FactoryAbmService(db).list_workspace(project_id=project_id)
@router.post("/programs")
async def create(project_id:int,payload:ProgramCreate,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,MANAGE,"factory.abm.program.create","factory-abm-program",FactoryAbmService(db).create_program,context=True,**payload.model_dump())
@router.post("/programs/{program_id}/targets")
async def add_target(project_id:int,program_id:str,payload:TargetCreate,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,MANAGE,"factory.abm.target.add","factory-abm-target",FactoryAbmService(db).add_target,context=True,program_id=program_id,**payload.model_dump())
@router.post("/targets/{target_id}/verify")
async def verify_target(project_id:int,target_id:str,payload:RevisionReference,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,VERIFY,"factory.abm.target.verify","factory-abm-target",FactoryAbmService(db).verify_target,target_id=target_id,**payload.model_dump())
@router.post("/targets/{target_id}/plays")
async def add_play(project_id:int,target_id:str,payload:PlayCreate,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,MANAGE,"factory.abm.play.create","factory-abm-play",FactoryAbmService(db).add_role_play,context=True,target_id=target_id,**payload.model_dump())
@router.post("/plays/{play_id}/approve")
async def approve_play(project_id:int,play_id:str,payload:RevisionReference,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,APPROVE,"factory.abm.play.approve","factory-abm-play",FactoryAbmService(db).approve_role_play,play_id=play_id,**payload.model_dump())
@router.post("/programs/{program_id}/publish")
async def publish(project_id:int,program_id:str,payload:PublishProgram,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,PUBLISH,"factory.abm.program.publish","factory-abm-program",FactoryAbmService(db).publish_program,context=True,program_id=program_id,**payload.model_dump())
@router.post("/activations/{activation_id}/acknowledge")
async def acknowledge(project_id:int,activation_id:str,payload:RevisionReference,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,ACK,"factory.abm.activation.acknowledge","factory-abm-activation",FactoryAbmService(db).acknowledge_activation,activation_id=activation_id,**payload.model_dump())
