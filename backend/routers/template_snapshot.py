"""Tenant-bound template snapshot, publishing, synchronization, and restore APIs."""

from __future__ import annotations

from typing import Any

from core.config import settings
from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from schemas.auth import UserResponse
from schemas.template_snapshot import (
    BackupCreateRequest,
    BackupRestoreDrillRequest,
    DeveloperGlobalFrameAcceptanceArtifactCreateRequest,
    DeveloperGlobalFrameAcceptanceArtifactResponse,
    DeveloperGlobalFrameAcceptanceJobCreateRequest,
    DeveloperGlobalFrameAcceptanceJobResponse,
    DeveloperGlobalFrameAcceptanceWorkerClaimRequest,
    DeveloperGlobalFrameAcceptanceWorkerClaimNextRequest,
    DeveloperGlobalFrameAcceptanceWorkerFailureRequest,
    DeveloperGlobalFrameDraftMergeRequest,
    DeveloperGlobalFrameDraftMergeResponse,
    DeveloperGlobalFrameFactoryDefaultReceiptRequest,
    DeveloperGlobalFrameFactoryDefaultReceiptResponse,
    DeveloperGlobalFrameFactoryDefaultRestoreRequest,
    DeveloperGlobalFramePreflightEvidenceResponse,
    DeveloperGlobalFramePreflightEvidenceValidateRequest,
    InstanceDetachRequest,
    InstanceRebindTemplateRequest,
    InstanceRestoreTemplateRequest,
    InstanceSyncLatestRequest,
    InstanceUpsertRequest,
    LegacyOwnerMappingRequest,
    ProductMarketFactoryDefaultPromoteRequest,
    ProductMarketFactoryDefaultResponse,
    SnapshotBindingRequest,
    TemplateCreateRequest,
    TemplatePublishRequest,
    TemplateReleaseBatchCreateRequest,
    TemplateVersionReviewRequest,
    TemplateUpsertRequest,
)
from services.audit import record_audit_event
from services.background_jobs import enqueue_background_job
from services.template_release_batches import TemplateReleaseBatchService
from services.template_snapshot import TemplateSnapshotService
from services.tenant_access import require_global_platform_access, require_organization_access, require_project_access
from models.platform import Organization
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


router = APIRouter(prefix="/api/template-snapshot", tags=["template-snapshot"])
_SOURCE_SCOPES = {"hq", "agency_source", "client_source"}
_INSTANCE_SCOPES = {"agency", "client"}


def _service(db: AsyncSession) -> TemplateSnapshotService:
    return TemplateSnapshotService(db)


async def _resolve_and_authorize_binding(
    db: AsyncSession,
    *,
    current_user: UserResponse,
    owner_scope: str,
    owner_id: str | None,
    organization_id: int | None,
    project_id: int | None,
    allow_existing_dual_binding: bool = False,
) -> tuple[int | None, int | None]:
    """Resolve an explicit legacy mapping, then validate the caller's real tenant access."""
    if organization_id is not None and project_id is not None and not allow_existing_dual_binding:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Use either organization_id or project_id, not both")
    if organization_id is None and project_id is None:
        mapping = await _service(db).resolve_legacy_mapping(owner_scope, owner_id)
        if mapping:
            organization_id, project_id = mapping.organization_id, mapping.project_id

    if owner_scope == "hq":
        await require_global_platform_access(current_user=current_user)
        return organization_id, project_id
    if project_id is not None:
        await require_project_access(db, current_user=current_user, project_id=project_id)
        return organization_id, project_id
    if organization_id is not None:
        await require_organization_access(db, current_user=current_user, organization_id=organization_id)
        return organization_id, project_id

    # Existing snapshots without an explicit mapping remain recoverable by HQ,
    # but are never exposed to a tenant based on a guessed browser site ID.
    await require_global_platform_access(current_user=current_user)
    return None, None


async def _authorize_payload(
    db: AsyncSession, *, current_user: UserResponse, payload: dict[str, Any], is_template: bool
) -> dict[str, Any]:
    owner_scope = str(payload.get("owner_scope") or "")
    allowed = _SOURCE_SCOPES if is_template else _INSTANCE_SCOPES
    if owner_scope not in allowed:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Unsupported template snapshot owner scope")
    if is_template:
        # Source templates control every downstream runtime.  Organization
        # visibility alone must never grant mutation authority, even to a
        # regular member of the headquarters organization.
        await require_global_platform_access(current_user=current_user)
    organization_id, project_id = await _resolve_and_authorize_binding(
        db,
        current_user=current_user,
        owner_scope=owner_scope,
        owner_id=payload.get("owner_id"),
        organization_id=payload.get("organization_id"),
        project_id=payload.get("project_id"),
    )
    if owner_scope in {"agency_source", "client_source"} and organization_id is None:
        # Headquarters owns the two global source templates.  Older browser
        # clients did not include that stable organization ID, so bind it on
        # the server only after global-platform authorization has succeeded.
        # This keeps a source template tenant-bound without trusting a browser
        # supplied fallback ID.
        organization_id = await db.scalar(
            select(Organization.id)
            .where(Organization.org_type == "hq")
            .order_by(Organization.id.asc())
        )
        if organization_id is None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Headquarters organization is not initialized")
    if owner_scope == "agency" and organization_id is None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="This scope requires an organization binding")
    if owner_scope == "client" and project_id is None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Client plan snapshots require a project binding")
    payload["organization_id"] = organization_id
    payload["project_id"] = project_id
    return payload


async def _authorize_existing(
    db: AsyncSession, *, current_user: UserResponse, resource: dict[str, Any]
) -> tuple[int | None, int | None]:
    return await _resolve_and_authorize_binding(
        db,
        current_user=current_user,
        owner_scope=str(resource.get("owner_scope") or ""),
        owner_id=resource.get("owner_id"),
        organization_id=resource.get("organization_id"),
        project_id=resource.get("project_id"),
        allow_existing_dual_binding=True,
    )


async def _record_action(
    db: AsyncSession,
    *,
    request: Request,
    current_user: UserResponse,
    action: str,
    organization_id: int | None,
    project_id: int | None,
    target_type: str,
    target_id: str,
    detail: dict[str, Any] | None = None,
) -> None:
    record_audit_event(
        db,
        action=action,
        actor_user_id=current_user.id,
        org_id=organization_id,
        project_id=project_id,
        target_type=target_type,
        target_id=target_id,
        ip_address=request.client.host if request.client else None,
        detail=detail,
    )
    await db.commit()


def _translate_error(exc: Exception) -> HTTPException:
    if isinstance(exc, KeyError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    if isinstance(exc, ValueError):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    raise exc


@router.post("/legacy-mappings", status_code=status.HTTP_201_CREATED)
async def upsert_legacy_mapping(
    payload: LegacyOwnerMappingRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    await require_global_platform_access(current_user=current_user)
    body = payload.model_dump()
    if bool(body["organization_id"]) == bool(body["project_id"]):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Provide exactly one target binding")
    if body["organization_id"]:
        await require_organization_access(db, current_user=current_user, organization_id=body["organization_id"])
    else:
        await require_project_access(db, current_user=current_user, project_id=body["project_id"])
    body["created_by"] = current_user.id
    try:
        result = await _service(db).upsert_legacy_mapping(body)
    except ValueError as exc:
        raise _translate_error(exc) from exc
    await _record_action(
        db, request=request, current_user=current_user, action="template_snapshot_legacy_mapping_upserted",
        organization_id=result["organization_id"], project_id=result["project_id"], target_type="template_snapshot_legacy_mapping",
        target_id=f"{result['owner_scope']}:{result['legacy_owner_id']}", detail={"owner_scope": result["owner_scope"]},
    )
    return result


@router.get("/legacy-mappings")
async def list_legacy_mappings(
    limit: int = Query(default=200, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    await require_global_platform_access(current_user=current_user)
    return {"items": await _service(db).list_legacy_mappings(limit=limit)}


@router.get("/legacy-unmapped")
async def list_legacy_unmapped(
    limit: int = Query(default=200, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    await require_global_platform_access(current_user=current_user)
    return {"items": await _service(db).list_unmapped_resources(limit=limit)}


@router.post("/legacy-unmapped/{resource_type}/{resource_id}/bind")
async def bind_legacy_unmapped(
    resource_type: str,
    resource_id: str,
    payload: SnapshotBindingRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    await require_global_platform_access(current_user=current_user)
    body = payload.model_dump()
    if bool(body["organization_id"]) == bool(body["project_id"]):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Provide exactly one target binding")
    if body["organization_id"]:
        await require_organization_access(db, current_user=current_user, organization_id=body["organization_id"])
    else:
        await require_project_access(db, current_user=current_user, project_id=body["project_id"])
    try:
        result = await _service(db).bind_unmapped_resource(resource_type=resource_type, resource_id=resource_id, **body)
    except (KeyError, ValueError) as exc:
        raise _translate_error(exc) from exc
    await _record_action(
        db, request=request, current_user=current_user, action="template_snapshot_legacy_resource_bound",
        organization_id=result["organization_id"], project_id=result["project_id"], target_type=f"template_snapshot_{resource_type}",
        target_id=resource_id, detail={"resource_type": resource_type},
    )
    return result


@router.post("/templates", status_code=status.HTTP_201_CREATED)
async def create_template(
    payload: TemplateCreateRequest, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)
):
    body = payload.model_dump()
    requested_template_id = body.get("template_id")
    if requested_template_id:
        try:
            await _service(db).get_template(requested_template_id)
        except KeyError:
            pass
        else:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Template ID already exists")
    body = await _authorize_payload(db, current_user=current_user, payload=body, is_template=True)
    try:
        result = await _service(db).create_template(body)
    except ValueError as exc:
        raise _translate_error(exc) from exc
    await _record_action(db, request=request, current_user=current_user, action="template_snapshot_template_created", organization_id=result["organization_id"], project_id=result["project_id"], target_type="template_snapshot_template", target_id=result["template_id"])
    return result


@router.put("/templates/{template_id}")
async def upsert_template(
    template_id: str, payload: TemplateUpsertRequest, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)
):
    try:
        existing = await _service(db).get_template(template_id)
    except KeyError:
        existing = None
    if existing is not None:
        # Authorize the current binding before reading any attacker-supplied
        # replacement binding from the request body.
        await require_global_platform_access(current_user=current_user)
        await _authorize_existing(db, current_user=current_user, resource=existing)
    body = payload.model_dump()
    body["template_id"] = template_id
    body = await _authorize_payload(db, current_user=current_user, payload=body, is_template=True)
    try:
        result = await _service(db).upsert_template(body)
    except ValueError as exc:
        raise _translate_error(exc) from exc
    await _record_action(db, request=request, current_user=current_user, action="template_snapshot_template_updated", organization_id=result["organization_id"], project_id=result["project_id"], target_type="template_snapshot_template", target_id=result["template_id"])
    return result


@router.post(
    "/sections/developer-global-frame/acceptance-jobs/claim-next",
    response_model=DeveloperGlobalFrameAcceptanceJobResponse,
    response_model_exclude_unset=True,
    responses={status.HTTP_204_NO_CONTENT: {"description": "No pending trusted acceptance job"}},
)
async def claim_next_developer_global_frame_acceptance_job(
    payload: DeveloperGlobalFrameAcceptanceWorkerClaimNextRequest,
    db: AsyncSession = Depends(get_db),
):
    """Trusted-worker dequeue; the signed request is bound to the selected job in durable history."""

    try:
        result = await _service(db).claim_next_developer_global_frame_acceptance_job(
            payload.model_dump(mode="python")
        )
    except (KeyError, ValueError) as exc:
        raise _translate_error(exc) from exc
    if result is None:
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    return result


@router.post(
    "/templates/{template_id}/sections/developer-global-frame/acceptance-jobs",
    response_model=DeveloperGlobalFrameAcceptanceJobResponse,
    response_model_exclude_unset=True,
    status_code=status.HTTP_202_ACCEPTED,
)
async def create_developer_global_frame_acceptance_job(
    template_id: str,
    payload: DeveloperGlobalFrameAcceptanceJobCreateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    """Request trusted acceptance without letting the browser attest its own result."""

    try:
        existing = await _service(db).get_template(template_id)
        organization_id, project_id = await _authorize_existing(
            db,
            current_user=current_user,
            resource=existing,
        )
        result = await _service(db).create_developer_global_frame_acceptance_job(
            template_id,
            payload.model_dump(mode="json"),
            requested_by=current_user.id,
        )
    except (KeyError, ValueError) as exc:
        raise _translate_error(exc) from exc
    await _record_action(
        db,
        request=request,
        current_user=current_user,
        action="developer_global_frame_acceptance_requested",
        organization_id=organization_id,
        project_id=project_id,
        target_type="developer_global_frame_acceptance_job",
        target_id=result["acceptance_job_id"],
        detail={
            "template_id": template_id,
            "frame_section_hash": result["frame_section_hash"],
            "status": result["status"],
        },
    )
    return result


@router.get(
    "/templates/{template_id}/sections/developer-global-frame/acceptance-jobs/{job_id}",
    response_model=DeveloperGlobalFrameAcceptanceJobResponse,
    response_model_exclude_unset=True,
)
async def get_developer_global_frame_acceptance_job(
    template_id: str,
    job_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    try:
        existing = await _service(db).get_template(template_id)
        await _authorize_existing(db, current_user=current_user, resource=existing)
        return await _service(db).get_developer_global_frame_acceptance_job(
            template_id,
            job_id,
            requested_by=current_user.id,
        )
    except (KeyError, ValueError) as exc:
        raise _translate_error(exc) from exc


@router.post(
    "/templates/{template_id}/sections/developer-global-frame/acceptance-jobs/{job_id}/claim",
    response_model=DeveloperGlobalFrameAcceptanceJobResponse,
    response_model_exclude_unset=True,
)
async def claim_developer_global_frame_acceptance_job(
    template_id: str,
    job_id: str,
    payload: DeveloperGlobalFrameAcceptanceWorkerClaimRequest,
    db: AsyncSession = Depends(get_db),
):
    """Trusted-worker claim; the request HMAC is the service credential."""

    try:
        return await _service(db).claim_developer_global_frame_acceptance_job(
            template_id,
            job_id,
            payload.model_dump(mode="python"),
        )
    except (KeyError, ValueError) as exc:
        raise _translate_error(exc) from exc


@router.post(
    "/templates/{template_id}/sections/developer-global-frame/acceptance-jobs/{job_id}/fail",
    response_model=DeveloperGlobalFrameAcceptanceJobResponse,
    response_model_exclude_unset=True,
)
async def fail_developer_global_frame_acceptance_job(
    template_id: str,
    job_id: str,
    payload: DeveloperGlobalFrameAcceptanceWorkerFailureRequest,
    db: AsyncSession = Depends(get_db),
):
    """Trusted-worker failure report with retry state controlled by the server."""

    try:
        return await _service(db).fail_developer_global_frame_acceptance_job(
            template_id,
            job_id,
            payload.model_dump(mode="python"),
        )
    except (KeyError, ValueError) as exc:
        raise _translate_error(exc) from exc


@router.post(
    "/templates/{template_id}/sections/developer-global-frame/acceptance-jobs/{job_id}/heartbeat",
    response_model=DeveloperGlobalFrameAcceptanceJobResponse,
    response_model_exclude_unset=True,
)
async def heartbeat_developer_global_frame_acceptance_job(
    template_id: str,
    job_id: str,
    payload: DeveloperGlobalFrameAcceptanceWorkerClaimRequest,
    db: AsyncSession = Depends(get_db),
):
    """Trusted-worker heartbeat; renews the active lease without extending the absolute job TTL."""

    try:
        return await _service(db).heartbeat_developer_global_frame_acceptance_job(
            template_id,
            job_id,
            payload.model_dump(mode="python"),
        )
    except (KeyError, ValueError) as exc:
        raise _translate_error(exc) from exc


@router.post(
    "/templates/{template_id}/sections/developer-global-frame/acceptance-artifacts/latest",
    response_model=DeveloperGlobalFrameAcceptanceArtifactResponse,
    status_code=status.HTTP_201_CREATED,
)
async def register_developer_global_frame_acceptance_artifact(
    template_id: str,
    payload: DeveloperGlobalFrameAcceptanceArtifactCreateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Trusted-runner ingest; the body HMAC is the only accepted service credential."""

    if payload.template_id != template_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Acceptance artifact template ID does not match the request route",
        )
    try:
        return await _service(db).register_developer_global_frame_acceptance_artifact(
            payload.model_dump(mode="python")
        )
    except (KeyError, ValueError) as exc:
        raise _translate_error(exc) from exc


@router.get(
    "/templates/{template_id}/sections/developer-global-frame/acceptance-artifacts/latest",
    response_model=DeveloperGlobalFrameAcceptanceArtifactResponse,
)
async def get_latest_developer_global_frame_acceptance_artifact(
    template_id: str,
    base_draft_hash: str = Query(pattern=r"^[0-9a-f]{64}$"),
    frame_section_hash: str = Query(pattern=r"^[0-9a-f]{64}$"),
    visual_draft_id: str = Query(min_length=1, max_length=200),
    recovery_point_id: str = Query(min_length=1, max_length=200),
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    """Resolve only an exact draft binding; deployment hashes remain server-owned."""

    try:
        existing = await _service(db).get_template(template_id)
        await _authorize_existing(db, current_user=current_user, resource=existing)
        return await _service(db).get_latest_developer_global_frame_acceptance_artifact(
            template_id,
            base_draft_hash=base_draft_hash,
            frame_section_hash=frame_section_hash,
            visual_draft_id=visual_draft_id,
            recovery_point_id=recovery_point_id,
        )
    except (KeyError, ValueError) as exc:
        raise _translate_error(exc) from exc


@router.patch(
    "/templates/{template_id}/sections/developer-global-frame",
    response_model=DeveloperGlobalFrameDraftMergeResponse,
)
async def merge_developer_global_frame_draft(
    template_id: str,
    payload: DeveloperGlobalFrameDraftMergeRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    try:
        existing = await _service(db).get_template(template_id)
        organization_id, project_id = await _authorize_existing(
            db,
            current_user=current_user,
            resource=existing,
        )
        body = payload.model_dump(mode="json")
        result = await _service(db).merge_developer_global_frame_draft(
            template_id,
            expected_binding=(
                str(existing.get("owner_scope") or ""),
                existing.get("owner_id"),
                existing.get("organization_id"),
                existing.get("project_id"),
            ),
            base_draft_hash=body["base_draft_hash"],
            developer_global_frame=body["developer_global_frame"],
            preflight_evidence=body.get("preflight_evidence"),
            created_by=current_user.id,
        )
    except (KeyError, ValueError) as exc:
        raise _translate_error(exc) from exc
    await _record_action(
        db,
        request=request,
        current_user=current_user,
        action="template_snapshot_developer_global_frame_draft_merged",
        organization_id=organization_id,
        project_id=project_id,
        target_type="template_snapshot_template",
        target_id=template_id,
        detail={
            "profile_version": result["developer_global_frame"]["profile_version"],
            "draft_config_hash": result["draft_config_hash"],
            "write_scope": result["write_scope"],
            "preflight_evidence_id": (
                result["preflight_evidence"]["evidence_id"]
                if result.get("preflight_evidence")
                else None
            ),
        },
    )
    return result


@router.get(
    "/templates/{template_id}/sections/developer-global-frame/preflight-evidence/latest",
    response_model=DeveloperGlobalFramePreflightEvidenceResponse,
)
async def get_latest_developer_global_frame_preflight_evidence(
    template_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    try:
        existing = await _service(db).get_template(template_id)
        await _authorize_existing(db, current_user=current_user, resource=existing)
        return await _service(db).get_latest_developer_global_frame_preflight_evidence(template_id)
    except (KeyError, ValueError) as exc:
        raise _translate_error(exc) from exc


@router.post(
    "/templates/{template_id}/sections/developer-global-frame/preflight-evidence/{evidence_id}/validate",
    response_model=DeveloperGlobalFramePreflightEvidenceResponse,
)
async def validate_developer_global_frame_preflight_evidence(
    template_id: str,
    evidence_id: str,
    payload: DeveloperGlobalFramePreflightEvidenceValidateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    try:
        existing = await _service(db).get_template(template_id)
        organization_id, project_id = await _authorize_existing(
            db,
            current_user=current_user,
            resource=existing,
        )
        body = payload.model_dump()
        result = await _service(db).validate_developer_global_frame_preflight_evidence(
            template_id,
            evidence_id,
            expected_saved_draft_hash=body["expected_saved_draft_hash"],
            expected_artifact_hash=body["expected_artifact_hash"],
        )
    except (KeyError, ValueError) as exc:
        raise _translate_error(exc) from exc
    await _record_action(
        db,
        request=request,
        current_user=current_user,
        action="template_snapshot_developer_global_frame_preflight_validated",
        organization_id=organization_id,
        project_id=project_id,
        target_type="developer_global_frame_preflight_evidence",
        target_id=evidence_id,
        detail={
            "template_id": template_id,
            "saved_draft_hash": result["saved_draft_hash"],
            "artifact_hash": result["artifact_hash"],
            "evidence_hash": result["evidence_hash"],
        },
    )
    return result


@router.post(
    "/templates/{template_id}/sections/developer-global-frame/factory-default-receipts",
    response_model=DeveloperGlobalFrameFactoryDefaultReceiptResponse,
    status_code=status.HTTP_201_CREATED,
)
async def record_developer_global_frame_factory_default_receipt(
    template_id: str,
    payload: DeveloperGlobalFrameFactoryDefaultReceiptRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    await require_global_platform_access(current_user=current_user)
    try:
        existing = await _service(db).get_template(template_id)
        organization_id, project_id = await _authorize_existing(
            db,
            current_user=current_user,
            resource=existing,
        )
        result = await _service(db).record_developer_global_frame_factory_default_receipt(
            template_id,
            payload.model_dump(mode="python"),
            recorded_by=current_user.id,
        )
    except (KeyError, ValueError) as exc:
        raise _translate_error(exc) from exc
    await _record_action(
        db,
        request=request,
        current_user=current_user,
        action="template_snapshot_developer_global_frame_factory_default_recorded",
        organization_id=organization_id,
        project_id=project_id,
        target_type="developer_global_frame_factory_default_receipt",
        target_id=result["receipt_id"],
        detail={
            "template_id": result["template_id"],
            "published_version": result["published_version"],
            "rollout_batch_id": result["rollout_batch_id"],
            "receipt_hash": result["receipt_hash"],
        },
    )
    return result


@router.get(
    "/templates/{template_id}/sections/developer-global-frame/factory-default-receipts/latest",
    response_model=DeveloperGlobalFrameFactoryDefaultReceiptResponse,
)
async def get_latest_developer_global_frame_factory_default_receipt(
    template_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    await require_global_platform_access(current_user=current_user)
    try:
        existing = await _service(db).get_template(template_id)
        await _authorize_existing(db, current_user=current_user, resource=existing)
        return await _service(db).get_latest_developer_global_frame_factory_default_receipt(template_id)
    except (KeyError, ValueError) as exc:
        raise _translate_error(exc) from exc


@router.get(
    "/templates/{template_id}/sections/developer-global-frame/factory-default-receipts",
)
async def list_developer_global_frame_factory_default_receipts(
    template_id: str,
    limit: int = Query(default=100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    await require_global_platform_access(current_user=current_user)
    try:
        existing = await _service(db).get_template(template_id)
        await _authorize_existing(db, current_user=current_user, resource=existing)
        items = await _service(db).list_developer_global_frame_factory_default_receipts(
            template_id,
            limit=limit,
        )
    except (KeyError, ValueError) as exc:
        raise _translate_error(exc) from exc
    return {"items": items}


@router.post("/templates/{template_id}/publish")
async def publish_template(
    template_id: str, payload: TemplatePublishRequest, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)
):
    template = await _service(db).get_template(template_id)
    await require_global_platform_access(current_user=current_user)
    organization_id, project_id = await _authorize_existing(db, current_user=current_user, resource=template)
    body = payload.model_dump()
    body["published_by"] = current_user.id
    try:
        result = await _service(db).publish_template(template_id, body)
    except (KeyError, ValueError) as exc:
        raise _translate_error(exc) from exc
    action = "template_snapshot_template_submitted_for_review" if body.get("requires_approval") else "template_snapshot_template_published"
    await _record_action(db, request=request, current_user=current_user, action=action, organization_id=organization_id, project_id=project_id, target_type="template_snapshot_template", target_id=template_id, detail={"version": result["version"], "required_sections": body.get("required_sections"), "expected_draft_config_hash": body.get("expected_draft_config_hash"), "expected_preflight_artifact_hash": body.get("expected_preflight_artifact_hash"), "preflight_evidence_id": result.get("preflight_evidence_id")})
    return result


@router.post("/templates/{template_id}/versions/{version}/approve")
async def approve_template_version(
    template_id: str, version: str, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)
):
    template = await _service(db).get_template(template_id)
    # Source promotion changes every downstream baseline and is therefore an HQ-only action.
    await require_global_platform_access(current_user=current_user)
    organization_id, project_id = await _authorize_existing(db, current_user=current_user, resource=template)
    try:
        result = await _service(db).approve_template_version(template_id, version, current_user.id)
    except (KeyError, ValueError) as exc:
        raise _translate_error(exc) from exc
    await _record_action(db, request=request, current_user=current_user, action="template_snapshot_template_approved", organization_id=organization_id, project_id=project_id, target_type="template_snapshot_template", target_id=template_id, detail={"version": version})
    return result


@router.post("/templates/{template_id}/versions/{version}/review")
async def review_template_version(
    template_id: str, version: str, payload: TemplateVersionReviewRequest, request: Request,
    db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user),
):
    template = await _service(db).get_template(template_id)
    await require_global_platform_access(current_user=current_user)
    organization_id, project_id = await _authorize_existing(db, current_user=current_user, resource=template)
    try:
        result = await _service(db).review_template_version(
            template_id, version, action=payload.action, reviewer=current_user.id, note=payload.note,
        )
    except (KeyError, ValueError) as exc:
        raise _translate_error(exc) from exc
    await _record_action(
        db, request=request, current_user=current_user,
        action="template_snapshot_template_rejected" if payload.action == "reject" else "template_snapshot_template_reviewed",
        organization_id=organization_id, project_id=project_id, target_type="template_snapshot_template", target_id=template_id,
        detail={"version": version, "review_status": result["review_status"], "review_step": result["review_step"]},
    )
    return result


@router.get("/templates/{template_id}/versions")
async def list_template_versions(
    template_id: str, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)
):
    try:
        template = await _service(db).get_template(template_id)
        await _authorize_existing(db, current_user=current_user, resource=template)
        return {"items": await _service(db).list_template_versions(template_id)}
    except KeyError as exc:
        raise _translate_error(exc) from exc


@router.get("/review-queue")
async def list_review_queue(
    limit: int = Query(default=100, ge=1, le=200), db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)
):
    await require_global_platform_access(current_user=current_user)
    return {"items": await _service(db).list_review_queue(limit=limit)}


@router.get("/templates/{template_id}")
async def get_template(template_id: str, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    try:
        result = await _service(db).get_template(template_id)
    except KeyError as exc:
        raise _translate_error(exc) from exc
    await _authorize_existing(db, current_user=current_user, resource=result)
    return result


@router.get("/instances/{instance_id}")
async def get_instance(instance_id: str, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    try:
        result = await _service(db).get_instance(instance_id)
    except KeyError as exc:
        raise _translate_error(exc) from exc
    await _authorize_existing(db, current_user=current_user, resource=result)
    return result


@router.put("/instances/{instance_id}")
async def upsert_instance(
    instance_id: str, payload: InstanceUpsertRequest, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)
):
    try:
        existing = await _service(db).get_instance(instance_id)
    except KeyError:
        existing = None
    if existing is None and payload.owner_scope == "client":
        # Client-plan runtimes are created only by the tenant-provisioning
        # transaction, which binds the canonical ID, client organization,
        # project and immutable source baseline together. A browser PUT may
        # update that exact instance but must never create a half-bound second
        # runtime when the canonical record is missing.
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Client plan runtime instances must be created by tenant provisioning",
        )
    if existing is not None:
        await _authorize_existing(db, current_user=current_user, resource=existing)
    body = payload.model_dump()
    body["instance_id"] = instance_id
    if existing is not None:
        # A runtime editor updates only its effective snapshot. Tenant binding,
        # detachment state and template lineage are server-owned and must not
        # be cleared or rebound by an older browser payload.
        for field in (
            "instance_type",
            "owner_scope",
            "owner_id",
            "organization_id",
            "project_id",
            "parent_id",
            "base_template_id",
            "base_template_version",
            "is_detached",
        ):
            body[field] = existing.get(field)
    else:
        body = await _authorize_payload(db, current_user=current_user, payload=body, is_template=False)
    # Runtime template snapshots are provisioned only by headquarters.  An
    # agency can accept a published version or restore a recorded version, but
    # must never replace its baseline by posting arbitrary configuration.
    if body.get("owner_scope") == "agency":
        await require_global_platform_access(current_user=current_user)
    if existing is None and body.get("base_template_id"):
        template = await _service(db).get_template(body["base_template_id"])
        await _authorize_existing(db, current_user=current_user, resource=template)
    try:
        result = await _service(db).upsert_instance(body)
    except ValueError as exc:
        raise _translate_error(exc) from exc
    await _record_action(db, request=request, current_user=current_user, action="template_snapshot_instance_updated", organization_id=result["organization_id"], project_id=result["project_id"], target_type="template_snapshot_instance", target_id=result["instance_id"])
    return result


async def _authorized_instance(db: AsyncSession, current_user: UserResponse, instance_id: str) -> tuple[dict[str, Any], int | None, int | None]:
    instance = await _service(db).get_instance(instance_id)
    organization_id, project_id = await _authorize_existing(db, current_user=current_user, resource=instance)
    return instance, organization_id, project_id


@router.get("/instances/{instance_id}/diff-latest")
async def diff_latest(instance_id: str, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    try:
        await _authorized_instance(db, current_user, instance_id)
        return await _service(db).diff_latest(instance_id)
    except KeyError as exc:
        raise _translate_error(exc) from exc


@router.post("/instances/{instance_id}/sync-latest")
async def sync_latest(
    instance_id: str, payload: InstanceSyncLatestRequest, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)
):
    try:
        _instance, organization_id, project_id = await _authorized_instance(db, current_user, instance_id)
        body = payload.model_dump()
        body["operator"] = current_user.id
        result = await _service(db).sync_latest(instance_id, body)
    except (KeyError, ValueError) as exc:
        raise _translate_error(exc) from exc
    await _record_action(db, request=request, current_user=current_user, action="template_snapshot_instance_synced", organization_id=organization_id, project_id=project_id, target_type="template_snapshot_instance", target_id=instance_id, detail={"template_version": result["base_template_version"], "sections": body.get("sections") or []})
    return result


@router.post("/release-batches", status_code=status.HTTP_201_CREATED)
async def create_release_batch(
    payload: TemplateReleaseBatchCreateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    """Queue a server-owned rollout; clients never synchronise targets one by one."""
    await require_global_platform_access(current_user=current_user)
    service = TemplateReleaseBatchService(db)
    try:
        result = await service.create(
            template_id=payload.template_id.strip(),
            expected_version=payload.expected_template_version,
            instance_ids=payload.instance_ids,
            sections=payload.sections,
            created_by=current_user.id,
        )
        job: dict[str, Any] | None = None
        # The dev queue is process-local by design, so execute inline there.
        # Production uses the durable Redis worker and retains the queued state.
        if settings.is_development_environment:
            result = await service.process(result["id"])
        else:
            job = await enqueue_background_job("template_sync_batch", {"batch_id": result["id"]})
    except (KeyError, ValueError) as exc:
        raise _translate_error(exc) from exc
    await _record_action(
        db,
        request=request,
        current_user=current_user,
        action="template_snapshot_release_batch_created",
        organization_id=None,
        project_id=None,
        target_type="template_snapshot_release_batch",
        target_id=result["id"],
        detail={
            "template_id": result["template_id"],
            "template_version": result["template_version"],
            "sections": result["sections"],
            "targets": result["total_targets"],
        },
    )
    return {"batch": result, "job": job}


@router.post(
    "/templates/{template_id}/product-market/factory-default",
    response_model=ProductMarketFactoryDefaultResponse,
)
async def promote_product_market_factory_default(
    template_id: str,
    payload: ProductMarketFactoryDefaultPromoteRequest,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    """Promote a completed rollout; the service commits its audit atomically."""
    await require_global_platform_access(current_user=current_user)
    try:
        result = await TemplateReleaseBatchService(db).promote_product_market_factory_default(
            template_id=template_id.strip(),
            release_batch_id=payload.release_batch_id,
            contract_version=payload.contract_version,
            promoted_by=current_user.id,
        )
    except (KeyError, ValueError) as exc:
        raise _translate_error(exc) from exc
    return result


@router.get(
    "/templates/{template_id}/product-market/factory-default",
    response_model=ProductMarketFactoryDefaultResponse,
)
async def get_product_market_factory_default(
    template_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    await require_global_platform_access(current_user=current_user)
    try:
        return await TemplateReleaseBatchService(db).get_product_market_factory_default(template_id.strip())
    except (KeyError, ValueError) as exc:
        raise _translate_error(exc) from exc


@router.get("/release-batches")
async def list_release_batches(
    template_id: str | None = Query(default=None, max_length=100),
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    await require_global_platform_access(current_user=current_user)
    return {"items": await TemplateReleaseBatchService(db).list(template_id=template_id, limit=limit)}


@router.get("/release-batches/{batch_id}")
async def get_release_batch(
    batch_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    await require_global_platform_access(current_user=current_user)
    try:
        return await TemplateReleaseBatchService(db).get(batch_id)
    except KeyError as exc:
        raise _translate_error(exc) from exc


@router.post("/release-batches/{batch_id}/pause")
async def pause_release_batch(
    batch_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    await require_global_platform_access(current_user=current_user)
    try:
        result = await TemplateReleaseBatchService(db).pause(batch_id)
    except (KeyError, ValueError) as exc:
        raise _translate_error(exc) from exc
    await _record_action(db, request=request, current_user=current_user, action="template_snapshot_release_batch_paused", organization_id=None, project_id=None, target_type="template_snapshot_release_batch", target_id=batch_id)
    return result


@router.post("/release-batches/{batch_id}/retry")
async def retry_release_batch(
    batch_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    await require_global_platform_access(current_user=current_user)
    service = TemplateReleaseBatchService(db)
    try:
        result = await service.retry_failed(batch_id)
        job: dict[str, Any] | None = None
        if settings.is_development_environment:
            result = await service.process(batch_id)
        else:
            job = await enqueue_background_job("template_sync_batch", {"batch_id": batch_id})
    except (KeyError, ValueError) as exc:
        raise _translate_error(exc) from exc
    await _record_action(db, request=request, current_user=current_user, action="template_snapshot_release_batch_retried", organization_id=None, project_id=None, target_type="template_snapshot_release_batch", target_id=batch_id)
    return {"batch": result, "job": job}


@router.post("/release-batches/{batch_id}/cancel")
async def cancel_release_batch(
    batch_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    await require_global_platform_access(current_user=current_user)
    try:
        result = await TemplateReleaseBatchService(db).cancel(batch_id)
    except (KeyError, ValueError) as exc:
        raise _translate_error(exc) from exc
    await _record_action(
        db,
        request=request,
        current_user=current_user,
        action="template_snapshot_release_batch_cancelled",
        organization_id=None,
        project_id=None,
        target_type="template_snapshot_release_batch",
        target_id=batch_id,
        detail={"template_id": result["template_id"], "template_version": result["template_version"]},
    )
    return result


@router.post("/release-batches/{batch_id}/resume")
async def resume_release_batch(
    batch_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    await require_global_platform_access(current_user=current_user)
    service = TemplateReleaseBatchService(db)
    try:
        result = await service.resume(batch_id)
        job: dict[str, Any] | None = None
        if settings.is_development_environment:
            result = await service.process(batch_id)
        else:
            job = await enqueue_background_job("template_sync_batch", {"batch_id": batch_id})
    except (KeyError, ValueError) as exc:
        raise _translate_error(exc) from exc
    await _record_action(
        db,
        request=request,
        current_user=current_user,
        action="template_snapshot_release_batch_resumed",
        organization_id=None,
        project_id=None,
        target_type="template_snapshot_release_batch",
        target_id=batch_id,
    )
    return {"batch": result, "job": job}


@router.post("/instances/{instance_id}/restore-template")
async def restore_template(
    instance_id: str, payload: InstanceRestoreTemplateRequest, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)
):
    try:
        _instance, organization_id, project_id = await _authorized_instance(db, current_user, instance_id)
        body = payload.model_dump()
        body["operator"] = current_user.id
        result = await _service(db).restore_template(instance_id, body)
    except (KeyError, ValueError) as exc:
        raise _translate_error(exc) from exc
    await _record_action(db, request=request, current_user=current_user, action="template_snapshot_instance_restored", organization_id=organization_id, project_id=project_id, target_type="template_snapshot_instance", target_id=instance_id, detail={"template_version": body.get("template_version"), "target": body.get("target")})
    return result


@router.post("/instances/{instance_id}/developer-global-frame/factory-default/restore")
async def restore_developer_global_frame_factory_default(
    instance_id: str,
    payload: DeveloperGlobalFrameFactoryDefaultRestoreRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    try:
        _instance, organization_id, project_id = await _authorized_instance(db, current_user, instance_id)
        result = await _service(db).restore_developer_global_frame_factory_default(
            instance_id,
            receipt_hash=payload.receipt_hash,
            operator=current_user.id,
        )
    except (KeyError, ValueError) as exc:
        raise _translate_error(exc) from exc
    await _record_action(
        db,
        request=request,
        current_user=current_user,
        action="template_snapshot_instance_developer_global_frame_factory_default_restored",
        organization_id=organization_id,
        project_id=project_id,
        target_type="template_snapshot_instance",
        target_id=instance_id,
        detail={
            "template_version": result["receipt"]["published_version"],
            "receipt_hash": result["receipt"]["receipt_hash"],
            "target": "developer_global_frame",
            "backup_created": True,
        },
    )
    return result


@router.post("/instances/{instance_id}/detach")
async def detach_instance(
    instance_id: str, payload: InstanceDetachRequest, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)
):
    try:
        _instance, organization_id, project_id = await _authorized_instance(db, current_user, instance_id)
        result = await _service(db).detach_instance(instance_id, current_user.id)
    except KeyError as exc:
        raise _translate_error(exc) from exc
    await _record_action(db, request=request, current_user=current_user, action="template_snapshot_instance_detached", organization_id=organization_id, project_id=project_id, target_type="template_snapshot_instance", target_id=instance_id)
    return result


@router.post("/instances/{instance_id}/rebind-template")
async def rebind_instance(
    instance_id: str, payload: InstanceRebindTemplateRequest, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)
):
    try:
        _instance, organization_id, project_id = await _authorized_instance(db, current_user, instance_id)
        template = await _service(db).get_template(payload.template_id)
        await _authorize_existing(db, current_user=current_user, resource=template)
        body = payload.model_dump()
        body["operator"] = current_user.id
        result = await _service(db).rebind_instance(instance_id, body)
    except KeyError as exc:
        raise _translate_error(exc) from exc
    await _record_action(db, request=request, current_user=current_user, action="template_snapshot_instance_rebound", organization_id=organization_id, project_id=project_id, target_type="template_snapshot_instance", target_id=instance_id, detail={"template_id": payload.template_id, "template_version": payload.template_version})
    return result


@router.post("/backups", status_code=status.HTTP_201_CREATED)
async def create_backup(
    payload: BackupCreateRequest, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)
):
    # Arbitrary paths must never be introduced through a tenant-facing backup endpoint.
    await require_global_platform_access(current_user=current_user)
    body = payload.model_dump()
    body["created_by"] = current_user.id
    result = await _service(db).create_backup(body)
    await _record_action(db, request=request, current_user=current_user, action="template_snapshot_backup_registered", organization_id=None, project_id=None, target_type="template_snapshot_backup", target_id=result["backup_id"], detail={"backup_kind": result["backup_kind"]})
    return result


@router.get("/backups")
async def list_backups(
    limit: int = Query(default=100, ge=1, le=200), db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user),
):
    await require_global_platform_access(current_user=current_user)
    return {"items": await _service(db).list_backups(limit=limit)}


@router.post("/backups/{backup_id}/restore-drill")
async def record_backup_restore_drill(
    backup_id: str, payload: BackupRestoreDrillRequest, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user),
):
    await require_global_platform_access(current_user=current_user)
    try:
        result = await _service(db).record_backup_restore_drill(backup_id, operator=current_user.id, result=payload.result, note=payload.note)
    except KeyError as exc:
        raise _translate_error(exc) from exc
    await _record_action(db, request=request, current_user=current_user, action="template_snapshot_backup_restore_drill", organization_id=None, project_id=None, target_type="template_snapshot_backup", target_id=backup_id, detail={"result": payload.result})
    return result
