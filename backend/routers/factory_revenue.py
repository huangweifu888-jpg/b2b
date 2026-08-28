"""Tenant-scoped APIs for the Factory Platform revenue golden flow."""

from __future__ import annotations

from decimal import Decimal
from typing import Literal

from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.factory_revenue import FactoryRevenueService
from services.tenant_access import require_project_access
from sqlalchemy.ext.asyncio import AsyncSession


router = APIRouter(prefix="/api/v1/factory-platform/projects/{project_id}/revenue-flow", tags=["factory-platform-revenue-flow"])


class RevenueFlowCreate(BaseModel):
    product_reference: str = Field(min_length=1, max_length=255)
    account_reference: str = Field(min_length=1, max_length=255)
    currency: str = Field(default="USD", min_length=3, max_length=3)


class RevenueFlowTransition(BaseModel):
    expected_revision: int = Field(gt=0)
    event_type: Literal["inquiry-created", "quote-submitted", "quote-accepted", "order-confirmed", "invoice-issued", "payment-received"]
    amount: Decimal | None = Field(default=None, ge=0, max_digits=18, decimal_places=2)


@router.get("")
async def list_revenue_flows(project_id: int, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    await require_project_access(db, current_user=current_user, project_id=project_id)
    return {"items": await FactoryRevenueService(db).list(project_id=project_id)}


@router.post("")
async def create_revenue_flow(project_id: int, payload: RevenueFlowCreate, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    resolved = await require_project_access(db, current_user=current_user, project_id=project_id)
    try:
        item = await FactoryRevenueService(db).create(project_id=project_id, context=resolved.context, actor=current_user.id, product_reference=payload.product_reference, account_reference=payload.account_reference, currency=payload.currency)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    record_audit_event(db, action="factory_revenue_flow_created", actor_user_id=current_user.id, target_type="factory_revenue_flow_run", target_id=item["id"], ip_address=request.client.host if request.client else None, detail={"project_id": project_id, "correlation_id": item["correlation_id"]})
    await db.commit()
    return item


@router.post("/{run_id}/transition")
async def transition_revenue_flow(project_id: int, run_id: str, payload: RevenueFlowTransition, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    await require_project_access(db, current_user=current_user, project_id=project_id)
    try:
        item = await FactoryRevenueService(db).transition(run_id, project_id=project_id, expected_revision=payload.expected_revision, actor=current_user.id, event_type=payload.event_type, amount=payload.amount)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    record_audit_event(db, action="factory_revenue_flow_advanced", actor_user_id=current_user.id, target_type="factory_revenue_flow_run", target_id=run_id, ip_address=request.client.host if request.client else None, detail={"project_id": project_id, "event_type": payload.event_type, "revision": item["revision"], "correlation_id": item["correlation_id"]})
    await db.commit()
    return item
