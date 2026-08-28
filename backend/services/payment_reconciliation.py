"""Signed payment-event reconciliation into the append-only tenant ledger."""

from __future__ import annotations

from dataclasses import dataclass

from models.platform import BillingLedgerEntry
from services.billing_ledger import append_entry
from services.integration_security import verify_webhook_signature
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


@dataclass(frozen=True)
class PaymentEvent:
    event_id: str
    event_type: str
    amount_minor: int
    currency: str
    project_id: int | None = None


async def reconcile_payment_event(db: AsyncSession, *, org_id: int, event: PaymentEvent, raw_payload: bytes, signature: str, signing_secret: str) -> tuple[BillingLedgerEntry, bool]:
    if event.event_type not in {"payment_succeeded", "refund_succeeded"} or event.amount_minor <= 0:
        raise ValueError("unsupported payment event")
    if not verify_webhook_signature(raw_payload, signature, signing_secret):
        raise ValueError("invalid payment callback signature")
    prior = await db.scalar(select(BillingLedgerEntry).where(BillingLedgerEntry.org_id == org_id, BillingLedgerEntry.external_event_id == event.event_id))
    if prior:
        return prior, False
    entry = await append_entry(
        db, org_id=org_id, project_id=event.project_id,
        entry_type="credit" if event.event_type == "payment_succeeded" else "debit",
        amount_minor=event.amount_minor if event.event_type == "payment_succeeded" else -event.amount_minor,
        currency=event.currency, external_event_id=event.event_id,
        metadata={"event_type": event.event_type, "reconciled": True},
    )
    return entry, True
