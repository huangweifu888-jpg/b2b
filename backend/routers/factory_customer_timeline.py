"""Tenant-scoped customer behavior timeline APIs."""
from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter,Depends,HTTPException,Request
from pydantic import BaseModel,Field
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.factory_customer_timeline import FactoryCustomerTimelineService
from services.tenant_access import require_project_access,require_project_permission
from sqlalchemy.ext.asyncio import AsyncSession
router=APIRouter(prefix="/api/v1/factory-platform/projects/{project_id}/customer-timeline",tags=["factory-platform-customer-timeline"])
MANAGE="factory.portrait.timeline.manage";VERIFY="factory.portrait.timeline.event.verify";CHECKPOINT="factory.portrait.timeline.checkpoint.manage";PUBLISH="factory.portrait.timeline.publish";ACK="factory.portrait.timeline.handoff.acknowledge"
class TimelineCreate(BaseModel):timeline_name:str=Field(min_length=1,max_length=180);account_reference:str=Field(min_length=1,max_length=180)
class EventCreate(BaseModel):source_type:str=Field(min_length=1,max_length=48);source_id:str=Field(min_length=1,max_length=100)
class CheckpointCreate(BaseModel):event_id:str=Field(min_length=1,max_length=100);checkpoint_code:str=Field(min_length=1,max_length=48);note:str|None=Field(default=None,max_length=1000)
class RevisionReference(BaseModel):expected_revision:int=Field(gt=0);reference:str=Field(min_length=1,max_length=255)
class PublishTimeline(BaseModel):expected_revision:int=Field(gt=0);consumers:list[str]=Field(min_length=1,max_length=4);delivery_reference_prefix:str=Field(min_length=1,max_length=180)
def _raise(exc):
    if isinstance(exc,KeyError):raise HTTPException(status_code=404,detail=str(exc)) from exc
    raise HTTPException(status_code=409,detail=str(exc)) from exc
def _item(x):
    if isinstance(x,dict):
        for k in ("timeline","version"):
            if isinstance(x.get(k),dict):return x[k]
    return x
def _audit(db,request,user,action,target_type,item,pid):item=_item(item);record_audit_event(db,action=action,actor_user_id=user.id,project_id=pid,target_type=target_type,target_id=str(item["id"]),ip_address=request.client.host if request.client else None,detail={"project_id":pid,"status":item.get("status"),"revision":item.get("revision")})
async def _run(db,request,user,pid,permission,action,target_type,method,*,context=False,**kwargs):
    resolved=await require_project_permission(db,current_user=user,project_id=pid,permission=permission)
    try:result=await method(project_id=pid,actor=user.id,**({"context":resolved.context} if context else {}),**kwargs)
    except (KeyError,ValueError) as exc:_raise(exc)
    _audit(db,request,user,action,target_type,result,pid);await db.commit();return result
@router.get("")
async def workspace(project_id:int,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):await require_project_access(db,current_user=current_user,project_id=project_id);return await FactoryCustomerTimelineService(db).list_workspace(project_id=project_id)
@router.post("/timelines")
async def create(project_id:int,payload:TimelineCreate,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,MANAGE,"factory.timeline.create","factory-customer-timeline",FactoryCustomerTimelineService(db).create_timeline,context=True,**payload.model_dump())
@router.post("/timelines/{timeline_id}/events")
async def add_event(project_id:int,timeline_id:str,payload:EventCreate,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,MANAGE,"factory.timeline.event.add","factory-customer-timeline-event",FactoryCustomerTimelineService(db).add_event,context=True,timeline_id=timeline_id,**payload.model_dump())
@router.post("/events/{event_id}/verify")
async def verify(project_id:int,event_id:str,payload:RevisionReference,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,VERIFY,"factory.timeline.event.verify","factory-customer-timeline-event",FactoryCustomerTimelineService(db).verify_event,event_id=event_id,**payload.model_dump())
@router.post("/timelines/{timeline_id}/checkpoints")
async def checkpoint(project_id:int,timeline_id:str,payload:CheckpointCreate,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,CHECKPOINT,"factory.timeline.checkpoint.create","factory-customer-timeline-checkpoint",FactoryCustomerTimelineService(db).add_checkpoint,context=True,timeline_id=timeline_id,**payload.model_dump())
@router.post("/timelines/{timeline_id}/publish")
async def publish(project_id:int,timeline_id:str,payload:PublishTimeline,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,PUBLISH,"factory.timeline.publish","factory-customer-timeline",FactoryCustomerTimelineService(db).publish_timeline,context=True,timeline_id=timeline_id,**payload.model_dump())
@router.post("/publications/{publication_id}/acknowledge")
async def acknowledge(project_id:int,publication_id:str,payload:RevisionReference,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,ACK,"factory.timeline.publication.acknowledge","factory-customer-timeline-publication",FactoryCustomerTimelineService(db).acknowledge_publication,publication_id=publication_id,**payload.model_dump())
