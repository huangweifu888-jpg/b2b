"""Tenant-safe operational endpoints for provisioning, billing, analytics, and support."""

from __future__ import annotations

import json
import os

from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter, Depends, HTTPException, Request, status
from models.platform import BillingLedgerEntry, SupportTicket
from pydantic import BaseModel, EmailStr, Field
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.payment_reconciliation import PaymentEvent, reconcile_payment_event
from services.support_operations import create_ticket
from services.membership_invites import create_membership_invite
from services.organization_roles import TENANT_MEMBER_MANAGE, default_administrator_role
from services.tenant_access import require_organization_access, require_organization_permission
from services.tenant_analytics import aggregate_tenant_metrics
from services.tenant_provisioning import provision_client_plan
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


router = APIRouter(prefix="/api/v1/business-operations", tags=["business-operations"])


class ProvisionRequest(BaseModel):
    agency_org_id: int = Field(gt=0)
    client_name: str = Field(min_length=1, max_length=255)
    client_code: str = Field(pattern=r"^[A-Za-z0-9_-]{1,100}$")
    plan_name: str = Field(min_length=1, max_length=255)
    plan_code: str = Field(pattern=r"^[A-Za-z0-9_-]{1,100}$")
    deployment_id: str = Field(default="shared-stamp-a", min_length=1, max_length=100)
    database_id: str = Field(default="shared-client-db-a", min_length=1, max_length=100)
    administrator_email: EmailStr | None = None


class TicketRequest(BaseModel):
    org_id: int = Field(gt=0)
    project_id: int | None = Field(default=None, gt=0)
    subject: str = Field(min_length=1, max_length=500)
    severity: str = Field(pattern=r"^sev[123]$")
    assigned_to: str | None = Field(default=None, max_length=255)


def _ledger_to_dict(entry: BillingLedgerEntry) -> dict[str, object]:
    return {"id": entry.id, "entry_key": entry.entry_key, "entry_type": entry.entry_type, "amount_minor": entry.amount_minor, "currency": entry.currency, "external_event_id": entry.external_event_id, "created_at": entry.created_at}


def _ticket_to_dict(ticket: SupportTicket) -> dict[str, object]:
    return {"id": ticket.id, "ticket_key": ticket.ticket_key, "subject": ticket.subject, "severity": ticket.severity, "status": ticket.status, "first_response_due_at": ticket.first_response_due_at, "next_update_due_at": ticket.next_update_due_at}


@router.post("/provision", status_code=status.HTTP_201_CREATED)
async def provision(payload: ProvisionRequest, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    await require_organization_permission(
        db, current_user=current_user, organization_id=payload.agency_org_id, permission="agency.manage_clients"
    )
    try:
        data = payload.model_dump()
        administrator_email = data.pop("administrator_email")
        result = await provision_client_plan(db, **data)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    bootstrap_invite_code = None
    if administrator_email:
        role = await default_administrator_role(db, result.client_org_id)
        if not role:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Client administrator role is unavailable")
        invitation, bootstrap_invite_code = await create_membership_invite(
            db,
            org_id=result.client_org_id,
            role_id=role.id,
            project_id=None,
            email=str(administrator_email),
            invited_by=current_user.id,
            expires_in_hours=168,
        )
        record_audit_event(db, action="client_admin_invited", actor_user_id=current_user.id, org_id=result.client_org_id, project_id=result.project_id, target_type="membership_invite", target_id=invitation.id, ip_address=request.client.host if request.client else None, detail={"role_id": role.id})
    record_audit_event(db, action="client_plan_provisioned", actor_user_id=current_user.id, org_id=result.client_org_id, project_id=result.project_id, target_type="project", target_id=result.project_id, ip_address=request.client.host if request.client else None, detail={"agency_org_id": payload.agency_org_id, "deployment_id": result.deployment_id})
    await db.commit()
    return {**result.__dict__, "bootstrap_invite_code": bootstrap_invite_code}


@router.get("/ledger")
async def list_ledger(org_id: int, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    await require_organization_access(db, current_user=current_user, organization_id=org_id)
    entries = (await db.execute(select(BillingLedgerEntry).where(BillingLedgerEntry.org_id == org_id).order_by(BillingLedgerEntry.id.desc()))).scalars().all()
    return {"items": [_ledger_to_dict(entry) for entry in entries]}


@router.get("/analytics")
async def analytics(org_id: int, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    await require_organization_access(db, current_user=current_user, organization_id=org_id)
    entries = (await db.execute(select(BillingLedgerEntry).where(BillingLedgerEntry.org_id == org_id))).scalars().all()
    metrics = aggregate_tenant_metrics(({"tenant_id": f"org-{org_id}", "kind": "ledger", "amount_minor": entry.amount_minor} for entry in entries), tenant_id=f"org-{org_id}")
    ticket_count = len((await db.execute(select(SupportTicket.id).where(SupportTicket.org_id == org_id))).scalars().all())
    return {"metrics": metrics, "support_ticket_count": ticket_count}


@router.post("/tickets", status_code=status.HTTP_201_CREATED)
async def open_ticket(payload: TicketRequest, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    await require_organization_access(db, current_user=current_user, organization_id=payload.org_id)
    try:
        ticket = await create_ticket(db, **payload.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    record_audit_event(db, action="support_ticket_created", actor_user_id=current_user.id, org_id=ticket.org_id, project_id=ticket.project_id, target_type="support_ticket", target_id=ticket.ticket_key, ip_address=request.client.host if request.client else None, detail={"severity": ticket.severity})
    await db.commit()
    return _ticket_to_dict(ticket)


@router.get("/tickets")
async def list_tickets(org_id: int, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    await require_organization_access(db, current_user=current_user, organization_id=org_id)
    tickets = (await db.execute(select(SupportTicket).where(SupportTicket.org_id == org_id).order_by(SupportTicket.id.desc()))).scalars().all()
    return {"items": [_ticket_to_dict(ticket) for ticket in tickets]}


@router.post("/payment-callback")
async def payment_callback(request: Request, db: AsyncSession = Depends(get_db)):
    secret = os.getenv("PAYMENT_WEBHOOK_SECRET", "")
    if len(secret) < 16:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Payment callback is not configured")
    raw_payload = await request.body()
    try:
        body = json.loads(raw_payload)
        event = PaymentEvent(event_id=str(body["event_id"]), event_type=str(body["event_type"]), amount_minor=int(body["amount_minor"]), currency=str(body["currency"]), project_id=int(body["project_id"]) if body.get("project_id") is not None else None)
        org_id = int(body["org_id"])
    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid payment callback") from exc
    try:
        entry, created = await reconcile_payment_event(db, org_id=org_id, event=event, raw_payload=raw_payload, signature=request.headers.get("X-Payment-Signature", ""), signing_secret=secret)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    record_audit_event(db, action="payment_callback_reconciled", org_id=org_id, project_id=event.project_id, target_type="billing_ledger_entry", target_id=entry.entry_key, ip_address=request.client.host if request.client else None, detail={"event_type": event.event_type, "created": created})
    await db.commit()
    return {"entry": _ledger_to_dict(entry), "created": created}
