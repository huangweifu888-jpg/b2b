from __future__ import annotations

import json
import sys
import sqlite3
import shutil
from datetime import datetime
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from core.path_registry import get_path_registry


LEGACY_ORG_IDS = (1, 2, 3, 4)
LEGACY_ROLE_ORG_IDS = (1, 2, 3, 4)
LEGACY_PROJECT_IDS = (1, 2)
SAMPLE_ORG_IDS = (7, 8, 9, 10, 11, 12, 13, 14, 15, 16)
REAL_HQ_ORG_ID = 19
REAL_HQ_ROLE_ID = 15
REAL_LOCAL_ADMIN_USER_ID = "local:local-admin@example.com"
REAL_LOCAL_ADMIN_ORG_ID = 19
KEEP_DIR_NAMES = {"templates", "__pycache__", "_legacy_orphaned"}


def _parse_time(value: str | None) -> float:
    if not value:
        return 0.0
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp()
    except Exception:
        return 0.0


def _site_priority(item: dict[str, object]) -> tuple[float, float, int, str]:
    updated_at = _parse_time(str(item.get("updatedAt") or ""))
    created_at = _parse_time(str(item.get("createdAt") or ""))
    plan_code = str(item.get("planCode") or "")
    site_id = str(item.get("siteId") or item.get("id") or "")
    return (updated_at, created_at, len(str(item.get("html") or "")), f"{plan_code}:{site_id}")


def _dedupe_published_sites(items: list[dict[str, object]]) -> list[dict[str, object]]:
    preferred: dict[str, dict[str, object]] = {}
    for item in items:
        key = str(item.get("siteId") or item.get("id") or "").strip()
        if not key:
            continue
        current = preferred.get(key)
        if not current or _site_priority(item) >= _site_priority(current):
            preferred[key] = item
    return sorted(preferred.values(), key=_site_priority, reverse=True)


def _load_valid_codes(db_path: Path) -> tuple[set[str], set[str], set[str]]:
    conn = sqlite3.connect(db_path)
    try:
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        agency_codes = {
            str(row["code"]).strip().upper()
            for row in cur.execute("select code from organizations where org_type in ('agency', 'sub_agency')")
            if row["code"]
        }
        client_codes = {
            str(row["code"]).strip().upper()
            for row in cur.execute("select code from organizations where org_type = 'client'")
            if row["code"]
        }
        project_codes = {
            str(row["code"]).strip().upper()
            for row in cur.execute("select code from projects_platform")
            if row["code"]
        }
        return agency_codes, client_codes, project_codes
    finally:
        conn.close()


def _site_matches_codes(
    item: dict[str, object], agency_codes: set[str], client_codes: set[str], project_codes: set[str]
) -> bool:
    agency_code = str(
        item.get("directAgencyCode") or item.get("agencyCode") or item.get("rootAgencyCode") or ""
    ).strip().upper()
    client_code = str(item.get("clientCode") or "").strip().upper()
    plan_code = str(item.get("planCode") or "").strip().upper()
    return agency_code in agency_codes and client_code in client_codes and plan_code in project_codes


def _clean_sites_file(
    path: Path, agency_codes: set[str], client_codes: set[str], project_codes: set[str]
) -> int:
    if not path.exists():
        return 0
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return 0
    if not isinstance(payload, list):
        return 0
    cleaned = _dedupe_published_sites(
        [
            item
            for item in payload
            if isinstance(item, dict)
            and _site_matches_codes(item, agency_codes, client_codes, project_codes)
        ]
    )
    if cleaned != payload:
        path.write_text(json.dumps(cleaned, ensure_ascii=False, indent=2), encoding="utf-8")
    return len(payload) - len(cleaned)


def _clean_site_index(
    path: Path, agency_codes: set[str], client_codes: set[str], project_codes: set[str]
) -> int:
    if not path.exists():
        return 0
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return 0
    if not isinstance(payload, dict):
        return 0
    if "items" in payload and isinstance(payload.get("items"), list):
        cleaned_items = _dedupe_published_sites(
            [
                item
                for item in payload["items"]
                if isinstance(item, dict) and _site_matches_codes(item, agency_codes, client_codes, project_codes)
            ]
        )
        cleaned = {**payload, "items": cleaned_items}
        removed = len(payload["items"]) - len(cleaned_items)
    else:
        cleaned = {
            key: value
            for key, value in payload.items()
            if isinstance(value, dict) and _site_matches_codes(value, agency_codes, client_codes, project_codes)
        }
        removed = len(payload) - len(cleaned)
    if cleaned != payload:
        path.write_text(json.dumps(cleaned, ensure_ascii=False, indent=2), encoding="utf-8")
    return removed


def _remove_legacy_site_dirs(paths: tuple[Path, ...], valid_agency_codes: set[str]) -> int:
    removed = 0
    for base in paths:
        if not base.exists():
            continue
        for child in base.iterdir():
            if not child.is_dir():
                continue
            if child.name in KEEP_DIR_NAMES:
                continue
            child_upper = child.name.upper()
            if any(child_upper.startswith(f"{code}-") or child_upper == code for code in valid_agency_codes):
                continue
            shutil.rmtree(child, ignore_errors=True)
            removed += 1
    return removed


def _filter_site_index_file(path: Path, agency_codes: set[str], client_codes: set[str], project_codes: set[str]) -> int:
    if not path.exists():
        return 0
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return 0
    if not isinstance(payload, dict):
        return 0

    items = payload.get("items")
    if not isinstance(items, list):
        return 0

    cleaned_items = _dedupe_published_sites(
        [
            item
            for item in items
            if isinstance(item, dict)
            and _site_matches_codes(item, agency_codes, client_codes, project_codes)
        ]
    )
    cleaned = {**payload, "items": cleaned_items}
    if cleaned != payload:
        path.write_text(json.dumps(cleaned, ensure_ascii=False, indent=2), encoding="utf-8")
    return len(items) - len(cleaned_items)


def _filter_backup_index_file(path: Path, agency_codes: set[str], client_codes: set[str], project_codes: set[str]) -> int:
    if not path.exists():
        return 0
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return 0
    if not isinstance(payload, dict):
        return 0

    cleaned = {}
    for key, value in payload.items():
        if not isinstance(value, dict):
            continue
        if _site_matches_codes(value, agency_codes, client_codes, project_codes):
            cleaned[key] = value
    if cleaned != payload:
        path.write_text(json.dumps(cleaned, ensure_ascii=False, indent=2), encoding="utf-8")
    return len(payload) - len(cleaned)


def clean_database(db_path: Path) -> None:
    conn = sqlite3.connect(db_path)
    try:
        conn.execute("PRAGMA foreign_keys = OFF")
        with conn:
            conn.execute(
                "UPDATE local_accounts SET org_id = ? WHERE user_id = ?",
                (REAL_LOCAL_ADMIN_ORG_ID, REAL_LOCAL_ADMIN_USER_ID),
            )
            conn.execute(
                "UPDATE memberships_platform SET org_id = ?, role_id = ? WHERE user_id = ?",
                (REAL_HQ_ORG_ID, REAL_HQ_ROLE_ID, REAL_LOCAL_ADMIN_USER_ID),
            )
            conn.execute("DELETE FROM ai_provider_configs WHERE org_id = 1")
            conn.execute("DELETE FROM ai_app_assignments WHERE org_id = 1")
            conn.execute("DELETE FROM projects_platform WHERE id IN (?, ?)", LEGACY_PROJECT_IDS)
            conn.execute("DELETE FROM projects_platform WHERE client_org_id IN (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", SAMPLE_ORG_IDS)
            conn.execute("DELETE FROM roles_platform WHERE org_id IN (?, ?, ?, ?)", LEGACY_ROLE_ORG_IDS)
            conn.execute("DELETE FROM roles_platform WHERE org_id IN (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", SAMPLE_ORG_IDS)
            conn.execute("DELETE FROM memberships_platform WHERE org_id IN (?, ?, ?, ?)", LEGACY_ORG_IDS)
            conn.execute("DELETE FROM memberships_platform WHERE org_id IN (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", SAMPLE_ORG_IDS)
            conn.execute(
                "DELETE FROM local_accounts WHERE org_id IN (?, ?, ?, ?) AND user_id <> ?",
                (*LEGACY_ORG_IDS, REAL_LOCAL_ADMIN_USER_ID),
            )
            conn.execute(
                "DELETE FROM local_accounts WHERE org_id IN (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) AND user_id <> ?",
                (*SAMPLE_ORG_IDS, REAL_LOCAL_ADMIN_USER_ID),
            )
            conn.execute("DELETE FROM organizations WHERE id IN (?, ?, ?, ?)", LEGACY_ORG_IDS)
            conn.execute("DELETE FROM organizations WHERE id IN (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", SAMPLE_ORG_IDS)
        conn.execute("PRAGMA foreign_keys = ON")
    finally:
        conn.close()


def main() -> None:
    paths = get_path_registry()
    db_path = paths.active_database_file
    published_sites_path = paths.backend_root / "published_sites.json"
    site_index_path = paths.site_backup_root / "_site_index.json"
    web_site_index_path = paths.website_root / "_site_index.json"

    clean_database(db_path)
    valid_agency_codes, valid_client_codes, valid_project_codes = _load_valid_codes(db_path)

    removed_dirs = _remove_legacy_site_dirs((paths.website_root, paths.site_backup_root), valid_agency_codes)
    removed_sites = _clean_sites_file(published_sites_path, valid_agency_codes, valid_client_codes, valid_project_codes)
    removed_index = _clean_site_index(site_index_path, valid_agency_codes, valid_client_codes, valid_project_codes)
    removed_web_index = _filter_site_index_file(
        web_site_index_path, valid_agency_codes, valid_client_codes, valid_project_codes
    )
    removed_backup_index = _filter_backup_index_file(
        site_index_path, valid_agency_codes, valid_client_codes, valid_project_codes
    )

    print(
        json.dumps(
            {
                "database": str(db_path),
                "removedDirs": removed_dirs,
                "publishedSitesRemoved": removed_sites,
                "siteIndexRemoved": removed_index,
                "webIndexRemoved": removed_web_index,
                "backupIndexRemoved": removed_backup_index,
                "validAgencyCodes": sorted(valid_agency_codes),
                "validClientCodes": sorted(valid_client_codes),
                "validProjectCodes": sorted(valid_project_codes),
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
