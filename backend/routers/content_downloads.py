"""Private asset metadata and short-lived download tickets for plan content."""

from __future__ import annotations

import base64
from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import json
import mimetypes
import os
from pathlib import Path, PurePosixPath
from typing import Optional
from uuid import uuid4

from core.config import settings
from core.database import get_db
from core.runtime_readiness import RuntimeStorageConfigurationError, resolve_runtime_storage_root
from dependencies.auth import get_current_user
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import FileResponse
from models.platform import ContentDownloadAsset
from pydantic import BaseModel, Field
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.content_scanner import CLEAN_SCAN_STATUS as _CLEAN_SCAN_STATUS, scan_file
from services.background_jobs import enqueue_background_job
from middlewares.request_security import rate_limit_backend
from services.tenant_access import require_project_access, resolve_project_context
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


router = APIRouter(prefix="/api/v1/content-downloads", tags=["content-downloads"])
_ALLOWED_VISIBILITIES = {"public", "authenticated"}
_DEFAULT_ALLOWED_EXTENSIONS = {".pdf", ".csv", ".docx", ".xlsx", ".pptx", ".zip", ".png", ".jpg", ".jpeg", ".webp"}


class AssetCreate(BaseModel):
    storage_key: str = Field(..., min_length=1, max_length=1000)
    display_name: str = Field(..., min_length=1, max_length=500)
    media_type: Optional[str] = Field(default=None, max_length=255)
    visibility: str = Field(default="authenticated")


def _asset_root() -> Path:
    configured = os.getenv("ASSET_STORAGE_ROOT")
    if configured is None:
        configured = settings.asset_storage_root
    try:
        return resolve_runtime_storage_root("ASSET_STORAGE_ROOT", configured)
    except RuntimeStorageConfigurationError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc


def _safe_storage_key(value: str) -> str:
    normalized = str(value or "").replace("\\", "/").strip("/")
    path = PurePosixPath(normalized)
    if not normalized or path.is_absolute() or any(part in {"", ".", ".."} for part in path.parts):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid storage key")
    return path.as_posix()


def _asset_path(storage_key: str) -> Path:
    root = _asset_root()
    candidate = (root / _safe_storage_key(storage_key)).resolve()
    if root != candidate and root not in candidate.parents:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Storage key escaped asset root")
    return candidate


def _allowed_extensions() -> set[str]:
    configured = os.getenv("CONTENT_DOWNLOAD_ALLOWED_EXTENSIONS", "")
    values = configured.split(",") if configured else _DEFAULT_ALLOWED_EXTENSIONS
    return {value.strip().lower() if value.strip().startswith(".") else f".{value.strip().lower()}" for value in values if value.strip()}


def _max_asset_bytes() -> int:
    try:
        configured = int(os.getenv("CONTENT_DOWNLOAD_MAX_BYTES", str(50 * 1024 * 1024)))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Invalid download size policy") from exc
    if configured <= 0:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Invalid download size policy")
    return configured


def _hash_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _inspect_asset(path: Path, requested_media_type: Optional[str]) -> tuple[int, str, str]:
    extension = path.suffix.lower()
    if extension not in _allowed_extensions():
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="File type is not allowed for content downloads")
    size_bytes = path.stat().st_size
    if size_bytes <= 0 or size_bytes > _max_asset_bytes():
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="File size is outside the allowed download policy")
    detected_media_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    if requested_media_type and requested_media_type != detected_media_type:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Declared media type does not match file extension")
    return size_bytes, _hash_file(path), requested_media_type or detected_media_type


def _scan_asset(path: Path) -> tuple[str, str]:
    return scan_file(path)


def _safe_display_name(value: str) -> str:
    normalized = Path(value.strip()).name
    if not normalized or normalized in {".", ".."}:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid download file name")
    return normalized


async def _audit_download(
    db: AsyncSession,
    *,
    action: str,
    asset: ContentDownloadAsset,
    actor_user_id: Optional[str],
    request: Request,
    detail: Optional[dict[str, object]] = None,
) -> None:
    record_audit_event(
        db,
        actor_user_id=actor_user_id,
        org_id=asset.client_org_id,
        project_id=asset.project_id,
        action=action,
        target_type="content_download_asset",
        target_id=asset.id,
        ip_address=request.client.host if request.client else None,
        detail=detail,
    )


def _ticket_secret() -> bytes:
    secret = os.getenv("CONTENT_DOWNLOAD_SECRET")
    environment = os.getenv("ENVIRONMENT", "dev").lower()
    if not secret and environment not in {"dev", "test", "local"}:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Download ticket secret is not configured")
    return (secret or "local-development-download-secret").encode("utf-8")


def _encode_ticket(asset: ContentDownloadAsset) -> str:
    expires = int((datetime.now(timezone.utc) + timedelta(seconds=int(os.getenv("DOWNLOAD_URL_TTL_SECONDS", "300")))).timestamp())
    payload = {"asset_id": asset.id, "project_id": asset.project_id, "expires": expires}
    encoded = base64.urlsafe_b64encode(json.dumps(payload, separators=(",", ":")).encode("utf-8")).decode("ascii").rstrip("=")
    signature = hmac.new(_ticket_secret(), encoded.encode("ascii"), hashlib.sha256).hexdigest()
    return f"{encoded}.{signature}"


def _decode_ticket(ticket: str) -> dict[str, int | str]:
    try:
        encoded, signature = ticket.rsplit(".", 1)
        expected = hmac.new(_ticket_secret(), encoded.encode("ascii"), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, expected):
            raise ValueError("signature")
        padded = encoded + "=" * (-len(encoded) % 4)
        payload = json.loads(base64.urlsafe_b64decode(padded.encode("ascii")))
        if int(payload["expires"]) < int(datetime.now(timezone.utc).timestamp()):
            raise ValueError("expired")
        return payload
    except (ValueError, KeyError, json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Download ticket is invalid or expired") from exc


def _serialize(asset: ContentDownloadAsset) -> dict[str, object]:
    return {
        "id": asset.id,
        "project_id": asset.project_id,
        "display_name": asset.display_name,
        "media_type": asset.media_type,
        "visibility": asset.visibility,
        "enabled": asset.enabled,
        "size_bytes": asset.size_bytes,
        "scan_status": asset.scan_status,
        "scan_detail": asset.scan_detail,
        "scanned_at": asset.scanned_at,
    }


@router.get("/public/projects/{project_id}/assets")
async def list_public_assets(project_id: int, db: AsyncSession = Depends(get_db)):
    await resolve_project_context(db, project_id)
    assets = (
        await db.execute(
            select(ContentDownloadAsset).where(
                ContentDownloadAsset.project_id == project_id,
                ContentDownloadAsset.enabled.is_(True),
                ContentDownloadAsset.visibility == "public",
                ContentDownloadAsset.scan_status == _CLEAN_SCAN_STATUS,
            ).order_by(ContentDownloadAsset.created_at.desc())
        )
    ).scalars().all()
    return {"items": [_serialize(asset) for asset in assets]}


@router.get("/projects/{project_id}/assets")
async def list_assets(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    await require_project_access(db, current_user=current_user, project_id=project_id)
    assets = (
        await db.execute(
            select(ContentDownloadAsset).where(ContentDownloadAsset.project_id == project_id).order_by(ContentDownloadAsset.created_at.desc())
        )
    ).scalars().all()
    return {"items": [_serialize(asset) for asset in assets]}


@router.post("/projects/{project_id}/assets", status_code=status.HTTP_201_CREATED)
async def register_asset(
    project_id: int,
    payload: AssetCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    resolved = await require_project_access(db, current_user=current_user, project_id=project_id)
    if payload.visibility not in _ALLOWED_VISIBILITIES:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Unsupported visibility")
    storage_key = _safe_storage_key(payload.storage_key)
    path = _asset_path(storage_key)
    if not path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset does not exist in private storage")
    size_bytes, sha256, media_type = _inspect_asset(path, payload.media_type)
    scan_status, scan_detail = _scan_asset(path)
    asset = ContentDownloadAsset(
        id=uuid4().hex,
        project_id=project_id,
        client_org_id=resolved.client.id,
        storage_key=storage_key,
        display_name=_safe_display_name(payload.display_name),
        media_type=media_type,
        visibility=payload.visibility,
        enabled=scan_status != "rejected",
        size_bytes=size_bytes,
        sha256=sha256,
        scan_status=scan_status,
        scan_detail=scan_detail,
        scanned_at=datetime.now(timezone.utc),
        created_by=current_user.id,
    )
    db.add(asset)
    await db.flush()
    await _audit_download(
        db,
        action="content_download_asset_registered",
        asset=asset,
        actor_user_id=current_user.id,
        request=request,
        detail={"scan_status": scan_status, "size_bytes": size_bytes},
    )
    await db.commit()
    await db.refresh(asset)
    return _serialize(asset)


async def _get_active_asset(db: AsyncSession, asset_id: str) -> ContentDownloadAsset:
    asset = await db.scalar(select(ContentDownloadAsset).where(ContentDownloadAsset.id == asset_id, ContentDownloadAsset.enabled.is_(True)))
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Download asset not found")
    return asset


def _ensure_asset_unchanged(asset: ContentDownloadAsset) -> Path:
    path = _asset_path(asset.storage_key)
    if not path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Download file is unavailable")
    size_bytes, sha256, _media_type = _inspect_asset(path, asset.media_type)
    if asset.size_bytes != size_bytes or not asset.sha256 or not hmac.compare_digest(asset.sha256, sha256):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Download file changed after security review")
    return path


async def _require_clean_asset(db: AsyncSession, asset_id: str) -> ContentDownloadAsset:
    asset = await _get_active_asset(db, asset_id)
    if asset.scan_status != _CLEAN_SCAN_STATUS:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Download asset is pending or failed security scanning")
    _ensure_asset_unchanged(asset)
    return asset


@router.post("/assets/{asset_id}/scan")
async def rescan_asset(
    asset_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    asset = await db.scalar(select(ContentDownloadAsset).where(ContentDownloadAsset.id == asset_id))
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Download asset not found")
    await require_project_access(db, current_user=current_user, project_id=asset.project_id)
    path = _asset_path(asset.storage_key)
    if not path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset is unavailable for scanning")
    if rate_limit_backend() == "redis":
        # Production scanning belongs to the separate worker. Pending remains fail-closed for download tickets.
        asset.scan_status = "pending"
        asset.scan_detail = "queued-for-worker"
        asset.scanned_at = None
        await _audit_download(db, action="content_download_asset_rescan_queued", asset=asset, actor_user_id=current_user.id, request=request, detail={"scan_status": "pending"})
        await db.commit()
        try:
            job = await enqueue_background_job("content_scan", {"asset_id": asset.id})
        except Exception as exc:
            asset.scan_detail = "worker-queue-unavailable"
            await db.commit()
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Content scan queue is temporarily unavailable") from exc
        await db.refresh(asset)
        return {**_serialize(asset), "job_id": job["id"]}
    size_bytes, sha256, media_type = _inspect_asset(path, asset.media_type)
    scan_status, scan_detail = _scan_asset(path)
    asset.size_bytes = size_bytes
    asset.sha256 = sha256
    asset.media_type = media_type
    asset.scan_status = scan_status
    asset.scan_detail = scan_detail
    asset.scanned_at = datetime.now(timezone.utc)
    asset.enabled = scan_status != "rejected"
    await _audit_download(
        db,
        action="content_download_asset_rescanned",
        asset=asset,
        actor_user_id=current_user.id,
        request=request,
        detail={"scan_status": scan_status, "size_bytes": size_bytes},
    )
    await db.commit()
    await db.refresh(asset)
    return _serialize(asset)


@router.post("/assets/{asset_id}/ticket")
async def create_private_ticket(
    asset_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    asset = await _get_active_asset(db, asset_id)
    await require_project_access(db, current_user=current_user, project_id=asset.project_id)
    if asset.scan_status != _CLEAN_SCAN_STATUS:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Download asset is pending or failed security scanning")
    _ensure_asset_unchanged(asset)
    await _audit_download(
        db,
        action="content_download_ticket_issued",
        asset=asset,
        actor_user_id=current_user.id,
        request=request,
        detail={"visibility": asset.visibility},
    )
    await db.commit()
    return {"download_url": f"/api/v1/content-downloads/tickets/{_encode_ticket(asset)}"}


@router.post("/public/assets/{asset_id}/ticket")
async def create_public_ticket(asset_id: str, request: Request, db: AsyncSession = Depends(get_db)):
    asset = await _require_clean_asset(db, asset_id)
    if asset.visibility != "public":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Asset is not public")
    await _audit_download(
        db,
        action="content_download_public_ticket_issued",
        asset=asset,
        actor_user_id=None,
        request=request,
        detail={"visibility": asset.visibility},
    )
    await db.commit()
    return {"download_url": f"/api/v1/content-downloads/tickets/{_encode_ticket(asset)}"}


@router.get("/tickets/{ticket}")
async def download_ticket(ticket: str, request: Request, db: AsyncSession = Depends(get_db)):
    payload = _decode_ticket(ticket)
    asset = await _require_clean_asset(db, str(payload["asset_id"]))
    if asset.project_id != int(payload["project_id"]):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Download ticket does not match asset")
    path = _ensure_asset_unchanged(asset)
    await _audit_download(
        db,
        action="content_download_served",
        asset=asset,
        actor_user_id=None,
        request=request,
        detail={"visibility": asset.visibility},
    )
    await db.commit()
    return FileResponse(path=path, media_type=asset.media_type or "application/octet-stream", filename=asset.display_name)
