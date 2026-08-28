"""Validate cloud disaster-recovery drill prerequisites without contacting cloud resources."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def validate(contract: dict[str, object], *, allow_placeholders: bool = False) -> list[str]:
    errors: list[str] = []
    if contract.get("schema_version") != 1 or contract.get("environment") not in {"staging", "production"}:
        errors.append("schema_version and environment are required")
    for key in ("isolated_restore_database_reference", "asset_restore_target_reference", "alternate_runtime_reference"):
        if not str(contract.get(key, "")).startswith("provider:"):
            errors.append(f"{key} must identify a provider resource")
    if not str(contract.get("dns_change_reference", "")).startswith("ticket:"):
        errors.append("DNS change plan ticket is required")
    if not {"restore_reference", "migration_revision", "tenant_integrity", "health_probe", "rollback_reference"} <= set(contract.get("evidence", [])):
        errors.append("drill evidence is incomplete")
    if contract.get("production_overwrite") is not False:
        errors.append("production overwrite must be forbidden")
    if not allow_placeholders and "replace" in json.dumps(contract).lower():
        errors.append("live contract contains placeholders")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--contract", type=Path)
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        valid = {"schema_version": 1, "environment": "staging", "isolated_restore_database_reference": "provider:isolated-db", "asset_restore_target_reference": "provider:isolated-assets", "alternate_runtime_reference": "provider:alternate-runtime", "dns_change_reference": "ticket:DNS-100", "evidence": ["restore_reference", "migration_revision", "tenant_integrity", "health_probe", "rollback_reference"], "production_overwrite": False}
        assert validate(valid) == []
        assert validate({**valid, "production_overwrite": True})
        print("Cloud DR contract: OK")
        return 0
    if not args.contract or not args.contract.is_file():
        parser.error("--contract must reference a credential-free live cloud DR contract")
    errors = validate(json.loads(args.contract.read_text(encoding="utf-8")))
    if errors:
        print("Cloud DR contract failed:\n" + "\n".join(f"- {error}" for error in errors))
        return 1
    print("Cloud DR contract: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
