"""Permissioned APIs for authorized case, news, video and blog releases."""
from typing import Any
from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.factory_content_proof import FactoryContentProofService
from services.tenant_access import require_project_access, require_project_permission
from sqlalchemy.ext.asyncio import AsyncSession
router=APIRouter(prefix="/api/v1/factory-platform/projects/{project_id}/content-proof",tags=["factory-platform-content-proof"])
MANAGE="factory.content.proof.asset.manage";VERIFY="factory.content.proof.version.verify";APPROVE="factory.content.proof.publication.approve";ACK="factory.content.proof.handoff.acknowledge"
class AssetCreate(BaseModel): content_type:str=Field(pattern="^(cases|news|videos|blog)$");content_reference:str=Field(min_length=2,max_length=160);display_name:str=Field(min_length=2,max_length=200);source_reference:str=Field(min_length=1,max_length=255);authorization_reference:str=Field(min_length=1,max_length=255);public_scope:str=Field(min_length=1,max_length=255)
class VersionCreate(BaseModel): locale:str=Field(min_length=2,max_length=16);content_manifest:dict[str,Any]
class RevisionReference(BaseModel): expected_revision:int=Field(gt=0);reference:str=Field(min_length=1,max_length=255)
class PublicationCreate(BaseModel): target:str=Field(pattern="^(website-case|website-news|website-video|website-blog|sales-proof)$");rollback_reference:str=Field(min_length=1,max_length=255)
def _fail(e:Exception): raise HTTPException(status_code=404 if isinstance(e,KeyError) else 409,detail=str(e)) from e
async def _run(db,request,user,project_id,permission,action,target_type,operation,*,context=False,**kwargs):
    await require_project_access(db,current_user=user,project_id=project_id);resolved=await require_project_permission(db,current_user=user,project_id=project_id,permission=permission)
    try: item=await operation(project_id=project_id,actor=user.id,**({"context":resolved.context} if context else {}),**kwargs)
    except (KeyError,ValueError) as error: _fail(error)
    record_audit_event(db,action=action,actor_user_id=user.id,project_id=project_id,target_type=target_type,target_id=str(item.get("id")),ip_address=request.client.host if request.client else None,detail={"project_id":project_id,"status":item.get("status"),"revision":item.get("revision")});await db.commit();return item
@router.get("")
async def workspace(project_id:int,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):
    await require_project_access(db,current_user=current_user,project_id=project_id);return await FactoryContentProofService(db).workspace(project_id=project_id)
@router.post("/assets")
async def create_asset(project_id:int,payload:AssetCreate,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)): return await _run(db,request,current_user,project_id,MANAGE,"factory.content-proof.asset.create","factory-content-proof-asset",FactoryContentProofService(db).create_asset,context=True,**payload.model_dump())
@router.post("/assets/{asset_id}/versions")
async def draft_version(project_id:int,asset_id:str,payload:VersionCreate,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)): return await _run(db,request,current_user,project_id,MANAGE,"factory.content-proof.version.draft","factory-content-proof-version",FactoryContentProofService(db).draft_version,context=True,asset_id=asset_id,**payload.model_dump())
@router.post("/versions/{version_id}/verify")
async def verify_version(project_id:int,version_id:str,payload:RevisionReference,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)): return await _run(db,request,current_user,project_id,VERIFY,"factory.content-proof.version.verify","factory-content-proof-version",FactoryContentProofService(db).verify_version,version_id=version_id,expected_revision=payload.expected_revision,verification_reference=payload.reference)
@router.post("/versions/{version_id}/publications")
async def prepare_publication(project_id:int,version_id:str,payload:PublicationCreate,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)): return await _run(db,request,current_user,project_id,MANAGE,"factory.content-proof.publication.prepare","factory-content-proof-publication",FactoryContentProofService(db).prepare_publication,context=True,version_id=version_id,**payload.model_dump())
@router.post("/publications/{publication_id}/approve")
async def approve_publication(project_id:int,publication_id:str,payload:RevisionReference,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)): return await _run(db,request,current_user,project_id,APPROVE,"factory.content-proof.publication.approve","factory-content-proof-publication",FactoryContentProofService(db).approve_publication,publication_id=publication_id,expected_revision=payload.expected_revision,approval_reference=payload.reference)
@router.post("/publications/{publication_id}/acknowledge")
async def acknowledge_publication(project_id:int,publication_id:str,payload:RevisionReference,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)): return await _run(db,request,current_user,project_id,ACK,"factory.content-proof.publication.acknowledge","factory-content-proof-publication",FactoryContentProofService(db).acknowledge_publication,publication_id=publication_id,expected_revision=payload.expected_revision,consumer_receipt_reference=payload.reference)
