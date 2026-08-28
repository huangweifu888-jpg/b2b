"""Tenant-scoped DAM rights, localization quality and country-pack APIs."""

from datetime import date
from typing import Literal

from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.factory_dam_localization import FactoryDamLocalizationService
from services.tenant_access import require_project_access, require_project_permission
from sqlalchemy.ext.asyncio import AsyncSession


router=APIRouter(prefix="/api/v1/factory-platform/projects/{project_id}/dam-localization",tags=["factory-platform-dam-localization"])
ASSET_MANAGE="factory.content.dam.asset.manage";RIGHTS_APPROVE="factory.content.dam.rights.approve";GLOSSARY_MANAGE="factory.content.dam.glossary.manage";GLOSSARY_APPROVE="factory.content.dam.glossary.approve"
LOCALIZATION_MANAGE="factory.content.dam.localization.manage";LOCALIZATION_REVIEW="factory.content.dam.localization.review";PACK_PUBLISH="factory.content.dam.pack.publish";HANDOFF_ACK="factory.content.dam.handoff.acknowledge"


class AssetCreate(BaseModel):
    source_asset_id:str=Field(min_length=1,max_length=64);asset_name:str=Field(min_length=1,max_length=255);asset_type:Literal["image","video","document","audio","copy-source","archive"]
    source_language:str=Field(min_length=2,max_length=16);product_references:list[str]=Field(default_factory=list,max_length=200);brand_reference:str=Field(min_length=1,max_length=255);rights_owner_reference:str=Field(min_length=1,max_length=255)


class RightsCreate(BaseModel):
    grant_code:str=Field(min_length=1,max_length=64);territories:list[str]=Field(min_length=1,max_length=100);languages:list[str]=Field(min_length=1,max_length=100);channels:list[Literal["cms","social","commerce","geo","sales-enablement"]]=Field(min_length=1,max_length=20)
    valid_from:date;valid_until:date;license_type:Literal["owned","exclusive","licensed","customer-consent","public-domain"];rights_evidence_reference:str=Field(min_length=1,max_length=255);restrictions:str|None=Field(default=None,max_length=4000)


class GlossaryTerm(BaseModel): source:str=Field(min_length=1,max_length=255);target:str=Field(min_length=1,max_length=255);note:str=Field(default="",max_length=1000)
class GlossaryCreate(BaseModel):
    glossary_code:str=Field(min_length=1,max_length=64);glossary_name:str=Field(min_length=1,max_length=180);source_locale:str=Field(min_length=2,max_length=16);target_locale:str=Field(min_length=2,max_length=16);terms:list[GlossaryTerm]=Field(min_length=3,max_length=1000)


class RevisionReference(BaseModel): expected_revision:int=Field(gt=0);reference:str=Field(min_length=1,max_length=255)
class JobCreate(BaseModel): asset_id:str=Field(min_length=1,max_length=100);rights_grant_id:str=Field(min_length=1,max_length=100);glossary_id:str=Field(min_length=1,max_length=100);target_market:str=Field(min_length=1,max_length=64);target_locale:str=Field(min_length=2,max_length=16);channel:Literal["cms","social","commerce","geo","sales-enablement"];brief:str=Field(min_length=8,max_length=4000)
class RenditionCreate(BaseModel): expected_revision:int=Field(gt=0);localized_storage_reference:str=Field(min_length=1,max_length=500);localized_sha256:str=Field(min_length=64,max_length=64);translator_reference:str=Field(min_length=1,max_length=255);ai_assisted:bool=False;machine_translation_provider_reference:str|None=Field(default=None,max_length=255)
class RenditionReview(BaseModel): expected_revision:int=Field(gt=0);linguistic_score:int=Field(ge=0,le=100);terminology_score:int=Field(ge=0,le=100);brand_score:int=Field(ge=0,le=100);cultural_score:int=Field(ge=0,le=100);findings:list[dict]=Field(default_factory=list,max_length=200);recommendation:Literal["approve","reject"];compliance_assessment_reference:str=Field(min_length=1,max_length=255)
class PackCreate(BaseModel): pack_code:str=Field(min_length=1,max_length=64);pack_name:str=Field(min_length=1,max_length=180);target_market:str=Field(min_length=1,max_length=64);target_locale:str=Field(min_length=2,max_length=16);rendition_ids:list[str]=Field(min_length=1,max_length=200);compliance_assessment_reference:str=Field(min_length=1,max_length=255);tax_reviewed:bool;privacy_reviewed:bool;market_access_reviewed:bool
class PublishPack(BaseModel): expected_revision:int=Field(gt=0);consumer:Literal["cms","social","commerce","geo"];delivery_reference:str=Field(min_length=1,max_length=255)


def _raise(exc):
    if isinstance(exc,KeyError):raise HTTPException(status_code=404,detail=str(exc)) from exc
    raise HTTPException(status_code=409,detail=str(exc)) from exc


def _item(payload):
    if isinstance(payload,dict):
        for key in ("asset","rights","glossary","version","rendition","review","pack","handoff"):
            if isinstance(payload.get(key),dict):return payload[key]
    return payload


def _audit(db,request,user,*,action,target_type,item,project_id):
    item=_item(item);record_audit_event(db,action=action,actor_user_id=user.id,project_id=project_id,target_type=target_type,target_id=str(item["id"]),ip_address=request.client.host if request.client else None,detail={"project_id":project_id,"status":item.get("status"),"revision":item.get("revision")})


async def _run(db,request,user,project_id,permission,action,target_type,method,*,context=False,**kwargs):
    resolved=await require_project_permission(db,current_user=user,project_id=project_id,permission=permission)
    try:result=await method(project_id=project_id,actor=user.id,**({"context":resolved.context} if context else {}),**kwargs)
    except (KeyError,ValueError) as exc:_raise(exc)
    _audit(db,request,user,action=action,target_type=target_type,item=result,project_id=project_id);await db.commit();return result


@router.get("")
async def workspace(project_id:int,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):
    await require_project_access(db,current_user=current_user,project_id=project_id);return await FactoryDamLocalizationService(db).list_workspace(project_id=project_id)


@router.post("/assets")
async def adopt(project_id:int,payload:AssetCreate,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):
    return await _run(db,request,current_user,project_id,ASSET_MANAGE,"factory.dam.asset.adopt","factory-dam-asset",FactoryDamLocalizationService(db).adopt_asset,context=True,**payload.model_dump())


@router.post("/assets/{asset_id}/rights")
async def request_rights(project_id:int,asset_id:str,payload:RightsCreate,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):
    return await _run(db,request,current_user,project_id,ASSET_MANAGE,"factory.dam.rights.request","factory-dam-rights",FactoryDamLocalizationService(db).request_rights,context=True,asset_id=asset_id,**payload.model_dump())


@router.post("/rights/{rights_id}/approve")
async def approve_rights(project_id:int,rights_id:str,payload:RevisionReference,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):
    return await _run(db,request,current_user,project_id,RIGHTS_APPROVE,"factory.dam.rights.approve","factory-dam-rights",FactoryDamLocalizationService(db).approve_rights,rights_id=rights_id,expected_revision=payload.expected_revision,approval_reference=payload.reference)


@router.post("/glossaries")
async def create_glossary(project_id:int,payload:GlossaryCreate,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):
    values=payload.model_dump();values["terms"]=[x.model_dump() if hasattr(x,"model_dump") else x for x in payload.terms]
    return await _run(db,request,current_user,project_id,GLOSSARY_MANAGE,"factory.dam.glossary.create","factory-localization-glossary",FactoryDamLocalizationService(db).create_glossary,context=True,**values)


@router.post("/glossaries/{glossary_id}/approve")
async def approve_glossary(project_id:int,glossary_id:str,payload:RevisionReference,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):
    return await _run(db,request,current_user,project_id,GLOSSARY_APPROVE,"factory.dam.glossary.approve","factory-localization-glossary",FactoryDamLocalizationService(db).approve_glossary,glossary_id=glossary_id,expected_revision=payload.expected_revision,approval_reference=payload.reference)


@router.post("/jobs")
async def create_job(project_id:int,payload:JobCreate,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):
    return await _run(db,request,current_user,project_id,LOCALIZATION_MANAGE,"factory.dam.job.create","factory-localization-job",FactoryDamLocalizationService(db).create_job,context=True,**payload.model_dump())


@router.post("/jobs/{job_id}/renditions")
async def submit_rendition(project_id:int,job_id:str,payload:RenditionCreate,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):
    return await _run(db,request,current_user,project_id,LOCALIZATION_MANAGE,"factory.dam.rendition.submit","factory-localized-rendition",FactoryDamLocalizationService(db).submit_rendition,context=True,job_id=job_id,**payload.model_dump())


@router.post("/renditions/{rendition_id}/review")
async def review_rendition(project_id:int,rendition_id:str,payload:RenditionReview,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):
    return await _run(db,request,current_user,project_id,LOCALIZATION_REVIEW,"factory.dam.rendition.review","factory-localized-rendition",FactoryDamLocalizationService(db).review_rendition,context=True,rendition_id=rendition_id,**payload.model_dump())


@router.post("/country-packs")
async def create_pack(project_id:int,payload:PackCreate,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):
    return await _run(db,request,current_user,project_id,LOCALIZATION_MANAGE,"factory.dam.pack.create","factory-country-content-pack",FactoryDamLocalizationService(db).create_pack,context=True,**payload.model_dump())


@router.post("/country-packs/{pack_id}/publish")
async def publish_pack(project_id:int,pack_id:str,payload:PublishPack,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):
    return await _run(db,request,current_user,project_id,PACK_PUBLISH,"factory.dam.pack.publish","factory-country-content-pack",FactoryDamLocalizationService(db).publish_pack,context=True,pack_id=pack_id,**payload.model_dump())


@router.post("/handoffs/{handoff_id}/acknowledge")
async def acknowledge(project_id:int,handoff_id:str,payload:RevisionReference,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):
    return await _run(db,request,current_user,project_id,HANDOFF_ACK,"factory.dam.handoff.acknowledge","factory-localization-handoff",FactoryDamLocalizationService(db).acknowledge_handoff,handoff_id=handoff_id,expected_revision=payload.expected_revision,acknowledgement_reference=payload.reference)
