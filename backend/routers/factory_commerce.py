"""Tenant-scoped B2B ordering and B2C checkout APIs."""
from decimal import Decimal
from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter,Depends,HTTPException,Request
from pydantic import BaseModel,Field
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.factory_commerce import FactoryCommerceService
from services.tenant_access import require_project_access,require_project_permission
from sqlalchemy.ext.asyncio import AsyncSession
router=APIRouter(prefix="/api/v1/factory-platform/projects/{project_id}/commerce",tags=["factory-platform-commerce"])
MANAGE="factory.convert.commerce.manage";TERMS="factory.convert.commerce.terms.review";PAYMENT="factory.convert.commerce.payment.verify";SUBMIT="factory.convert.commerce.order.submit";ACK="factory.convert.commerce.order.acknowledge"
class CheckoutCreate(BaseModel):commerce_mode:str;source_id:str;buyer_reference:str=Field(min_length=1,max_length=255);quantity:Decimal=Field(gt=0)
class TermsCreate(BaseModel):terms_version:str=Field(min_length=1,max_length=64);locale:str=Field(min_length=2,max_length=16);destination_country:str=Field(min_length=2,max_length=16);fulfillment_mode:str=Field(min_length=1,max_length=32);purchase_reference:str=Field(min_length=1,max_length=255);acceptance_reference:str=Field(min_length=1,max_length=255)
class TermsReview(BaseModel):expected_revision:int=Field(gt=0);decision:str;review_reference:str=Field(min_length=1,max_length=255);review_note:str=Field(min_length=1,max_length=2000)
class PaymentCreate(BaseModel):method:str;processor_reference:str=Field(min_length=1,max_length=255)
class PaymentVerify(BaseModel):expected_revision:int=Field(gt=0);verification_reference:str=Field(min_length=1,max_length=255)
class SubmitOrder(BaseModel):delivery_reference:str=Field(min_length=1,max_length=255)
class Acknowledge(BaseModel):expected_revision:int=Field(gt=0);decision:str;authority_system:str=Field(min_length=1,max_length=64);authority_reference:str=Field(min_length=1,max_length=255);authoritative_order_id:str|None=None
def _raise(e):
 if isinstance(e,KeyError):raise HTTPException(status_code=404,detail=str(e)) from e
 raise HTTPException(status_code=409,detail=str(e)) from e
async def _run(db,r,u,p,permission,action,target,operation,*,context=False,**kw):
 await require_project_access(db,current_user=u,project_id=p);resolved=await require_project_permission(db,current_user=u,project_id=p,permission=permission)
 try:x=await operation(project_id=p,actor=u.id,**({"context":resolved.context} if context else {}),**kw)
 except (KeyError,ValueError) as e:_raise(e)
 record_audit_event(db,action=action,actor_user_id=u.id,project_id=p,target_type=target,target_id=str(x["id"]),ip_address=r.client.host if r.client else None,detail={"project_id":p,"status":x.get("status"),"revision":x.get("revision")});await db.commit();return x
@router.get("")
async def workspace(project_id:int,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):await require_project_access(db,current_user=current_user,project_id=project_id);return await FactoryCommerceService(db).list_workspace(project_id=project_id)
@router.post("/checkouts")
async def create(project_id:int,payload:CheckoutCreate,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,MANAGE,"factory.commerce.checkout.create","factory-commerce-checkout",FactoryCommerceService(db).create_checkout,context=True,**payload.model_dump())
@router.post("/checkouts/{checkout_id}/terms")
async def terms(project_id:int,checkout_id:str,payload:TermsCreate,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,MANAGE,"factory.commerce.terms.accept","factory-commerce-acceptance",FactoryCommerceService(db).accept_terms,context=True,checkout_id=checkout_id,**payload.model_dump())
@router.post("/acceptances/{acceptance_id}/review")
async def review(project_id:int,acceptance_id:str,payload:TermsReview,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,TERMS,"factory.commerce.terms.review","factory-commerce-acceptance",FactoryCommerceService(db).review_terms,acceptance_id=acceptance_id,**payload.model_dump())
@router.post("/checkouts/{checkout_id}/payments")
async def payment(project_id:int,checkout_id:str,payload:PaymentCreate,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,MANAGE,"factory.commerce.payment.create","factory-commerce-payment",FactoryCommerceService(db).initiate_payment,context=True,checkout_id=checkout_id,**payload.model_dump())
@router.post("/payments/{payment_id}/verify")
async def verify(project_id:int,payment_id:str,payload:PaymentVerify,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,PAYMENT,"factory.commerce.payment.verify","factory-commerce-payment",FactoryCommerceService(db).verify_payment,payment_id=payment_id,**payload.model_dump())
@router.post("/checkouts/{checkout_id}/submit")
async def submit(project_id:int,checkout_id:str,payload:SubmitOrder,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,SUBMIT,"factory.commerce.order.submit","factory-commerce-handoff",FactoryCommerceService(db).submit_order,context=True,checkout_id=checkout_id,**payload.model_dump())
@router.post("/handoffs/{handoff_id}/acknowledge")
async def acknowledge(project_id:int,handoff_id:str,payload:Acknowledge,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,ACK,"factory.commerce.order.acknowledge","factory-commerce-handoff",FactoryCommerceService(db).acknowledge_order,handoff_id=handoff_id,**payload.model_dump())
