import json
import os
from pathlib import Path
import re
import subprocess
import sys

from core.path_registry import (
    PATH_FIELD_NAMES,
    PATH_REGISTRY_ENV_VAR,
    ensure_path_config_file,
    get_path_registry,
    initialize_local_storage_layout,
)


def test_default_registry_relocates_with_workspace_without_creating_storage(monkeypatch, tmp_path):
    monkeypatch.delenv(PATH_REGISTRY_ENV_VAR, raising=False)
    workspace_root = tmp_path / "relocated-ruanjian"
    app_root = workspace_root / "00-platform-source"
    app_root.mkdir(parents=True)

    paths = get_path_registry(app_root=app_root)

    assert paths.codex_root == workspace_root.resolve()
    assert paths.app_root == app_root.resolve()
    assert paths.hq_program_root == (workspace_root / "01-hq-source-control").resolve()
    assert paths.website_style_root == (app_root / "shared" / "contracts").resolve()
    assert paths.program_backup_root == (workspace_root / "local-data" / "backup-staging" / "program").resolve()
    assert paths.site_backup_root == (workspace_root / "local-data" / "backup-staging" / "website").resolve()
    assert paths.path_config_file == (workspace_root / "local-data" / "config" / "path-registry.json").resolve()
    assert not (workspace_root / "local-data").exists()


def test_workspace_config_ignores_existing_legacy_absolute_paths_but_resolves_relative_values(monkeypatch, tmp_path):
    monkeypatch.delenv(PATH_REGISTRY_ENV_VAR, raising=False)
    workspace_root = tmp_path / "current-ruanjian"
    app_root = workspace_root / "00-platform-source"
    app_root.mkdir(parents=True)
    legacy_root = tmp_path / "legacy-drive-still-online"
    legacy_root.mkdir()

    config_file = workspace_root / "local-data" / "config" / "path-registry.json"
    config_file.parent.mkdir(parents=True)
    config_file.write_text(
        json.dumps(
            {
                "codexRoot": str(legacy_root),
                "projectRoot": str(legacy_root / "00-platform-source"),
                "appRoot": str(legacy_root / "00-platform-source"),
                "hqProgramRoot": str(legacy_root / "01-hq-source-control"),
                "websiteStyleRoot": "01-hq-source-control/templates/website-style",
                "programBackupRoot": str(legacy_root / "backups" / "program"),
                "assetResourceRoot": "local-data/custom-assets",
            }
        ),
        encoding="utf-8",
    )

    paths = get_path_registry(app_root=app_root)

    assert paths.codex_root == workspace_root.resolve()
    assert paths.app_root == app_root.resolve()
    assert paths.hq_program_root == (workspace_root / "01-hq-source-control").resolve()
    assert paths.website_style_root == (app_root / "shared" / "contracts").resolve()
    assert paths.program_backup_root == (workspace_root / "local-data" / "backup-staging" / "program").resolve()
    assert paths.asset_resource_root == (workspace_root / "local-data" / "custom-assets").resolve()


def test_explicit_environment_config_can_override_absolute_paths(monkeypatch, tmp_path):
    workspace_root = tmp_path / "current-ruanjian"
    source_app_root = workspace_root / "00-platform-source"
    source_app_root.mkdir(parents=True)
    external_config = tmp_path / "operator-config" / "path-registry.json"
    external_config.parent.mkdir()
    custom_root = tmp_path / "operator-selected-root"
    external_config.write_text(
        json.dumps(
            {
                "codexRoot": str(custom_root),
                "projectRoot": str(custom_root / "source"),
                "appRoot": str(custom_root / "source"),
                "hqProgramRoot": str(custom_root / "hq-artifacts"),
                "websiteStyleRoot": str(custom_root / "website-style-contracts"),
                "assetResourceRoot": "local-data/operator-assets",
            }
        ),
        encoding="utf-8",
    )
    monkeypatch.setenv(PATH_REGISTRY_ENV_VAR, str(external_config))

    paths = get_path_registry(app_root=source_app_root)

    assert paths.path_config_file == external_config.resolve()
    assert paths.codex_root == custom_root.resolve()
    assert paths.app_root == (custom_root / "source").resolve()
    assert paths.hq_program_root == (custom_root / "hq-artifacts").resolve()
    assert paths.website_style_root == (custom_root / "website-style-contracts").resolve()
    assert paths.asset_resource_root == (workspace_root / "local-data" / "operator-assets").resolve()


def test_explicit_config_creation_writes_only_workspace_relative_values(monkeypatch, tmp_path):
    monkeypatch.delenv(PATH_REGISTRY_ENV_VAR, raising=False)
    workspace_root = tmp_path / "portable-ruanjian"
    app_root = workspace_root / "00-platform-source"
    app_root.mkdir(parents=True)

    config_file = ensure_path_config_file(app_root=app_root)
    payload = json.loads(config_file.read_text(encoding="utf-8"))

    assert config_file == (workspace_root / "local-data" / "config" / "path-registry.json").resolve()
    assert payload["template"] == "workspace-relative"
    assert payload["appRoot"] == "00-platform-source"
    assert payload["websiteStyleRoot"] == "00-platform-source/shared/contracts"
    for key in PATH_FIELD_NAMES:
        value = str(payload[key])
        assert not Path(value).is_absolute()
        assert not re.match(r"^[A-Za-z]:[\\/]", value)


def test_explicit_local_initializer_creates_config_and_standard_storage(monkeypatch, tmp_path):
    monkeypatch.delenv(PATH_REGISTRY_ENV_VAR, raising=False)
    workspace_root = tmp_path / "first-start-ruanjian"
    app_root = workspace_root / "00-platform-source"
    app_root.mkdir(parents=True)
    paths = get_path_registry(app_root=app_root)

    assert not paths.path_config_file.exists()
    initialize_local_storage_layout(paths)

    assert paths.path_config_file.is_file()
    assert paths.active_database_file.parent.is_dir()
    assert paths.asset_resource_root.is_dir()
    assert paths.program_backup_root.is_dir()
    assert paths.site_backup_root.is_dir()


def test_source_registry_template_has_no_machine_drive_or_absolute_path():
    template_file = Path(__file__).resolve().parents[1] / "data_models" / "path_registry.json"
    raw = template_file.read_text(encoding="utf-8")
    payload = json.loads(raw)

    assert not re.search(r"[A-Za-z]:[\\/]", raw)
    assert payload["template"] == "workspace-relative-example-only"
    assert payload["websiteStyleRoot"] == "00-platform-source/shared/contracts"
    for key in PATH_FIELD_NAMES:
        value = str(payload[key])
        assert not Path(value).is_absolute()
        assert not re.match(r"^[A-Za-z]:[\\/]", value)


def test_importing_local_dev_with_missing_explicit_config_does_not_create_it(tmp_path):
    config_file = tmp_path / "nonexistent-config" / "path-registry.json"
    backend_root = Path(__file__).resolve().parents[1]
    environment = {
        **os.environ,
        PATH_REGISTRY_ENV_VAR: str(config_file),
        "PYTHONDONTWRITEBYTECODE": "1",
    }

    result = subprocess.run(
        [sys.executable, "-c", "import routers.local_dev"],
        cwd=backend_root,
        env=environment,
        capture_output=True,
        text=True,
        timeout=30,
        check=False,
    )

    assert result.returncode == 0, result.stderr
    assert not config_file.exists()
    assert not config_file.parent.exists()
