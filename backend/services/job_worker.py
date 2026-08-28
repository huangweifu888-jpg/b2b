"""Dedicated job-worker handlers. This module is never started by the API process."""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
import json
import logging
import os
from pathlib import Path
import subprocess
import sys
from typing import Any

from core.database import db_manager
from core.runtime_readiness import RuntimeStorageConfigurationError, resolve_runtime_storage_root
from models.platform import ContentDownloadAsset
from services.audit import record_audit_event
from services.background_jobs import acknowledge_background_job, claim_background_job, retry_background_job
from services.content_scanner import scan_file
from sqlalchemy import select


ROOT = Path(__file__).resolve().parents[2]
logger = logging.getLogger(__name__)


class PermanentJobError(ValueError):
    pass


def _worker_storage_root(variable_name: str) -> Path:
    try:
        return resolve_runtime_storage_root(
            variable_name,
            os.getenv(variable_name),
            source_root=ROOT,
        )
    except RuntimeStorageConfigurationError as exc:
        raise PermanentJobError(str(exc)) from exc


def _within(path: Path, root: Path) -> Path:
    resolved, safe_root = path.resolve(), root.resolve()
    if resolved != safe_root and safe_root not in resolved.parents:
        raise PermanentJobError("job path is outside its permitted root")
    return resolved


async def _scan_content_asset(payload: dict[str, Any]) -> dict[str, Any]:
    asset_id = str(payload.get("asset_id", "")).strip()
    if not asset_id or db_manager.async_session_maker is None:
        raise PermanentJobError("content scan requires an asset id and initialized database")
    # Kept inside the worker boundary so API requests never execute malware scanning.
    from routers.content_downloads import _asset_path, _inspect_asset

    async with db_manager.async_session_maker() as db:
        asset = await db.scalar(select(ContentDownloadAsset).where(ContentDownloadAsset.id == asset_id))
        if not asset:
            raise PermanentJobError("content asset no longer exists")
        path = _asset_path(asset.storage_key)
        if not path.is_file():
            raise PermanentJobError("content asset is unavailable")
        size_bytes, sha256, media_type = _inspect_asset(path, asset.media_type)
        scan_status, scan_detail = await asyncio.to_thread(scan_file, path)
        asset.size_bytes, asset.sha256, asset.media_type = size_bytes, sha256, media_type
        asset.scan_status, asset.scan_detail = scan_status, scan_detail
        asset.scanned_at, asset.enabled = datetime.now(timezone.utc), scan_status != "rejected"
        record_audit_event(db, action="content_download_asset_worker_scanned", actor_user_id=None, org_id=asset.client_org_id, project_id=asset.project_id, target_type="content_download_asset", target_id=asset.id, detail={"scan_status": scan_status, "size_bytes": size_bytes})
        await db.commit()
    return {"status": "completed", "scan_status": scan_status, "asset_id": asset_id}


def _run_tool(script: str, path: Path, root: Path, arguments: tuple[str, ...]) -> dict[str, Any]:
    target = _within(path, root)
    completed = subprocess.run([sys.executable, str(ROOT / "tools" / script), *arguments, str(target)], cwd=ROOT, capture_output=True, text=True, timeout=180, check=False, shell=False)
    try:
        payload = json.loads(completed.stdout)
    except json.JSONDecodeError:
        payload = {"status": "failed"}
    if completed.returncode != 0:
        raise PermanentJobError(f"{script} rejected the requested artifact")
    return {"status": "completed", "verification": payload.get("status", "verified")}


async def execute_job(job: dict[str, Any]) -> dict[str, Any]:
    payload = job.get("payload")
    if not isinstance(payload, dict):
        raise PermanentJobError("job payload must be an object")
    if job["type"] == "content_scan":
        return await _scan_content_asset(payload)
    if job["type"] == "backup_verify":
        backup_root = _worker_storage_root("BACKUP_WORKER_ROOT")
        return await asyncio.to_thread(_run_tool, "verify_sqlite_restore_drill.py", Path(str(payload.get("backup_path", ""))), backup_root, ("--backup",))
    if job["type"] == "release_smoke_check":
        artifact_root = _worker_storage_root("RELEASE_ARTIFACT_ROOT")
        return await asyncio.to_thread(_run_tool, "verify_release_bundle.py", Path(str(payload.get("artifact_path", ""))), artifact_root, ())
    if job["type"] == "template_sync_batch":
        batch_id = str(payload.get("batch_id", "")).strip()
        if not batch_id or db_manager.async_session_maker is None:
            raise PermanentJobError("template release batch requires a batch id and initialized database")
        from services.template_release_batches import TemplateReleaseBatchService

        async with db_manager.async_session_maker() as db:
            service = TemplateReleaseBatchService(db)
            result = await service.process(batch_id)
            # A recovered Redis job can arrive before a crashed target lease
            # expires.  Keep the raw job unacknowledged and automatically
            # revisit the durable batch after the lease instead of returning a
            # misleading successful `running` result that would strand it.
            while result.get("status") == "running":
                retry_after = result.get("retry_after_seconds")
                if not retry_after:
                    raise RuntimeError("Running template batch omitted durable lease retry metadata")
                await asyncio.sleep(max(1, int(retry_after)))
                result = await service.process(batch_id)
        return {"status": result["status"], "batch_id": batch_id, "succeeded": result["succeeded_targets"], "failed": result["failed_targets"]}
    raise PermanentJobError("unsupported job type")


async def _oldest_unfinished_template_batch_job() -> dict[str, Any] | None:
    """Recover a committed rollout that never reached the external queue.

    The API deliberately does not call this helper.  It belongs to the
    dedicated worker's idle path, after the Redis claim has timed out.  More
    than one worker may discover the same batch; ``TemplateReleaseBatchService``
    owns the durable target leases and idempotent completed-batch handling.
    """
    session_factory = db_manager.async_session_maker
    if session_factory is None:
        return None

    from models.template_snapshot import TemplateSnapshotReleaseBatch

    async with session_factory() as db:
        batch_id = await db.scalar(
            select(TemplateSnapshotReleaseBatch.id)
            .where(
                TemplateSnapshotReleaseBatch.status.in_(("queued", "running")),
                TemplateSnapshotReleaseBatch.completed_at.is_(None),
            )
            .order_by(
                TemplateSnapshotReleaseBatch.created_at.asc(),
                TemplateSnapshotReleaseBatch.id.asc(),
            )
            .limit(1)
        )
    if not batch_id:
        return None
    return {
        "id": f"db-template-sync-batch:{batch_id}",
        "type": "template_sync_batch",
        "payload": {"batch_id": str(batch_id)},
        "attempt": 0,
    }


class JobWorker:
    async def process_one(self, timeout_seconds: int = 5) -> bool:
        try:
            claimed = await claim_background_job(timeout_seconds)
        except Exception as exc:
            logger.warning("Background queue claim failed; checking durable template batches: %s", type(exc).__name__)
            claimed = None
        if not claimed:
            try:
                recovered_job = await _oldest_unfinished_template_batch_job()
            except Exception as exc:
                logger.warning("Durable template batch discovery failed: %s", type(exc).__name__)
                return False
            if recovered_job is None:
                return False
            try:
                await execute_job(recovered_job)
            except Exception as exc:
                # The batch row remains the source of truth.  A queued row or
                # an expired running lease will be discovered again on the
                # next idle cycle without requiring another browser request.
                logger.warning("Durable template batch execution will retry: %s", type(exc).__name__)
                return False
            return True
        job, raw = claimed
        try:
            result = await execute_job(job)
        except PermanentJobError as exc:
            await acknowledge_background_job(raw, {"status": "failed", "reason": str(exc), "attempt": job.get("attempt", 0)})
        except Exception as exc:
            await retry_background_job(raw, job, type(exc).__name__)
        else:
            await acknowledge_background_job(raw, result)
        return True
