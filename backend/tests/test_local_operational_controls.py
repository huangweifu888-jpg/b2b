import pytest

from core.auth import AccessTokenError
from services.authentication_assurance import enforce_mfa_for_privileged_role
from services.quota_controls import evaluate_quota


def test_privileged_mfa_gate_accepts_mfa_claims_and_rejects_a_password_only_session():
    with pytest.raises(AccessTokenError, match="Multi-factor"):
        enforce_mfa_for_privileged_role({"sub": "admin"}, role="admin", enabled=True)
    enforce_mfa_for_privileged_role({"sub": "admin", "amr": ["pwd", "webauthn"]}, role="admin", enabled=True)
    enforce_mfa_for_privileged_role({"sub": "client"}, role="user", enabled=True)


def test_plan_quota_warns_before_blocking_new_consumption():
    assert evaluate_quota("sites", used=8, limit=10).status == "available"
    assert evaluate_quota("sites", used=9, limit=10).status == "warning"
    assert evaluate_quota("sites", used=10, limit=10).status == "blocked"
