#!/usr/bin/env python3
"""Build the Page Factory phase-two, read-only source census.

This tool only reads ``frontend/src/pages``, literal route ownership in
``frontend/src/App.tsx`` and the code-owned page-factory registry.  It never
opens a database and never reads assets or backups.  Optional report/baseline
writes stay inside the code-owned Page Factory catalog and remain deliberately
separate from adopting or changing any application page.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path
from typing import Any


SOURCE_ROOT = Path(__file__).resolve().parents[1]
PAGES_ROOT = SOURCE_ROOT / "frontend" / "src" / "pages"
FRONTEND_SOURCE_ROOT = SOURCE_ROOT / "frontend" / "src"
FACTORY_ROOT = SOURCE_ROOT / "frontend" / "src" / "page-factory"
APP_FILE = SOURCE_ROOT / "frontend" / "src" / "App.tsx"
REGISTRY_FILE = FACTORY_ROOT / "page-registry.json"
REPORT_FILE = FACTORY_ROOT / "page-inventory.json"
BASELINE_FILE = FACTORY_ROOT / "page-inventory-baseline.json"
MAX_FILE_SIZE = 2 * 1024 * 1024

HIGH_RISK = re.compile(r"(?:auth|backup|release|audit|live|codeeditor|companyinfo|productmarket|preview|tenant|versioncenter|logoutcallback)", re.IGNORECASE)
REVIEW_RISK = re.compile(r"(?:factory|productanalysis|ai|account|customer|project|site|template|seo|smart|social|commerce|inquir|report|wallet|member|role)", re.IGNORECASE)
SOURCE_SIGNAL_PATTERNS = {
    "authorization": (3, re.compile(r"\b(?:auth|permission|role|accessControl)\b", re.IGNORECASE)),
    "upload": (3, re.compile(r"(?:type=[\"']file[\"']|upload|fileReader|assetStorage)", re.IGNORECASE)),
    "write-action": (2, re.compile(r"(?:useMutation|onSubmit|handleSubmit|\bdelete\w*\(|\bupdate\w*\(|\bcreate\w*\()", re.IGNORECASE)),
    "network-data": (2, re.compile(r"(?:\bfetch\(|axios\.|apiClient|useQuery|queryClient)", re.IGNORECASE)),
    "tenant-context": (2, re.compile(r"(?:tenantId|clientId|agencyId|siteId|planId)")),
    "complex-interaction": (1, re.compile(r"(?:DndContext|useDraggable|useSortable|Resizable|contentEditable)")),
    "browser-storage": (1, re.compile(r"(?:localStorage|sessionStorage)")),
    "form-state": (1, re.compile(r"(?:useForm|<form\b|FormField)")),
}


def load_json(path: Path) -> dict[str, Any]:
    if not path.is_file() or path.stat().st_size > MAX_FILE_SIZE:
        raise ValueError(f"invalid catalog file: {path.name}")
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"catalog root must be an object: {path.name}")
    return value


def relative(path: Path) -> str:
    return path.resolve().relative_to(SOURCE_ROOT.resolve()).as_posix()


def page_id(path: Path) -> str:
    stem = path.relative_to(PAGES_ROOT).with_suffix("").as_posix()
    return re.sub(r"[^a-z0-9]+", "-", stem.lower()).strip("-")


def scope_hint(path: Path) -> str:
    parts = path.relative_to(PAGES_ROOT).parts
    if parts[0] == "hq":
        return "hq"
    if parts[0] == "agency":
        return "agency_source"
    return "shared-client-entry"


def direct_thin_entry_dependencies(path: Path, content: str) -> list[Path]:
    effective_lines = [line for line in content.splitlines() if "@/page-factory/FactoryPage" not in line]
    if len(effective_lines) > 40:
        return []
    dependencies: list[Path] = []
    import_pattern = re.compile(r'from\s+["\'](@/[^"\']+|\.{1,2}/[^"\']+)["\']')
    for match in import_pattern.finditer(content):
        specifier = match.group(1)
        if specifier == "@/page-factory/FactoryPage":
            continue
        base = FRONTEND_SOURCE_ROOT / specifier[2:] if specifier.startswith("@/") else path.parent / specifier
        candidates = [base.with_suffix(".tsx"), base.with_suffix(".ts"), base / "index.tsx", base / "index.ts"]
        dependency = next((candidate.resolve() for candidate in candidates if candidate.is_file()), None)
        if dependency is None or FRONTEND_SOURCE_ROOT.resolve() not in dependency.parents or dependency in dependencies:
            continue
        dependencies.append(dependency)
    return dependencies


def analyze_source(path: Path) -> dict[str, Any]:
    content = path.read_text(encoding="utf-8")
    linked_paths = direct_thin_entry_dependencies(path, content)
    linked_contents = [dependency.read_text(encoding="utf-8") for dependency in linked_paths]
    analyzed_content = "\n".join([content, *linked_contents])
    signals = [signal for signal, (_, pattern) in SOURCE_SIGNAL_PATTERNS.items() if pattern.search(analyzed_content)]
    line_count = len(content.splitlines())
    analyzed_line_count = line_count + sum(len(value.splitlines()) for value in linked_contents)
    if line_count >= 800:
        signals.append("large-source")
    score = sum(SOURCE_SIGNAL_PATTERNS[signal][0] for signal in signals if signal in SOURCE_SIGNAL_PATTERNS) + (2 if "large-source" in signals else 0)
    return {
        "lineCount": line_count,
        "analyzedLineCount": analyzed_line_count,
        "linkedSources": [relative(dependency) for dependency in linked_paths],
        "riskScore": score,
        "riskSignals": signals,
        "factoryContractPresent": "<FactoryPage" in content or "data-page-factory-contract" in content,
    }


def risk_for(path: Path, analysis: dict[str, Any]) -> tuple[str, str]:
    token = path.as_posix()
    signals = analysis["riskSignals"]
    suffix = f"；源码信号：{', '.join(signals)}" if signals else "；未发现额外交互信号"
    if HIGH_RISK.search(token) or analysis["riskScore"] >= 7:
        return "high", f"涉及治理壳层或多项高影响代码特征，只允许单页专项审查{suffix}。"
    if REVIEW_RISK.search(token) or analysis["riskScore"] >= 2:
        return "review", f"包含业务交互、租户语义或状态读写特征，先完成单页影响检查{suffix}。"
    return "low", "静态或单一展示入口候选；仍须先走单页计划和检查，不能自动接入。"


def source_from_app_import(import_path: str) -> str | None:
    candidate = (APP_FILE.parent / import_path).with_suffix(".tsx").resolve()
    try:
        return relative(candidate) if candidate.is_file() and PAGES_ROOT.resolve() in candidate.parents else None
    except ValueError:
        return None


def _declared_route_identity(path: str, source_scope: str) -> str:
    """Return the Page Factory route owned by a source shell."""
    prefixes = {
        "hq": ("/zb",),
        "agency_source": ("/zb/agency-source", "/dl"),
        "client_source": ("/zb/client-source", "/kh"),
    }
    for prefix in prefixes[source_scope]:
        if path == prefix:
            return "/"
        if path.startswith(f"{prefix}/"):
            return path[len(prefix):]
    return path or "/"


def _literal_route_scope(path: str) -> str:
    if path == "/zb/agency-source" or path.startswith("/zb/agency-source/") or path == "/dl" or path.startswith("/dl/"):
        return "agency_source"
    if path == "/zb/client-source" or path.startswith("/zb/client-source/") or path == "/kh" or path.startswith("/kh/"):
        return "client_source"
    if path == "/zb" or path.startswith("/zb/"):
        return "hq"
    return "client_source"


def _audit_route_identities(expected: list[dict[str, str]], registry: dict[str, Any]) -> dict[str, Any]:
    unique_expected = {
        (item["sourceScope"], item["route"], item["source"]): item
        for item in expected
    }
    expected_items = sorted(unique_expected.values(), key=lambda item: (item["sourceScope"], item["route"], item["source"]))
    registry_items = [item for item in registry.get("pages", []) if isinstance(item, dict)]
    registry_by_identity: dict[tuple[str, str], list[dict[str, Any]]] = {}
    for item in registry_items:
        source_scope = item.get("sourceScope")
        route = item.get("route")
        if not isinstance(source_scope, str) or not isinstance(route, str):
            continue
        registry_by_identity.setdefault((source_scope, route), []).append(item)

    unregistered: list[dict[str, str]] = []
    mismatches: list[dict[str, Any]] = []
    matched = 0
    for item in expected_items:
        candidates = registry_by_identity.get((item["sourceScope"], item["route"]), [])
        if not candidates:
            unregistered.append(item)
            continue
        if not any(item["source"] in {candidate.get("component"), candidate.get("entryComponent")} for candidate in candidates):
            mismatches.append({
                **item,
                "registeredOwners": sorted({
                    owner
                    for candidate in candidates
                    for owner in (candidate.get("component"), candidate.get("entryComponent"))
                    if isinstance(owner, str)
                }),
            })
            continue
        matched += 1

    expected_count = len(expected_items)
    coverage = round(matched / expected_count * 100, 2) if expected_count else 0
    return {
        "expectedRouteIdentities": expected_count,
        "registeredRouteIdentities": matched,
        "routeIdentityCoveragePercent": coverage,
        "unregisteredRouteIdentities": unregistered,
        "ownershipMismatches": mismatches,
        "registryRouteIdentities": len(registry_by_identity),
        "queryVariantIdentities": sum("?" in route for _, route in registry_by_identity),
        "dynamicRouteIdentities": sum(":" in item["route"] for item in expected_items),
    }


def route_inventory(registry: dict[str, Any]) -> tuple[dict[str, list[str]], dict[str, Any]]:
    """Extract literal App.tsx routes and verify their shell-scoped registry identities."""
    app = APP_FILE.read_text(encoding="utf-8")
    symbols: dict[str, str] = {}
    default_import = re.compile(r'^import\s+(\w+)\s+from\s+"(\./pages/[^";]+)";', re.MULTILINE)
    named_import = re.compile(r'^import\s+\{([^}]+)\}\s+from\s+"(\./pages/[^";]+)";', re.MULTILINE)
    lazy_import = re.compile(r'const\s+(\w+)\s*=\s*lazyPage\(\(\)\s*=>\s*import\("(\./pages/[^";]+)"\)\);')
    inline_lazy_named_page = re.compile(r'const\s+(\w+)\s*=\s*lazyNamedPage\(\(\)\s*=>\s*import\("(\./pages/[^";]+)"\),\s*"\w+"\);')
    loader_import = re.compile(r'const\s+(\w+)\s*=\s*\(\)\s*=>\s*import\("(\./pages/[^";]+)"\);')
    alias_assignment = re.compile(r'const\s+(\w+)\s*=\s*(\w+);')
    lazy_named_page = re.compile(r'const\s+(\w+)\s*=\s*lazyNamedPage\((\w+),\s*"\w+"\);')
    for match in default_import.finditer(app):
        source = source_from_app_import(match.group(2))
        if source:
            symbols[match.group(1)] = source
    for match in named_import.finditer(app):
        source = source_from_app_import(match.group(2))
        if not source:
            continue
        for item in match.group(1).split(","):
            name = item.strip().split(" as ")[-1].strip()
            if re.fullmatch(r"\w+", name):
                symbols[name] = source
    for match in lazy_import.finditer(app):
        source = source_from_app_import(match.group(2))
        if source:
            symbols[match.group(1)] = source
    for match in inline_lazy_named_page.finditer(app):
        source = source_from_app_import(match.group(2))
        if source:
            symbols[match.group(1)] = source
    loaders: dict[str, str] = {}
    for match in loader_import.finditer(app):
        source = source_from_app_import(match.group(2))
        if source:
            loaders[match.group(1)] = source
    for match in alias_assignment.finditer(app):
        source = symbols.get(match.group(2))
        if source:
            symbols[match.group(1)] = source
    for match in lazy_named_page.finditer(app):
        source = loaders.get(match.group(2))
        if source:
            symbols[match.group(1)] = source

    route_pattern = re.compile(
        r'<Route\s+path=(?:"([^"]+)"|\{routePath\("([^"]+)"\)\})\s+element=\{page\(<(\w+)',
        re.MULTILINE,
    )
    result: dict[str, list[str]] = {}
    unresolved: list[dict[str, str]] = []
    expected_identities: list[dict[str, str]] = []
    declarations = 0
    mapped_declarations = 0
    client_routes_start = app.index("function clientRoutes")
    agency_routes_start = app.index("function agencyRoutes")
    route_functions_end = app.index("export default function App")
    for match in route_pattern.finditer(app):
        path = match.group(1) or match.group(2)
        source = symbols.get(match.group(3))
        if not path:
            continue
        declarations += 1
        if source:
            result.setdefault(source, []).append(path)
            mapped_declarations += 1
            if match.group(2):
                if client_routes_start <= match.start() < agency_routes_start:
                    source_scope = "client_source"
                elif agency_routes_start <= match.start() < route_functions_end:
                    source_scope = "agency_source"
                else:
                    unresolved.append({"path": path, "component": match.group(3)})
                    continue
                normalized_route = path
            else:
                source_scope = _literal_route_scope(path)
                normalized_route = _declared_route_identity(path, source_scope)
            expected_identities.append({
                "sourceScope": source_scope,
                "route": normalized_route,
                "source": source,
                "component": match.group(3),
            })
        else:
            unresolved.append({"path": path, "component": match.group(3)})
    normalized = {source: sorted(set(paths)) for source, paths in result.items()}
    return normalized, {
        "literalRouteDeclarations": declarations,
        "mappedRouteDeclarations": mapped_declarations,
        "unmappedRouteTargets": unresolved,
        **_audit_route_identities(expected_identities, registry),
    }


def baseline_projection(pages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            "id": item["id"],
            "source": item["source"],
            "routeEntry": item["routeEntry"],
            "routeHints": item["routeHints"],
            "risk": item["risk"],
            "riskSignals": item["analysis"]["riskSignals"],
        }
        for item in pages
    ]


def projection_fingerprint(projection: list[dict[str, Any]]) -> str:
    canonical = json.dumps(projection, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def baseline_payload(inventory_version: str, pages: list[dict[str, Any]]) -> dict[str, Any]:
    projection = baseline_projection(pages)
    return {
        "schemaVersion": 1,
        "inventoryVersion": inventory_version,
        "mode": "code-owned-read-only-baseline",
        "fingerprint": projection_fingerprint(projection),
        "pages": projection,
    }


def compare_baseline(inventory_version: str, pages: list[dict[str, Any]]) -> dict[str, Any]:
    current = baseline_payload(inventory_version, pages)
    if not BASELINE_FILE.is_file():
        return {"status": "missing", "baselineVersion": None, "currentFingerprint": current["fingerprint"], "addedPageIds": [], "removedPageIds": [], "riskChangedPageIds": []}
    baseline = load_json(BASELINE_FILE)
    baseline_pages = {item["id"]: item for item in baseline.get("pages", []) if isinstance(item, dict) and isinstance(item.get("id"), str)}
    current_pages = {item["id"]: item for item in current["pages"]}
    added = sorted(set(current_pages) - set(baseline_pages))
    removed = sorted(set(baseline_pages) - set(current_pages))
    changed = sorted(page_id for page_id in set(current_pages) & set(baseline_pages) if current_pages[page_id].get("risk") != baseline_pages[page_id].get("risk") or current_pages[page_id].get("riskSignals") != baseline_pages[page_id].get("riskSignals"))
    fingerprint_matches = baseline.get("fingerprint") == current["fingerprint"]
    return {
        "status": "unchanged" if fingerprint_matches else "changed",
        "baselineVersion": baseline.get("inventoryVersion"),
        "currentFingerprint": current["fingerprint"],
        "addedPageIds": added,
        "removedPageIds": removed,
        "riskChangedPageIds": changed,
    }


def build_inventory() -> dict[str, Any]:
    registry = load_json(REGISTRY_FILE)
    inventory_version = str(registry.get("factoryVersion"))
    route_hints, routing_audit = route_inventory(registry)
    registered_paths = {
        item.get(key)
        for item in registry.get("pages", [])
        if isinstance(item, dict)
        for key in ("component", "entryComponent")
        if isinstance(item.get(key), str)
    }
    completed_paths = {
        item.get(key)
        for item in registry.get("pages", [])
        if isinstance(item, dict) and item.get("status") in {"complete", "pilot-complete"}
        for key in ("component", "entryComponent")
        if isinstance(item.get(key), str)
    }
    pages: list[dict[str, Any]] = []
    for path in sorted(PAGES_ROOT.rglob("*.tsx"), key=lambda item: item.as_posix().lower()):
        source = relative(path)
        analysis = analyze_source(path)
        risk, reason = risk_for(path, analysis)
        pages.append({
            "id": page_id(path),
            "source": source,
            "scopeHint": scope_hint(path),
            "routeEntry": source in route_hints,
            "routeHints": route_hints.get(source, []),
            "registered": source in registered_paths,
            "completed": source in completed_paths,
            "risk": risk,
            "reason": reason,
            "analysis": analysis,
            "adoption": "registered" if source in registered_paths else "review-only",
        })

    by_risk = {risk: sum(item["risk"] == risk for item in pages) for risk in ("low", "review", "high")}
    batches = []
    for batch_id, risk, label, wave_size in (
        ("B01", "low", "低风险候选：仅列队与单页验证", 5),
        ("B02", "review", "业务交互候选：逐页影响审查", 8),
        ("B03", "high", "高风险治理页：专项方案后再处理", 3),
    ):
        candidates = [item["id"] for item in pages if item["routeEntry"] and item["risk"] == risk and not item["registered"]]
        waves = [
            {"id": f"{batch_id}-{index + 1:02d}", "mode": "single-page-authorized", "candidatePageIds": candidates[offset:offset + wave_size]}
            for index, offset in enumerate(range(0, len(candidates), wave_size))
        ]
        batches.append({
            "id": batch_id,
            "label": label,
            "mode": "review-only",
            "risk": risk,
            "candidateCount": len(candidates),
            "waveSize": wave_size,
            "candidatePageIds": candidates,
            "waves": waves,
            "entryCriteria": ["保持源码锁通过", "单页路由和租户上下文已确认", "无数据库、素材或备份写入"],
            "exitCriteria": ["人工确认模板与11区域", "通过小屏、开发器、可视化和共享契约检查", "明确获得单页接入授权"],
        })

    registered = sum(item["registered"] for item in pages)
    completed = sum(item["completed"] for item in pages)
    route_entries = sum(item["routeEntry"] for item in pages)
    registered_route_entries = sum(item["registered"] and item["routeEntry"] for item in pages)
    completed_route_entries = sum(item["completed"] and item["routeEntry"] for item in pages)
    route_risk = {risk: sum(item["routeEntry"] and item["risk"] == risk for item in pages) for risk in ("low", "review", "high")}
    expected_plan_ids = {item["id"] for item in pages if item["routeEntry"] and not item["registered"]}
    planned_ids = [page_id for batch in batches for page_id in batch["candidatePageIds"]]
    duplicate_plan_ids = sorted({page_id for page_id in planned_ids if planned_ids.count(page_id) > 1})
    unplanned_ids = sorted(expected_plan_ids - set(planned_ids))
    plan_complete = not unplanned_ids and not duplicate_plan_ids and len(set(planned_ids)) == len(expected_plan_ids)
    baseline_diff = compare_baseline(inventory_version, pages)
    progress_steps = [
        {"id": "route-census", "label": "全平台路由普查", "weight": 20, "complete": routing_audit["mappedRouteDeclarations"] == routing_audit["literalRouteDeclarations"] and not routing_audit["unmappedRouteTargets"] and routing_audit["routeIdentityCoveragePercent"] == 100 and not routing_audit["ownershipMismatches"]},
        {"id": "source-risk", "label": "源码特征风险分级", "weight": 20, "complete": all("analysis" in item for item in pages if item["routeEntry"])},
        {"id": "batch-plan", "label": "完整分批与波次计划", "weight": 20, "complete": plan_complete},
        {"id": "coverage-data", "label": "覆盖率中心数据", "weight": 20, "complete": route_entries > 0 and sum(route_risk.values()) == route_entries},
        {"id": "difference-baseline", "label": "普查差异基线", "weight": 20, "complete": baseline_diff["status"] == "unchanged" and baseline_diff["baselineVersion"] == inventory_version},
    ]
    progress_percent = sum(item["weight"] for item in progress_steps if item["complete"])
    return {
        "schemaVersion": 1,
        "phase": "page-factory-phase-2",
        "mode": "read-only-census",
        "sourceOfTruth": "frontend/src/pages + frontend/src/page-factory/page-registry.json",
        "inventoryVersion": inventory_version,
        "routingAudit": routing_audit,
        "baselineDiff": baseline_diff,
        "phaseProgress": {
            "phase": "page-factory-phase-2",
            "version": inventory_version,
            "completedPercent": progress_percent,
            "steps": progress_steps,
        },
        "planSummary": {
            "eligibleRouteEntries": len(expected_plan_ids),
            "plannedRouteEntries": len(set(planned_ids)),
            "unplannedPageIds": unplanned_ids,
            "duplicatePageIds": duplicate_plan_ids,
            "complete": plan_complete,
        },
        "totals": {
            "pageFiles": len(pages),
            "registered": registered,
            "completed": completed,
            "unregistered": len(pages) - registered,
            "coveragePercent": round((completed / len(pages) * 100) if pages else 0, 2),
            "routeEntries": route_entries,
            "supportFiles": len(pages) - route_entries,
            "registeredRouteEntries": registered_route_entries,
            "completedRouteEntries": completed_route_entries,
            "routeCoveragePercent": round((completed_route_entries / route_entries * 100) if route_entries else 0, 2),
            "risk": by_risk,
            "routeRisk": route_risk,
        },
        "guardrails": [
            "只读普查不修改任何业务页面。",
            "不批量接入、不批量改写、不自动登记。",
            "禁止读取或写入数据库、上传素材、正式备份和外部服务器。",
            "每次接入必须获得单页授权，并继续使用 page_factory.py 的计划优先流程。",
        ],
        "batches": batches,
        "pages": pages,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Page Factory phase-two read-only census")
    parser.add_argument("--write-report", action="store_true", help="write only the deterministic code-owned inventory JSON")
    parser.add_argument("--write-baseline", action="store_true", help="write only the code-owned census difference baseline")
    args = parser.parse_args(argv)
    report = build_inventory()
    writes = 0
    if args.write_baseline:
        BASELINE_FILE.write_text(json.dumps(baseline_payload(report["inventoryVersion"], report["pages"]), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        writes += 1
        report = build_inventory()
    if args.write_report:
        REPORT_FILE.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        writes += 1
    print(json.dumps({"dryRun": writes == 0, "filesystemWrites": writes, "phaseProgress": report["phaseProgress"], "baselineDiff": report["baselineDiff"], "totals": report["totals"], "batches": len(report["batches"]), "guardrails": len(report["guardrails"])}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
