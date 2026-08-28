"""Tenant-context validation endpoint for new modular APIs.

This endpoint intentionally resolves only a normalized context.  It does not
grant access to tenant data; data routers must still enforce membership and
descendant-agent checks against the database.
"""

from typing import Optional

from core.tenant_context import TenantContextError, build_tenant_context
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field


router = APIRouter(prefix="/api/v1/platform/tenant-context", tags=["tenant-context"])


class TenantContextResolveRequest(BaseModel):
    agent_path: str = Field(..., examples=["agency-a/sub-agency-b"])
    tenant_id: str = Field(..., examples=["tenant-acme"])
    client_id: str = Field(..., examples=["client-acme"])
    plan_id: Optional[str] = Field(default=None, examples=["plan-spring-2026"])


@router.post("/resolve")
async def resolve_tenant_context(payload: TenantContextResolveRequest):
    try:
        context = build_tenant_context(**payload.model_dump())
    except TenantContextError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc

    return {
        "context": context.as_dict(),
        "asset_prefix": context.asset_prefix,
        "authorization_required": ["requester_membership", "agent_descendant_scope", "tenant_membership"],
    }
