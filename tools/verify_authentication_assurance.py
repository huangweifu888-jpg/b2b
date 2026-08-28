"""Verify privileged-session MFA controls without contacting an identity provider."""

from __future__ import annotations

import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from core.auth import AccessTokenError  # noqa: E402
from services.authentication_assurance import enforce_mfa_for_privileged_role, has_mfa_assurance  # noqa: E402


def main() -> int:
    policy = json.loads((ROOT / "deployment" / "policies" / "authentication-assurance.json").read_text(encoding="utf-8"))
    assert policy["schema_version"] == 1 and policy["production_mfa_required"] is True
    assert {"admin", "technical_operations", "security_owner"} <= set(policy["privileged_roles"])
    assert policy["recovery"]["support_bypass_forbidden"] is True
    assert has_mfa_assurance({"amr": ["pwd", "webauthn"]})
    enforce_mfa_for_privileged_role({"amr": ["otp"]}, role="admin", enabled=True)
    try:
        enforce_mfa_for_privileged_role({"amr": ["pwd"]}, role="admin", enabled=True)
    except AccessTokenError:
        pass
    else:
        raise AssertionError("privileged session without MFA was accepted")
    production = (ROOT / "deployment" / "env" / "release.production.env.example").read_text(encoding="utf-8")
    dependency = (ROOT / "backend" / "dependencies" / "auth.py").read_text(encoding="utf-8")
    assert "REQUIRE_MFA_FOR_PRIVILEGED_ROLES=true" in production
    assert "enforce_mfa_for_privileged_role(" in dependency
    print("Authentication assurance controls: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
