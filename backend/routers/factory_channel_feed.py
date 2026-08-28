"""Tenant-scoped product feed and channel listing APIs."""
from typing import Literal

from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.factory_channel_feed import FactoryChannelFeedService
from services.tenant_access import require_project_access, require_project_permission
from sqlalchemy.ext.asyncio import AsyncSession


router = APIRouter(prefix="/api/v1/factory-platform/projects/{project_id}/channel-feed", tags=["factory-platform-channel-feed"])
ACCOUNT_MANAGE="factory.recommend.channel.account.manage"; ACCOUNT_APPROVE="factory.recommend.channel.account.approve"; CATALOG_MANAGE="factory.recommend.channel.catalog.manage"; LISTING_VALIDATE="factory.recommend.channel.listing.validate"; FEED_EXECUTE="factory.recommend.channel.feed.execute"; PUBLISH="factory.recommend.channel.publish"; ACK="factory.recommend.channel.handoff.acknowledge"


class AccountCreate(BaseModel):
    platform: Literal["google-merchant","amazon","alibaba","industry-marketplace"]
    account_reference: str = Field(min_length=1,max_length=180)
    credential_reference: str = Field(min_length=1,max_length=255)
    territory: str = Field(min_length=2,max_length=16)
    locale: str = Field(min_length=2,max_length=16)
    currency: str = Field(min_length=3,max_length=3)


class CatalogCreate(BaseModel):
    catalog_code: str = Field(min_length=1,max_length=64)
    catalog_name: str = Field(min_length=1,max_length=180)
    source_release_id: str = Field(min_length=1,max_length=100)
    default_locale: str = Field(min_length=2,max_length=16)


class ListingCreate(BaseModel):
    account_id: str = Field(min_length=1,max_length=100)
    external_sku: str = Field(min_length=1,max_length=120)
    product_identifier: str = Field(min_length=1,max_length=180)
    price_mode: Literal["catalog-only","connector-reference"]
    price_amount: float | None = Field(default=None,gt=0)
    currency: str | None = Field(default=None,min_length=3,max_length=3)
    price_reference: str | None = Field(default=None,max_length=255)
    inventory_mode: Literal["on-request","connector-reference"]
    availability_status: Literal["on_request","in_stock","out_of_stock","preorder"]
    inventory_reference: str | None = Field(default=None,max_length=255)
    channel_attributes: dict


class RevisionReference(BaseModel):
    expected_revision: int = Field(gt=0)
    reference: str = Field(min_length=1,max_length=255)


class FeedRun(BaseModel):
    expected_revision: int = Field(gt=0)
    reference: str = Field(min_length=1,max_length=255)


class PublishCatalog(BaseModel):
    expected_revision: int = Field(gt=0)
    run_id: str = Field(min_length=1,max_length=100)
    remote_reference_prefix: str = Field(min_length=1,max_length=180)


def _raise(exc):
    if isinstance(exc,KeyError): raise HTTPException(status_code=404,detail=str(exc)) from exc
    raise HTTPException(status_code=409,detail=str(exc)) from exc


def _item(payload):
    if isinstance(payload,dict):
        for key in ("catalog","release"):
            if isinstance(payload.get(key),dict): return payload[key]
    return payload


def _audit(db,request,user,action,target_type,item,project_id):
    item=_item(item);record_audit_event(db,action=action,actor_user_id=user.id,project_id=project_id,target_type=target_type,target_id=str(item["id"]),ip_address=request.client.host if request.client else None,detail={"project_id":project_id,"status":item.get("status"),"revision":item.get("revision")})


async def _run(db,request,user,project_id,permission,action,target_type,method,*,context=False,**kwargs):
    resolved=await require_project_permission(db,current_user=user,project_id=project_id,permission=permission)
    try: result=await method(project_id=project_id,actor=user.id,**({"context":resolved.context} if context else {}),**kwargs)
    except (KeyError,ValueError) as exc: _raise(exc)
    _audit(db,request,user,action,target_type,result,project_id);await db.commit();return result


@router.get("")
async def workspace(project_id:int,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):
    await require_project_access(db,current_user=current_user,project_id=project_id);return await FactoryChannelFeedService(db).list_workspace(project_id=project_id)


@router.post("/accounts")
async def create_account(project_id:int,payload:AccountCreate,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)): return await _run(db,request,current_user,project_id,ACCOUNT_MANAGE,"factory.channel.account.create","factory-channel-account",FactoryChannelFeedService(db).create_account,context=True,**payload.model_dump())


@router.post("/accounts/{account_id}/approve")
async def approve_account(project_id:int,account_id:str,payload:RevisionReference,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)): return await _run(db,request,current_user,project_id,ACCOUNT_APPROVE,"factory.channel.account.approve","factory-channel-account",FactoryChannelFeedService(db).approve_account,account_id=account_id,expected_revision=payload.expected_revision,reference=payload.reference)


@router.post("/catalogs")
async def create_catalog(project_id:int,payload:CatalogCreate,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)): return await _run(db,request,current_user,project_id,CATALOG_MANAGE,"factory.channel.catalog.create","factory-channel-catalog",FactoryChannelFeedService(db).create_catalog,context=True,**payload.model_dump())


@router.post("/catalogs/{catalog_id}/listings")
async def add_listing(project_id:int,catalog_id:str,payload:ListingCreate,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)): return await _run(db,request,current_user,project_id,CATALOG_MANAGE,"factory.channel.listing.create","factory-channel-listing",FactoryChannelFeedService(db).add_listing,context=True,catalog_id=catalog_id,**payload.model_dump())


@router.post("/listings/{listing_id}/validate")
async def validate_listing(project_id:int,listing_id:str,payload:RevisionReference,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)): return await _run(db,request,current_user,project_id,LISTING_VALIDATE,"factory.channel.listing.validate","factory-channel-listing",FactoryChannelFeedService(db).validate_listing,listing_id=listing_id,expected_revision=payload.expected_revision,reference=payload.reference)


@router.post("/catalogs/{catalog_id}/feed-runs")
async def run_feed(project_id:int,catalog_id:str,payload:FeedRun,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)): return await _run(db,request,current_user,project_id,FEED_EXECUTE,"factory.channel.feed.execute","factory-channel-feed-run",FactoryChannelFeedService(db).run_feed,context=True,catalog_id=catalog_id,**payload.model_dump())


@router.post("/catalogs/{catalog_id}/publish")
async def publish_catalog(project_id:int,catalog_id:str,payload:PublishCatalog,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)): return await _run(db,request,current_user,project_id,PUBLISH,"factory.channel.catalog.publish","factory-channel-catalog",FactoryChannelFeedService(db).publish_catalog,context=True,catalog_id=catalog_id,**payload.model_dump())


@router.post("/publications/{publication_id}/acknowledge")
async def acknowledge(project_id:int,publication_id:str,payload:RevisionReference,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)): return await _run(db,request,current_user,project_id,ACK,"factory.channel.publication.acknowledge","factory-channel-publication",FactoryChannelFeedService(db).acknowledge_publication,publication_id=publication_id,expected_revision=payload.expected_revision,reference=payload.reference)
