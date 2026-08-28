"""Validate credential-free staging resource declarations before a live drill."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from urllib.parse import urlparse


def validate(contract: dict[str, object], *, allow_placeholders: bool = False) -> list[str]:
    errors: list[str] = []
    if contract.get("environment") != "staging":
        errors.append("environment must be staging")
    deployment_id = str(contract.get("deployment_id", ""))
    if not deployment_id.startswith("staging-"):
        errors.append("deployment_id must be a staging-specific identifier")
    public_url = urlparse(str(contract.get("public_base_url", "")))
    if public_url.scheme != "https" or not public_url.netloc:
        errors.append("public_base_url must use HTTPS")
    for key, provider in (("database", "managed-postgresql"), ("redis", "managed-redis")):
        item = contract.get(key)
        if not isinstance(item, dict) or item.get("provider") != provider or not item.get("resource_id"):
            errors.append(f"{key} must name a {provider} resource")
    assets = contract.get("private_assets")
    backups = contract.get("backups")
    if not isinstance(assets, dict) or not str(assets.get("uri", "")).startswith(("s3://", "az://", "gs://")):
        errors.append("private_assets.uri must be private object storage")
    if not isinstance(assets, dict) or not str(assets.get("runtime_mount", "")).startswith("/"):
        errors.append("private_assets.runtime_mount must be an absolute private mount")
    if not isinstance(backups, dict) or not str(backups.get("uri", "")).startswith(("s3://", "az://", "gs://")):
        errors.append("backups.uri must be offsite object storage")
    if isinstance(assets, dict) and isinstance(backups, dict) and assets.get("uri") == backups.get("uri"):
        errors.append("private assets and backups must use separate storage")
    if not isinstance(backups, dict) or not backups.get("schedule_id") or not backups.get("restore_drill_reference"):
        errors.append("backups need a schedule ID and restore drill reference")
    observability = contract.get("observability")
    if not isinstance(observability, dict) or observability.get("health_endpoint") != "/api/v1/operations/health":
        errors.append("observability must use the platform health endpoint")
    if not isinstance(observability, dict) or observability.get("alert_after_consecutive_failures") != 3:
        errors.append("observability must alert after three consecutive failures")
    if not allow_placeholders:
        serialized = json.dumps(contract).lower()
        if "replace_" in serialized or "example" in serialized:
            errors.append("live staging contract contains placeholder values")
    return errors


def self_test() -> int:
    valid = {
        "environment": "staging", "deployment_id": "staging-customer-stamp-a", "public_base_url": "https://staging.internal.invalid",
        "database": {"provider": "managed-postgresql", "resource_id": "pg-staging-a"},
        "redis": {"provider": "managed-redis", "resource_id": "redis-staging-a"},
        "private_assets": {"uri": "s3://assets-staging/b2b", "runtime_mount": "/srv/b2b/private-assets"},
        "backups": {"uri": "s3://backups-staging/b2b", "schedule_id": "backup-staging", "restore_drill_reference": "RESTORE-100"},
        "observability": {"health_endpoint": "/api/v1/operations/health", "alert_after_consecutive_failures": 3},
    }
    assert validate(valid) == []
    assert validate({**valid, "private_assets": valid["backups"]})
    print("Staging resource contract: OK")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--contract", type=Path)
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        return self_test()
    if not args.contract or not args.contract.is_file():
        parser.error("--contract must reference the credential-free live staging contract")
    errors = validate(json.loads(args.contract.read_text(encoding="utf-8")))
    if errors:
        print("Staging resource contract failed:\n" + "\n".join(f"- {error}" for error in errors))
        return 1
    print("Staging resource contract: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
