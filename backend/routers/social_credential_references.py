"""Credential-reference status and revocation-request APIs.

Only headquarters may register a reference.  Project users may see their
status and request revocation; no endpoint returns secret material.
"""

from __future__ import annotations

import json
import secrets
from datetime import datetime

from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter, Depends, HTTPException, Request, status
from models.social_authorization import SocialAuthorizationRequest
from models.social_credential_reference import SocialCredentialReference
from pydantic import BaseModel, Field
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.social_secret_references import validate_secret_reference
from services.tenant_access import require_global_platform_access, require_project_access
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


router = APIRouter(prefix="/api/v1/social-credential-references", tags=["social-credential-references"])


class CredentialReferenceCreate(BaseModel):
    project_id: int = Field(gt=0)
    provider: str = Field(min_length=2, max_length=80)
    secret_reference: str = Field(min_length=12, max_length=255)
    authorization_request_id: str | None = Field(default=None, max_length=64)
    scopes: list[str] = Field(default_factory=list, max_length=50)
    expires_at: datetime | None = None


def _view(item: SocialCredentialReference) -> dict:
    return {
        "id": item.id,
        "project_id": item.project_id,
        "provider": item.provider,
        "status": item.status,
        "scopes": json.loads(item.scopes_json or "[]"),
        "verified_at": item.verified_at,
        "expires_at": item.expires_at,
        "revocation_requested_at": item.revocation_requested_at,
        "revoked_at": item.revoked_at,
        "secret_configured": bool(item.secret_reference),
    }


@router.get("")
async def list_credential_references(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    await require_project_access(db, current_user=current_user, project_id=project_id)
    records = (await db.execute(select(SocialCredentialReference).where(SocialCredentialReference.project_id == project_id))).scalars().all()
    return {"items": [_view(record) for record in records]}


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_credential_reference(
    payload: CredentialReferenceCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    await require_global_platform_access(current_user=current_user)
    resolved = await require_project_access(db, current_user=current_user, project_id=payload.project_id)
    try:
        secret_reference = validate_secret_reference(payload.secret_reference)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc)) from exc
    provider = " ".join(payload.provider.split()).strip().lower()
    if payload.authorization_request_id:
        authorization_request = await db.scalar(select(SocialAuthorizationRequest).where(SocialAuthorizationRequest.id == payload.authorization_request_id, SocialAuthorizationRequest.project_id == payload.project_id))
        if not authorization_request:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Authorization request not found in this project")
    duplicate = await db.scalar(select(SocialCredentialReference).where(SocialCredentialReference.project_id == payload.project_id, SocialCredentialReference.provider == provider, SocialCredentialReference.secret_reference == secret_reference))
    if duplicate:
        return _view(duplicate)
    context = resolved.context
    item = SocialCredentialReference(
        id=f"social-credential-{secrets.token_urlsafe(18)}",
        project_id=payload.project_id,
        agent_path=context.agent_path,
        tenant_id=context.tenant_id,
        client_id=context.client_id,
        plan_id=context.plan_id or f"plan-{payload.project_id}",
        authorization_request_id=payload.authorization_request_id,
        provider=provider,
        secret_reference=secret_reference,
        scopes_json=json.dumps(sorted(set(payload.scopes)), ensure_ascii=False),
        status="active",
        verified_at=datetime.now(),
        expires_at=payload.expires_at,
        created_by=current_user.id,
    )
    db.add(item)
    record_audit_event(db, action="social_credential_reference_registered", actor_user_id=current_user.id, org_id=resolved.client.id, project_id=payload.project_id, target_type="social_credential_reference", target_id=item.id, ip_address=request.client.host if request.client else None, detail={"provider": provider, "scope_count": len(payload.scopes)})
    await db.commit()
    await db.refresh(item)
    return _view(item)


@router.post("/{reference_id}/revoke")
async def request_credential_revocation(
    reference_id: str,
    project_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    await require_project_access(db, current_user=current_user, project_id=project_id)
    item = await db.scalar(select(SocialCredentialReference).where(SocialCredentialReference.id == reference_id, SocialCredentialReference.project_id == project_id))
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Credential reference not found")
    if item.status not in {"revoked", "revocation_requested"}:
        item.status = "revocation_requested"
        item.revocation_requested_at = datetime.now()
        item.revoked_by = current_user.id
        record_audit_event(db, action="social_credential_revocation_requested", actor_user_id=current_user.id, project_id=project_id, target_type="social_credential_reference", target_id=item.id, ip_address=request.client.host if request.client else None, detail={"provider": item.provider})
        await db.commit()
        await db.refresh(item)
    return {**_view(item), "external_revocation_completed": False}
