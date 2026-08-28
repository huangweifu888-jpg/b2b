from __future__ import annotations

import json
import shutil
from pathlib import Path
from typing import Any, Literal

from fastapi import APIRouter
from pydantic import BaseModel

from core.path_registry import get_path_registry, move_json_files, remove_empty_directory, sanitize_folder_name

router = APIRouter(prefix="/api/v1/version-backups", tags=["version-backups"])

ProgramScope = Literal["hq", "agency", "client"]
SiteScope = Literal["client", "agency", "hq"]
ACTIVE_PROGRAM_BACKUP_SCOPES: tuple[ProgramScope, ...] = ("hq",)
ALL_PROGRAM_SCOPES: tuple[ProgramScope, ...] = ("hq", "agency", "client")


class ProgramVersionPayload(BaseModel):
    id: str
    scope: ProgramScope
    createdAt: str
    config: dict[str, Any]
    source: str | None = None
    title: str | None = None
    summary: str | None = None
    aiHtml: str | None = None


class SiteVersionPayload(BaseModel):
    id: str
    siteId: str
    scope: SiteScope
    createdAt: str
    siteName: str
    builderState: dict[str, Any]
    html: str
    summary: str | None = None
    agencyCode: str | None = None
    agencyName: str | None = None
    clientCode: str | None = None
    clientName: str | None = None
    planCode: str | None = None
    planName: str | None = None


def _write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def _read_json(path: Path, fallback: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return fallback


def _is_valid_program_version_payload(payload: Any) -> bool:
    if not isinstance(payload, dict):
        return False
    config = payload.get("config")
    if not isinstance(config, dict):
        return False
    products = config.get("products")
    return isinstance(products, list) and len(products) > 0


def _version_number(value: str, fallback: int = 0) -> int:
    digits = "".join(ch for ch in value if ch.isdigit())
    return int(digits or fallback)


def _sorted_program_files(scope: ProgramScope) -> list[Path]:
    if scope not in ACTIVE_PROGRAM_BACKUP_SCOPES:
        return []
    paths = get_path_registry()
    folder = paths.program_backup_root / scope
    folder.mkdir(parents=True, exist_ok=True)
    return sorted(
        folder.glob("H*.json"),
        key=lambda item: (_version_number(item.stem), item.stat().st_mtime),
        reverse=True,
    )


def _site_index_path() -> Path:
    return get_path_registry().site_backup_root / "_site_index.json"


def _read_site_index() -> dict[str, dict[str, Any]]:
    return _read_json(_site_index_path(), {})


def _write_site_index(payload: dict[str, dict[str, Any]]) -> None:
    _write_json(_site_index_path(), payload)


def _published_sites_path() -> Path:
    return get_path_registry().backend_root / "published_sites.json"


def _read_published_sites() -> list[dict[str, Any]]:
    return _read_json(_published_sites_path(), [])


def _published_site_map() -> dict[str, dict[str, Any]]:
    items = _read_published_sites()
    return {
        str(item.get("id")): item
        for item in items
        if isinstance(item, dict) and item.get("id")
    }


def _safe_site_segment(value: str | None, fallback: str) -> str:
    cleaned = sanitize_folder_name(value or "", fallback=fallback).replace(" ", "-")
    cleaned = cleaned.strip(".-")
    return cleaned or fallback


def _looks_corrupted_text(value: str | None) -> bool:
    if value is None:
        return True
    text = str(value).strip()
    if not text:
        return True
    if "?" in text:
        return True
    return any(token in text for token in ("�", "Ã", "Â", "æ", "ç", "è", "é", "ê", "ë"))


def _clean_site_meta_text(value: str | None, fallback: str) -> str:
    if _looks_corrupted_text(value):
        return fallback
    return str(value)


def _site_label(code: str | None, name: str | None, fallback_code: str, fallback_name: str) -> str:
    return f"{_safe_site_segment(code, fallback_code)}-{_safe_site_segment(name, fallback_name)}"


def _site_folder_parts(meta: dict[str, Any]) -> list[str]:
    return [
        _site_label(meta.get("agencyCode"), _clean_site_meta_text(meta.get("agencyName"), "???"), "D000", "agency"),
        _site_label(meta.get("clientCode"), _clean_site_meta_text(meta.get("clientName"), "??"), "K000", "client"),
        _site_label(meta.get("planCode"), _clean_site_meta_text(meta.get("planName") or meta.get("siteName"), "??"), "J000", "plan"),
    ]


def _site_folder_from_meta(meta: dict[str, Any]) -> Path:
    folder = get_path_registry().site_backup_root
    for part in _site_folder_parts(meta):
        folder = folder / part
    folder.mkdir(parents=True, exist_ok=True)
    return folder


def _site_relative_folder(meta: dict[str, Any]) -> str:
    return str(Path(*_site_folder_parts(meta))).replace("\\", "/")


def _resolve_site_meta(site_id: str, payload: SiteVersionPayload | None = None) -> dict[str, Any]:
    published = _published_site_map().get(site_id, {})
    site_name = (payload.siteName if payload else None) or published.get("name") or "?????"
    agency_name = _clean_site_meta_text((payload.agencyName if payload else None) or published.get("agencyName"), "???")
    client_name = _clean_site_meta_text((payload.clientName if payload else None) or published.get("clientName"), "??")
    plan_name = _clean_site_meta_text(
        (payload.planName if payload else None) or published.get("planName") or (payload.siteName if payload else None),
        "??",
    )
    return {
        "siteId": site_id,
        "siteName": site_name,
        "scope": (payload.scope if payload else None) or published.get("scope") or "client",
        "agencyCode": (payload.agencyCode if payload else None) or published.get("agencyCode"),
        "agencyName": agency_name,
        "clientCode": (payload.clientCode if payload else None) or published.get("clientCode"),
        "clientName": client_name,
        "planCode": (payload.planCode if payload else None) or published.get("planCode"),
        "planName": plan_name,
    }


def _resolve_site_folder(site_id: str, payload: SiteVersionPayload | None = None) -> tuple[Path, dict[str, Any]]:
    index = _read_site_index()
    existing = index.get(site_id, {})
    meta = {**existing, **_resolve_site_meta(site_id, payload)}
    meta.pop("folderName", None)
    folder = _site_folder_from_meta(meta)
    meta["relativeFolder"] = _site_relative_folder(meta)
    index[site_id] = meta
    _write_site_index(index)
    return folder, meta


def _normalize_site_version_payload(path: Path) -> Path:
    payload = _read_json(path, {})
    if not isinstance(payload, dict):
        return path

    normalized_id = path.stem
    if normalized_id.upper().startswith("A"):
        normalized_id = f"J{_version_number(normalized_id)}"
    payload["id"] = normalized_id

    normalized_path = path.with_name(f"{normalized_id}.json")
    _write_json(normalized_path, payload)
    if normalized_path.resolve() != path.resolve():
        path.unlink(missing_ok=True)
    return normalized_path


def _normalize_site_version_files(folder: Path) -> None:
    for path in list(folder.glob("*.json")):
        if path.name.lower() == "site.json":
            continue
        _normalize_site_version_payload(path)


def _sorted_site_files(folder: Path) -> list[Path]:
    _normalize_site_version_files(folder)
    files = list(folder.glob("*.json"))
    return sorted(
        [path for path in files if path.name.lower() != "site.json"],
        key=lambda item: (_version_number(item.stem), item.stat().st_mtime),
        reverse=True,
    )


def _prune_version_files(files: list[Path], limit: int = 10) -> None:
    for extra in files[limit:]:
        extra.unlink(missing_ok=True)


def _prune_all_program_versions(limit: int = 10) -> None:
    for scope in ACTIVE_PROGRAM_BACKUP_SCOPES:
        _prune_version_files(_sorted_program_files(scope), limit)


def _remove_empty_parents(path: Path, stop_at: Path) -> None:
    current = path
    stop = stop_at.resolve()
    while current.exists():
        try:
            current_resolved = current.resolve()
        except Exception:
            break
        if current_resolved == stop:
            break
        remove_empty_directory(current)
        current = current.parent


def _legacy_folder_candidates(raw_meta: dict[str, Any], root: Path) -> list[Path]:
    legacy_scope = str(raw_meta.get("scope") or "client")
    legacy_name = str(raw_meta.get("folderName") or "")
    legacy_relative = str(raw_meta.get("relativeFolder") or "")
    candidates: list[Path] = []
    if legacy_name:
        candidates.append(root / legacy_scope / legacy_name)
    if legacy_relative:
        candidates.append(root / Path(legacy_relative))
    return candidates


def _move_site_json_files(source: Path, target: Path) -> None:
    if not source.exists() or source.resolve() == target.resolve():
        return
    target.mkdir(parents=True, exist_ok=True)
    for json_file in source.glob("*.json"):
        destination = target / json_file.name
        if destination.exists():
            continue
        shutil.move(str(json_file), str(destination))
    remove_empty_directory(source)


def _migrate_existing_site_backup_tree() -> None:
    root = get_path_registry().site_backup_root
    published_map = _published_site_map()
    raw_index = _read_site_index()
    normalized_index: dict[str, dict[str, Any]] = {}
    target_lookup: dict[str, Path] = {}
    changed = False

    for site_id, published in published_map.items():
        meta = {**raw_index.get(site_id, {}), **_resolve_site_meta(site_id)}
        meta.pop("folderName", None)
        meta["relativeFolder"] = _site_relative_folder(meta)
        normalized_index[site_id] = meta
        target_folder = _site_folder_from_meta(meta)
        target_lookup[_safe_site_segment(str(published.get("slug") or ""), "site").lower()] = target_folder
        target_lookup[_safe_site_segment(str(published.get("name") or ""), "site").lower()] = target_folder
        if meta.get("planName"):
            target_lookup[_safe_site_segment(str(meta["planName"]), "plan").lower()] = target_folder

    for site_id, raw_meta in list(raw_index.items()):
        if site_id not in normalized_index:
            continue
        target_folder = _site_folder_from_meta(normalized_index[site_id])
        for source in _legacy_folder_candidates(raw_meta, root):
            if not source.exists():
                continue
            _move_site_json_files(source, target_folder)
            _remove_empty_parents(source.parent, root)
            changed = True

    legacy_root = root / "_legacy_orphaned"
    for base in (root / "client", root / "D000-agency" / "K000-client"):
        if not base.exists():
            continue
        for source in sorted(base.iterdir()):
            if not source.is_dir():
                continue
            lookup_key = _safe_site_segment(source.name, "legacy").lower()
            target = target_lookup.get(lookup_key)
            if target is None:
                target = legacy_root / _safe_site_segment(source.name, "legacy")
            _move_site_json_files(source, target)
            changed = True
        _remove_empty_parents(base, root)

    for site_id, meta in normalized_index.items():
        folder = _site_folder_from_meta(meta)
        _normalize_site_version_files(folder)
        meta["relativeFolder"] = _site_relative_folder(meta)
        normalized_index[site_id] = meta

    if changed or normalized_index != raw_index:
        _write_site_index(normalized_index)


def _cleanup_site_backup_root() -> None:
    root = get_path_registry().site_backup_root
    valid_folders = {
        (root / meta.get("relativeFolder", "")).resolve()
        for meta in _read_site_index().values()
        if meta.get("relativeFolder")
    }
    legacy_root = (root / "_legacy_orphaned").resolve()

    for candidate in root.glob("*/*/*"):
        if not candidate.is_dir():
            continue
        resolved = candidate.resolve()
        if resolved in valid_folders:
            continue
        if legacy_root in resolved.parents:
            continue
        if any(candidate.glob("*.json")):
            orphan_target = legacy_root / _safe_site_segment(candidate.name, "legacy")
            orphan_target.mkdir(parents=True, exist_ok=True)
            for json_file in candidate.glob("*.json"):
                destination = orphan_target / json_file.name
                if destination.exists():
                    continue
                shutil.move(str(json_file), str(destination))
        remove_empty_directory(candidate)

    for directory in sorted(root.rglob("*"), reverse=True):
        if not directory.is_dir():
            continue
        if directory == root or directory.resolve() == legacy_root:
            continue
        remove_empty_directory(directory)


def _prune_all_site_versions(limit: int = 10) -> None:
    _migrate_existing_site_backup_tree()
    index = _read_site_index()
    for site_id, meta in list(index.items()):
        folder = _site_folder_from_meta(meta)
        if not folder.exists():
            index.pop(site_id, None)
            continue
        _prune_version_files(_sorted_site_files(folder), limit)
        meta["relativeFolder"] = _site_relative_folder(meta)
        meta.pop("folderName", None)
        index[site_id] = meta
    _write_site_index(index)
    _cleanup_site_backup_root()


def _migrate_legacy_backups() -> dict[str, int]:
    paths = get_path_registry()
    legacy_program_dirs = [
        paths.project_root / "backups" / "program_versions",
        paths.app_root / "version_backups" / "program",
        paths.backend_root / "version_backups" / "program",
    ]
    legacy_site_dirs = [
        paths.project_root / "backups" / "site_versions",
        paths.app_root / "version_backups" / "sites",
        paths.backend_root / "version_backups" / "sites",
    ]

    moved_program = sum(move_json_files(source, paths.program_backup_root) for source in legacy_program_dirs)
    moved_site = sum(move_json_files(source, paths.site_backup_root / "_legacy_json") for source in legacy_site_dirs)
    _migrate_existing_site_backup_tree()
    _prune_all_program_versions()
    _prune_all_site_versions()
    return {"program": moved_program, "site": moved_site}


def _list_program_versions(scope: ProgramScope) -> list[dict[str, Any]]:
    if scope not in ACTIVE_PROGRAM_BACKUP_SCOPES:
        return []
    items: list[dict[str, Any]] = []
    for path in _sorted_program_files(scope):
        payload = _read_json(path, {})
        if _is_valid_program_version_payload(payload):
            items.append(payload)
        else:
            path.unlink(missing_ok=True)
    return items


def _list_all_program_versions() -> dict[str, list[dict[str, Any]]]:
    return {scope: _list_program_versions(scope) for scope in ALL_PROGRAM_SCOPES}


def _list_all_site_versions() -> dict[str, list[dict[str, Any]]]:
    _migrate_existing_site_backup_tree()
    index = _read_site_index()
    items: dict[str, list[dict[str, Any]]] = {}
    for site_id, meta in index.items():
        folder = _site_folder_from_meta(meta)
        items[site_id] = [_read_json(path, {}) for path in _sorted_site_files(folder)]
    return items


@router.get("/bootstrap")
async def version_backup_bootstrap():
    migration = _migrate_legacy_backups()
    return {
        "paths": {
            "programBackupRoot": str(get_path_registry().program_backup_root),
            "siteBackupRoot": str(get_path_registry().site_backup_root),
        },
        "migrated": migration,
        "programVersions": _list_all_program_versions(),
        "siteVersions": _list_all_site_versions(),
    }


@router.post("/program")
async def save_program_version(payload: ProgramVersionPayload):
    _migrate_legacy_backups()
    if payload.scope not in ACTIVE_PROGRAM_BACKUP_SCOPES:
        return {
            "saved": False,
            "ignored": True,
            "path": None,
            "items": [],
        }
    folder = get_path_registry().program_backup_root / payload.scope
    folder.mkdir(parents=True, exist_ok=True)
    file_path = folder / f"{payload.id}.json"
    _write_json(file_path, payload.model_dump())
    _prune_version_files(_sorted_program_files(payload.scope))
    return {
        "saved": True,
        "path": str(file_path),
        "items": _list_program_versions(payload.scope),
    }


@router.post("/site")
async def save_site_version(payload: SiteVersionPayload):
    _migrate_legacy_backups()
    normalized_payload = payload.model_copy(update={"id": payload.id.replace("A", "J", 1) if payload.id.upper().startswith("A") else payload.id})
    folder, meta = _resolve_site_folder(normalized_payload.siteId, normalized_payload)
    file_path = folder / f"{normalized_payload.id}.json"
    _write_json(file_path, normalized_payload.model_dump())
    _prune_version_files(_sorted_site_files(folder))
    return {
        "saved": True,
        "path": str(file_path),
        "folder": str(folder),
        "relativeFolder": meta.get("relativeFolder"),
        "items": _list_all_site_versions().get(normalized_payload.siteId, []),
    }
