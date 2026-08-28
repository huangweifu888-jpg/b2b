"""Tenant-scoped buying committee and influence-path APIs."""
from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter,Depends,HTTPException,Request
from pydantic import BaseModel,Field
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.factory_buying_committee import FactoryBuyingCommitteeService
from services.tenant_access import require_project_access,require_project_permission
from sqlalchemy.ext.asyncio import AsyncSession

router=APIRouter(prefix="/api/v1/factory-platform/projects/{project_id}/buying-committee",tags=["factory-platform-buying-committee"])
MANAGE="factory.portrait.buying.committee.manage";MEMBER_VERIFY="factory.portrait.buying.member.verify";INFLUENCE_MANAGE="factory.portrait.buying.influence.manage";INFLUENCE_VERIFY="factory.portrait.buying.influence.verify";PUBLISH="factory.portrait.buying.publish";ACK="factory.portrait.buying.handoff.acknowledge"
class CommitteeCreate(BaseModel):committee_name:str=Field(min_length=1,max_length=180);opportunity_source_id:str=Field(min_length=1,max_length=100);icp_profile_id:str=Field(min_length=1,max_length=100)
class MemberCreate(BaseModel):role_id:str=Field(min_length=1,max_length=100);contact_signal_id:str=Field(min_length=1,max_length=100);influence_score:float=Field(ge=0,le=100);relationship_strength:str=Field(pattern="^(weak|medium|strong)$");stance:str=Field(pattern="^(supportive|neutral|blocking)$");preferred_channel:str=Field(pattern="^(email|phone|meeting|wechat|whatsapp)$");evidence_reference:str=Field(min_length=1,max_length=255)
class InfluenceCreate(BaseModel):from_member_id:str=Field(min_length=1,max_length=100);to_member_id:str=Field(min_length=1,max_length=100);influence_direction:str=Field(pattern="^(influences|approves|advises|blocks)$");strength:str=Field(pattern="^(weak|medium|strong)$");evidence_reference:str=Field(min_length=1,max_length=255)
class RevisionReference(BaseModel):expected_revision:int=Field(gt=0);reference:str=Field(min_length=1,max_length=255)
class PublishCommittee(BaseModel):expected_revision:int=Field(gt=0);consumers:list[str]=Field(min_length=1,max_length=4);delivery_reference_prefix:str=Field(min_length=1,max_length=180)
def _raise(exc):
    if isinstance(exc,KeyError):raise HTTPException(status_code=404,detail=str(exc)) from exc
    raise HTTPException(status_code=409,detail=str(exc)) from exc
def _item(x):
    if isinstance(x,dict):
        for k in ("committee","version"):
            if isinstance(x.get(k),dict):return x[k]
    return x
def _audit(db,request,user,action,target_type,item,pid):item=_item(item);record_audit_event(db,action=action,actor_user_id=user.id,project_id=pid,target_type=target_type,target_id=str(item["id"]),ip_address=request.client.host if request.client else None,detail={"project_id":pid,"status":item.get("status"),"revision":item.get("revision")})
async def _run(db,request,user,pid,permission,action,target_type,method,*,context=False,**kwargs):
    resolved=await require_project_permission(db,current_user=user,project_id=pid,permission=permission)
    try:result=await method(project_id=pid,actor=user.id,**({"context":resolved.context} if context else {}),**kwargs)
    except (KeyError,ValueError) as exc:_raise(exc)
    _audit(db,request,user,action,target_type,result,pid);await db.commit();return result
@router.get("")
async def workspace(project_id:int,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):await require_project_access(db,current_user=current_user,project_id=project_id);return await FactoryBuyingCommitteeService(db).list_workspace(project_id=project_id)
@router.post("/committees")
async def create_committee(project_id:int,payload:CommitteeCreate,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,MANAGE,"factory.buying.committee.create","factory-buying-committee",FactoryBuyingCommitteeService(db).create_committee,context=True,**payload.model_dump())
@router.post("/committees/{committee_id}/members")
async def add_member(project_id:int,committee_id:str,payload:MemberCreate,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,MANAGE,"factory.buying.member.create","factory-buying-member",FactoryBuyingCommitteeService(db).add_member,context=True,committee_id=committee_id,**payload.model_dump())
@router.post("/members/{member_id}/verify")
async def verify_member(project_id:int,member_id:str,payload:RevisionReference,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,MEMBER_VERIFY,"factory.buying.member.verify","factory-buying-member",FactoryBuyingCommitteeService(db).verify_member,member_id=member_id,**payload.model_dump())
@router.post("/committees/{committee_id}/influences")
async def add_influence(project_id:int,committee_id:str,payload:InfluenceCreate,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,INFLUENCE_MANAGE,"factory.buying.influence.create","factory-buying-influence",FactoryBuyingCommitteeService(db).add_influence,context=True,committee_id=committee_id,**payload.model_dump())
@router.post("/influences/{edge_id}/verify")
async def verify_influence(project_id:int,edge_id:str,payload:RevisionReference,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,INFLUENCE_VERIFY,"factory.buying.influence.verify","factory-buying-influence",FactoryBuyingCommitteeService(db).verify_influence,edge_id=edge_id,**payload.model_dump())
@router.post("/committees/{committee_id}/publish")
async def publish(project_id:int,committee_id:str,payload:PublishCommittee,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,PUBLISH,"factory.buying.committee.publish","factory-buying-committee",FactoryBuyingCommitteeService(db).publish_committee,context=True,committee_id=committee_id,**payload.model_dump())
@router.post("/publications/{publication_id}/acknowledge")
async def acknowledge(project_id:int,publication_id:str,payload:RevisionReference,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,ACK,"factory.buying.publication.acknowledge","factory-buying-publication",FactoryBuyingCommitteeService(db).acknowledge_publication,publication_id=publication_id,**payload.model_dump())
