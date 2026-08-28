"""Tenant-scoped creative center APIs."""
from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter,Depends,HTTPException,Request
from pydantic import BaseModel,Field
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.factory_creative import FactoryCreativeService
from services.tenant_access import require_project_access,require_project_permission
from sqlalchemy.ext.asyncio import AsyncSession
router=APIRouter(prefix="/api/v1/factory-platform/projects/{project_id}/creative-center",tags=["factory-platform-creative"])
MANAGE="factory.lead.creative.manage";APPROVE="factory.lead.creative.variant.approve";PUBLISH="factory.lead.creative.publish";ACK="factory.lead.creative.activation.acknowledge"
class BriefCreate(BaseModel):brief_code:str=Field(min_length=1,max_length=64);brief_name:str=Field(min_length=1,max_length=180);objective:str=Field(min_length=1,max_length=255);abm_version_id:str;country_pack_id:str;allowed_consumers:list[str]=Field(min_length=1,max_length=4)
class VariantCreate(BaseModel):abm_play_id:str;channel:str=Field(min_length=1,max_length=32);headline:str=Field(min_length=1,max_length=180);message_body:str=Field(min_length=1,max_length=4000);call_to_action:str=Field(min_length=1,max_length=128);ai_assisted:bool=False;model_reference:str|None=None;prompt_reference:str|None=None
class RevisionReference(BaseModel):expected_revision:int=Field(gt=0);reference:str=Field(min_length=1,max_length=255)
class PublishBrief(BaseModel):expected_revision:int=Field(gt=0);consumers:list[str]=Field(min_length=1,max_length=4);delivery_reference_prefix:str=Field(min_length=1,max_length=180)
def _raise(e):
 if isinstance(e,KeyError):raise HTTPException(status_code=404,detail=str(e)) from e
 raise HTTPException(status_code=409,detail=str(e)) from e
def _item(x):
 if isinstance(x,dict):
  for k in ("brief","version"):
   if isinstance(x.get(k),dict):return x[k]
 return x
async def _run(db,r,u,p,permission,a,t,m,*,context=False,**kw):
 await require_project_access(db,current_user=u,project_id=p);resolved=await require_project_permission(db,current_user=u,project_id=p,permission=permission)
 try:x=await m(project_id=p,actor=u.id,**({"context":resolved.context} if context else {}),**kw)
 except (KeyError,ValueError) as e:_raise(e)
 item=_item(x);record_audit_event(db,action=a,actor_user_id=u.id,project_id=p,target_type=t,target_id=str(item["id"]),ip_address=r.client.host if r.client else None,detail={"project_id":p,"status":item.get("status"),"revision":item.get("revision")});await db.commit();return x
@router.get("")
async def workspace(project_id:int,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):await require_project_access(db,current_user=current_user,project_id=project_id);return await FactoryCreativeService(db).list_workspace(project_id=project_id)
@router.post("/briefs")
async def create(project_id:int,payload:BriefCreate,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,MANAGE,"factory.creative.brief.create","factory-creative-brief",FactoryCreativeService(db).create_brief,context=True,**payload.model_dump())
@router.post("/briefs/{brief_id}/variants")
async def create_variant(project_id:int,brief_id:str,payload:VariantCreate,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,MANAGE,"factory.creative.variant.create","factory-creative-variant",FactoryCreativeService(db).create_variant,context=True,brief_id=brief_id,**payload.model_dump())
@router.post("/variants/{variant_id}/approve")
async def approve_variant(project_id:int,variant_id:str,payload:RevisionReference,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,APPROVE,"factory.creative.variant.approve","factory-creative-variant",FactoryCreativeService(db).approve_variant,variant_id=variant_id,**payload.model_dump())
@router.post("/briefs/{brief_id}/publish")
async def publish(project_id:int,brief_id:str,payload:PublishBrief,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,PUBLISH,"factory.creative.brief.publish","factory-creative-brief",FactoryCreativeService(db).publish_brief,context=True,brief_id=brief_id,**payload.model_dump())
@router.post("/activations/{activation_id}/acknowledge")
async def acknowledge(project_id:int,activation_id:str,payload:RevisionReference,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,ACK,"factory.creative.activation.acknowledge","factory-creative-activation",FactoryCreativeService(db).acknowledge_activation,activation_id=activation_id,**payload.model_dump())
