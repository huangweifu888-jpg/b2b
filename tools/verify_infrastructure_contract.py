"""Validate repeatable infrastructure boundaries without deploying resources."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def validate(contract: dict[str, object], *, allow_placeholders: bool = False) -> list[str]:
    errors: list[str] = []
    if contract.get("schema_version") != 1 or contract.get("environment") not in {"staging", "production"}:
        errors.append("schema_version and environment are required")
    for section in ("runtime", "database", "redis", "assets", "monitoring"):
        value = contract.get(section)
        if not isinstance(value, dict) or not str(value.get("reference", "")).startswith("provider:"):
            errors.append(f"{section} provider reference is required")
    if not isinstance(contract.get("runtime"), dict) or not contract["runtime"].get("repeatable_deployment") or not contract["runtime"].get("immutable_image_required"):
        errors.append("runtime must be repeatable and immutable")
    if not isinstance(contract.get("database"), dict) or not contract["database"].get("migration_only") or not contract["database"].get("isolated_restore_required"):
        errors.append("database migration and restore controls are required")
    if not isinstance(contract.get("assets"), dict) or not contract["assets"].get("public_serving_forbidden"):
        errors.append("private assets must not be public")
    if not allow_placeholders and "replace" in json.dumps(contract).lower():
        errors.append("live contract contains placeholders")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--contract", type=Path)
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        valid = {"schema_version": 1, "environment": "staging", "runtime": {"reference": "provider:run", "repeatable_deployment": True, "immutable_image_required": True}, "database": {"reference": "provider:db", "migration_only": True, "isolated_restore_required": True}, "redis": {"reference": "provider:redis", "private_network_required": True}, "assets": {"reference": "provider:assets", "public_serving_forbidden": True}, "monitoring": {"reference": "provider:monitor", "alert_delivery_test_required": True}}
        assert validate(valid) == []
        assert validate({**valid, "assets": {"reference": "provider:assets", "public_serving_forbidden": False}})
        print("Infrastructure contract: OK")
        return 0
    if not args.contract or not args.contract.is_file():
        parser.error("--contract must reference a credential-free live infrastructure contract")
    errors = validate(json.loads(args.contract.read_text(encoding="utf-8")))
    if errors:
        print("Infrastructure contract failed:\n" + "\n".join(f"- {error}" for error in errors))
        return 1
    print("Infrastructure contract: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
