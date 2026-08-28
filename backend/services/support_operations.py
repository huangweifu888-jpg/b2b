"""Tenant-scoped support tickets with explicit SLA timestamps."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
import uuid

from models.platform import SupportTicket
from sqlalchemy.ext.asyncio import AsyncSession


SLA_MINUTES = {"sev1": (15, 30), "sev2": (60, 120), "sev3": (480, 1440)}


async def create_ticket(db: AsyncSession, *, org_id: int, project_id: int | None, subject: str, severity: str, assigned_to: str | None = None) -> SupportTicket:
    if org_id <= 0 or severity not in SLA_MINUTES or not subject.strip():
        raise ValueError("invalid support ticket")
    now = datetime.now(timezone.utc)
    acknowledge, update = SLA_MINUTES[severity]
    ticket = SupportTicket(
        org_id=org_id, project_id=project_id, ticket_key=f"SUP-{uuid.uuid4().hex[:12].upper()}", subject=subject.strip(), severity=severity,
        status="open", assigned_to=assigned_to, first_response_due_at=now + timedelta(minutes=acknowledge), next_update_due_at=now + timedelta(minutes=update), created_at=now,
    )
    db.add(ticket)
    await db.flush()
    return ticket
