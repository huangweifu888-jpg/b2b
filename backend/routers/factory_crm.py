"""Permissioned API for the governed factory CRM source of record."""
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from core.database import get_db
from dependencies.auth import get_current_user
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.factory_crm import FactoryCrmService
from services.tenant_access import require_project_access, require_project_permission
from sqlalchemy.ext.asyncio import AsyncSession
router=APIRouter(prefix="/api/v1/factory-platform/projects/{project_id}/crm",tags=["factory-platform-crm"])
C,V,O,A="factory.care.crm.account.create","factory.care.crm.account.verify","factory.care.crm.opportunity.create","factory.care.crm.opportunity.advance"
class AccountPayload(BaseModel): account_reference:str=Field(min_length=2,max_length=255);account_name:str=Field(min_length=2,max_length=255);market:str=Field(min_length=2,max_length=80)
class DecisionPayload(BaseModel): expected_revision:int=Field(gt=0);reference:str=Field(min_length=2,max_length=255);note:str=Field(min_length=8,max_length=4000)
class OpportunityPayload(BaseModel): account_id:str=Field(min_length=1,max_length=100);opportunity_key:str=Field(min_length=2,max_length=100);title:str=Field(min_length=2,max_length=255);currency:str=Field(min_length=3,max_length=3);amount_cents:int=Field(gt=0);owner_team:str=Field(min_length=2,max_length=80)
class StagePayload(DecisionPayload): stage:str=Field(pattern="^(proposal|won|lost)$")
def fail(e:Exception):raise HTTPException(status_code=404 if isinstance(e,KeyError) else 409,detail=str(e)) from e
def audit(db,request,user,action,target,project,detail):record_audit_event(db,action=action,actor_user_id=user.id,target_type="factory_crm",target_id=target,project_id=project,ip_address=request.client.host if request.client else None,detail=detail)
@router.get("")
async def workspace(project_id:int,db:AsyncSession=Depends(get_db),current_user:UserResponse=Depends(get_current_user)):
 await require_project_access(db,current_user=current_user,project_id=project_id);return await FactoryCrmService(db).workspace(project_id)
@router.post("/accounts")
async def create_account(project_id:int,payload:AccountPayload,request:Request,db:AsyncSession=Depends(get_db),current_user:UserResponse=Depends(get_current_user)):
 resolved=await require_project_permission(db,current_user=current_user,project_id=project_id,permission=C)
 try:x=await FactoryCrmService(db).create_account(project_id=project_id,context=resolved.context,actor=current_user.id,**payload.model_dump())
 except (KeyError,ValueError) as e:fail(e)
 audit(db,request,current_user,"factory_crm_account_created",x["id"],project_id,{"account_number":x["account_number"]});await db.commit();return x
@router.post("/accounts/{account_id}/verify")
async def verify_account(project_id:int,account_id:str,payload:DecisionPayload,request:Request,db:AsyncSession=Depends(get_db),current_user:UserResponse=Depends(get_current_user)):
 await require_project_permission(db,current_user=current_user,project_id=project_id,permission=V)
 try:x=await FactoryCrmService(db).verify_account(account_id,project_id=project_id,actor=current_user.id,**payload.model_dump())
 except (KeyError,ValueError) as e:fail(e)
 audit(db,request,current_user,"factory_crm_account_verified",account_id,project_id,{"reference":payload.reference});await db.commit();return x
@router.post("/opportunities")
async def create_opportunity(project_id:int,payload:OpportunityPayload,request:Request,db:AsyncSession=Depends(get_db),current_user:UserResponse=Depends(get_current_user)):
 resolved=await require_project_permission(db,current_user=current_user,project_id=project_id,permission=O)
 try:x=await FactoryCrmService(db).create_opportunity(project_id=project_id,context=resolved.context,actor=current_user.id,**payload.model_dump())
 except (KeyError,ValueError) as e:fail(e)
 audit(db,request,current_user,"factory_crm_opportunity_created",x["id"],project_id,{"opportunity_number":x["opportunity_number"]});await db.commit();return x
@router.post("/opportunities/{opportunity_id}/advance")
async def advance_opportunity(project_id:int,opportunity_id:str,payload:StagePayload,request:Request,db:AsyncSession=Depends(get_db),current_user:UserResponse=Depends(get_current_user)):
 await require_project_permission(db,current_user=current_user,project_id=project_id,permission=A)
 try:x=await FactoryCrmService(db).advance_opportunity(opportunity_id,project_id=project_id,actor=current_user.id,**payload.model_dump())
 except (KeyError,ValueError) as e:fail(e)
 audit(db,request,current_user,"factory_crm_opportunity_advanced",opportunity_id,project_id,{"stage":payload.stage,"reference":payload.reference});await db.commit();return x
