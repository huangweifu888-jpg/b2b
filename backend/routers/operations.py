"""Minimal health endpoints for load balancers and operational monitoring."""

from __future__ import annotations

import os
from typing import Literal

from core.config import settings
from core.database import get_db
from core.runtime_readiness import deployment_readiness
from dependencies.auth import get_current_user
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.database import check_database_health
from services.content_scanner import scanner_readiness
from middlewares.request_security import rate_limit_backend_health
from services.background_jobs import background_job_queue_health, background_job_queue_metrics, background_job_result, enqueue_background_job
from services.secret_controls import secret_configuration_health
from services.tenant_access import require_global_platform_access
from sqlalchemy.ext.asyncio import AsyncSession


router = APIRouter(prefix="/api/v1/operations", tags=["operations"])


class VerificationJobRequest(BaseModel):
    """Request a worker-owned verification for a permitted operational artifact."""

    kind: Literal["backup_verify", "release_smoke_check"]
    artifact_path: str = Field(min_length=1, max_length=1000)


@router.post("/verification-jobs", status_code=status.HTTP_202_ACCEPTED)
async def enqueue_verification_job(
    payload: VerificationJobRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    await require_global_platform_access(current_user=current_user)
    key = "backup_path" if payload.kind == "backup_verify" else "artifact_path"
    try:
        job = await enqueue_background_job(payload.kind, {key: payload.artifact_path})
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    record_audit_event(
        db,
        action="operational_verification_queued",
        actor_user_id=current_user.id,
        target_type="background_job",
        target_id=job["id"],
        ip_address=request.client.host if request.client else None,
        detail={"kind": payload.kind},
    )
    await db.commit()
    return job


@router.get("/verification-jobs/{job_id}")
async def get_verification_job(
    job_id: str,
    current_user: UserResponse = Depends(get_current_user),
):
    await require_global_platform_access(current_user=current_user)
    result = await background_job_result(job_id)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Verification job result is not available")
    return result


@router.get("/health")
async def operational_health():
    """Return a credential-free readiness result suitable for monitoring probes."""
    database_ok = await check_database_health()
    scanner_status = scanner_readiness()
    scanner_ok = settings.is_development_environment or scanner_status == "ready"
    rate_limit_status = await rate_limit_backend_health()
    rate_limit_ok = settings.is_development_environment or rate_limit_status == "redis-ready"
    job_queue_status = await background_job_queue_health()
    job_queue_metrics = await background_job_queue_metrics()
    job_queue_ok = settings.is_development_environment or job_queue_status == "redis-ready"
    secret_status = secret_configuration_health()
    secret_ok = settings.is_development_environment or secret_status == "ready"
    deployment = deployment_readiness()
    deployment_ok = bool(deployment["ready"])
    payload = {
        "status": "healthy" if database_ok and scanner_ok and rate_limit_ok and job_queue_ok and secret_ok and deployment_ok else "unhealthy",
        "checks": {
            "database": "healthy" if database_ok else "unhealthy",
            "content_download_scanner": scanner_status,
            "rate_limit_backend": rate_limit_status,
            "background_job_queue": job_queue_status,
            "secret_configuration": secret_status,
            "deployment": "ready" if deployment_ok else "invalid",
        },
        "queue": job_queue_metrics,
        "deployment": deployment,
        "environment": os.getenv("ENVIRONMENT", settings.environment).strip().lower(),
        "version": settings.version,
    }
    return JSONResponse(
        status_code=status.HTTP_200_OK if database_ok and scanner_ok and rate_limit_ok and job_queue_ok and secret_ok and deployment_ok else status.HTTP_503_SERVICE_UNAVAILABLE,
        content=payload,
    )
