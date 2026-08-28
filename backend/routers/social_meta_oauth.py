"""Safe readiness endpoint for the official Meta OAuth pilot."""

from __future__ import annotations

from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter, Depends, HTTPException, status
from models.social_authorization import SocialOAuthApplication
from schemas.auth import UserResponse
from services.social_meta_oauth import META_PROVIDERS, meta_oauth_readiness, normalize_meta_provider
from services.tenant_access import require_project_access
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


router = APIRouter(prefix="/api/v1/social-meta-oauth", tags=["social-meta-oauth"])


@router.get("/readiness")
async def get_meta_oauth_readiness(
    project_id: int,
    provider: str = "facebook",
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    await require_project_access(db, current_user=current_user, project_id=project_id)
    try:
        provider_key = normalize_meta_provider(provider)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc)) from exc
    application = await db.scalar(select(SocialOAuthApplication).where(SocialOAuthApplication.provider == provider_key))
    readiness = meta_oauth_readiness(application_active=bool(application and application.status == "active"))
    return {
        "provider": provider_key,
        "official_flow": "Meta OAuth 2.0",
        "external_redirect_started": False,
        "requirements": readiness,
        "message": "This endpoint performs readiness checks only; external OAuth redirect and code exchange remain disabled until all requirements are configured.",
    }
