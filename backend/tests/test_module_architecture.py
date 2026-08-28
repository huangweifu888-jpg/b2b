import json
from dataclasses import replace
from pathlib import Path

import pytest

from core.path_registry import build_module_architecture_catalog, get_path_registry


REQUIRED_FIELDS = {
    "contractVersion",
    "strategy",
    "productSourceOfTruth",
    "technicalCatalogFile",
    "categoriesRoot",
    "shellCompositionsRoot",
    "migrationPhase",
    "categories",
    "legacyMappings",
    "pilotApplications",
    "compositions",
    "deploymentBoundary",
    "principles",
    "errors",
    "resolvedPaths",
}


def _write_contract(app_root: Path) -> Path:
    contract_file = app_root / "modules" / "module-architecture.json"
    contract_file.parent.mkdir(parents=True)
    contract_file.write_text(
        json.dumps(
            {
                "contractVersion": "1.0",
                "strategy": {"id": "progressive-modular-monolith", "repositoryModel": "single-source-monorepo"},
                "productSourceOfTruth": {
                    "file": "frontend/src/lib/factory-platform-blueprint.ts",
                    "authority": "product",
                    "categoryCount": 12,
                    "applicationCount": 72,
                    "owns": ["application-ids"],
                },
                "technicalCatalogFile": "modules/registry.json",
                "categoriesRoot": "modules/categories",
                "shellCompositionsRoot": {
                    "sourceShell": "zbcx/compositions",
                    "agencyRuntimeShell": "dlcx",
                    "clientRuntimeShell": "khcs",
                },
                "migrationPhase": {"id": "phase-1", "label": "Contract first"},
                "categories": {
                    "c01_identity": {"order": 1, "label": "Identity", "applicationIds": ["product-intelligence"]}
                },
                "legacyMappings": [{"id": "00-product-market", "targetCategoryId": "c01_identity"}],
                "pilotApplications": [
                    {
                        "id": "deepen.social-matrix",
                        "categoryId": "deepen",
                        "directory": "modules/categories/c05_deepen/apps/social_matrix",
                        "manifest": "modules/categories/c05_deepen/apps/social_matrix/app.manifest.json",
                    }
                ],
                "compositions": {
                    "hq": {
                        "label": "HQ",
                        "file": "zbcx/compositions/hq.json",
                        "applicationIds": ["product-intelligence"],
                    }
                },
                "deploymentBoundary": {"source": "modules", "release": "deployment"},
                "principles": ["single-source", {"id": "contracts-only"}],
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    return contract_file


def test_module_architecture_follows_a_relocated_app_root(tmp_path):
    app_root = tmp_path / "relocated-platform-source"
    contract_file = _write_contract(app_root)
    relocated_paths = replace(get_path_registry(), app_root=app_root)

    catalog = build_module_architecture_catalog(relocated_paths)

    assert REQUIRED_FIELDS <= catalog.keys()
    assert catalog["available"] is True
    assert Path(catalog["sourceFile"]) == contract_file.resolve()
    assert catalog["categoriesRoot"] == "modules/categories"
    assert catalog["shellCompositionsRoot"]["sourceShell"] == "zbcx/compositions"
    assert catalog["productSourceOfTruth"]["categoryCount"] == 12
    assert catalog["categories"][0]["id"] == "c01_identity"
    assert catalog["pilotApplications"][0]["id"] == "deepen.social-matrix"
    assert catalog["compositions"][0]["id"] == "hq"
    assert Path(catalog["resolvedPaths"]["contractFile"]) == contract_file.resolve()
    assert Path(catalog["resolvedPaths"]["technicalCatalog"]).is_relative_to(app_root)
    assert Path(catalog["resolvedPaths"]["compositionsById"]["hq"]).is_relative_to(app_root)
    assert Path(catalog["resolvedPaths"]["pilotManifestById"]["deepen.social-matrix"]).is_relative_to(app_root)
    assert catalog["errors"] == []


def test_module_architecture_bad_file_degrades_to_a_complete_safe_shape(tmp_path):
    app_root = tmp_path / "broken-platform-source"
    contract_file = app_root / "modules" / "module-architecture.json"
    contract_file.parent.mkdir(parents=True)
    contract_file.write_text("{ definitely-not-json", encoding="utf-8")
    relocated_paths = replace(get_path_registry(), app_root=app_root)

    catalog = build_module_architecture_catalog(relocated_paths)

    assert REQUIRED_FIELDS <= catalog.keys()
    assert catalog["available"] is False
    assert catalog["categories"] == []
    assert catalog["compositions"] == []
    assert catalog["deploymentBoundary"] == {}
    assert catalog["errors"] and "Invalid module architecture contract" in catalog["errors"][0]


def test_module_architecture_rejects_paths_outside_the_source_root(tmp_path):
    app_root = tmp_path / "safe-platform-source"
    contract_file = _write_contract(app_root)
    payload = json.loads(contract_file.read_text(encoding="utf-8"))
    payload["categoriesRoot"] = "../../outside"
    payload["technicalCatalogFile"] = str((tmp_path / "external-registry.json").resolve())
    contract_file.write_text(json.dumps(payload), encoding="utf-8")
    relocated_paths = replace(get_path_registry(), app_root=app_root)

    catalog = build_module_architecture_catalog(relocated_paths)

    assert catalog["categoriesRoot"] == "modules"
    assert catalog["technicalCatalogFile"] == "modules/technical-category-catalog.json"
    assert len(catalog["errors"]) == 2


@pytest.mark.asyncio
async def test_workspace_endpoint_exposes_module_architecture(monkeypatch, tmp_path):
    import routers.local_dev as local_dev

    app_root = tmp_path / "api-platform-source"
    _write_contract(app_root)
    relocated_paths = replace(get_path_registry(), app_root=app_root)
    monkeypatch.setattr(local_dev, "get_path_registry", lambda: relocated_paths)
    monkeypatch.setattr(local_dev, "initialize_local_storage_layout", lambda paths: paths)

    payload = await local_dev.workspace_info()

    assert payload["moduleArchitecture"]["available"] is True
    assert payload["moduleArchitecture"]["contractVersion"] == "1.0"
    assert Path(payload["moduleArchitecture"]["sourceFile"]).is_relative_to(app_root)
