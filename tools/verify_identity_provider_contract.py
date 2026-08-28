"""Validate a credential-free OIDC/SCIM integration contract."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from urllib.parse import urlsplit


ROOT = Path(__file__).resolve().parents[1]


def validate(contract: dict[str, object], *, allow_placeholders: bool = False) -> list[str]:
    errors: list[str] = []
    if contract.get("schema_version") != 1 or contract.get("environment") not in {"staging", "production"}:
        errors.append("schema_version and environment are required")
    issuer = urlsplit(str(contract.get("issuer_url", "")))
    if issuer.scheme != "https" or not issuer.hostname:
        errors.append("issuer_url must be HTTPS")
    for key in ("client_id_reference", "test_user_reference"):
        if not str(contract.get(key, "")).startswith("secret-manager:"):
            errors.append(f"{key} must use a secret-manager reference")
    if not {"amr", "acr"}.intersection(set(contract.get("mfa_claims", []))):
        errors.append("MFA claim mapping is required")
    if not {"admin", "technical_operations", "security_owner"} <= set(contract.get("privileged_roles", [])):
        errors.append("privileged role mapping is incomplete")
    scim = contract.get("scim")
    if not isinstance(scim, dict) or not scim.get("enabled") or not scim.get("deprovisioning_event_required"):
        errors.append("SCIM deprovisioning is required")
    if not allow_placeholders and "replace" in json.dumps(contract).lower():
        errors.append("live contract contains placeholders")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--contract", type=Path)
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        valid = {"schema_version": 1, "environment": "staging", "issuer_url": "https://idp.example.test", "client_id_reference": "secret-manager:idp/client", "mfa_claims": ["amr"], "privileged_roles": ["admin", "technical_operations", "security_owner"], "scim": {"enabled": True, "deprovisioning_event_required": True}, "test_user_reference": "secret-manager:idp/test-user"}
        assert validate(valid) == []
        assert validate({**valid, "issuer_url": "http://idp.example.test"})
        print("Identity provider contract: OK")
        return 0
    if not args.contract or not args.contract.is_file():
        parser.error("--contract must reference a credential-free live identity-provider contract")
    errors = validate(json.loads(args.contract.read_text(encoding="utf-8")))
    if errors:
        print("Identity provider contract failed:\n" + "\n".join(f"- {error}" for error in errors))
        return 1
    print("Identity provider contract: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
