"""Validate the non-destructive B2B modular-platform foundation."""

from __future__ import annotations

import json
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
CODEX_ROOT = ROOT.parent
DESKTOP_WZ_ROOT = CODEX_ROOT / "local-data" / "site-public"
PORTABLE_WZ_ROOT = ROOT / "runtime" / "website"
DESKTOP_WZ_READY = (
    (DESKTOP_WZ_ROOT / "AGENTS.md").exists()
    and (DESKTOP_WZ_ROOT / "_plan-template" / "plan.yaml").exists()
)
WZ_ROOT = DESKTOP_WZ_ROOT if DESKTOP_WZ_READY else PORTABLE_WZ_ROOT

REQUIRED = [
    ROOT / "AGENTS.md",
    ROOT / "shared" / "contracts",
    ROOT / "platform" / "control-api",
    ROOT / "platform" / "tenant-registry",
    ROOT / "platform" / "template-engine",
    ROOT / "platform" / "release-manager",
    ROOT / "platform" / "worker",
    ROOT / "platform" / "worker" / "run_worker.py",
    ROOT / "platform" / "worker" / "README.md",
    ROOT / "modules" / "registry.json",
    ROOT / "modules" / "module-architecture.json",
    ROOT / "modules" / "technical-category-catalog.json",
    ROOT / "modules" / "02-content" / "module.manifest.json",
    ROOT / "modules" / "02-content" / "download-policy.example.yaml",
    ROOT / "modules" / "05-social-media" / "module.manifest.json",
    ROOT / "modules" / "categories" / "c05_deepen" / "category.manifest.json",
    ROOT / "modules" / "categories" / "c05_deepen" / "apps" / "social_matrix" / "app.manifest.json",
    ROOT / "zbcx" / "compositions" / "hq.json",
    ROOT / "zbcx" / "compositions" / "agency-source.json",
    ROOT / "zbcx" / "compositions" / "client-source.json",
    ROOT / "dlcx" / "composition.json",
    ROOT / "khcs" / "composition.json",
    ROOT / "backend" / "routers" / "module_registry.py",
    ROOT / "backend" / "routers" / "plan_runtime.py",
    ROOT / "backend" / "routers" / "content_downloads.py",
    ROOT / "backend" / "routers" / "audit_logs.py",
    ROOT / "backend" / "routers" / "operations.py",
    ROOT / "backend" / "routers" / "template_snapshot.py",
    ROOT / "backend" / "routers" / "release_rollouts.py",
    ROOT / "backend" / "services" / "audit.py",
    ROOT / "backend" / "services" / "content_scanner.py",
    ROOT / "backend" / "middlewares" / "request_security.py",
    ROOT / "backend" / "services" / "tenant_access.py",
    ROOT / "frontend" / "src" / "lib" / "module-registry.ts",
    ROOT / "deployment" / "env" / ".env.example",
    ROOT / "deployment" / "env" / "release.production.env.example",
    ROOT / "deployment" / "topology" / "service-units.yaml",
    ROOT / "deployment" / "containers" / "backend.Dockerfile",
    ROOT / "deployment" / "compose" / "customer-stamp.compose.example.yaml",
    ROOT / "deployment" / "compose" / "customer-stamp.runtime.env.example",
    ROOT / ".github" / "workflows" / "verify.yml",
    ROOT / "tools" / "release-preflight.ps1",
    ROOT / "tools" / "verify_release_readiness.py",
    ROOT / "tools" / "verify_tenant_end_to_end_matrix.py",
    ROOT / "tools" / "verify_content_download_security.py",
    ROOT / "tools" / "verify_sqlite_restore_drill.py",
    ROOT / "tools" / "verify_postgres_restore_drill.py",
    ROOT / "tools" / "run_postgres_restore_drill.ps1",
    ROOT / "tools" / "verify_observability_controls.py",
    ROOT / "tools" / "verify_audit_log_scope.py",
    ROOT / "tools" / "verify_template_snapshot_tenant_controls.py",
    ROOT / "tools" / "verify_request_security_controls.py",
    ROOT / "tools" / "verify_content_scanner_controls.py",
    ROOT / "tools" / "verify_release_rollout_controls.py",
    ROOT / "tools" / "verify_background_job_queue.py",
    ROOT / "tools" / "verify_job_worker.py",
    ROOT / "tools" / "verify_external_service_cutover.py",
    ROOT / "tools" / "verify_customer_stamp_deployment.py",
    ROOT / "tools" / "create_release_bundle.py",
    ROOT / "tools" / "verify_release_bundle.py",
    ROOT / "tools" / "verify_release_artifact_controls.py",
    ROOT / "tools" / "verify_backup_automation.py",
    ROOT / "tools" / "verify_secret_controls.py",
    ROOT / "tools" / "run_health_monitor.py",
    ROOT / "tools" / "install-local-health-monitor.ps1",
    ROOT / "tools" / "verify_health_monitor.py",
    ROOT / "tools" / "install-local-backup-schedule.ps1",
    ROOT / "docs" / "architecture" / "redis-rate-limit-runbook.md",
    ROOT / "docs" / "architecture" / "dedicated-worker-runbook.md",
    ROOT / "docs" / "architecture" / "backup-automation-runbook.md",
    ROOT / "docs" / "architecture" / "secret-management-runbook.md",
    ROOT / "docs" / "architecture" / "health-monitor-runbook.md",
    ROOT / "docs" / "architecture" / "release-artifact-runbook.md",
    ROOT / "deployment" / "schedules" / "backup-jobs.yaml",
    ROOT / "deployment" / "policies" / "observability.yaml",
    ROOT / "docs" / "architecture" / "observability-and-restore-runbook.md",
    ROOT / "docs" / "architecture" / "template-snapshot-tenant-migration.md",
    ROOT / "docs" / "architecture" / "request-security-controls.md",
    ROOT / "docs" / "architecture" / "content-scanner-production-runbook.md",
    ROOT / "docs" / "architecture" / "release-rollout-runbook.md",
    ROOT / "docs" / "architecture" / "external-service-cutover-runbook.md",
    ROOT / "docs" / "architecture" / "customer-stamp-deployment-runbook.md",
    ROOT / "docs" / "architecture" / "tenant-authorization-matrix.md",
    ROOT / "docs" / "architecture" / "postgres-restore-drill-runbook.md",
    WZ_ROOT / "AGENTS.md",
    WZ_ROOT / "_plan-template" / "plan.yaml",
]

LEGACY_MODULE_IDS = [
    "00-product-market",
    "01-momentum",
    "02-content",
    "03-seo",
    "04-geo",
    "05-social-media",
    "06-smart-ads",
    "07-inquiries",
    "08-reports",
    "09-crm",
    "10-health-dashboard",
]

CATEGORY_SPECS = [
    ("identity", "01", "c01_identity", "catalog-only"),
    ("content", "02", "c02_content", "catalog-only"),
    ("trust", "03", "c03_trust", "catalog-only"),
    ("recommend", "04", "c04_recommend", "catalog-only"),
    ("deepen", "05", "c05_deepen", "pilot-manifest"),
    ("portrait", "06", "c06_portrait", "catalog-only"),
    ("lead", "07", "c07_lead", "catalog-only"),
    ("convert", "08", "c08_convert", "catalog-only"),
    ("fulfillment", "09", "c09_fulfillment", "catalog-only"),
    ("care", "10", "c10_care", "catalog-only"),
    ("decision", "11", "c11_decision", "catalog-only"),
    ("operations", "12", "c12_operations", "catalog-only"),
]

LEGACY_TARGETS = {
    "00-product-market": ("control-plane", "control.product-market"),
    "01-momentum": ("category", "identity"),
    "02-content": ("category", "content"),
    "03-seo": ("category", "trust"),
    "04-geo": ("category", "recommend"),
    "05-social-media": ("application", "deepen.social-matrix"),
    "06-smart-ads": ("category", "lead"),
    "07-inquiries": ("category", "convert"),
    "08-reports": ("category", "portrait"),
    "09-crm": ("category", "care"),
    "10-health-dashboard": ("category", "decision"),
}

COMPOSITION_SPECS = [
    ("zbcx.headquarters", "zbcx/compositions/hq.json", "govern"),
    ("zbcx.agency-source", "zbcx/compositions/agency-source.json", "publish"),
    ("zbcx.client-source", "zbcx/compositions/client-source.json", "configure"),
    ("dlcx.agency-runtime", "dlcx/composition.json", "operate"),
    ("khcs.client-runtime", "khcs/composition.json", "use"),
]

PRODUCT_SOURCE = "frontend/src/lib/factory-platform-blueprint.ts"
TECHNICAL_CATALOG = "modules/technical-category-catalog.json"


def _read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def validate_progressive_module_architecture(root: Path = ROOT) -> list[str]:
    """Validate phase-one contracts without requiring the legacy code to move."""

    errors: list[str] = []
    architecture_path = root / "modules" / "module-architecture.json"
    catalog_path = root / TECHNICAL_CATALOG
    try:
        architecture = _read_json(architecture_path)
        catalog = _read_json(catalog_path)
    except (OSError, json.JSONDecodeError) as exc:
        return [f"Unable to read progressive module contracts: {exc}"]

    if architecture.get("contractVersion") != "1.0.0":
        errors.append("Unexpected module architecture contractVersion")
    strategy = architecture.get("strategy", {})
    if strategy.get("id") != "progressive-modular-monolith":
        errors.append("Module strategy must remain progressive-modular-monolith")
    product_source = architecture.get("productSourceOfTruth", {})
    if product_source.get("file") != PRODUCT_SOURCE:
        errors.append("Factory platform blueprint must remain the product source of truth")
    if product_source.get("categoryCount") != 12 or product_source.get("applicationCount") != 72:
        errors.append("Product source declaration must remain 12 categories and 72 applications")
    if not (root / PRODUCT_SOURCE).is_file():
        errors.append(f"Product source of truth is missing: {PRODUCT_SOURCE}")
    if architecture.get("technicalCatalogFile") != TECHNICAL_CATALOG:
        errors.append("Unexpected technical category catalog path")
    if architecture.get("categoriesRoot") != "modules/categories":
        errors.append("Unexpected progressive categories root")

    expected_categories = [
        {"id": category_id, "order": order, "directory": directory, "physicalState": state}
        for category_id, order, directory, state in CATEGORY_SPECS
    ]
    if catalog.get("categories") != expected_categories:
        errors.append("Technical category catalog must contain the ordered 12-category projection")
    if architecture.get("categories") != expected_categories:
        errors.append("Module architecture categories must match the technical catalog")
    if catalog.get("sourceOfTruth") != PRODUCT_SOURCE:
        errors.append("Technical catalog must point to the product source of truth")

    phase = architecture.get("migrationPhase", {})
    if phase.get("id") != "phase-1-contract-foundation":
        errors.append("Unexpected progressive migration phase")
    if phase.get("implementationMovesAllowed") is not False:
        errors.append("Phase one must not allow implementation moves")
    if phase.get("legacyAdaptersRequired") is not True:
        errors.append("Phase one must keep legacy adapters")

    mappings = architecture.get("legacyMappings", [])
    if [item.get("legacyModuleId") for item in mappings] != LEGACY_MODULE_IDS:
        errors.append("Legacy mapping order must preserve the 11-module registry")
    for mapping in mappings:
        legacy_id = mapping.get("legacyModuleId")
        expected_target = LEGACY_TARGETS.get(legacy_id)
        actual_target = (mapping.get("targetKind"), mapping.get("targetId"))
        if expected_target and actual_target != expected_target:
            errors.append(f"Unexpected legacy target for {legacy_id}: {actual_target}")

    categories_root = root / "modules" / "categories"
    for category_id, _, directory, state in CATEGORY_SPECS:
        category_path = categories_root / directory
        if state == "catalog-only" and category_path.exists():
            errors.append(
                f"Catalog-only category must not create an empty phase-one folder: {category_id}"
            )

    pilot_applications = architecture.get("pilotApplications", [])
    if len(pilot_applications) != 1:
        errors.append("Phase one must declare exactly one pilot application")
    else:
        pilot = pilot_applications[0]
        if pilot.get("id") != "deepen.social-matrix":
            errors.append("Unexpected pilot application")
        if pilot.get("legacyModuleId") != "05-social-media":
            errors.append("Pilot must preserve the 05-social-media compatibility owner")
        if pilot.get("migrationState") != "manifest-only" or pilot.get("implementationMoved") is not False:
            errors.append("Pilot must remain manifest-only until contract tests and adapters pass")

    pilot_manifest_path = (
        root / "modules" / "categories" / "c05_deepen" / "apps" / "social_matrix" / "app.manifest.json"
    )
    try:
        pilot_manifest = _read_json(pilot_manifest_path)
    except (OSError, json.JSONDecodeError) as exc:
        errors.append(f"Unable to read pilot manifest: {exc}")
    else:
        if pilot_manifest.get("applicationId") != "deepen.social-matrix":
            errors.append("Pilot manifest application ID is invalid")
        if pilot_manifest.get("migrationState") != "manifest-only":
            errors.append("Pilot manifest must remain manifest-only in phase one")
        if pilot_manifest.get("implementationMoved") is not False:
            errors.append("Pilot implementation must not be copied or moved in phase one")
        if pilot_manifest.get("downloadEnabled") is not False:
            errors.append("Social matrix pilot must not expose public plan downloads")
        pilot_files = [path for path in pilot_manifest_path.parent.rglob("*") if path.is_file()]
        if pilot_files != [pilot_manifest_path]:
            errors.append("Pilot directory must contain only its manifest in phase one")

    expected_category_ids = [item[0] for item in CATEGORY_SPECS]
    architecture_compositions = architecture.get("compositions", [])
    expected_composition_declarations = [
        {"id": composition_id, "file": file_path, "mode": mode}
        for composition_id, file_path, mode in COMPOSITION_SPECS
    ]
    if architecture_compositions != expected_composition_declarations:
        errors.append("Module architecture composition declarations are invalid")

    for composition_id, file_path, mode in COMPOSITION_SPECS:
        try:
            composition = _read_json(root / file_path)
        except (OSError, json.JSONDecodeError) as exc:
            errors.append(f"Unable to read composition {composition_id}: {exc}")
            continue
        if composition.get("compositionId") != composition_id:
            errors.append(f"Composition ID mismatch in {file_path}")
        if composition.get("mode") != mode or composition.get("codePolicy") != "reference-only":
            errors.append(f"Composition {composition_id} must be reference-only in mode {mode}")
        if composition.get("categoryCatalog") != TECHNICAL_CATALOG:
            errors.append(f"Composition {composition_id} must use the technical category catalog")
        resolution = composition.get("applicationResolution", {})
        if resolution.get("sourceFile") != PRODUCT_SOURCE:
            errors.append(f"Composition {composition_id} must resolve applications from the product source")
        refs = composition.get("categoryRefs", [])
        if [item.get("id") for item in refs] != expected_category_ids:
            errors.append(f"Composition {composition_id} must reference all category IDs in catalog order")
        if any(item.get("mode") != mode or set(item) != {"id", "mode"} for item in refs):
            errors.append(f"Composition {composition_id} category refs may contain only stable ID and mode")

    deployment_boundary = architecture.get("deploymentBoundary", {})
    if deployment_boundary.get("roleIds") != ["01", "02", "03", "04", "05", "06", "07"]:
        errors.append("Deployment boundary must preserve generated roles 01-07")
    if deployment_boundary.get("moduleMeaning") != "development-ownership-and-test-boundary":
        errors.append("Module and deployment boundaries must remain separate")

    required_principles = {
        "one-source-tree",
        "shells-reference-stable-ids",
        "tenant-and-plan-are-data",
        "contracts-before-imports",
        "no-empty-directory-catalog",
        "tenant-context",
        "download-owner",
        "generated-delivery",
    }
    principle_ids = {item.get("id") for item in architecture.get("principles", [])}
    if not required_principles.issubset(principle_ids):
        errors.append("Module architecture is missing fixed management principles")

    return errors


def main() -> int:
    errors: list[str] = []
    missing = [str(path) for path in REQUIRED if not path.exists()]
    if missing:
        errors.append("Missing required architecture paths:\n" + "\n".join(missing))

    registry_path = ROOT / "modules" / "registry.json"
    registry = json.loads(registry_path.read_text(encoding="utf-8"))
    modules = registry.get("modules", [])
    ids = [item.get("id") for item in modules]
    if ids != LEGACY_MODULE_IDS:
        errors.append(f"Unexpected legacy module registry order: {ids}")
    download_owners = [item.get("id") for item in modules if item.get("downloadEnabled")]
    if download_owners != ["02-content"]:
        errors.append(f"Exactly 02-content must expose plan downloads: {download_owners}")
    missing_manifests = [
        module_id for module_id in LEGACY_MODULE_IDS
        if not (ROOT / "modules" / module_id / "module.manifest.json").exists()
    ]
    if missing_manifests:
        errors.append(f"Missing legacy module manifests: {missing_manifests}")

    errors.extend(validate_progressive_module_architecture(ROOT))

    desktop_misc = CODEX_ROOT / "local-data" / "protected-misc"
    portable_misc = ROOT / "runtime" / "zcwj"
    if not desktop_misc.exists() and not portable_misc.exists():
        errors.append("Expected protected misc-files root is missing")

    if errors:
        print("Platform layout validation failed:")
        print("\n".join(f"- {error}" for error in errors))
        return 1

    print("Platform layout: OK")
    print(f"Legacy compatibility module count: {len(modules)}")
    print(f"Technical category count: {len(CATEGORY_SPECS)}")
    print("Pilot application count: 1 (manifest-only)")
    print(f"Shell composition count: {len(COMPOSITION_SPECS)}")
    print("Download owner: 02-content")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
