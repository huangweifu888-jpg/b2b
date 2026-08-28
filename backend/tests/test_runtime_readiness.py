from pathlib import Path

import pytest

from core.config import settings
from core.runtime_readiness import (
    RuntimeStorageConfigurationError,
    deployment_readiness,
    development_storage_root,
    is_absolute_runtime_path,
    production_runtime_configuration_errors,
    resolve_runtime_storage_root,
)
from scripts.container_entrypoint import command_for_component


def test_production_readiness_requires_shared_runtime_dependencies(monkeypatch):
    monkeypatch.delenv("ENVIRONMENT", raising=False)
    monkeypatch.delenv("BACKUP_WORKER_ROOT", raising=False)
    monkeypatch.delenv("RELEASE_ARTIFACT_ROOT", raising=False)
    monkeypatch.setattr(settings, "environment", "production")
    monkeypatch.setattr(settings, "app_component", "api")
    monkeypatch.setattr(settings, "database_url", "sqlite:///local.sqlite3")
    monkeypatch.setattr(settings, "redis_url", "")
    monkeypatch.setattr(settings, "rate_limit_backend", "memory")
    monkeypatch.setattr(settings, "asset_storage_root", "")
    monkeypatch.setattr(settings, "asset_storage_uri", "")
    monkeypatch.setattr(settings, "backup_target", "")
    monkeypatch.setattr(settings, "backup_schedule_id", "")
    monkeypatch.setattr(settings, "restore_drill_reference", "")
    monkeypatch.setattr(settings, "deployment_id", "")
    monkeypatch.setattr(settings, "public_base_url", "http://localhost")
    monkeypatch.setattr(settings, "cors_allowed_origins", "http://localhost")

    errors = production_runtime_configuration_errors()
    assert "DATABASE_URL:postgresql-asyncpg-required" in errors
    assert "REDIS_URL:required" in errors
    assert "ASSET_STORAGE_ROOT:required-private-mount" in errors
    assert "BACKUP_WORKER_ROOT:required-private-mount" in errors
    assert "RELEASE_ARTIFACT_ROOT:required-private-mount" in errors
    assert "BACKUP_TARGET:offsite-object-storage-required" in errors
    assert "DEPLOYMENT_ID:invalid-or-missing" in errors
    assert deployment_readiness()["ready"] is False


def test_production_readiness_accepts_separate_postgres_redis_and_storage(monkeypatch, tmp_path):
    asset_root = tmp_path / "private-assets"
    backup_worker_root = tmp_path / "backup-verification"
    release_artifact_root = tmp_path / "release-artifacts"
    monkeypatch.delenv("ENVIRONMENT", raising=False)
    monkeypatch.setenv("BACKUP_WORKER_ROOT", str(backup_worker_root))
    monkeypatch.setenv("RELEASE_ARTIFACT_ROOT", str(release_artifact_root))
    monkeypatch.setattr(settings, "environment", "production")
    monkeypatch.setattr(settings, "app_component", "worker")
    monkeypatch.setattr(settings, "database_url", "postgresql+asyncpg://user:password@db.example.test/b2b")
    monkeypatch.setattr(settings, "redis_url", "rediss://redis.example.test:6380/0")
    monkeypatch.setattr(settings, "rate_limit_backend", "redis")
    monkeypatch.setattr(settings, "asset_storage_root", str(asset_root))
    monkeypatch.setattr(settings, "asset_storage_uri", "s3://private-assets/b2b")
    monkeypatch.setattr(settings, "backup_target", "s3://offsite-backups/b2b")
    monkeypatch.setattr(settings, "backup_schedule_id", "managed-backup-nightly")
    monkeypatch.setattr(settings, "restore_drill_reference", "restore-drill-202607")
    monkeypatch.setattr(settings, "deployment_id", "customer-stamp-a")
    monkeypatch.setattr(settings, "public_base_url", "https://customer.example.test")
    monkeypatch.setattr(settings, "cors_allowed_origins", "https://hq.example.test,https://customer.example.test")

    assert production_runtime_configuration_errors() == []
    readiness = deployment_readiness()
    assert readiness["component"] == "worker"
    assert readiness["database_engine"] == "postgresql"
    assert readiness["ready"] is True


def test_production_readiness_rejects_relative_runtime_storage_roots(monkeypatch):
    monkeypatch.delenv("ENVIRONMENT", raising=False)
    monkeypatch.setenv("BACKUP_WORKER_ROOT", "relative/backup")
    monkeypatch.setenv("RELEASE_ARTIFACT_ROOT", "relative/releases")
    monkeypatch.setattr(settings, "environment", "production")
    monkeypatch.setattr(settings, "asset_storage_root", "relative/assets")

    errors = production_runtime_configuration_errors()
    assert "ASSET_STORAGE_ROOT:absolute-path-required" in errors
    assert "BACKUP_WORKER_ROOT:absolute-path-required" in errors
    assert "RELEASE_ARTIFACT_ROOT:absolute-path-required" in errors


def test_runtime_path_flavours_are_validated_for_the_target_platform():
    assert is_absolute_runtime_path(r"C:\\b2b\\private-assets", platform="windows")
    assert not is_absolute_runtime_path(r"C:\\b2b\\private-assets", platform="posix")
    assert is_absolute_runtime_path("/srv/b2b/private-assets", platform="posix")
    assert not is_absolute_runtime_path("/srv/b2b/private-assets", platform="windows")


def test_development_storage_roots_follow_the_current_source_parent(tmp_path):
    source_root = tmp_path / "00-platform-source"

    assert development_storage_root("BACKUP_WORKER_ROOT", source_root=source_root) == (tmp_path / "local-data" / "backup-staging").resolve()
    assert development_storage_root("RELEASE_ARTIFACT_ROOT", source_root=source_root) == (tmp_path / "local-data" / "release-artifacts").resolve()
    assert development_storage_root("ASSET_STORAGE_ROOT", source_root=source_root) == (tmp_path / "local-data" / "objects" / "asset-private").resolve()
    assert resolve_runtime_storage_root(
        "ASSET_STORAGE_ROOT",
        "",
        environment="development",
        source_root=source_root,
    ) == (tmp_path / "local-data" / "objects" / "asset-private").resolve()


def test_production_storage_root_never_falls_back_to_a_relative_path(tmp_path):
    with pytest.raises(RuntimeStorageConfigurationError, match="BACKUP_WORKER_ROOT:required-absolute-path"):
        resolve_runtime_storage_root(
            "BACKUP_WORKER_ROOT",
            "",
            environment="production",
            source_root=tmp_path / "00-platform-source",
        )
    with pytest.raises(RuntimeStorageConfigurationError, match="RELEASE_ARTIFACT_ROOT:absolute-path-required"):
        resolve_runtime_storage_root(
            "RELEASE_ARTIFACT_ROOT",
            "relative/releases",
            environment="staging",
            source_root=tmp_path / "00-platform-source",
        )


def test_container_entrypoint_selects_a_separate_worker_command():
    assert command_for_component("api")[2:4] == ["uvicorn", "main:app"]
    assert command_for_component("worker")[-1] == "scripts.run_job_worker"
