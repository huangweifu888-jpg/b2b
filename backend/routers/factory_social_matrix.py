"""Tenant/project APIs for the governed social-account matrix."""
from __future__ import annotations
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from core.database import get_db
from dependencies.auth import get_current_user
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.factory_social_matrix import FactorySocialMatrixService
from services.tenant_access import require_project_access, require_project_permission
from sqlalchemy.ext.asyncio import AsyncSession

router=APIRouter(prefix="/api/v1/factory-platform/projects/{project_id}/social-matrices",tags=["factory-platform-social-matrices"])
CREATE, BIND, VERIFY, PUBLISH, ACK="factory.deepen.social-matrix.create","factory.deepen.social-matrix.bind","factory.deepen.social-matrix.verify","factory.deepen.social-matrix.publish","factory.deepen.social-matrix.acknowledge"
class CreatePayload(BaseModel): matrix_key:str=Field(min_length=1,max_length=100);matrix_name:str=Field(min_length=2,max_length=255);market_scope:Literal["china","overseas","dual"]
class BindPayload(BaseModel): page_asset_id:str=Field(min_length=8,max_length=100);credential_reference_id:str=Field(min_length=8,max_length=100)
class DecisionPayload(BaseModel): expected_revision:int=Field(gt=0);reference:str=Field(min_length=1,max_length=255)
def err(exc:Exception): raise HTTPException(status_code=404 if isinstance(exc,KeyError) else 409,detail=str(exc)) from exc
def audit(db,request,user,action,target,project_id,detail): record_audit_event(db,action=action,actor_user_id=user.id,target_type="factory_social_matrix",target_id=target,ip_address=request.client.host if request.client else None,detail={"project_id":project_id,**detail})
@router.get("")
async def workspace(project_id:int,db:AsyncSession=Depends(get_db),current_user:UserResponse=Depends(get_current_user)):
    await require_project_access(db,current_user=current_user,project_id=project_id);return await FactorySocialMatrixService(db).list_workspace(project_id=project_id)
@router.post("")
async def create(project_id:int,payload:CreatePayload,request:Request,db:AsyncSession=Depends(get_db),current_user:UserResponse=Depends(get_current_user)):
    resolved=await require_project_permission(db,current_user=current_user,project_id=project_id,permission=CREATE)
    try:item=await FactorySocialMatrixService(db).create(project_id=project_id,context=resolved.context,actor=current_user.id,**payload.model_dump())
    except (KeyError,ValueError) as exc:err(exc)
    audit(db,request,current_user,"factory_social_matrix_created",item["id"],project_id,{"matrix_number":item["matrix_number"]});await db.commit();return item
@router.post("/{matrix_id}/bindings")
async def bind(project_id:int,matrix_id:str,payload:BindPayload,request:Request,db:AsyncSession=Depends(get_db),current_user:UserResponse=Depends(get_current_user)):
    resolved=await require_project_permission(db,current_user=current_user,project_id=project_id,permission=BIND)
    try:item=await FactorySocialMatrixService(db).bind_page(matrix_id,project_id=project_id,context=resolved.context,actor=current_user.id,**payload.model_dump())
    except (KeyError,ValueError) as exc:err(exc)
    audit(db,request,current_user,"factory_social_matrix_page_bound",item["id"],project_id,{"matrix_id":matrix_id,"page_asset_id":item["page_asset_id"]});await db.commit();return item
@router.post("/{matrix_id}/verify")
async def verify(project_id:int,matrix_id:str,payload:DecisionPayload,request:Request,db:AsyncSession=Depends(get_db),current_user:UserResponse=Depends(get_current_user)):
    await require_project_permission(db,current_user=current_user,project_id=project_id,permission=VERIFY)
    try:item=await FactorySocialMatrixService(db).verify(matrix_id,project_id=project_id,actor=current_user.id,expected_revision=payload.expected_revision,verification_reference=payload.reference)
    except (KeyError,ValueError) as exc:err(exc)
    audit(db,request,current_user,"factory_social_matrix_verified",matrix_id,project_id,{"reference":payload.reference});await db.commit();return item
@router.post("/{matrix_id}/publish")
async def publish(project_id:int,matrix_id:str,payload:DecisionPayload,request:Request,db:AsyncSession=Depends(get_db),current_user:UserResponse=Depends(get_current_user)):
    resolved=await require_project_permission(db,current_user=current_user,project_id=project_id,permission=PUBLISH)
    try:item=await FactorySocialMatrixService(db).publish(matrix_id,project_id=project_id,context=resolved.context,actor=current_user.id,expected_revision=payload.expected_revision,delivery_reference=payload.reference)
    except (KeyError,ValueError) as exc:err(exc)
    audit(db,request,current_user,"factory_social_matrix_published",item["publication"]["id"],project_id,{"matrix_id":matrix_id,"reference":payload.reference});await db.commit();return item
@router.post("/publications/{publication_id}/acknowledge")
async def acknowledge(project_id:int,publication_id:str,payload:DecisionPayload,request:Request,db:AsyncSession=Depends(get_db),current_user:UserResponse=Depends(get_current_user)):
    await require_project_permission(db,current_user=current_user,project_id=project_id,permission=ACK)
    try:item=await FactorySocialMatrixService(db).acknowledge(publication_id,project_id=project_id,actor=current_user.id,expected_revision=payload.expected_revision,acknowledgement_reference=payload.reference)
    except (KeyError,ValueError) as exc:err(exc)
    audit(db,request,current_user,"factory_social_matrix_acknowledged",publication_id,project_id,{"reference":payload.reference});await db.commit();return item
