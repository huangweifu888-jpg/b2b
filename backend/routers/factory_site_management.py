"""Permissioned APIs for the controlled multi-site content loop."""
from typing import Any
from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.factory_site_management import FactorySiteManagementService
from services.tenant_access import require_project_access, require_project_permission
from sqlalchemy.ext.asyncio import AsyncSession

router=APIRouter(prefix="/api/v1/factory-platform/projects/{project_id}/site-management",tags=["factory-platform-site-management"])
MANAGE="factory.content.cms.site.manage"; REVIEW="factory.content.cms.version.review"; APPROVE="factory.content.cms.publication.approve"; ACK="factory.content.cms.handoff.acknowledge"; BUILD_MANAGE="factory.content.website-build.program.manage"; BUILD_VERIFY="factory.content.website-build.gate.verify"; BUILD_ACTIVATE="factory.content.website-build.activate"
class SiteCreate(BaseModel): site_code:str=Field(min_length=2,max_length=80); site_name:str=Field(min_length=2,max_length=200); channel:str=Field(pattern="^(official|brand|campaign)$"); default_locale:str=Field(min_length=2,max_length=16); domain_reference:str=Field(min_length=3,max_length=255)
class VersionCreate(BaseModel): locale:str=Field(min_length=2,max_length=16); page_manifest:dict[str,Any]; source_reference:str=Field(min_length=1,max_length=255)
class RevisionReference(BaseModel): expected_revision:int=Field(gt=0); reference:str=Field(min_length=1,max_length=255)
class PublicationCreate(BaseModel): target_environment:str=Field(pattern="^(staging|production)$"); rollback_reference:str=Field(min_length=1,max_length=255)
class WebsiteBuildCreate(BaseModel):
    program_key:str=Field(min_length=2,max_length=100); program_name:str=Field(min_length=2,max_length=200); site_mode:str=Field(pattern="^(b2b|b2c|hybrid)$"); market_scope:str=Field(pattern="^(china|overseas|dual)$"); locales:list[str]=Field(min_length=1,max_length=20); route_strategy:str=Field(pattern="^(subdomain|path|single)$"); brief:dict[str,Any]
class WebsiteBuildSiteBind(BaseModel): expected_revision:int=Field(gt=0); site_id:str=Field(min_length=8,max_length=100); reference:str=Field(min_length=2,max_length=255)
class WebsiteBuildGateDecision(BaseModel): expected_revision:int=Field(gt=0); evidence_reference:str=Field(min_length=2,max_length=255)
class WebsiteBuildActivation(BaseModel): expected_revision:int=Field(gt=0); site_publication_id:str=Field(min_length=8,max_length=100); activation_reference:str=Field(min_length=2,max_length=255)
def _fail(error:Exception): raise HTTPException(status_code=404 if isinstance(error,KeyError) else 409,detail=str(error)) from error
async def _run(db:AsyncSession,request:Request,user:UserResponse,project_id:int,permission:str,action:str,target:str,operation:Any,*,context:bool=False,**kwargs:Any):
    await require_project_access(db,current_user=user,project_id=project_id); resolved=await require_project_permission(db,current_user=user,project_id=project_id,permission=permission)
    try: item=await operation(project_id=project_id,actor=user.id,**({"context":resolved.context} if context else {}),**kwargs)
    except (KeyError,ValueError) as error: _fail(error)
    record_audit_event(db,action=action,actor_user_id=user.id,project_id=project_id,target_type=target,target_id=str(item.get("id")),ip_address=request.client.host if request.client else None,detail={"project_id":project_id,"status":item.get("status"),"revision":item.get("revision")}); await db.commit(); return item
@router.get("")
async def workspace(project_id:int,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):
    await require_project_access(db,current_user=current_user,project_id=project_id); return await FactorySiteManagementService(db).workspace(project_id=project_id)
@router.post("/sites")
async def create_site(project_id:int,payload:SiteCreate,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)): return await _run(db,request,current_user,project_id,MANAGE,"factory.site-management.site.create","factory-site-space",FactorySiteManagementService(db).create_site,context=True,**payload.model_dump())
@router.post("/sites/{site_id}/versions")
async def draft_version(project_id:int,site_id:str,payload:VersionCreate,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)): return await _run(db,request,current_user,project_id,MANAGE,"factory.site-management.version.draft","factory-site-content-version",FactorySiteManagementService(db).draft_version,context=True,site_id=site_id,**payload.model_dump())
@router.post("/versions/{version_id}/review")
async def review_version(project_id:int,version_id:str,payload:RevisionReference,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)): return await _run(db,request,current_user,project_id,REVIEW,"factory.site-management.version.review","factory-site-content-version",FactorySiteManagementService(db).review_version,version_id=version_id,expected_revision=payload.expected_revision,review_reference=payload.reference)
@router.post("/versions/{version_id}/publications")
async def prepare_publication(project_id:int,version_id:str,payload:PublicationCreate,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)): return await _run(db,request,current_user,project_id,MANAGE,"factory.site-management.publication.prepare","factory-site-publication",FactorySiteManagementService(db).prepare_publication,context=True,version_id=version_id,**payload.model_dump())
@router.post("/publications/{publication_id}/approve")
async def approve_publication(project_id:int,publication_id:str,payload:RevisionReference,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)): return await _run(db,request,current_user,project_id,APPROVE,"factory.site-management.publication.approve","factory-site-publication",FactorySiteManagementService(db).approve_publication,publication_id=publication_id,expected_revision=payload.expected_revision,approval_reference=payload.reference)
@router.post("/publications/{publication_id}/acknowledge")
async def acknowledge_publication(project_id:int,publication_id:str,payload:RevisionReference,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)): return await _run(db,request,current_user,project_id,ACK,"factory.site-management.publication.acknowledge","factory-site-publication",FactorySiteManagementService(db).acknowledge_publication,publication_id=publication_id,expected_revision=payload.expected_revision,consumer_receipt_reference=payload.reference)
@router.post("/website-build-programs")
async def create_website_build_program(project_id:int,payload:WebsiteBuildCreate,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)): return await _run(db,request,current_user,project_id,BUILD_MANAGE,"factory.website-build.program.create","website-build-program",FactorySiteManagementService(db).create_website_build_program,context=True,**payload.model_dump())
@router.post("/website-build-programs/{program_id}/site")
async def bind_website_build_site(project_id:int,program_id:str,payload:WebsiteBuildSiteBind,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)): return await _run(db,request,current_user,project_id,BUILD_MANAGE,"factory.website-build.site.bind","website-build-program",FactorySiteManagementService(db).bind_website_build_site,program_id=program_id,expected_revision=payload.expected_revision,site_id=payload.site_id,reference=payload.reference)
@router.post("/website-build-programs/{program_id}/gates/{gate_key}/verify")
async def verify_website_build_gate(project_id:int,program_id:str,gate_key:str,payload:WebsiteBuildGateDecision,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)): return await _run(db,request,current_user,project_id,BUILD_VERIFY,"factory.website-build.gate.verify","website-build-program",FactorySiteManagementService(db).verify_website_build_gate,program_id=program_id,gate_key=gate_key,expected_revision=payload.expected_revision,evidence_reference=payload.evidence_reference)
@router.post("/website-build-programs/{program_id}/activate")
async def activate_website_build_program(project_id:int,program_id:str,payload:WebsiteBuildActivation,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)): return await _run(db,request,current_user,project_id,BUILD_ACTIVATE,"factory.website-build.activate","website-build-program",FactorySiteManagementService(db).activate_website_build_program,program_id=program_id,expected_revision=payload.expected_revision,site_publication_id=payload.site_publication_id,activation_reference=payload.activation_reference)
