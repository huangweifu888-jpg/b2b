from fastapi import APIRouter,Depends,HTTPException,Request
from pydantic import BaseModel,Field
from core.database import get_db
from dependencies.auth import get_current_user
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.factory_budget_attribution import FactoryBudgetAttributionService as S
from services.tenant_access import require_project_access,require_project_permission
from sqlalchemy.ext.asyncio import AsyncSession
router=APIRouter(prefix="/api/v1/factory-platform/projects/{project_id}/budget-attribution",tags=["factory-platform-budget-attribution"])
C,V,A="factory.lead.budget-attribution.create","factory.lead.budget-attribution.verify","factory.lead.budget-attribution.accept"
class Create(BaseModel):allocation_reference:str=Field(min_length=3,max_length=255);finance_document_reference:str=Field(min_length=3,max_length=255);attribution_run_id:str=Field(min_length=3,max_length=100);channel:str=Field(min_length=2,max_length=100);campaign_reference:str=Field(min_length=2,max_length=255);proposed_amount:str=Field(min_length=1,max_length=50)
class Advance(BaseModel):expected_revision:int=Field(gt=0);reference:str=Field(min_length=3,max_length=500)
def fail(e):raise HTTPException(status_code=404 if isinstance(e,KeyError) else 409,detail=str(e))from e
def audit(db,r,u,action,x,p):record_audit_event(db,action=action,actor_user_id=u.id,target_type="factory_marketing_budget_allocation",target_id=x["id"],project_id=p,ip_address=r.client.host if r.client else None,detail={"allocation_number":x["allocation_number"],"status":x["status"],"revision":x["revision"]})
@router.get("")
async def workspace(project_id:int,db:AsyncSession=Depends(get_db),current_user:UserResponse=Depends(get_current_user)):await require_project_access(db,current_user=current_user,project_id=project_id);return await S(db).workspace(project_id)
@router.post("")
async def create(project_id:int,payload:Create,request:Request,db:AsyncSession=Depends(get_db),current_user:UserResponse=Depends(get_current_user)):
 resolved=await require_project_permission(db,current_user=current_user,project_id=project_id,permission=C)
 try:x=await S(db).create(project_id=project_id,context=resolved.context,actor=current_user.id,**payload.model_dump())
 except(KeyError,ValueError)as e:fail(e)
 audit(db,request,current_user,"factory_budget_allocation_created",x,project_id);await db.commit();return x
@router.post("/{allocation_id}/verify")
async def verify(project_id:int,allocation_id:str,payload:Advance,request:Request,db:AsyncSession=Depends(get_db),current_user:UserResponse=Depends(get_current_user)):
 await require_project_permission(db,current_user=current_user,project_id=project_id,permission=V)
 try:x=await S(db).verify(allocation_id,project_id=project_id,actor=current_user.id,**payload.model_dump())
 except(KeyError,ValueError)as e:fail(e)
 audit(db,request,current_user,"factory_budget_allocation_verified",x,project_id);await db.commit();return x
@router.post("/{allocation_id}/accept")
async def accept(project_id:int,allocation_id:str,payload:Advance,request:Request,db:AsyncSession=Depends(get_db),current_user:UserResponse=Depends(get_current_user)):
 await require_project_permission(db,current_user=current_user,project_id=project_id,permission=A)
 try:x=await S(db).accept(allocation_id,project_id=project_id,actor=current_user.id,**payload.model_dump())
 except(KeyError,ValueError)as e:fail(e)
 audit(db,request,current_user,"factory_budget_allocation_accepted",x,project_id);await db.commit();return x
