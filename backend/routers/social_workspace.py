"""Durable, tenant-scoped social plan workspace APIs.

The endpoint stores collaboration state only. It refuses secret-like fields so
that browser-local drafts can be promoted to a shared workspace without
creating a second, unsafe OAuth credential store.
"""

from __future__ import annotations

import json
import secrets
from typing import Any

from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter, Depends, HTTPException, Request, status
from models.social_workspace import SocialPlanWorkspace
from pydantic import BaseModel, Field
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.tenant_access import require_project_access
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


router = APIRouter(prefix="/api/v1/social-workspaces", tags=["social-workspaces"])

_FORBIDDEN_KEY_PARTS = (
    "token", "secret", "password", "cookie", "api_key", "apikey", "authorization_code", "client_secret",
)
_MAX_STATE_BYTES = 1_000_000
_MAX_DEPTH = 12


class SocialWorkspaceUpdate(BaseModel):
    state: dict[str, Any] = Field(default_factory=dict)
    expected_revision: int | None = Field(default=None, ge=0)


def _assert_safe_value(value: Any, *, path: str = "state", depth: int = 0) -> None:
    if depth > _MAX_DEPTH:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Workspace state is nested too deeply")
    if isinstance(value, dict):
        for key, child in value.items():
            if not isinstance(key, str):
                raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Workspace keys must be strings")
            normalized = key.lower().replace("-", "_")
            if any(part in normalized for part in _FORBIDDEN_KEY_PARTS):
                raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=f"Sensitive field is not allowed: {path}.{key}")
            _assert_safe_value(child, path=f"{path}.{key}", depth=depth + 1)
    elif isinstance(value, list):
        for index, child in enumerate(value):
            _assert_safe_value(child, path=f"{path}[{index}]", depth=depth + 1)
    elif value is None or isinstance(value, (str, int, float, bool)):
        return
    else:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=f"Unsupported workspace value at {path}")


def _serialize_state(state: dict[str, Any]) -> str:
    _assert_safe_value(state)
    try:
        encoded = json.dumps(state, ensure_ascii=False, separators=(",", ":"))
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Workspace state must be JSON serializable") from exc
    if len(encoded.encode("utf-8")) > _MAX_STATE_BYTES:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Workspace state exceeds 1 MB")
    return encoded


def _view(item: SocialPlanWorkspace | None, *, project_id: int) -> dict[str, Any]:
    if not item:
        return {"project_id": project_id, "revision": 0, "state": {}, "updated_at": None}
    try:
        state = json.loads(item.state_json or "{}")
    except json.JSONDecodeError:
        state = {}
    return {"project_id": item.project_id, "revision": item.revision, "state": state, "updated_at": item.updated_at}


@router.get("/{project_id}")
async def get_workspace(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    await require_project_access(db, current_user=current_user, project_id=project_id)
    item = await db.scalar(select(SocialPlanWorkspace).where(SocialPlanWorkspace.project_id == project_id))
    return _view(item, project_id=project_id)


@router.put("/{project_id}")
async def put_workspace(
    project_id: int,
    payload: SocialWorkspaceUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    resolved = await require_project_access(db, current_user=current_user, project_id=project_id)
    encoded = _serialize_state(payload.state)
    item = await db.scalar(select(SocialPlanWorkspace).where(SocialPlanWorkspace.project_id == project_id))
    current_revision = item.revision if item else 0
    if payload.expected_revision is not None and payload.expected_revision != current_revision:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Workspace revision conflict; refresh before saving")
    if not item:
        context = resolved.context
        item = SocialPlanWorkspace(
            id=f"social-workspace-{secrets.token_urlsafe(18)}",
            project_id=project_id,
            agent_path=context.agent_path,
            tenant_id=context.tenant_id,
            client_id=context.client_id,
            plan_id=context.plan_id or f"plan-{project_id}",
            state_json=encoded,
            revision=1,
            updated_by=current_user.id,
        )
        db.add(item)
    else:
        item.state_json = encoded
        item.revision += 1
        item.updated_by = current_user.id
    record_audit_event(
        db,
        action="social_workspace_saved",
        actor_user_id=current_user.id,
        org_id=resolved.client.id,
        project_id=project_id,
        target_type="social_plan_workspace",
        target_id=item.id,
        ip_address=request.client.host if request.client else None,
        detail={"revision": item.revision, "state_keys": sorted(payload.state.keys())},
    )
    await db.commit()
    await db.refresh(item)
    return _view(item, project_id=project_id)
