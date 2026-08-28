from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from core.path_registry import get_path_registry

BACKEND_ROOT = Path(__file__).resolve().parents[1]
PATHS = get_path_registry()
SITES_STORE_PATH = BACKEND_ROOT / "published_sites.json"
SITE_OUTPUT_ROOT = PATHS.website_root


def safe_site_segment(value: str, fallback: str) -> str:
    cleaned = re.sub(r'[\\/:*?"<>|\s]+', "-", value or "").strip(".-")
    cleaned = re.sub(r"-+", "-", cleaned)
    return cleaned[:80] or fallback


def site_label(code: str | None, name: str | None, fallback_code: str, fallback_name: str) -> str:
    safe_code = safe_site_segment(code or fallback_code, fallback_code)
    safe_name = safe_site_segment(name or fallback_name, fallback_name)
    return f"{safe_code}-{safe_name}"


def site_url_path(site: dict[str, Any]) -> str:
    return (
        f"/{site_label(site.get('agencyCode'), site.get('agencyName'), 'D000', 'agency')}"
        f"/{site_label(site.get('clientCode'), site.get('clientName'), 'K000', 'client')}"
        f"/{site_label(site.get('planCode'), site.get('planName') or site.get('name'), 'J000', 'plan')}/"
    )


def site_public_url(site: dict[str, Any]) -> str:
    return f"http://127.0.0.1:3004{site_url_path(site)}"


def read_sites() -> list[dict[str, Any]]:
    if not SITES_STORE_PATH.exists():
        return []
    raw = json.loads(SITES_STORE_PATH.read_text(encoding="utf-8"))
    return raw if isinstance(raw, list) else []


def export_site(site: dict[str, Any]) -> dict[str, str] | None:
    html = str(site.get("html") or "")
    if not html.strip():
        return None

    output_dir = (
        SITE_OUTPUT_ROOT
        / site_label(site.get("agencyCode"), site.get("agencyName"), "D000", "agency")
        / site_label(site.get("clientCode"), site.get("clientName"), "K000", "client")
        / site_label(site.get("planCode"), site.get("planName") or site.get("name"), "J000", "plan")
    )
    output_dir.mkdir(parents=True, exist_ok=True)

    index_file = output_dir / "index.html"
    index_file.write_text(html, encoding="utf-8", newline="")
    manifest = {
        "id": site.get("id"),
        "slug": site.get("slug"),
        "name": site.get("name"),
        "scope": site.get("scope", "client"),
        "agencyCode": site.get("agencyCode"),
        "agencyName": site.get("agencyName"),
        "clientCode": site.get("clientCode"),
        "clientName": site.get("clientName"),
        "planCode": site.get("planCode"),
        "planName": site.get("planName"),
        "updatedAt": site.get("updatedAt"),
        "entry": "index.html",
        "urlPath": site.get("urlPath") or site_url_path(site),
        "publicUrl": site.get("publicUrl") or site_public_url(site),
    }
    (output_dir / "site.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"path": str(index_file), "urlPath": str(manifest["urlPath"]), "publicUrl": str(manifest["publicUrl"])}


def write_site_index(items: list[dict[str, Any]]) -> None:
    SITE_OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    exported = []
    for site in items:
        result = export_site(site)
        if result:
            exported.append(
                {
                    "id": site.get("id"),
                    "slug": site.get("slug"),
                    "name": site.get("name"),
                    "scope": site.get("scope", "client"),
                    "path": result["path"],
                    "urlPath": result["urlPath"],
                    "publicUrl": result["publicUrl"],
                    "agencyCode": site.get("agencyCode"),
                    "clientCode": site.get("clientCode"),
                    "planCode": site.get("planCode"),
                    "updatedAt": site.get("updatedAt"),
                }
            )

    (SITE_OUTPUT_ROOT / "_site_index.json").write_text(
        json.dumps({"root": str(SITE_OUTPUT_ROOT), "items": exported}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    links = "\n".join(
        f'<li><a href="{item["urlPath"]}">{item.get("name") or item.get("slug")}</a> '
        f'<small>{item.get("scope")}</small></li>'
        for item in exported
    )
    index_html = (
        "<!doctype html><html lang=\"zh-CN\"><head><meta charset=\"utf-8\">"
        "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">"
        "<title>Published Sites</title>"
        "<style>body{font-family:Arial,Helvetica,sans-serif;margin:40px;line-height:1.6}"
        "a{color:#2563eb}small{color:#64748b;margin-left:8px}</style></head>"
        f"<body><h1>Published Sites</h1><ul>{links}</ul></body></html>"
    )
    (SITE_OUTPUT_ROOT / "index.html").write_text(index_html, encoding="utf-8", newline="")


if __name__ == "__main__":
    sites = read_sites()
    write_site_index(sites)
    print(f"Exported {len(sites)} site record(s) to {SITE_OUTPUT_ROOT}")
