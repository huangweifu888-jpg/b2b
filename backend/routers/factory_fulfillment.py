"""Tenant-scoped authoritative order confirmation and fulfillment APIs."""

from __future__ import annotations

from typing import Literal

from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.factory_fulfillment import FactoryFulfillmentService
from services.tenant_access import require_project_access, require_project_permission
from sqlalchemy.ext.asyncio import AsyncSession


router = APIRouter(prefix="/api/v1/factory-platform/projects/{project_id}/fulfillment-orders", tags=["factory-platform-fulfillment"])

ORDER_REGISTER = "factory.fulfillment.order.register"
ORDER_CONFIRM = "factory.fulfillment.order.confirm"
DELIVERY_MANAGE = "factory.fulfillment.delivery.manage"


class IntentRegistration(BaseModel):
    order_intent_id: str = Field(min_length=1, max_length=100)


class OrderDecision(BaseModel):
    expected_revision: int = Field(gt=0)
    action: Literal["confirm", "reject"]
    product: bool
    payment: bool
    inventory: bool
    capacity: bool
    note: str = Field(min_length=4, max_length=2000)


class FulfillmentAdvance(BaseModel):
    expected_revision: int = Field(gt=0)
    action: Literal["allocate", "start-production", "complete-production", "release-quality", "ship", "deliver"]
    evidence_reference: str = Field(min_length=1, max_length=255)
    note: str = Field(min_length=4, max_length=2000)


@router.get("")
async def list_fulfillment_orders(project_id: int, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    await require_project_access(db, current_user=current_user, project_id=project_id)
    return {"items": await FactoryFulfillmentService(db).list(project_id=project_id)}


@router.post("")
async def register_order_intent(project_id: int, payload: IntentRegistration, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    resolved = await require_project_permission(db, current_user=current_user, project_id=project_id, permission=ORDER_REGISTER)
    try:
        item = await FactoryFulfillmentService(db).register_intent(project_id=project_id, context=resolved.context, actor=current_user.id, order_intent_id=payload.order_intent_id)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    record_audit_event(db, action="factory_fulfillment_order_registered", actor_user_id=current_user.id, target_type="factory_fulfillment_order", target_id=item["id"], ip_address=request.client.host if request.client else None, detail={"project_id": project_id, "order_number": item["order_number"], "order_intent_id": item["order_intent_id"], "status": item["status"]})
    await db.commit()
    return item


@router.post("/{order_id}/decision")
async def decide_order(project_id: int, order_id: str, payload: OrderDecision, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    await require_project_permission(db, current_user=current_user, project_id=project_id, permission=ORDER_CONFIRM)
    try:
        item = await FactoryFulfillmentService(db).decide(order_id, project_id=project_id, expected_revision=payload.expected_revision, actor=current_user.id, action=payload.action, validations={key: getattr(payload, key) for key in ("product", "payment", "inventory", "capacity")}, note=payload.note)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    record_audit_event(db, action=f"factory_fulfillment_order_{payload.action}", actor_user_id=current_user.id, target_type="factory_fulfillment_order", target_id=order_id, ip_address=request.client.host if request.client else None, detail={"project_id": project_id, "order_number": item["order_number"], "status": item["status"], "revision": item["revision"], "validations": item["validation"]})
    await db.commit()
    return item


@router.post("/{order_id}/advance")
async def advance_fulfillment(project_id: int, order_id: str, payload: FulfillmentAdvance, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    await require_project_permission(db, current_user=current_user, project_id=project_id, permission=DELIVERY_MANAGE)
    try:
        item = await FactoryFulfillmentService(db).advance(order_id, project_id=project_id, expected_revision=payload.expected_revision, actor=current_user.id, action=payload.action, evidence_reference=payload.evidence_reference, note=payload.note)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    record_audit_event(db, action=f"factory_fulfillment_{payload.action}", actor_user_id=current_user.id, target_type="factory_fulfillment_order", target_id=order_id, ip_address=request.client.host if request.client else None, detail={"project_id": project_id, "order_number": item["order_number"], "status": item["status"], "revision": item["revision"], "evidence_reference": payload.evidence_reference})
    await db.commit()
    return item
