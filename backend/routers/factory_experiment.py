from fastapi import APIRouter,Depends,HTTPException,Request
from pydantic import BaseModel,Field
from core.database import get_db
from dependencies.auth import get_current_user
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.factory_experiment import FactoryExperimentService as S
from services.tenant_access import require_project_access,require_project_permission
from sqlalchemy.ext.asyncio import AsyncSession
router=APIRouter(prefix="/api/v1/factory-platform/projects/{project_id}/experiments",tags=["factory-platform-experiments"])
C,V,D,A="factory.lead.experiments.create","factory.lead.experiments.review","factory.lead.experiments.decide","factory.lead.experiments.acknowledge"
class Experiment(BaseModel):experiment_key:str=Field(min_length=2,max_length=120);hypothesis:str=Field(min_length=8,max_length=2000);evidence_reference:str=Field(min_length=3,max_length=255)
class Decision(BaseModel):expected_revision:int=Field(gt=0);reference:str=Field(min_length=2,max_length=255)
class Decide(BaseModel):expected_revision:int=Field(gt=0);destination:str=Field(pattern="^(marketing-owner|agency-operator)$")
def fail(e):raise HTTPException(status_code=404 if isinstance(e,KeyError) else 409,detail=str(e))from e
def audit(db,r,u,a,t,p,d):record_audit_event(db,action=a,actor_user_id=u.id,target_type="factory_experiment",target_id=t,project_id=p,ip_address=r.client.host if r.client else None,detail=d)
@router.get("")
async def workspace(project_id:int,db:AsyncSession=Depends(get_db),current_user:UserResponse=Depends(get_current_user)):await require_project_access(db,current_user=current_user,project_id=project_id);return await S(db).workspace(project_id)
@router.post("")
async def create(project_id:int,payload:Experiment,request:Request,db:AsyncSession=Depends(get_db),current_user:UserResponse=Depends(get_current_user)):
 x=None;resolved=await require_project_permission(db,current_user=current_user,project_id=project_id,permission=C)
 try:x=await S(db).create(project_id=project_id,context=resolved.context,actor=current_user.id,**payload.model_dump())
 except(KeyError,ValueError)as e:fail(e)
 audit(db,request,current_user,"factory_experiment_created",x["id"],project_id,{"experiment_number":x["experiment_number"]});await db.commit();return x
@router.post("/{experiment_id}/review")
async def review(project_id:int,experiment_id:str,payload:Decision,request:Request,db:AsyncSession=Depends(get_db),current_user:UserResponse=Depends(get_current_user)):
 await require_project_permission(db,current_user=current_user,project_id=project_id,permission=V)
 try:x=await S(db).review(experiment_id,project_id=project_id,actor=current_user.id,**payload.model_dump())
 except(KeyError,ValueError)as e:fail(e)
 audit(db,request,current_user,"factory_experiment_reviewed",experiment_id,project_id,{});await db.commit();return x
@router.post("/{experiment_id}/decide")
async def decide(project_id:int,experiment_id:str,payload:Decide,request:Request,db:AsyncSession=Depends(get_db),current_user:UserResponse=Depends(get_current_user)):
 resolved=await require_project_permission(db,current_user=current_user,project_id=project_id,permission=D)
 try:x=await S(db).decide(experiment_id,project_id=project_id,context=resolved.context,actor=current_user.id,**payload.model_dump())
 except(KeyError,ValueError)as e:fail(e)
 audit(db,request,current_user,"factory_experiment_decided",x["decision"]["id"],project_id,{"destination":payload.destination});await db.commit();return x
@router.post("/decisions/{decision_id}/acknowledge")
async def acknowledge(project_id:int,decision_id:str,payload:Decision,request:Request,db:AsyncSession=Depends(get_db),current_user:UserResponse=Depends(get_current_user)):
 await require_project_permission(db,current_user=current_user,project_id=project_id,permission=A)
 try:x=await S(db).acknowledge(decision_id,project_id=project_id,actor=current_user.id,**payload.model_dump())
 except(KeyError,ValueError)as e:fail(e)
 audit(db,request,current_user,"factory_experiment_acknowledged",decision_id,project_id,{});await db.commit();return x
