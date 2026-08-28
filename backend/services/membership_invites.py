"""One-time, role-bound tenant member invitations."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
import hashlib
import secrets

from models.platform import MembershipInvite
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


def _hash_code(code: str) -> str:
    return hashlib.sha256(code.encode("utf-8")).hexdigest()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(value: datetime) -> datetime:
    """SQLite returns naive datetimes even for timezone-aware model columns."""
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def new_invite_code() -> str:
    return f"B2B-{secrets.token_urlsafe(24)}"


async def create_membership_invite(
    db: AsyncSession,
    *,
    org_id: int,
    role_id: int,
    project_id: int | None,
    email: str | None,
    invited_by: str,
    expires_in_hours: int,
) -> tuple[MembershipInvite, str]:
    raw_code = new_invite_code()
    invite = MembershipInvite(
        code_hash=_hash_code(raw_code),
        org_id=org_id,
        project_id=project_id,
        role_id=role_id,
        email=(email or "").strip().lower() or None,
        status="pending",
        expires_at=_now() + timedelta(hours=expires_in_hours),
        invited_by=invited_by,
    )
    db.add(invite)
    await db.flush()
    return invite, raw_code


async def claim_membership_invite(db: AsyncSession, *, raw_code: str, email: str) -> MembershipInvite:
    invite = await db.scalar(
        select(MembershipInvite).where(MembershipInvite.code_hash == _hash_code(raw_code.strip()))
    )
    now = _now()
    if not invite or invite.status != "pending" or _as_utc(invite.expires_at) <= now:
        raise ValueError("Invitation is invalid, expired, or already used")
    if invite.email and invite.email != email.strip().lower():
        raise ValueError("Invitation is bound to a different email address")
    invite.status = "accepted"
    invite.accepted_at = now
    return invite
