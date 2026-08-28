"""Independent-plan runtime configuration endpoints."""

from __future__ import annotations

import json
from typing import Any

from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter, Depends, Request
from models.platform import PlanRuntimeConfig
from pydantic import BaseModel, Field
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.tenant_access import require_project_access
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


router = APIRouter(prefix="/api/v1/plans", tags=["plan-runtime"])


class PlanRuntimeUpdate(BaseModel):
    deployment_id: str = Field(default="shared-stamp-a", min_length=1, max_length=100)
    database_id: str = Field(default="shared-client-db-a", min_length=1, max_length=100)
    base_client_version: str = Field(default="0.1.0", min_length=1, max_length=100)
    template_version: str = Field(default="0.1.0", min_length=1, max_length=100)
    enabled_modules: list[str] = Field(default_factory=list)
    overrides: dict[str, Any] = Field(default_factory=dict)


def serialize(config: PlanRuntimeConfig, *, context: dict[str, str | None]) -> dict[str, Any]:
    return {
        "project_id": config.project_id,
        "deployment_id": config.deployment_id,
        "database_id": config.database_id,
        "base_client_version": config.base_client_version,
        "template_version": config.template_version,
        "enabled_modules": json.loads(config.enabled_modules_json or "[]"),
        "overrides": json.loads(config.overrides_json or "{}"),
        "status": config.status,
        "tenant_context": context,
    }


@router.get("/{project_id}/runtime")
async def get_runtime_config(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    resolved = await require_project_access(db, current_user=current_user, project_id=project_id)
    config = await db.scalar(select(PlanRuntimeConfig).where(PlanRuntimeConfig.project_id == project_id))
    if not config:
        return {
            "project_id": project_id,
            "deployment_id": "shared-stamp-a",
            "database_id": "shared-client-db-a",
            "base_client_version": "0.1.0",
            "template_version": "0.1.0",
            "enabled_modules": ["00-product-market", "02-content"],
            "overrides": {"content_download": False},
            "status": "draft",
            "tenant_context": resolved.context.as_dict(),
        }
    return serialize(config, context=resolved.context.as_dict())


@router.put("/{project_id}/runtime")
async def update_runtime_config(
    project_id: int,
    payload: PlanRuntimeUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    resolved = await require_project_access(db, current_user=current_user, project_id=project_id)
    config = await db.scalar(select(PlanRuntimeConfig).where(PlanRuntimeConfig.project_id == project_id))
    if not config:
        config = PlanRuntimeConfig(project_id=project_id)
        db.add(config)

    config.deployment_id = payload.deployment_id
    config.database_id = payload.database_id
    config.base_client_version = payload.base_client_version
    config.template_version = payload.template_version
    config.enabled_modules_json = json.dumps(sorted(set(payload.enabled_modules)), ensure_ascii=False)
    config.overrides_json = json.dumps(payload.overrides, ensure_ascii=False)
    record_audit_event(
        db,
        action="plan_runtime_updated",
        actor_user_id=current_user.id,
        org_id=resolved.client.id,
        project_id=project_id,
        target_type="plan_runtime_config",
        target_id=project_id,
        ip_address=request.client.host if request.client else None,
        detail={
            "deployment_id": payload.deployment_id,
            "database_id": payload.database_id,
            "base_client_version": payload.base_client_version,
            "template_version": payload.template_version,
            "enabled_modules": sorted(set(payload.enabled_modules)),
        },
    )
    await db.commit()
    await db.refresh(config)
    return serialize(config, context=resolved.context.as_dict())
