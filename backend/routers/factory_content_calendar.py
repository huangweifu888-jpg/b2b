"""Permissioned content-calendar API."""
from datetime import datetime
from typing import Literal
from fastapi import APIRouter,Depends,HTTPException,Request
from pydantic import BaseModel,Field
from core.database import get_db
from dependencies.auth import get_current_user
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.factory_content_calendar import FactoryContentCalendarService
from services.tenant_access import require_project_access,require_project_permission
from sqlalchemy.ext.asyncio import AsyncSession
router=APIRouter(prefix="/api/v1/factory-platform/projects/{project_id}/content-calendars",tags=["factory-platform-content-calendars"])
C,E,V,P,A="factory.deepen.content-calendar.create","factory.deepen.content-calendar.entry.create","factory.deepen.content-calendar.verify","factory.deepen.content-calendar.publish","factory.deepen.content-calendar.acknowledge"
class Create(BaseModel): calendar_key:str=Field(min_length=1,max_length=100);calendar_name:str=Field(min_length=2,max_length=255);market_scope:Literal["china","overseas","dual"]
class Entry(BaseModel): review_id:str=Field(min_length=8,max_length=100);channel:str=Field(min_length=2,max_length=80);scheduled_for:datetime
class Decision(BaseModel): expected_revision:int=Field(gt=0);reference:str=Field(min_length=2,max_length=255)
def fail(e): raise HTTPException(status_code=404 if isinstance(e,KeyError) else 409,detail=str(e)) from e
def audit(db,r,u,action,target,p,detail):record_audit_event(db,action=action,actor_user_id=u.id,target_type="factory_content_calendar",target_id=target,project_id=p,ip_address=r.client.host if r.client else None,detail=detail)
@router.get("")
async def workspace(project_id:int,db:AsyncSession=Depends(get_db),current_user:UserResponse=Depends(get_current_user)):
 await require_project_access(db,current_user=current_user,project_id=project_id);return await FactoryContentCalendarService(db).workspace(project_id)
@router.post("")
async def create(project_id:int,payload:Create,request:Request,db:AsyncSession=Depends(get_db),current_user:UserResponse=Depends(get_current_user)):
 resolved=await require_project_permission(db,current_user=current_user,project_id=project_id,permission=C)
 try:x=await FactoryContentCalendarService(db).create(project_id=project_id,context=resolved.context,actor=current_user.id,**payload.model_dump())
 except (KeyError,ValueError) as e:fail(e)
 audit(db,request,current_user,"factory_content_calendar_created",x["id"],project_id,{"calendar_number":x["calendar_number"]});await db.commit();return x
@router.post("/{calendar_id}/entries")
async def entry(project_id:int,calendar_id:str,payload:Entry,request:Request,db:AsyncSession=Depends(get_db),current_user:UserResponse=Depends(get_current_user)):
 resolved=await require_project_permission(db,current_user=current_user,project_id=project_id,permission=E)
 try:x=await FactoryContentCalendarService(db).add_entry(calendar_id,project_id=project_id,context=resolved.context,actor=current_user.id,**payload.model_dump())
 except (KeyError,ValueError) as e:fail(e)
 audit(db,request,current_user,"factory_content_calendar_entry_planned",x["id"],project_id,{"calendar_id":calendar_id,"review_id":x["review_id"]});await db.commit();return x
@router.post("/{calendar_id}/verify")
async def verify(project_id:int,calendar_id:str,payload:Decision,request:Request,db:AsyncSession=Depends(get_db),current_user:UserResponse=Depends(get_current_user)):
 await require_project_permission(db,current_user=current_user,project_id=project_id,permission=V)
 try:x=await FactoryContentCalendarService(db).verify(calendar_id,project_id=project_id,actor=current_user.id,expected_revision=payload.expected_revision,reference=payload.reference)
 except (KeyError,ValueError) as e:fail(e)
 audit(db,request,current_user,"factory_content_calendar_verified",calendar_id,project_id,{"reference":payload.reference});await db.commit();return x
@router.post("/{calendar_id}/publish")
async def publish(project_id:int,calendar_id:str,payload:Decision,request:Request,db:AsyncSession=Depends(get_db),current_user:UserResponse=Depends(get_current_user)):
 resolved=await require_project_permission(db,current_user=current_user,project_id=project_id,permission=P)
 try:x=await FactoryContentCalendarService(db).publish(calendar_id,project_id=project_id,context=resolved.context,actor=current_user.id,expected_revision=payload.expected_revision,reference=payload.reference)
 except (KeyError,ValueError) as e:fail(e)
 audit(db,request,current_user,"factory_content_calendar_published",x["publication"]["id"],project_id,{"calendar_id":calendar_id,"reference":payload.reference});await db.commit();return x
@router.post("/publications/{publication_id}/acknowledge")
async def acknowledge(project_id:int,publication_id:str,payload:Decision,request:Request,db:AsyncSession=Depends(get_db),current_user:UserResponse=Depends(get_current_user)):
 await require_project_permission(db,current_user=current_user,project_id=project_id,permission=A)
 try:x=await FactoryContentCalendarService(db).acknowledge(publication_id,project_id=project_id,actor=current_user.id,expected_revision=payload.expected_revision,reference=payload.reference)
 except (KeyError,ValueError) as e:fail(e)
 audit(db,request,current_user,"factory_content_calendar_acknowledged",publication_id,project_id,{"reference":payload.reference});await db.commit();return x
