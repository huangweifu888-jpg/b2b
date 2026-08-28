"""Operational records for customer-selected social pages and their metrics.

This router persists workflow data, verified manual exports, and future sync
requests.  It intentionally does not accept credentials and it never reaches a
social platform from a browser request.  A provider connector must be deployed
separately to mark an asset ready and write ``official_api`` snapshots.
"""

from __future__ import annotations

import json
import secrets
from datetime import datetime
from urllib.parse import urlparse

from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter, Depends, HTTPException, Request, status
from models.social_authorization import SocialAuthorizationRequest
from models.social_page_asset import SocialPageAsset, SocialPageMetricSnapshot, SocialPageSyncRequest
from pydantic import BaseModel, Field
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.tenant_access import require_project_access
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


router = APIRouter(prefix="/api/v1/social-page-assets", tags=["social-page-assets"])

_SENSITIVE_PARTS = ("token", "secret", "password", "cookie", "apikey", "api_key", "authorization_code")


class PageAssetCreate(BaseModel):
    project_id: int = Field(gt=0)
    provider: str = Field(min_length=2, max_length=80)
    display_name: str = Field(min_length=1, max_length=255)
    page_url: str = Field(min_length=8, max_length=1000)
    asset_reference: str = Field(min_length=1, max_length=255)
    authorization_request_id: str | None = Field(default=None, max_length=64)


class VerifiedMetricSnapshotCreate(BaseModel):
    captured_at: datetime = Field(default_factory=datetime.now)
    followers: int | None = Field(default=None, ge=0)
    impressions: int | None = Field(default=None, ge=0)
    engagements: int | None = Field(default=None, ge=0)
    views: int | None = Field(default=None, ge=0)
    clicks: int | None = Field(default=None, ge=0)


def _provider_key(value: str) -> str:
    normalized = " ".join(value.split()).strip().lower()
    if not normalized or any(character in normalized for character in "<>\\\"'`\n\r"):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Invalid provider")
    return normalized


def _safe_reference(value: str) -> str:
    normalized = value.strip()
    lower = normalized.lower().replace("-", "_")
    if not normalized or any(part in lower for part in _SENSITIVE_PARTS):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Asset reference must not contain credentials or secrets")
    return normalized


def _https_url(value: str) -> str:
    normalized = value.strip()
    parsed = urlparse(normalized)
    if parsed.scheme != "https" or not parsed.netloc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Page URL must be an HTTPS URL")
    return normalized


def _asset_view(item: SocialPageAsset) -> dict:
    return {
        "id": item.id,
        "project_id": item.project_id,
        "authorization_request_id": item.authorization_request_id,
        "provider": item.provider,
        "display_name": item.display_name,
        "page_url": item.page_url,
        "asset_reference": item.asset_reference,
        "status": item.status,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
    }


def _snapshot_view(item: SocialPageMetricSnapshot) -> dict:
    return {
        "id": item.id,
        "project_id": item.project_id,
        "page_asset_id": item.page_asset_id,
        "source": item.source,
        "captured_at": item.captured_at,
        "followers": item.followers,
        "impressions": item.impressions,
        "engagements": item.engagements,
        "views": item.views,
        "clicks": item.clicks,
        "created_at": item.created_at,
    }


@router.get("")
async def list_page_assets(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    await require_project_access(db, current_user=current_user, project_id=project_id)
    items = (
        await db.execute(
            select(SocialPageAsset)
            .where(SocialPageAsset.project_id == project_id)
            .order_by(SocialPageAsset.updated_at.desc(), SocialPageAsset.created_at.desc())
        )
    ).scalars().all()
    return {"items": [_asset_view(item) for item in items]}


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_page_asset(
    payload: PageAssetCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    resolved = await require_project_access(db, current_user=current_user, project_id=payload.project_id)
    provider = _provider_key(payload.provider)
    authorization_request_id = payload.authorization_request_id.strip() if payload.authorization_request_id else None
    if authorization_request_id:
        authorization = await db.scalar(
            select(SocialAuthorizationRequest).where(
                SocialAuthorizationRequest.id == authorization_request_id,
                SocialAuthorizationRequest.project_id == payload.project_id,
            )
        )
        if not authorization:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Authorization request was not found in this project")
        if authorization.provider != provider:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Page provider must match the authorization request")
        if authorization.status == "cancelled":
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Cancelled authorization requests cannot be used")

    context = resolved.context
    item = SocialPageAsset(
        id=f"social-page-{secrets.token_urlsafe(18)}",
        project_id=payload.project_id,
        agent_path=context.agent_path,
        tenant_id=context.tenant_id,
        client_id=context.client_id,
        plan_id=context.plan_id or f"plan-{payload.project_id}",
        authorization_request_id=authorization_request_id,
        provider=provider,
        display_name=payload.display_name.strip(),
        page_url=_https_url(payload.page_url),
        asset_reference=_safe_reference(payload.asset_reference),
        status="awaiting_oauth",
        created_by=current_user.id,
    )
    db.add(item)
    record_audit_event(
        db,
        action="social_page_asset_created",
        actor_user_id=current_user.id,
        org_id=resolved.client.id,
        project_id=payload.project_id,
        target_type="social_page_asset",
        target_id=item.id,
        ip_address=request.client.host if request.client else None,
        detail={"provider": provider, "status": item.status, "has_authorization_request": bool(authorization_request_id)},
    )
    await db.commit()
    await db.refresh(item)
    return _asset_view(item)


@router.get("/{page_asset_id}/snapshots")
async def list_metric_snapshots(
    page_asset_id: str,
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    await require_project_access(db, current_user=current_user, project_id=project_id)
    asset = await db.scalar(select(SocialPageAsset).where(SocialPageAsset.id == page_asset_id, SocialPageAsset.project_id == project_id))
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Page asset was not found in this project")
    items = (
        await db.execute(
            select(SocialPageMetricSnapshot)
            .where(SocialPageMetricSnapshot.project_id == project_id, SocialPageMetricSnapshot.page_asset_id == page_asset_id)
            .order_by(SocialPageMetricSnapshot.captured_at.desc())
        )
    ).scalars().all()
    return {"items": [_snapshot_view(item) for item in items]}


@router.post("/{page_asset_id}/snapshots", status_code=status.HTTP_201_CREATED)
async def create_verified_metric_snapshot(
    page_asset_id: str,
    payload: VerifiedMetricSnapshotCreate,
    project_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    resolved = await require_project_access(db, current_user=current_user, project_id=project_id)
    asset = await db.scalar(select(SocialPageAsset).where(SocialPageAsset.id == page_asset_id, SocialPageAsset.project_id == project_id))
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Page asset was not found in this project")
    if all(value is None for value in (payload.followers, payload.impressions, payload.engagements, payload.views, payload.clicks)):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="At least one metric is required")
    context = resolved.context
    item = SocialPageMetricSnapshot(
        id=f"social-snapshot-{secrets.token_urlsafe(18)}",
        project_id=project_id,
        page_asset_id=asset.id,
        agent_path=context.agent_path,
        tenant_id=context.tenant_id,
        client_id=context.client_id,
        plan_id=context.plan_id or f"plan-{project_id}",
        source="verified_manual",
        captured_at=payload.captured_at,
        followers=payload.followers,
        impressions=payload.impressions,
        engagements=payload.engagements,
        views=payload.views,
        clicks=payload.clicks,
        recorded_by=current_user.id,
    )
    db.add(item)
    record_audit_event(
        db,
        action="social_page_metric_snapshot_recorded",
        actor_user_id=current_user.id,
        org_id=resolved.client.id,
        project_id=project_id,
        target_type="social_page_metric_snapshot",
        target_id=item.id,
        ip_address=request.client.host if request.client else None,
        detail={"page_asset_id": asset.id, "source": "verified_manual", "metric_count": sum(value is not None for value in (payload.followers, payload.impressions, payload.engagements, payload.views, payload.clicks))},
    )
    await db.commit()
    await db.refresh(item)
    return _snapshot_view(item)


@router.post("/{page_asset_id}/sync-requests", status_code=status.HTTP_201_CREATED)
async def create_sync_request(
    page_asset_id: str,
    project_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    resolved = await require_project_access(db, current_user=current_user, project_id=project_id)
    asset = await db.scalar(select(SocialPageAsset).where(SocialPageAsset.id == page_asset_id, SocialPageAsset.project_id == project_id))
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Page asset was not found in this project")
    reasons = ["awaiting_official_oauth_callback"] if asset.status != "ready_for_sync" else ["provider_connector_not_deployed"]
    context = resolved.context
    item = SocialPageSyncRequest(
        id=f"social-page-sync-{secrets.token_urlsafe(18)}",
        project_id=project_id,
        page_asset_id=asset.id,
        agent_path=context.agent_path,
        tenant_id=context.tenant_id,
        client_id=context.client_id,
        plan_id=context.plan_id or f"plan-{project_id}",
        status="blocked_configuration",
        block_reasons_json=json.dumps(reasons),
        requested_by=current_user.id,
    )
    db.add(item)
    record_audit_event(
        db,
        action="social_page_sync_requested",
        actor_user_id=current_user.id,
        org_id=resolved.client.id,
        project_id=project_id,
        target_type="social_page_sync_request",
        target_id=item.id,
        ip_address=request.client.host if request.client else None,
        detail={"page_asset_id": asset.id, "status": item.status, "block_reasons": reasons},
    )
    await db.commit()
    await db.refresh(item)
    return {"id": item.id, "project_id": item.project_id, "page_asset_id": item.page_asset_id, "status": item.status, "block_reasons": reasons, "requested_at": item.requested_at}
