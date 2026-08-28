from pathlib import Path

import pytest
from fastapi import HTTPException

from core.config import settings
from routers.content_downloads import _asset_root
from services.job_worker import PermanentJobError, ROOT, _within, _worker_storage_root


def test_job_worker_uses_source_relative_local_roots(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "development")
    monkeypatch.delenv("BACKUP_WORKER_ROOT", raising=False)
    monkeypatch.delenv("RELEASE_ARTIFACT_ROOT", raising=False)

    assert _worker_storage_root("BACKUP_WORKER_ROOT") == (ROOT.parent / "local-data" / "backup-staging").resolve()
    assert _worker_storage_root("RELEASE_ARTIFACT_ROOT") == (ROOT.parent / "local-data" / "release-artifacts").resolve()


def test_job_worker_requires_absolute_roots_outside_local_development(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.delenv("BACKUP_WORKER_ROOT", raising=False)
    with pytest.raises(PermanentJobError, match="BACKUP_WORKER_ROOT:required-absolute-path"):
        _worker_storage_root("BACKUP_WORKER_ROOT")

    monkeypatch.setenv("RELEASE_ARTIFACT_ROOT", "relative/releases")
    with pytest.raises(PermanentJobError, match="RELEASE_ARTIFACT_ROOT:absolute-path-required"):
        _worker_storage_root("RELEASE_ARTIFACT_ROOT")


def test_job_worker_path_boundary_still_rejects_escape(tmp_path):
    controlled_root = tmp_path / "controlled"
    controlled_root.mkdir()
    inside = controlled_root / "artifact.zip"
    outside = tmp_path / "outside.zip"

    assert _within(inside, controlled_root) == inside.resolve()
    with pytest.raises(PermanentJobError, match="outside its permitted root"):
        _within(outside, controlled_root)


def test_content_assets_use_source_relative_local_root(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "local")
    monkeypatch.delenv("ASSET_STORAGE_ROOT", raising=False)
    monkeypatch.setattr(settings, "asset_storage_root", "")

    source_root = Path(__file__).resolve().parents[2]
    assert _asset_root() == (source_root.parent / "local-data" / "objects" / "asset-private").resolve()


def test_content_assets_fail_closed_without_a_production_mount(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.delenv("ASSET_STORAGE_ROOT", raising=False)
    monkeypatch.setattr(settings, "asset_storage_root", "")

    with pytest.raises(HTTPException) as captured:
        _asset_root()
    assert captured.value.status_code == 503
    assert captured.value.detail == "ASSET_STORAGE_ROOT:required-absolute-path"


def test_content_assets_reject_relative_configured_mount(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "staging")
    monkeypatch.setenv("ASSET_STORAGE_ROOT", "relative/private-assets")

    with pytest.raises(HTTPException) as captured:
        _asset_root()
    assert captured.value.status_code == 503
    assert captured.value.detail == "ASSET_STORAGE_ROOT:absolute-path-required"


def test_content_assets_accept_a_native_absolute_mount(monkeypatch, tmp_path):
    configured = tmp_path / "private-assets"
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("ASSET_STORAGE_ROOT", str(configured))

    assert _asset_root() == configured.resolve()
