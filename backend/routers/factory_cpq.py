"""Tenant-scoped governed CPQ APIs."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Literal

from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.factory_cpq import FactoryCpqService
from services.tenant_access import require_project_access
from sqlalchemy.ext.asyncio import AsyncSession


router = APIRouter(prefix="/api/v1/factory-platform/projects/{project_id}/cpq-quotes", tags=["factory-platform-cpq"])


class CpqLine(BaseModel):
    product_reference: str = Field(min_length=1, max_length=255)
    sku_reference: str = Field(min_length=1, max_length=255)
    quantity: Decimal = Field(gt=0, max_digits=18, decimal_places=4)
    moq: Decimal = Field(gt=0, max_digits=18, decimal_places=4)
    unit_price: Decimal = Field(gt=0, max_digits=18, decimal_places=2)
    unit_cost: Decimal = Field(ge=0, max_digits=18, decimal_places=2)
    lead_time_days: int = Field(ge=1, le=3650)


class CpqCreate(BaseModel):
    account_reference: str = Field(min_length=1, max_length=255)
    currency: str = Field(default="USD", min_length=3, max_length=3)
    exchange_rate: Decimal = Field(default=1, gt=0, max_digits=18, decimal_places=6)
    valid_until: datetime
    lines: list[CpqLine] = Field(min_length=1, max_length=50)


class CpqTransition(BaseModel):
    expected_revision: int = Field(gt=0)
    action: Literal["submit", "approve", "reject", "send", "accept"]
    note: str | None = Field(default=None, max_length=2000)


@router.get("")
async def list_cpq_quotes(project_id: int, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    await require_project_access(db, current_user=current_user, project_id=project_id)
    return {"items": await FactoryCpqService(db).list(project_id=project_id)}


@router.post("")
async def create_cpq_quote(project_id: int, payload: CpqCreate, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    resolved = await require_project_access(db, current_user=current_user, project_id=project_id)
    try:
        item = await FactoryCpqService(db).create(project_id=project_id, context=resolved.context, actor=current_user.id, account_reference=payload.account_reference, currency=payload.currency, exchange_rate=payload.exchange_rate, valid_until=payload.valid_until, lines=[line.model_dump() for line in payload.lines])
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    record_audit_event(db, action="factory_cpq_quote_created", actor_user_id=current_user.id, target_type="factory_cpq_quote", target_id=item["id"], ip_address=request.client.host if request.client else None, detail={"project_id": project_id, "quote_number": item["quote_number"], "subtotal": item["subtotal"], "currency": item["currency"]})
    await db.commit()
    return item


@router.post("/{quote_id}/transition")
async def transition_cpq_quote(project_id: int, quote_id: str, payload: CpqTransition, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    await require_project_access(db, current_user=current_user, project_id=project_id)
    try:
        item = await FactoryCpqService(db).transition(quote_id, project_id=project_id, expected_revision=payload.expected_revision, actor=current_user.id, action=payload.action, note=payload.note)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    record_audit_event(db, action=f"factory_cpq_quote_{payload.action}", actor_user_id=current_user.id, target_type="factory_cpq_quote", target_id=quote_id, ip_address=request.client.host if request.client else None, detail={"project_id": project_id, "quote_number": item["quote_number"], "status": item["status"], "revision": item["revision"], "order_intent_id": item["order_intent_id"]})
    await db.commit()
    return item
