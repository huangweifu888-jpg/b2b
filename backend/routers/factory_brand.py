"""Tenant-scoped brand positioning and website-style APIs."""
from datetime import datetime
from typing import Any
from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter,Depends,HTTPException,Request
from pydantic import BaseModel,Field
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.factory_brand import FactoryBrandService
from services.tenant_access import require_project_access,require_project_permission
from sqlalchemy.ext.asyncio import AsyncSession
router=APIRouter(prefix="/api/v1/factory-platform/projects/{project_id}/brand-studio",tags=["factory-platform-brand"])
MANAGE="factory.identity.brand.manage";VERIFY="factory.identity.brand.claim.verify";APPROVE="factory.identity.brand.profile.approve";RELEASE="factory.identity.brand.release.approve"
class ProfileCreate(BaseModel):
 brand_name:str=Field(min_length=1,max_length=180);market_scope:str=Field(min_length=1,max_length=64);audience:str=Field(min_length=8,max_length=4000);positioning:str=Field(min_length=8,max_length=4000);value_promise:str=Field(min_length=8,max_length=4000);tone:str=Field(min_length=2,max_length=255);visual_tokens:dict[str,Any];messaging:dict[str,Any]
class ClaimCreate(BaseModel):claim_type:str=Field(min_length=2,max_length=64);claim_text:str=Field(min_length=4,max_length=4000);evidence_reference:str=Field(min_length=1,max_length=255)
class RevisionReference(BaseModel):expected_revision:int=Field(gt=0);reference:str=Field(min_length=1,max_length=255)
class ReleaseCreate(BaseModel):
 release_version:str=Field(min_length=1,max_length=64);support_owner:str=Field(min_length=1,max_length=128);support_until:datetime;customer_trial_reference:str=Field(min_length=1,max_length=255);role_training_reference:str=Field(min_length=1,max_length=255);issue_closure_reference:str=Field(min_length=1,max_length=255);monitoring_reference:str=Field(min_length=1,max_length=255);rollback_reference:str=Field(min_length=1,max_length=255)
def fail(e):raise HTTPException(status_code=404 if isinstance(e,KeyError) else 409,detail=str(e)) from e
async def run(db,request,user,pid,permission,action,target,operation,*,context=False,**kw):
 await require_project_access(db,current_user=user,project_id=pid);resolved=await require_project_permission(db,current_user=user,project_id=pid,permission=permission)
 try:item=await operation(project_id=pid,actor=user.id,**({"context":resolved.context} if context else {}),**kw)
 except (KeyError,ValueError) as e:fail(e)
 record_audit_event(db,action=action,actor_user_id=user.id,project_id=pid,target_type=target,target_id=str(item["id"] if "id" in item else item["profile"]["id"]),ip_address=request.client.host if request.client else None,detail={"project_id":pid,"status":item.get("status",item.get("profile",{}).get("status")),"revision":item.get("revision",item.get("profile",{}).get("revision"))});await db.commit();return item
@router.get("")
async def workspace(project_id:int,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):
 await require_project_access(db,current_user=current_user,project_id=project_id);return await FactoryBrandService(db).workspace(project_id=project_id)
@router.post("/profiles")
async def profile(project_id:int,payload:ProfileCreate,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await run(db,request,current_user,project_id,MANAGE,"factory.brand.profile.create","factory-brand-profile",FactoryBrandService(db).create_profile,context=True,**payload.model_dump())
@router.post("/profiles/{profile_id}/claims")
async def claim(project_id:int,profile_id:str,payload:ClaimCreate,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await run(db,request,current_user,project_id,MANAGE,"factory.brand.claim.create","factory-brand-claim",FactoryBrandService(db).add_claim,context=True,profile_id=profile_id,**payload.model_dump())
@router.post("/claims/{claim_id}/verify")
async def verify(project_id:int,claim_id:str,payload:RevisionReference,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await run(db,request,current_user,project_id,VERIFY,"factory.brand.claim.verify","factory-brand-claim",FactoryBrandService(db).verify_claim,claim_id=claim_id,expected_revision=payload.expected_revision,verification_reference=payload.reference)
@router.post("/profiles/{profile_id}/approve")
async def approve(project_id:int,profile_id:str,payload:RevisionReference,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await run(db,request,current_user,project_id,APPROVE,"factory.brand.profile.approve","factory-brand-profile",FactoryBrandService(db).approve_profile,profile_id=profile_id,expected_revision=payload.expected_revision,approval_reference=payload.reference)
@router.post("/profiles/{profile_id}/releases")
async def release(project_id:int,profile_id:str,payload:ReleaseCreate,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await run(db,request,current_user,project_id,MANAGE,"factory.brand.release.prepare","factory-brand-release",FactoryBrandService(db).prepare_release,context=True,profile_id=profile_id,**payload.model_dump())
@router.post("/releases/{release_id}/approve")
async def release_approve(project_id:int,release_id:str,payload:RevisionReference,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await run(db,request,current_user,project_id,RELEASE,"factory.brand.release.approve","factory-brand-release",FactoryBrandService(db).approve_release,release_id=release_id,expected_revision=payload.expected_revision,approval_reference=payload.reference)
