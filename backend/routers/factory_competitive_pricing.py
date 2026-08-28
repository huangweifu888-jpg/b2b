"""Tenant-scoped competitive price intelligence APIs."""
from datetime import datetime
from decimal import Decimal
from typing import Literal
from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.factory_competitive_pricing import FactoryCompetitivePricingService
from services.tenant_access import require_project_access, require_project_permission
from sqlalchemy.ext.asyncio import AsyncSession

router=APIRouter(prefix="/api/v1/factory-platform/projects/{project_id}/competitive-pricing",tags=["factory-platform-competitive-pricing"])
MANAGE="factory.identity.competitive-pricing.manage";VERIFY="factory.identity.competitive-pricing.offer.verify";REVIEW="factory.identity.competitive-pricing.decision.review";APPROVE="factory.identity.competitive-pricing.release.approve"
class WatchCreate(BaseModel):
    product_reference:str=Field(min_length=1,max_length=180);product_name:str=Field(min_length=1,max_length=180);market_country:str=Field(min_length=2,max_length=3);channel:str=Field(min_length=1,max_length=64);currency:str=Field(min_length=3,max_length=3);own_reference_price:Decimal=Field(gt=0);scope_note:str=Field(min_length=8,max_length=4000)
class OfferCreate(BaseModel):
    competitor_name:str=Field(min_length=1,max_length=180);competitor_offer_reference:str=Field(min_length=1,max_length=180);offer_type:Literal["list","quote","promotion"];offer_price:Decimal=Field(gt=0);freight_price:Decimal=Field(ge=0);feature_summary:str=Field(min_length=4,max_length=4000);source_system:str=Field(min_length=1,max_length=64);source_reference:str=Field(min_length=1,max_length=255);source_revision:str=Field(min_length=1,max_length=96);source_observed_at:datetime
class Verify(BaseModel):expected_revision:int=Field(gt=0);verification_reference:str=Field(min_length=1,max_length=255)
class DecisionCreate(BaseModel):boundary_note:str=Field(min_length=8,max_length=4000)
class DecisionReview(BaseModel):expected_revision:int=Field(gt=0);decision:Literal["approve","reject"];review_reference:str=Field(min_length=1,max_length=255)
class ReleaseCreate(BaseModel):
    release_version:str=Field(min_length=1,max_length=64);support_owner:str=Field(min_length=1,max_length=128);support_until:datetime;customer_trial_reference:str=Field(min_length=1,max_length=255);role_training_reference:str=Field(min_length=1,max_length=255);issue_closure_reference:str=Field(min_length=1,max_length=255);monitoring_reference:str=Field(min_length=1,max_length=255);rollback_reference:str=Field(min_length=1,max_length=255)
class ReleaseApprove(BaseModel):expected_revision:int=Field(gt=0);approval_reference:str=Field(min_length=1,max_length=255)
def _raise(exc):
    if isinstance(exc,KeyError):raise HTTPException(status_code=404,detail=str(exc)) from exc
    raise HTTPException(status_code=409,detail=str(exc)) from exc
async def _run(db,request,user,project_id,permission,action,target_type,operation,*,context=False,**kwargs):
    await require_project_access(db,current_user=user,project_id=project_id);resolved=await require_project_permission(db,current_user=user,project_id=project_id,permission=permission)
    try:item=await operation(project_id=project_id,actor=user.id,**({"context":resolved.context} if context else {}),**kwargs)
    except (KeyError,ValueError) as exc:_raise(exc)
    record_audit_event(db,action=action,actor_user_id=user.id,project_id=project_id,target_type=target_type,target_id=str(item["id"]),ip_address=request.client.host if request.client else None,detail={"project_id":project_id,"status":item.get("status"),"revision":item.get("revision")});await db.commit();return item
@router.get("")
async def workspace(project_id:int,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):
    await require_project_access(db,current_user=current_user,project_id=project_id);return await FactoryCompetitivePricingService(db).workspace(project_id=project_id)
@router.post("/watches")
async def create_watch(project_id:int,payload:WatchCreate,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,MANAGE,"factory.competitive-pricing.watch.create","factory-competitive-price-watch",FactoryCompetitivePricingService(db).create_watch,context=True,**payload.model_dump())
@router.post("/watches/{watch_id}/offers")
async def create_offer(project_id:int,watch_id:str,payload:OfferCreate,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,MANAGE,"factory.competitive-pricing.offer.create","factory-competitive-offer",FactoryCompetitivePricingService(db).add_offer,context=True,watch_id=watch_id,**payload.model_dump())
@router.post("/offers/{offer_id}/verify")
async def verify_offer(project_id:int,offer_id:str,payload:Verify,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,VERIFY,"factory.competitive-pricing.offer.verify","factory-competitive-offer",FactoryCompetitivePricingService(db).verify_offer,offer_id=offer_id,**payload.model_dump())
@router.post("/watches/{watch_id}/decisions")
async def create_decision(project_id:int,watch_id:str,payload:DecisionCreate,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,MANAGE,"factory.competitive-pricing.decision.create","factory-competitive-price-decision",FactoryCompetitivePricingService(db).create_decision,context=True,watch_id=watch_id,**payload.model_dump())
@router.post("/decisions/{decision_id}/review")
async def review_decision(project_id:int,decision_id:str,payload:DecisionReview,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,REVIEW,"factory.competitive-pricing.decision.review","factory-competitive-price-decision",FactoryCompetitivePricingService(db).review_decision,decision_id=decision_id,**payload.model_dump())
@router.post("/decisions/{decision_id}/releases")
async def prepare_release(project_id:int,decision_id:str,payload:ReleaseCreate,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,MANAGE,"factory.competitive-pricing.release.prepare","factory-competitive-price-release",FactoryCompetitivePricingService(db).prepare_release,context=True,decision_id=decision_id,**payload.model_dump())
@router.post("/releases/{release_id}/approve")
async def approve_release(project_id:int,release_id:str,payload:ReleaseApprove,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,APPROVE,"factory.competitive-pricing.release.approve","factory-competitive-price-release",FactoryCompetitivePricingService(db).approve_release,release_id=release_id,**payload.model_dump())
