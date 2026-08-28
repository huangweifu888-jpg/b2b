#!/usr/bin/env python3
"""Portable page-factory registry, verification and release-plan command.

Every mutating command is plan-first. Source files are changed only when the
operator explicitly supplies --apply; check and report are always read-only.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import re
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import parse_qsl, quote_plus


SOURCE_ROOT = Path(__file__).resolve().parents[1]
FACTORY_ROOT = SOURCE_ROOT / "frontend" / "src" / "page-factory"
STANDARD_FILE = FACTORY_ROOT / "page-factory-standard.json"
REGISTRY_FILE = FACTORY_ROOT / "page-registry.json"
COMMAND_FILE = FACTORY_ROOT / "page-command-catalog.json"
SNAPSHOT_FILE = FACTORY_ROOT / "factory-default-snapshot.json"
INHERITED_REGIONS = {"top", "title-1", "footer"}
MAX_FILE_SIZE = 2 * 1024 * 1024
PAGE_FRAME_NON_IDENTITY_QUERY_KEYS = frozenset({
    "agentPath",
    "agent_path",
    "tenantId",
    "tenant_id",
    "tenant",
    "clientId",
    "client_id",
    "client",
    "planId",
    "plan_id",
    "plan",
    "siteId",
    "site_id",
    "projectPageName",
    "developmentApply",
    "developmentDraft",
    "visualCardLayout",
    "createTask",
    "capability",
})
SOCIAL_MEDIA_COMPONENT = "frontend/src/pages/SocialMedia.tsx"
SOCIAL_TAB_LOADERS_BLOCK = re.compile(
    r"const\s+SOCIAL_TAB_LOADERS\s*=\s*\{(?P<body>.*?)\}\s+as\s+const;",
    re.DOTALL,
)
SOCIAL_TAB_LOADER_ENTRY = re.compile(
    r'^\s*(?:"(?P<quoted>[^"]+)"|(?P<bare>[A-Za-z][\w-]*))\s*:\s*\(\)\s*=>\s*import\("(?P<module>@/[^"]+)"\),?\s*$',
    re.MULTILINE,
)


def load_json(path: Path) -> dict[str, Any]:
    if not path.is_file() or path.stat().st_size > MAX_FILE_SIZE:
        raise ValueError(f"invalid page-factory file: {path}")
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"page-factory root must be an object: {path}")
    return value


def write_json(path: Path, value: dict[str, Any]) -> None:
    resolved = path.resolve()
    if resolved.parent != FACTORY_ROOT.resolve():
        raise ValueError(f"write escaped page-factory root: {resolved}")
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _encode_page_frame_query_component(value: str) -> str:
    # Match URLSearchParams serialization: form encoding keeps `*`, encodes
    # `~`, and represents spaces as `+`.
    return quote_plus(value, safe="*-._").replace("~", "%7E")


def normalize_page_frame_search(search: str = "") -> str:
    raw_search = search[1:] if search.startswith("?") else search
    params = [
        (key, value)
        for key, value in parse_qsl(raw_search, keep_blank_values=True)
        if key not in PAGE_FRAME_NON_IDENTITY_QUERY_KEYS
    ]
    # URLSearchParams.sort() compares UTF-16 code units and preserves the
    # relative order of repeated keys.
    params.sort(key=lambda item: item[0].encode("utf-16-be", errors="surrogatepass"))
    return "&".join(
        f"{_encode_page_frame_query_component(key)}={_encode_page_frame_query_component(value)}"
        for key, value in params
    )


def normalize_route(route: str) -> str:
    if not route.startswith("/"):
        raise ValueError("route must start with /")
    pathname, separator, search = route.partition("?")
    normalized_pathname = re.sub(r"^/(?:zb/agency-source|zb/client-source|zb|dl|kh)(?=/|$)", "", pathname) or "/"
    normalized_search = normalize_page_frame_search(search if separator else "")
    return f"{normalized_pathname}?{normalized_search}" if normalized_search else normalized_pathname


def validate_page_registry_identities(pages: list[Any]) -> None:
    page_records = [page for page in pages if isinstance(page, dict)]
    ids = [page.get("id") for page in page_records]
    scoped_normalized_routes: list[tuple[str, str]] = []
    for page in page_records:
        source_scope = page.get("sourceScope")
        route = page.get("route")
        if not isinstance(source_scope, str) or not isinstance(route, str):
            raise ValueError("page sourceScope and route must be strings")
        scoped_normalized_routes.append((source_scope, normalize_route(route)))
    if len(ids) != len(set(ids)) or len(scoped_normalized_routes) != len(set(scoped_normalized_routes)):
        raise ValueError("page ids and source-scoped routes must be unique after normalizedRoute normalization")


def source_path(relative: str) -> Path:
    candidate = (SOURCE_ROOT / relative).resolve()
    if SOURCE_ROOT.resolve() not in candidate.parents:
        raise ValueError(f"source path escaped repository: {relative}")
    return candidate


def social_tab_implementation_path(page: dict[str, Any], shell_content: str, errors: list[str]) -> Path | None:
    page_id = page.get("id")
    if not isinstance(page_id, str) or not (page_id == "client-social" or page_id.startswith("client-social-")):
        return None
    if page.get("component") != SOCIAL_MEDIA_COMPONENT or page.get("entryComponent") != SOCIAL_MEDIA_COMPONENT:
        errors.append("social page shell differs")
        return None

    normalized_route = normalize_route(str(page.get("route", "")))
    pathname, _, search = normalized_route.partition("?")
    params = dict(parse_qsl(search, keep_blank_values=True))
    tab = params.get("tab") or "dashboard"
    expected_id = "client-social" if "tab" not in params else f"client-social-{tab}"
    if pathname != "/social" or page_id != expected_id:
        errors.append(f"social page id/route differs: {page_id} -> {normalized_route}")
        return None

    block = SOCIAL_TAB_LOADERS_BLOCK.search(shell_content)
    if not block:
        errors.append("social lazy tab loader map missing")
        return None
    loaders = {
        match.group("quoted") or match.group("bare"): match.group("module")
        for match in SOCIAL_TAB_LOADER_ENTRY.finditer(block.group("body"))
    }
    module_specifier = loaders.get(tab)
    if not module_specifier:
        errors.append(f"social lazy tab implementation missing: {tab}")
        return None
    relative = f"frontend/src/{module_specifier.removeprefix('@/')}"
    if not Path(relative).suffix:
        relative += ".tsx"
    implementation = source_path(relative)
    if not implementation.is_file():
        errors.append(f"social tab implementation missing: {implementation}")
        return None
    return implementation


def inspection_source_paths(page: dict[str, Any], errors: list[str]) -> list[Path]:
    component = source_path(str(page.get("component", "")))
    entry = source_path(str(page.get("entryComponent", "")))
    for label, path in (("component", component), ("entry component", entry)):
        if not path.is_file():
            errors.append(f"{label} missing: {path}")

    paths = [path for path in (component, entry) if path.is_file()]
    shell_content = component.read_text(encoding="utf-8") if component.is_file() else ""
    social_implementation = social_tab_implementation_path(page, shell_content, errors)
    if social_implementation is not None:
        paths.append(social_implementation)

    unique_paths: list[Path] = []
    seen: set[Path] = set()
    for path in paths:
        if path in seen:
            continue
        seen.add(path)
        unique_paths.append(path)
    return unique_paths


def validate_catalogs() -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
    standard = load_json(STANDARD_FILE)
    registry = load_json(REGISTRY_FILE)
    commands = load_json(COMMAND_FILE)
    if standard.get("schemaVersion") != 1 or registry.get("schemaVersion") != 1 or commands.get("schemaVersion") != 1:
        raise ValueError("unsupported page-factory schema version")
    if registry.get("factoryVersion") != standard.get("factoryVersion"):
        raise ValueError("registry and factory versions differ")
    required_regions = standard.get("regions")
    template_regions = standard.get("templateRegions")
    required_capabilities = standard.get("requiredCapabilities")
    if not isinstance(required_regions, list) or len(required_regions) != len(set(required_regions)):
        raise ValueError("factory regions are missing or duplicated")
    if not isinstance(required_capabilities, list) or len(required_capabilities) != len(set(required_capabilities)):
        raise ValueError("factory capabilities are missing or duplicated")
    customer_service_expert = standard.get("domainContracts", {}).get("customerServiceExpert", {})
    if customer_service_expert.get("contentSource") != "current-expert-voice-customization":
        raise ValueError("customer-service expert content source differs")
    if customer_service_expert.get("identityFields") != ["gender", "title", "animation"]:
        raise ValueError("customer-service expert identity field order differs")
    if customer_service_expert.get("behaviorFields") != ["customer-service-name", "greeting", "reminder", "voice"]:
        raise ValueError("customer-service expert behavior field order differs")
    if (
        customer_service_expert.get("capacityPlugin") != "shared-service-expert-capacity-v4"
        or customer_service_expert.get("minimumCardInlineSize") != 222
        or customer_service_expert.get("maximumColumns") is not None
        or customer_service_expert.get("controlEdgeInset") != 8
        or customer_service_expert.get("controlGap") != 8
        or customer_service_expert.get("selectionCopy") != "seven-character-total-shared-behavior-ellipsis-v3"
        or customer_service_expert.get("layout") != "centered-avatar-eight-gap-fact-columns-v4"
    ):
        raise ValueError("customer-service expert capacity contract differs")
    if not isinstance(template_regions, dict) or set(template_regions) != set(standard.get("templates", [])):
        raise ValueError("factory template region contracts are incomplete")
    if any(not isinstance(regions, list) or not set(regions).issubset(set(required_regions)) for regions in template_regions.values()):
        raise ValueError("factory template regions must use the shared region catalog")
    pages = registry.get("pages")
    if not isinstance(pages, list):
        raise ValueError("page registry pages must be an array")
    validate_page_registry_identities(pages)
    command_items = commands.get("commands")
    if not isinstance(command_items, list) or len(command_items) < 7:
        raise ValueError("page-factory command catalog is incomplete")
    command_ids = [item.get("id") for item in command_items if isinstance(item, dict)]
    if len(command_ids) != len(set(command_ids)):
        raise ValueError("page-factory command ids must be unique")
    return standard, registry, commands


def inspect_page(page: dict[str, Any], standard: dict[str, Any]) -> dict[str, Any]:
    errors: list[str] = []
    paths = inspection_source_paths(page, errors)
    content = "\n".join(path.read_text(encoding="utf-8") for path in paths)
    required_regions = page.get("requiredRegions", [])
    auto_regions = page.get("regionStrategy") == "runtime-auto" or "autoRegions" in content
    for region in required_regions:
        if region in INHERITED_REGIONS:
            continue
        if auto_regions:
            continue
        if region == "body" and "<FactoryPage" in content:
            continue
        if f'data-page-factory-region="{region}"' not in content:
            errors.append(f"region marker missing: {region}")
    capabilities = set(page.get("capabilities", []))
    missing_capabilities = set(standard.get("requiredCapabilities", [])) - capabilities
    if missing_capabilities:
        errors.append(f"capabilities missing: {','.join(sorted(missing_capabilities))}")
    if "<FactoryPage" not in content:
        errors.append("FactoryPage wrapper missing")
    if page.get("factoryDefaultVersion") != standard.get("factoryVersion"):
        errors.append("factory default version differs")
    return {
        "id": page.get("id"),
        "route": page.get("route"),
        "status": "passed" if not errors else "issues",
        "errors": errors,
    }


def matching_pages(registry: dict[str, Any], route: str | None, all_pages: bool) -> list[dict[str, Any]]:
    pages = [page for page in registry.get("pages", []) if isinstance(page, dict)]
    if all_pages:
        return pages
    normalized = normalize_route(route or "")
    selected = [page for page in pages if normalize_route(str(page.get("route", ""))) == normalized]
    if not selected:
        raise ValueError(f"page is not registered: {normalized}")
    return selected


def snapshot_payload(standard: dict[str, Any], registry: dict[str, Any], commands: dict[str, Any]) -> dict[str, Any]:
    canonical = json.dumps({"standard": standard, "registry": registry, "commands": commands}, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return {
        "schemaVersion": 1,
        "factoryVersion": standard["factoryVersion"],
        "source": "code-owned-page-factory",
        "catalogSha256": hashlib.sha256(canonical.encode("utf-8")).hexdigest(),
        "pageIds": [page["id"] for page in registry["pages"]],
        "preserves": standard["factoryRestore"]["preserves"],
    }


def next_version(current: str) -> str:
    today = date.today().strftime("%Y.%m.%d")
    match = re.fullmatch(r"(\d{4}\.\d{2}\.\d{2})\.(\d+)", current)
    if match and match.group(1) == today:
        return f"{today}.{int(match.group(2)) + 1}"
    return f"{today}.1"


def refresh_inventory_report() -> dict[str, Any]:
    """Refresh only the code-owned census after an intentional factory mutation.

    The baseline is deliberately not refreshed here: a real page, route or risk
    change must remain visible as an 80% governance state until a human reviews
    and accepts the new baseline.
    """
    module_path = SOURCE_ROOT / "tools" / "page_factory_inventory.py"
    spec = importlib.util.spec_from_file_location("page_factory_inventory_refresh", module_path)
    if spec is None or spec.loader is None:
        raise ValueError("page-factory inventory module is unavailable")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    report = module.build_inventory()
    write_json(module.REPORT_FILE, report)
    return {
        "version": report["phaseProgress"]["version"],
        "completedPercent": report["phaseProgress"]["completedPercent"],
        "baselineStatus": report["baselineDiff"]["status"],
        "registeredRouteEntries": report["totals"]["registeredRouteEntries"],
        "completedRouteEntries": report["totals"]["completedRouteEntries"],
        "routeEntries": report["totals"]["routeEntries"],
        "routeCoveragePercent": report["totals"]["routeCoveragePercent"],
    }


def add_page(args: argparse.Namespace, apply: bool) -> dict[str, Any]:
    standard, registry, _ = validate_catalogs()
    route = normalize_route(args.route)
    candidate = {
        "id": args.id,
        "label": args.label or args.id,
        "route": route,
        "component": args.component,
        "entryComponent": args.entry_component or args.component,
        "template": args.template,
        "sourceScope": args.source_scope,
        "governanceScopes": ["hq", "agency_source", "client_source"],
        "requiredRegions": standard["templateRegions"][args.template],
        "capabilities": standard["requiredCapabilities"],
        "status": "adopting",
        "regionStrategy": "runtime-auto" if args.auto_regions else "explicit",
        "factoryDefaultVersion": standard["factoryVersion"],
    }
    existing = next((page for page in registry["pages"] if page.get("id") == args.id), None)
    route_owner = next((
        page
        for page in registry["pages"]
        if page.get("sourceScope") == args.source_scope
        and normalize_route(str(page.get("route", ""))) == route
    ), None)
    update_adopting = bool(getattr(args, "update_adopting", False))
    operation = "create"
    if existing:
        if not update_adopting:
            raise ValueError("page id or source-scoped route already exists")
        if existing.get("status") != "adopting":
            raise ValueError("only an adopting page may be updated")
        immutable_fields = ("route", "component", "entryComponent", "sourceScope")
        changed_ownership = [field for field in immutable_fields if existing.get(field) != candidate.get(field)]
        if changed_ownership:
            raise ValueError(f"adopting page ownership is immutable: {', '.join(changed_ownership)}")
        operation = "update-adopting"
    elif update_adopting:
        raise ValueError("update-adopting requires an existing page id")
    if route_owner and route_owner.get("id") != args.id:
        raise ValueError("page id or source-scoped route already exists")
    if apply:
        if existing:
            registry["pages"][registry["pages"].index(existing)] = candidate
        else:
            registry["pages"].append(candidate)
        write_json(REGISTRY_FILE, registry)
    return {"dryRun": not apply, "filesystemWrites": 1 if apply else 0, "operation": operation, "candidate": candidate}


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="B2B page factory")
    sub = parser.add_subparsers(dest="command", required=True)
    check = sub.add_parser("check")
    check.add_argument("--route")
    check.add_argument("--all", action="store_true")
    sub.add_parser("report")
    for name in ("new", "adopt"):
        item = sub.add_parser(name)
        item.add_argument("--id", required=True)
        item.add_argument("--label")
        item.add_argument("--route", required=True)
        item.add_argument("--component", required=True)
        item.add_argument("--entry-component")
        item.add_argument("--template", choices=["reference", "dashboard", "list", "form", "detail", "editor", "workflow"], required=True)
        item.add_argument("--source-scope", choices=["hq", "agency_source", "client_source"], default="client_source")
        item.add_argument("--auto-regions", action="store_true")
        item.add_argument("--update-adopting", action="store_true")
        item.add_argument("--apply", action="store_true")
    bump = sub.add_parser("bump")
    bump.add_argument("--part", choices=["patch"], default="patch")
    bump.add_argument("--apply", action="store_true")
    snapshot = sub.add_parser("snapshot")
    snapshot.add_argument("--apply", action="store_true")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        standard, registry, commands = validate_catalogs()
        if args.command == "check":
            if not args.all and not args.route:
                raise ValueError("check requires --route or --all")
            reports = [inspect_page(page, standard) for page in matching_pages(registry, args.route, args.all)]
            result = {"factoryVersion": standard["factoryVersion"], "reports": reports, "passed": all(item["status"] == "passed" for item in reports)}
            print(json.dumps(result, ensure_ascii=False, indent=2))
            return 0 if result["passed"] else 1
        if args.command == "report":
            reports = [inspect_page(page, standard) for page in registry["pages"]]
            print(json.dumps({"factoryVersion": standard["factoryVersion"], "registered": len(reports), "passed": sum(item["status"] == "passed" for item in reports), "reports": reports}, ensure_ascii=False, indent=2))
            return 0
        if args.command in {"new", "adopt"}:
            result = add_page(args, args.apply)
            if args.apply:
                result["filesystemWrites"] += 1
                result["inventoryProgress"] = refresh_inventory_report()
            print(json.dumps(result, ensure_ascii=False, indent=2))
            return 0
        if args.command == "bump":
            version = next_version(str(standard["factoryVersion"]))
            if args.apply:
                standard["factoryVersion"] = version
                registry["factoryVersion"] = version
                for page in registry["pages"]:
                    page["factoryDefaultVersion"] = version
                write_json(STANDARD_FILE, standard)
                write_json(REGISTRY_FILE, registry)
            result = {"dryRun": not args.apply, "filesystemWrites": 2 if args.apply else 0, "current": standard["factoryVersion"] if args.apply else load_json(STANDARD_FILE)["factoryVersion"], "next": version}
            if args.apply:
                result["filesystemWrites"] += 1
                result["inventoryProgress"] = refresh_inventory_report()
            print(json.dumps(result, ensure_ascii=False, indent=2))
            return 0
        if args.command == "snapshot":
            reports = [inspect_page(page, standard) for page in registry["pages"]]
            if any(item["status"] != "passed" for item in reports):
                raise ValueError("all registered pages must pass before snapshot")
            finalized = [page["id"] for page in registry["pages"] if page.get("status") == "adopting"]
            if args.apply and finalized:
                for page in registry["pages"]:
                    if page.get("status") == "adopting":
                        page["status"] = "complete"
                write_json(REGISTRY_FILE, registry)
            payload = snapshot_payload(standard, registry, commands)
            payload["createdAt"] = datetime.now(timezone.utc).isoformat() if args.apply else "dry-run"
            inventory_progress = None
            if args.apply:
                write_json(SNAPSHOT_FILE, payload)
                inventory_progress = refresh_inventory_report()
            print(json.dumps({"dryRun": not args.apply, "filesystemWrites": (3 if finalized else 2) if args.apply else 0, "finalizedPageIds": finalized, "inventoryProgress": inventory_progress, "snapshot": payload}, ensure_ascii=False, indent=2))
            return 0
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print(json.dumps({"error": str(error)}, ensure_ascii=False, indent=2))
        return 2
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
