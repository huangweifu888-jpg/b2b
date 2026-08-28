"""Tenant-authorized APIs for inquiry intake and lead-routing."""
from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.factory_inquiry import FactoryInquiryService
from services.tenant_access import require_project_access, require_project_permission
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/api/v1/factory-platform/projects/{project_id}/inquiries", tags=["factory-platform-inquiries"])
CREATE, QUALIFY, RULE_CREATE, RULE_APPROVE, RULE_ACTIVATE, ROUTE, ACK, HANDOFF = ("factory.convert.inquiry.create", "factory.convert.inquiry.qualify", "factory.convert.routing.create", "factory.convert.routing.approve", "factory.convert.routing.activate", "factory.convert.routing.route", "factory.convert.routing.acknowledge", "factory.convert.inquiry.handoff")
class InquiryCreate(BaseModel):
    source_channel: str = Field(min_length=1, max_length=32); source_reference: str = Field(min_length=1, max_length=255); account_reference: str = Field(min_length=1, max_length=180); product_reference: str = Field(min_length=1, max_length=180); country_code: str = Field(min_length=2, max_length=2); requested_quantity: int | None = Field(default=None, gt=0); payload_summary: str | None = Field(default=None, max_length=2000); score: int = Field(default=0, ge=0, le=100)
class Revision(BaseModel): expected_revision: int = Field(gt=0); reference: str = Field(min_length=1, max_length=255)
class RuleCreate(BaseModel): rule_key: str = Field(min_length=1, max_length=96); rule_name: str = Field(min_length=1, max_length=160); priority: int = Field(ge=1, le=100000); conditions: dict[str, object]; assignee_reference: str = Field(min_length=1, max_length=128)
class Activate(BaseModel): expected_revision: int = Field(gt=0)
class Handoff(Activate): currency: str = Field(default="USD", min_length=3, max_length=3)
async def run(db, request, user, project_id, permission, action, target, method, context=False, **kwargs):
    resolved = await require_project_permission(db, current_user=user, project_id=project_id, permission=permission)
    try: result = await method(project_id=project_id, actor=user.id, **({"context": resolved.context} if context else {}), **kwargs)
    except KeyError as exc: raise HTTPException(404, detail=str(exc)) from exc
    except ValueError as exc: raise HTTPException(409, detail=str(exc)) from exc
    value = result.get("inquiry", result) if isinstance(result, dict) else result
    record_audit_event(db, action=action, actor_user_id=user.id, project_id=project_id, target_type=target, target_id=str(value["id"]), ip_address=request.client.host if request.client else None, detail={"revision": value.get("revision"), "status": value.get("status")}); await db.commit(); return result
@router.get("")
async def workspace(project_id: int, current_user: UserResponse = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await require_project_access(db, current_user=current_user, project_id=project_id); return await FactoryInquiryService(db).workspace(project_id=project_id)
@router.post("")
async def create(project_id: int, payload: InquiryCreate, request: Request, current_user: UserResponse = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await run(db, request, current_user, project_id, CREATE, "factory_inquiry_created", "factory_inquiry", FactoryInquiryService(db).create_inquiry, True, **payload.model_dump())
@router.post("/{inquiry_id}/qualify")
async def qualify(project_id: int, inquiry_id: str, payload: Revision, request: Request, current_user: UserResponse = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await run(db, request, current_user, project_id, QUALIFY, "factory_inquiry_qualified", "factory_inquiry", FactoryInquiryService(db).qualify_inquiry, inquiry_id=inquiry_id, **payload.model_dump())
@router.post("/rules")
async def create_rule(project_id: int, payload: RuleCreate, request: Request, current_user: UserResponse = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await run(db, request, current_user, project_id, RULE_CREATE, "factory_inquiry_routing_rule_created", "factory_inquiry_routing_rule", FactoryInquiryService(db).create_rule, True, **payload.model_dump())
@router.post("/rules/{rule_id}/approve")
async def approve_rule(project_id: int, rule_id: str, payload: Revision, request: Request, current_user: UserResponse = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await run(db, request, current_user, project_id, RULE_APPROVE, "factory_inquiry_routing_rule_approved", "factory_inquiry_routing_rule", FactoryInquiryService(db).approve_rule, rule_id=rule_id, **payload.model_dump())
@router.post("/rules/{rule_id}/activate")
async def activate_rule(project_id: int, rule_id: str, payload: Activate, request: Request, current_user: UserResponse = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await run(db, request, current_user, project_id, RULE_ACTIVATE, "factory_inquiry_routing_rule_activated", "factory_inquiry_routing_rule", FactoryInquiryService(db).activate_rule, rule_id=rule_id, **payload.model_dump())
@router.post("/{inquiry_id}/route")
async def route(project_id: int, inquiry_id: str, payload: Activate, request: Request, current_user: UserResponse = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await run(db, request, current_user, project_id, ROUTE, "factory_inquiry_routed", "factory_inquiry", FactoryInquiryService(db).route_inquiry, True, inquiry_id=inquiry_id, **payload.model_dump())
@router.post("/assignments/{assignment_id}/acknowledge")
async def acknowledge(project_id: int, assignment_id: str, payload: Revision, request: Request, current_user: UserResponse = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await run(db, request, current_user, project_id, ACK, "factory_inquiry_assignment_acknowledged", "factory_inquiry_assignment", FactoryInquiryService(db).acknowledge_assignment, assignment_id=assignment_id, **payload.model_dump())
@router.post("/{inquiry_id}/handoff")
async def handoff(project_id: int, inquiry_id: str, payload: Handoff, request: Request, current_user: UserResponse = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await run(db, request, current_user, project_id, HANDOFF, "factory_inquiry_revenue_handed_off", "factory_inquiry", FactoryInquiryService(db).handoff_to_revenue, True, inquiry_id=inquiry_id, **payload.model_dump())
