"""Tenant-scoped renewal, repurchase and expansion APIs."""

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
from services.factory_renewal_growth import FactoryRenewalGrowthService
from services.tenant_access import require_project_access, require_project_permission
from sqlalchemy.ext.asyncio import AsyncSession


router = APIRouter(
    prefix="/api/v1/factory-platform/projects/{project_id}/renewal-growth",
    tags=["factory-platform-renewal-growth"],
)

RENEWAL_GROWTH_MANAGE = "factory.care.renewal-growth.manage"
RENEWAL_GROWTH_ASSESS = "factory.care.renewal-growth.assess"
RENEWAL_GROWTH_APPROVE = "factory.care.renewal-growth.approve"
RENEWAL_GROWTH_HANDOFF = "factory.care.renewal-growth.handoff"
RENEWAL_GROWTH_CONFIRM = "factory.care.renewal-growth.confirm"


class RenewalCreate(BaseModel):
    asset_id: str = Field(min_length=1, max_length=100)
    opportunity_reference: str = Field(min_length=1, max_length=255)
    owner: str = Field(min_length=1, max_length=255)
    next_action_at: datetime


class RenewalAssess(BaseModel):
    expected_revision: int = Field(gt=0)
    value_evidence_reference: str = Field(min_length=1, max_length=500)
    value_summary: str = Field(min_length=8, max_length=4000)


class RenewalRecommend(BaseModel):
    expected_revision: int = Field(gt=0)
    motion: Literal["renewal", "repurchase", "upsell"]
    customer_goal: str = Field(min_length=8, max_length=4000)
    customer_confirmation_reference: str = Field(min_length=1, max_length=500)
    recommendation_reference: str = Field(min_length=1, max_length=500)
    recommended_product_reference: str = Field(min_length=1, max_length=255)
    recommended_sku_reference: str = Field(min_length=1, max_length=255)
    recommended_quantity: Decimal = Field(gt=0, max_digits=18, decimal_places=4)
    currency: str = Field(min_length=3, max_length=3)
    estimated_unit_price: Decimal = Field(gt=0, max_digits=18, decimal_places=2)
    estimated_unit_cost: Decimal = Field(ge=0, max_digits=18, decimal_places=2)
    recommendation_rationale: str = Field(min_length=8, max_length=4000)


class RenewalApprove(BaseModel):
    expected_revision: int = Field(gt=0)
    approval_reference: str = Field(min_length=1, max_length=500)
    approval_note: str = Field(min_length=8, max_length=4000)


class RenewalCpqHandoff(BaseModel):
    expected_revision: int = Field(gt=0)
    cpq_handoff_reference: str = Field(min_length=1, max_length=500)


class RenewalQuoteLink(BaseModel):
    expected_revision: int = Field(gt=0)
    quote_id: str = Field(min_length=1, max_length=100)


class RenewalWin(BaseModel):
    expected_revision: int = Field(gt=0)
    order_id: str = Field(min_length=1, max_length=100)


class RenewalLoss(BaseModel):
    expected_revision: int = Field(gt=0)
    loss_reference: str = Field(min_length=1, max_length=500)
    loss_reason: str = Field(min_length=8, max_length=4000)


def _raise(exc: Exception) -> None:
    if isinstance(exc, KeyError):
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    raise HTTPException(status_code=409, detail=str(exc)) from exc


def _audit(
    db: AsyncSession, request: Request, user: UserResponse, *, action: str,
    item: dict[str, object], project_id: int,
) -> None:
    record_audit_event(
        db, action=action, actor_user_id=user.id,
        target_type="factory_renewal_growth_opportunity", target_id=str(item["id"]),
        ip_address=request.client.host if request.client else None,
        detail={
            "project_id": project_id,
            "opportunity_number": item["opportunity_number"],
            "asset_number": item["asset_number"],
            "lifecycle_status": item["lifecycle_status"],
            "health_score": item["health_score"],
            "quote_number": item["quote_number"],
            "order_number": item["order_number"],
            "revision": item["revision"],
        },
    )


@router.get("")
async def list_renewal_workspace(
    project_id: int, db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    await require_project_access(db, current_user=current_user, project_id=project_id)
    return await FactoryRenewalGrowthService(db).list_workspace(project_id=project_id)


@router.post("")
async def create_renewal_opportunity(
    project_id: int, payload: RenewalCreate, request: Request,
    db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user),
):
    resolved = await require_project_permission(
        db, current_user=current_user, project_id=project_id,
        permission=RENEWAL_GROWTH_MANAGE,
    )
    try:
        item = await FactoryRenewalGrowthService(db).create(
            project_id=project_id, context=resolved.context, actor=current_user.id,
            asset_id=payload.asset_id, opportunity_reference=payload.opportunity_reference,
            owner=payload.owner, next_action_at=payload.next_action_at,
        )
    except (KeyError, ValueError) as exc:
        _raise(exc)
    _audit(db, request, current_user, action="factory_renewal_growth_created", item=item, project_id=project_id)
    await db.commit()
    return item


@router.post("/{opportunity_id}/assess")
async def assess_renewal(
    project_id: int, opportunity_id: str, payload: RenewalAssess, request: Request,
    db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user),
):
    await require_project_permission(db, current_user=current_user, project_id=project_id, permission=RENEWAL_GROWTH_ASSESS)
    try:
        item = await FactoryRenewalGrowthService(db).assess(
            opportunity_id, project_id=project_id, expected_revision=payload.expected_revision,
            actor=current_user.id, value_evidence_reference=payload.value_evidence_reference,
            value_summary=payload.value_summary,
        )
    except (KeyError, ValueError) as exc:
        _raise(exc)
    _audit(db, request, current_user, action="factory_renewal_growth_assessed", item=item, project_id=project_id)
    await db.commit()
    return item


@router.post("/{opportunity_id}/recommend")
async def recommend_renewal(
    project_id: int, opportunity_id: str, payload: RenewalRecommend, request: Request,
    db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user),
):
    await require_project_permission(db, current_user=current_user, project_id=project_id, permission=RENEWAL_GROWTH_ASSESS)
    try:
        item = await FactoryRenewalGrowthService(db).recommend(
            opportunity_id, project_id=project_id, expected_revision=payload.expected_revision,
            actor=current_user.id, **payload.model_dump(exclude={"expected_revision"}),
        )
    except (KeyError, ValueError) as exc:
        _raise(exc)
    _audit(db, request, current_user, action="factory_renewal_growth_recommended", item=item, project_id=project_id)
    await db.commit()
    return item


@router.post("/{opportunity_id}/approve")
async def approve_renewal(
    project_id: int, opportunity_id: str, payload: RenewalApprove, request: Request,
    db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user),
):
    await require_project_permission(db, current_user=current_user, project_id=project_id, permission=RENEWAL_GROWTH_APPROVE)
    try:
        item = await FactoryRenewalGrowthService(db).approve(
            opportunity_id, project_id=project_id, expected_revision=payload.expected_revision,
            actor=current_user.id, approval_reference=payload.approval_reference,
            approval_note=payload.approval_note,
        )
    except (KeyError, ValueError) as exc:
        _raise(exc)
    _audit(db, request, current_user, action="factory_renewal_growth_approved", item=item, project_id=project_id)
    await db.commit()
    return item


@router.post("/{opportunity_id}/cpq-handoff")
async def handoff_renewal_to_cpq(
    project_id: int, opportunity_id: str, payload: RenewalCpqHandoff, request: Request,
    db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user),
):
    await require_project_permission(db, current_user=current_user, project_id=project_id, permission=RENEWAL_GROWTH_HANDOFF)
    try:
        item = await FactoryRenewalGrowthService(db).request_cpq(
            opportunity_id, project_id=project_id, expected_revision=payload.expected_revision,
            actor=current_user.id, cpq_handoff_reference=payload.cpq_handoff_reference,
        )
    except (KeyError, ValueError) as exc:
        _raise(exc)
    _audit(db, request, current_user, action="factory_renewal_growth_cpq_requested", item=item, project_id=project_id)
    await db.commit()
    return item


@router.post("/{opportunity_id}/link-quote")
async def link_renewal_quote(
    project_id: int, opportunity_id: str, payload: RenewalQuoteLink, request: Request,
    db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user),
):
    await require_project_permission(db, current_user=current_user, project_id=project_id, permission=RENEWAL_GROWTH_HANDOFF)
    try:
        item = await FactoryRenewalGrowthService(db).link_accepted_quote(
            opportunity_id, project_id=project_id, expected_revision=payload.expected_revision,
            actor=current_user.id, quote_id=payload.quote_id,
        )
    except (KeyError, ValueError) as exc:
        _raise(exc)
    _audit(db, request, current_user, action="factory_renewal_growth_quote_linked", item=item, project_id=project_id)
    await db.commit()
    return item


@router.post("/{opportunity_id}/confirm-won")
async def confirm_renewal_won(
    project_id: int, opportunity_id: str, payload: RenewalWin, request: Request,
    db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user),
):
    await require_project_permission(db, current_user=current_user, project_id=project_id, permission=RENEWAL_GROWTH_CONFIRM)
    try:
        item = await FactoryRenewalGrowthService(db).confirm_won(
            opportunity_id, project_id=project_id, expected_revision=payload.expected_revision,
            actor=current_user.id, order_id=payload.order_id,
        )
    except (KeyError, ValueError) as exc:
        _raise(exc)
    _audit(db, request, current_user, action="factory_renewal_growth_won", item=item, project_id=project_id)
    await db.commit()
    return item


@router.post("/{opportunity_id}/close-lost")
async def close_renewal_lost(
    project_id: int, opportunity_id: str, payload: RenewalLoss, request: Request,
    db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user),
):
    await require_project_permission(db, current_user=current_user, project_id=project_id, permission=RENEWAL_GROWTH_MANAGE)
    try:
        item = await FactoryRenewalGrowthService(db).close_lost(
            opportunity_id, project_id=project_id, expected_revision=payload.expected_revision,
            actor=current_user.id, loss_reference=payload.loss_reference,
            loss_reason=payload.loss_reason,
        )
    except (KeyError, ValueError) as exc:
        _raise(exc)
    _audit(db, request, current_user, action="factory_renewal_growth_lost", item=item, project_id=project_id)
    await db.commit()
    return item
