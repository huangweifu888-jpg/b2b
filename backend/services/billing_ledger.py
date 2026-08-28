"""Append-only, tenant-scoped billing ledger primitives."""

from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import json
import uuid
from collections.abc import Mapping, Sequence

from models.platform import BillingLedgerEntry
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


def _digest(value: Mapping[str, object] | None) -> str:
    canonical = json.dumps(value or {}, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def compute_entry_hash(*, entry_key: str, org_id: int, project_id: int | None, entry_type: str, amount_minor: int, currency: str, external_event_id: str, payload_digest: str, previous_hash: str | None, created_at: datetime) -> str:
    normalized_created_at = created_at if created_at.tzinfo is not None else created_at.replace(tzinfo=timezone.utc)
    payload = {
        "entry_key": entry_key,
        "org_id": org_id,
        "project_id": project_id,
        "entry_type": entry_type,
        "amount_minor": amount_minor,
        "currency": currency.upper(),
        "external_event_id": external_event_id,
        "payload_digest": payload_digest,
        "previous_hash": previous_hash,
        "created_at": normalized_created_at.astimezone(timezone.utc).isoformat(),
    }
    return _digest(payload)


async def append_entry(
    db: AsyncSession,
    *,
    org_id: int,
    project_id: int | None,
    entry_type: str,
    amount_minor: int,
    currency: str,
    external_event_id: str,
    metadata: Mapping[str, object] | None = None,
) -> BillingLedgerEntry:
    if org_id <= 0 or not entry_type.strip() or not external_event_id.strip() or len(currency.strip()) != 3:
        raise ValueError("invalid billing ledger entry")
    prior = await db.scalar(
        select(BillingLedgerEntry)
        .where(BillingLedgerEntry.org_id == org_id)
        .order_by(BillingLedgerEntry.id.desc())
        .limit(1)
    )
    created_at = datetime.now(timezone.utc)
    entry_key = f"led-{uuid.uuid4().hex}"
    payload_digest = _digest(metadata)
    previous_hash = prior.entry_hash if prior else None
    entry_hash = compute_entry_hash(
        entry_key=entry_key, org_id=org_id, project_id=project_id, entry_type=entry_type.strip(), amount_minor=amount_minor,
        currency=currency, external_event_id=external_event_id.strip(), payload_digest=payload_digest, previous_hash=previous_hash, created_at=created_at,
    )
    entry = BillingLedgerEntry(
        org_id=org_id, project_id=project_id, entry_key=entry_key, entry_type=entry_type.strip(), amount_minor=amount_minor,
        currency=currency.upper(), external_event_id=external_event_id.strip(), payload_digest=payload_digest, previous_hash=previous_hash,
        entry_hash=entry_hash, created_at=created_at,
    )
    db.add(entry)
    await db.flush()
    return entry


def validate_chain(entries: Sequence[BillingLedgerEntry]) -> bool:
    previous_hash: str | None = None
    for entry in sorted(entries, key=lambda item: item.id):
        if entry.previous_hash != previous_hash:
            return False
        expected = compute_entry_hash(
            entry_key=entry.entry_key, org_id=entry.org_id, project_id=entry.project_id, entry_type=entry.entry_type,
            amount_minor=entry.amount_minor, currency=entry.currency, external_event_id=entry.external_event_id,
            payload_digest=entry.payload_digest, previous_hash=entry.previous_hash, created_at=entry.created_at,
        )
        if entry.entry_hash != expected:
            return False
        previous_hash = entry.entry_hash
    return True
