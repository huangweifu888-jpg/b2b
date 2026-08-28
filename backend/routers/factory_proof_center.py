"""Permissioned verified-proof and controlled website handoff APIs."""
from typing import Any
from fastapi import APIRouter,Depends,HTTPException,Request
from pydantic import BaseModel,Field
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_db
from dependencies.auth import get_current_user
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.factory_proof_center import FactoryProofCenterService
from services.tenant_access import require_project_access,require_project_permission
router=APIRouter(prefix="/api/v1/factory-platform/projects/{project_id}/proof-center",tags=["factory-platform-proof-center"])
MANAGE="factory.trust.proof-center.asset.manage";VERIFY="factory.trust.proof-center.version.verify";APPROVE="factory.trust.proof-center.release.approve";ACK="factory.trust.proof-center.handoff.acknowledge"
class AssetCreate(BaseModel):asset_type:str=Field(pattern="^(certificate|test-report|capacity|delivery|service)$");source_reference:str=Field(min_length=2,max_length=255);rights_reference:str=Field(min_length=2,max_length=255);market_scope:str=Field(min_length=2,max_length=80);valid_until:str=Field(min_length=8,max_length=32)
class VersionCreate(BaseModel):claim_manifest:dict[str,Any]
class ReleaseCreate(BaseModel):target:str=Field(pattern="^(marketing-owner|sales-owner|quality-owner)$");handoff_manifest:dict[str,Any];rollback_reference:str=Field(min_length=1,max_length=255)
class RevisionReference(BaseModel):expected_revision:int=Field(gt=0);reference:str=Field(min_length=1,max_length=255)
def fail(e):raise HTTPException(status_code=404 if isinstance(e,KeyError) else 409,detail=str(e))from e
async def run(db,request,user,project_id,permission,action,target_type,op,*,context=False,**kw):
 await require_project_access(db,current_user=user,project_id=project_id);r=await require_project_permission(db,current_user=user,project_id=project_id,permission=permission)
 try:item=await op(project_id=project_id,actor=user.id,**({"context":r.context}if context else{}),**kw)
 except(KeyError,ValueError)as e:fail(e)
 record_audit_event(db,action=action,actor_user_id=user.id,project_id=project_id,target_type=target_type,target_id=str(item["id"]),ip_address=request.client.host if request.client else None,detail={"status":item.get("status"),"revision":item.get("revision")});await db.commit();return item
@router.get("")
async def workspace(project_id:int,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):
 await require_project_access(db,current_user=current_user,project_id=project_id);return await FactoryProofCenterService(db).workspace(project_id=project_id)
@router.post("/assets")
async def asset(project_id:int,payload:AssetCreate,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await run(db,request,current_user,project_id,MANAGE,"factory.proof.asset.create","factory-proof-center-asset",FactoryProofCenterService(db).create_asset,context=True,**payload.model_dump())
@router.post("/assets/{asset_id}/versions")
async def version(project_id:int,asset_id:str,payload:VersionCreate,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await run(db,request,current_user,project_id,MANAGE,"factory.proof.version.draft","factory-proof-center-version",FactoryProofCenterService(db).draft_version,context=True,asset_id=asset_id,**payload.model_dump())
@router.post("/versions/{version_id}/verify")
async def verify(project_id:int,version_id:str,payload:RevisionReference,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await run(db,request,current_user,project_id,VERIFY,"factory.proof.version.verify","factory-proof-center-version",FactoryProofCenterService(db).verify_version,version_id=version_id,expected_revision=payload.expected_revision,verification_reference=payload.reference)
@router.post("/versions/{version_id}/releases")
async def release(project_id:int,version_id:str,payload:ReleaseCreate,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await run(db,request,current_user,project_id,MANAGE,"factory.proof.release.prepare","factory-proof-center-release",FactoryProofCenterService(db).prepare_release,context=True,version_id=version_id,**payload.model_dump())
@router.post("/releases/{release_id}/approve")
async def approve(project_id:int,release_id:str,payload:RevisionReference,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await run(db,request,current_user,project_id,APPROVE,"factory.proof.release.approve","factory-proof-center-release",FactoryProofCenterService(db).approve_release,release_id=release_id,expected_revision=payload.expected_revision,approval_reference=payload.reference)
@router.post("/releases/{release_id}/acknowledge")
async def acknowledge(project_id:int,release_id:str,payload:RevisionReference,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await run(db,request,current_user,project_id,ACK,"factory.proof.handoff.acknowledge","factory-proof-center-release",FactoryProofCenterService(db).acknowledge_release,release_id=release_id,expected_revision=payload.expected_revision,consumer_receipt_reference=payload.reference)
