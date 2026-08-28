"""Local-only source snapshots for the external development tools.

This router deliberately accepts no filesystem path from the browser.  It can
only restore a validated W release stored under the fixed local release folder,
and always moves the current source into a timestamped recovery folder first.
"""

from __future__ import annotations

from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import shutil
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request

from core.path_registry import get_path_registry
from core.runtime_security import require_local_development_request


router = APIRouter(
    prefix="/api/v1/local-dev/devtools-versions",
    tags=["local-dev"],
    dependencies=[Depends(require_local_development_request)],
)

PATHS = get_path_registry()
DEVTOOLS_ROOT = PATHS.misc_files_root / "tradepro-devtools"
SOURCE_DIRECTORY = DEVTOOLS_ROOT / "frontend"
VERSION_FILE = DEVTOOLS_ROOT / "VERSION.json"
RELEASES_DIRECTORY = DEVTOOLS_ROOT / "releases"
RECOVERY_DIRECTORY = DEVTOOLS_ROOT / "recovery"
VERSION_PATTERN = re.compile(r"W[1-9]\d*")
LOOPBACK_HOSTS = {"127.0.0.1", "::1", "localhost"}


def _require_loopback(request: Request) -> None:
    client = request.client
    host = client.host if client else ""
    if host not in LOOPBACK_HOSTS:
        raise HTTPException(status_code=403, detail="外置开发工具源码恢复只允许本机访问。")


def _read_json(path: Path) -> dict:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    return payload if isinstance(payload, dict) else {}


def _validated_version(version: str) -> str:
    if not VERSION_PATTERN.fullmatch(version):
        raise HTTPException(status_code=400, detail="版本号必须是 W1、W2 这样的连续 W 编号。")
    return version


def _release_directory(version: str) -> Path:
    candidate = (RELEASES_DIRECTORY / version).resolve()
    root = RELEASES_DIRECTORY.resolve()
    if candidate.parent != root:
        raise HTTPException(status_code=400, detail="无效的版本快照位置。")
    return candidate


def _release_payload(version: str) -> dict:
    release_directory = _release_directory(version)
    manifest = _read_json(release_directory / "manifest.json")
    snapshot_version = _read_json(release_directory / "VERSION.json")
    source_snapshot = release_directory / "frontend"
    available = (
        source_snapshot.is_dir()
        and bool(manifest)
        and manifest.get("version") == version
        and snapshot_version.get("version") == version
    )
    return {
        "version": version,
        "available": available,
        "title": manifest.get("title") or snapshot_version.get("title") or "历史版本",
        "summary": manifest.get("summary") or snapshot_version.get("summary") or "",
        "updatedAt": manifest.get("updatedAt") or snapshot_version.get("updatedAt") or "",
        "snapshotCreatedAt": manifest.get("snapshotCreatedAt") or "",
    }


@router.get("")
def list_devtools_versions(request: Request):
    _require_loopback(request)
    releases: list[dict] = []
    if RELEASES_DIRECTORY.is_dir():
        for entry in RELEASES_DIRECTORY.iterdir():
            if entry.is_dir() and VERSION_PATTERN.fullmatch(entry.name):
                releases.append(_release_payload(entry.name))
    releases.sort(key=lambda item: int(item["version"][1:]), reverse=True)
    return {
        "current": _read_json(VERSION_FILE),
        "releases": releases,
        "localOnly": True,
    }


@router.post("/{version}/restore")
def restore_devtools_version(version: str, request: Request):
    """Restore one local W source snapshot after the browser has confirmed it."""

    _require_loopback(request)
    version = _validated_version(version)
    release_directory = _release_directory(version)
    source_snapshot = release_directory / "frontend"
    snapshot_version_file = release_directory / "VERSION.json"
    manifest = _read_json(release_directory / "manifest.json")
    snapshot_version = _read_json(snapshot_version_file)
    if (
        not source_snapshot.is_dir()
        or manifest.get("version") != version
        or snapshot_version.get("version") != version
    ):
        raise HTTPException(status_code=404, detail=f"{version} 没有可安全恢复的本地源码快照。")
    if not SOURCE_DIRECTORY.is_dir() or not VERSION_FILE.is_file():
        raise HTTPException(status_code=409, detail="当前外置开发工具源码或版本文件不存在，已停止恢复以保护文件。")

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    recovery_directory = RECOVERY_DIRECTORY / f"{timestamp}-before-{version}"
    staging_directory = DEVTOOLS_ROOT / f".restore-staging-{uuid4().hex}"
    recovery_source = recovery_directory / "frontend"
    staging_source = staging_directory / "frontend"
    staged_version = staging_directory / "VERSION.json"

    try:
        RECOVERY_DIRECTORY.mkdir(parents=True, exist_ok=True)
        staging_directory.mkdir(parents=True, exist_ok=False)
        shutil.copytree(source_snapshot, staging_source)
        shutil.copy2(snapshot_version_file, staged_version)

        recovery_directory.mkdir(parents=True, exist_ok=False)
        shutil.copy2(VERSION_FILE, recovery_directory / "VERSION.json")
        shutil.move(str(SOURCE_DIRECTORY), str(recovery_source))
        try:
            shutil.move(str(staging_source), str(SOURCE_DIRECTORY))
            os.replace(staged_version, VERSION_FILE)
        except Exception:
            if SOURCE_DIRECTORY.exists():
                shutil.rmtree(SOURCE_DIRECTORY, ignore_errors=True)
            if recovery_source.exists():
                shutil.move(str(recovery_source), str(SOURCE_DIRECTORY))
            backup_version = recovery_directory / "VERSION.json"
            if backup_version.exists():
                shutil.copy2(backup_version, VERSION_FILE)
            raise

        (recovery_directory / "restore.json").write_text(
            json.dumps(
                {
                    "restoredVersion": version,
                    "restoredAt": datetime.now(timezone.utc).isoformat(),
                    "previousVersion": _read_json(recovery_directory / "VERSION.json").get("version", ""),
                    "kind": "local-devtools-recovery",
                }, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"恢复失败，当前源码已尽量回滚：{exc}") from exc
    finally:
        shutil.rmtree(staging_directory, ignore_errors=True)

    return {
        "ok": True,
        "restoredVersion": version,
        "recoveryId": recovery_directory.name,
        "restartRequired": True,
        "message": f"已恢复 {version}，恢复前源码已保存。请刷新页面；若开发服务未自动更新，再重启本地环境。",
    }
