"""Tenant-safe social authorization preparation APIs.

This is deliberately a control plane, not an OAuth proxy.  It records a
headquarters application's safe references and client authorization requests,
but it never accepts passwords, tokens, cookies, authorization codes, or
platform secrets.  A provider-specific connector can be added later after the
application is approved and the server-side secret store is provisioned.
"""

from __future__ import annotations

import json
import secrets
from datetime import datetime
from typing import Literal

from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter, Depends, HTTPException, Request, status
from models.social_authorization import SocialAuthorizationRequest, SocialOAuthApplication
from pydantic import BaseModel, Field
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.tenant_access import require_global_platform_access, require_project_access
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


router = APIRouter(prefix="/api/v1/social-authorization", tags=["social-authorization"])


class OAuthApplicationUpsert(BaseModel):
    status: Literal["draft", "review", "active", "suspended"] = "draft"
    client_id_reference: str | None = Field(default=None, max_length=255)
    secret_reference: str | None = Field(default=None, max_length=255)
    redirect_uri: str | None = Field(default=None, max_length=1000)
    approved_scopes: list[str] = Field(default_factory=list, max_length=50)


class AuthorizationRequestCreate(BaseModel):
    project_id: int = Field(gt=0)
    provider: str = Field(min_length=2, max_length=80)
    account_label: str = Field(min_length=1, max_length=255)
    market: Literal["overseas", "china"]
    requested_scopes: list[str] = Field(default_factory=list, max_length=50)


def _provider_key(provider: str) -> str:
    normalized = " ".join(provider.split()).strip().lower()
    if not normalized or any(char in normalized for char in "<>\\\"'`\n\r"):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid provider")
    return normalized


def _application_view(application: SocialOAuthApplication) -> dict:
    return {
        "provider": application.provider,
        "status": application.status,
        "redirect_configured": bool(application.redirect_uri),
        "secret_configured": bool(application.secret_reference),
        "approved_scopes": json.loads(application.approved_scopes_json or "[]"),
        "updated_at": application.updated_at,
    }


def _request_view(item: SocialAuthorizationRequest) -> dict:
    return {
        "id": item.id,
        "project_id": item.project_id,
        "provider": item.provider,
        "account_label": item.account_label,
        "market": item.market,
        "requested_scopes": json.loads(item.requested_scopes_json or "[]"),
        "status": item.status,
        "created_at": item.created_at,
        "cancelled_at": item.cancelled_at,
    }


@router.get("/applications")
async def list_headquarters_applications(
    db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)
):
    await require_global_platform_access(current_user=current_user)
    applications = (await db.execute(select(SocialOAuthApplication).order_by(SocialOAuthApplication.provider))).scalars().all()
    return {"items": [_application_view(application) for application in applications]}


@router.put("/applications/{provider}")
async def upsert_headquarters_application(
    provider: str,
    payload: OAuthApplicationUpsert,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    await require_global_platform_access(current_user=current_user)
    provider_key = _provider_key(provider)
    if payload.status == "active" and (not payload.secret_reference or not payload.redirect_uri):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Active applications require a secret reference and redirect URI")

    application = await db.scalar(select(SocialOAuthApplication).where(SocialOAuthApplication.provider == provider_key))
    if not application:
        application = SocialOAuthApplication(provider=provider_key, configured_by=current_user.id)
        db.add(application)
    application.status = payload.status
    application.client_id_reference = payload.client_id_reference
    application.secret_reference = payload.secret_reference
    application.redirect_uri = payload.redirect_uri
    application.approved_scopes_json = json.dumps(sorted(set(payload.approved_scopes)), ensure_ascii=False)
    application.configured_by = current_user.id
    record_audit_event(
        db,
        action="social_oauth_application_saved",
        actor_user_id=current_user.id,
        target_type="social_oauth_application",
        target_id=provider_key,
        ip_address=request.client.host if request.client else None,
        detail={"provider": provider_key, "status": payload.status, "scope_count": len(payload.approved_scopes)},
    )
    await db.commit()
    await db.refresh(application)
    return _application_view(application)


@router.get("/projects/{project_id}/providers")
async def list_project_provider_readiness(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    await require_project_access(db, current_user=current_user, project_id=project_id)
    applications = (await db.execute(select(SocialOAuthApplication).order_by(SocialOAuthApplication.provider))).scalars().all()
    return {
        "items": [
            {
                "provider": application.provider,
                "ready_for_request": application.status == "active" and bool(application.secret_reference) and bool(application.redirect_uri),
                "approved_scopes": json.loads(application.approved_scopes_json or "[]"),
            }
            for application in applications
        ]
    }


@router.get("/requests")
async def list_authorization_requests(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    await require_project_access(db, current_user=current_user, project_id=project_id)
    records = (
        await db.execute(
            select(SocialAuthorizationRequest)
            .where(SocialAuthorizationRequest.project_id == project_id)
            .order_by(SocialAuthorizationRequest.created_at.desc())
        )
    ).scalars().all()
    return {"items": [_request_view(record) for record in records]}


@router.post("/requests", status_code=status.HTTP_201_CREATED)
async def create_authorization_request(
    payload: AuthorizationRequestCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    resolved = await require_project_access(db, current_user=current_user, project_id=payload.project_id)
    provider_key = _provider_key(payload.provider)
    application = await db.scalar(select(SocialOAuthApplication).where(SocialOAuthApplication.provider == provider_key))
    ready = bool(application and application.status == "active" and application.secret_reference and application.redirect_uri)
    context = resolved.context
    record = SocialAuthorizationRequest(
        id=f"social-auth-{secrets.token_urlsafe(18)}",
        project_id=payload.project_id,
        agent_path=context.agent_path,
        tenant_id=context.tenant_id,
        client_id=context.client_id,
        plan_id=context.plan_id or f"plan-{payload.project_id}",
        provider=provider_key,
        account_label=payload.account_label.strip(),
        market=payload.market,
        requested_scopes_json=json.dumps(sorted(set(payload.requested_scopes)), ensure_ascii=False),
        status="ready_for_oauth" if ready else "awaiting_headquarters_app",
        requested_by=current_user.id,
    )
    db.add(record)
    record_audit_event(
        db,
        action="social_authorization_requested",
        actor_user_id=current_user.id,
        org_id=resolved.client.id,
        project_id=payload.project_id,
        target_type="social_authorization_request",
        target_id=record.id,
        ip_address=request.client.host if request.client else None,
        detail={"provider": provider_key, "market": payload.market, "status": record.status, "scope_count": len(payload.requested_scopes)},
    )
    await db.commit()
    await db.refresh(record)
    return _request_view(record)


@router.post("/requests/{request_id}/cancel")
async def cancel_authorization_request(
    request_id: str,
    project_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    await require_project_access(db, current_user=current_user, project_id=project_id)
    record = await db.scalar(
        select(SocialAuthorizationRequest).where(
            SocialAuthorizationRequest.id == request_id,
            SocialAuthorizationRequest.project_id == project_id,
        )
    )
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Authorization request not found")
    if record.status == "cancelled":
        return _request_view(record)
    record.status = "cancelled"
    record.cancelled_by = current_user.id
    record.cancelled_at = datetime.now()
    record_audit_event(
        db,
        action="social_authorization_cancelled",
        actor_user_id=current_user.id,
        project_id=project_id,
        target_type="social_authorization_request",
        target_id=record.id,
        ip_address=request.client.host if request.client else None,
        detail={"provider": record.provider},
    )
    await db.commit()
    await db.refresh(record)
    return _request_view(record)
