"""Validate a staging/production release configuration without exposing secrets."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[1]
PLACEHOLDER_TOKENS = ("change-me", "replace", "example", "placeholder", "your-")
REQUIRED_KEYS = (
    "ENVIRONMENT",
    "DATABASE_SCHEMA_MODE",
    "DATABASE_URL",
    "REDIS_URL",
    "RATE_LIMIT_BACKEND",
    "DEPLOYMENT_ID",
    "ASSET_STORAGE_ROOT",
    "ASSET_STORAGE_URI",
    "BACKUP_TARGET",
    "BACKUP_SCHEDULE_ID",
    "RESTORE_DRILL_REFERENCE",
    "PUBLIC_BASE_URL",
    "CONTENT_DOWNLOAD_SECRET",
    "JWT_SECRET_KEY",
    "MASK_KEY",
    "CONTENT_DOWNLOAD_SCANNER_COMMAND_JSON",
)


def load_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for number, raw_line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            raise ValueError(f"Invalid environment line {number}: expected KEY=VALUE")
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def is_placeholder(value: str) -> bool:
    normalized = value.lower().strip()
    return not normalized or any(token in normalized for token in PLACEHOLDER_TOKENS)


def validate(values: dict[str, str], *, require_production: bool) -> list[str]:
    errors = [f"Missing required value: {key}" for key in REQUIRED_KEYS if is_placeholder(values.get(key, ""))]
    environment = values.get("ENVIRONMENT", "").lower()
    if environment not in {"staging", "production"}:
        errors.append("ENVIRONMENT must be staging or production")
    if require_production and environment != "production":
        errors.append("This preflight was invoked for production but ENVIRONMENT is not production")
    if values.get("DATABASE_SCHEMA_MODE", "").lower() != "migrate":
        errors.append("DATABASE_SCHEMA_MODE must be migrate outside local development")
    database_url = values.get("DATABASE_URL", "")
    if database_url.startswith("sqlite"):
        errors.append("DATABASE_URL must use a managed server database, not SQLite")
    if not database_url.startswith(("postgresql+asyncpg://", "postgresql://")):
        errors.append("DATABASE_URL must use a PostgreSQL connection URL")
    if values.get("RATE_LIMIT_BACKEND", "").lower() != "redis":
        errors.append("RATE_LIMIT_BACKEND must be redis outside local development")
    if not values.get("REDIS_URL", "").startswith(("redis://", "rediss://")):
        errors.append("REDIS_URL must use a Redis connection URL")
    if len(values.get("CONTENT_DOWNLOAD_SECRET", "")) < 32:
        errors.append("CONTENT_DOWNLOAD_SECRET must be at least 32 characters")
    if len(values.get("JWT_SECRET_KEY", "")) < 32:
        errors.append("JWT_SECRET_KEY must be at least 32 characters")
    if values.get("CONTENT_DOWNLOAD_SECRET") == values.get("JWT_SECRET_KEY"):
        errors.append("CONTENT_DOWNLOAD_SECRET and JWT_SECRET_KEY must be different values")
    if len(values.get("MASK_KEY", "")) < 32:
        errors.append("MASK_KEY must be at least 32 characters")
    if values.get("MASK_KEY") in {values.get("CONTENT_DOWNLOAD_SECRET"), values.get("JWT_SECRET_KEY")}:
        errors.append("MASK_KEY must be different from JWT and download secrets")
    try:
        scanner_command = json.loads(values.get("CONTENT_DOWNLOAD_SCANNER_COMMAND_JSON", ""))
        if not isinstance(scanner_command, list) or "{file}" not in scanner_command:
            raise ValueError
    except (TypeError, ValueError, json.JSONDecodeError):
        errors.append("CONTENT_DOWNLOAD_SCANNER_COMMAND_JSON must be a JSON command array containing {file}")
    if values.get("DEPLOYMENT_ID") == "shared-stamp-a":
        errors.append("DEPLOYMENT_ID must name the real staging/production deployment unit")
    backup_target = values.get("BACKUP_TARGET", "")
    if not backup_target.startswith(("s3://", "az://", "gs://")):
        errors.append("BACKUP_TARGET must be an offsite object-storage URI (s3://, az://, or gs://)")
    if len(values.get("RESTORE_DRILL_REFERENCE", "")) < 8:
        errors.append("RESTORE_DRILL_REFERENCE must identify a recent documented restore drill")
    asset_uri = values.get("ASSET_STORAGE_URI", "")
    if not asset_uri.startswith(("s3://", "az://", "gs://")):
        errors.append("ASSET_STORAGE_URI must be private object storage in staging/production")
    asset_root = values.get("ASSET_STORAGE_ROOT", "")
    is_absolute_mount = Path(asset_root).is_absolute() or asset_root.startswith("/")
    if asset_root.startswith(("s3://", "az://", "gs://")) or not is_absolute_mount:
        errors.append("ASSET_STORAGE_ROOT must be an absolute private mount path, not an object-storage URI")
    if asset_uri == backup_target:
        errors.append("ASSET_STORAGE_URI and BACKUP_TARGET must use separate storage locations")
    public_url = urlparse(values.get("PUBLIC_BASE_URL", ""))
    if public_url.scheme != "https" or not public_url.netloc:
        errors.append("PUBLIC_BASE_URL must be an HTTPS URL")
    return errors


def verify_manifest(path: Path) -> list[str]:
    try:
        manifest = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        return [f"Cannot read release manifest: {exc}"]
    for key in ("role", "version", "deploymentId", "files"):
        if not manifest.get(key):
            return [f"Release manifest is missing {key}"]
    if manifest["deploymentId"] == "shared-stamp-a":
        return ["Release manifest must use the real deployment ID, not the local default"]
    return []


def self_test() -> int:
    """Exercise the gate with non-secret in-memory values for CI."""
    valid = {
        "ENVIRONMENT": "production",
        "DATABASE_SCHEMA_MODE": "migrate",
        "DATABASE_URL": "postgresql+asyncpg://release_user:release_password@db.internal:5432/b2b",
        "REDIS_URL": "rediss://release_cache:6380/0",
        "RATE_LIMIT_BACKEND": "redis",
        "DEPLOYMENT_ID": "prod-customer-stamp-a",
        "ASSET_STORAGE_ROOT": "/srv/b2b/private-assets",
        "ASSET_STORAGE_URI": "s3://private-assets-prod/b2b-assets",
        "BACKUP_TARGET": "s3://offsite-backups-prod/b2b-backups",
        "BACKUP_SCHEDULE_ID": "db-backup-prod-daily-0230",
        "RESTORE_DRILL_REFERENCE": "OPS-RESTORE-20260728",
        "PUBLIC_BASE_URL": "https://b2b.release-check.invalid",
        "CONTENT_DOWNLOAD_SECRET": "download-secret-0123456789-abcdefghijklmnopqrstuvwxyz",
        "JWT_SECRET_KEY": "jwt-secret-9876543210-abcdefghijklmnopqrstuvwxyz",
        "MASK_KEY": "mask-secret-2468013579-abcdefghijklmnopqrstuvwxyz",
        "CONTENT_DOWNLOAD_SCANNER_COMMAND_JSON": '["/usr/local/bin/clamscan","--no-summary","{file}"]',
    }
    valid_errors = validate(valid, require_production=True)
    assert valid_errors == [], valid_errors
    unsafe = dict(valid, DATABASE_SCHEMA_MODE="bootstrap", BACKUP_TARGET="D:/Codex/beifen/beifencx", ASSET_STORAGE_ROOT="s3://wrong")
    errors = validate(unsafe, require_production=True)
    assert any("DATABASE_SCHEMA_MODE" in error for error in errors)
    assert any("BACKUP_TARGET" in error for error in errors)
    assert any("ASSET_STORAGE_ROOT" in error for error in errors)
    print("Release readiness self-test: OK")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--environment-file", type=Path)
    parser.add_argument("--manifest", type=Path)
    parser.add_argument("--production", action="store_true", help="Require ENVIRONMENT=production")
    parser.add_argument("--self-test", action="store_true", help="Run non-secret in-memory policy tests")
    args = parser.parse_args()

    if args.self_test:
        return self_test()

    if not args.environment_file or not args.manifest:
        parser.error("--environment-file and --manifest are required unless --self-test is used")

    if not args.environment_file.is_file():
        raise SystemExit(f"Environment file does not exist: {args.environment_file}")
    errors = validate(load_env_file(args.environment_file), require_production=args.production)
    errors.extend(verify_manifest(args.manifest))
    if errors:
        print("Release readiness failed:")
        print("\n".join(f"- {error}" for error in errors))
        return 1
    print("Release readiness: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
