"""Reusable MFA-claim checks for privileged B2B sessions."""

from __future__ import annotations

from collections.abc import Iterable, Mapping

from core.auth import AccessTokenError


DEFAULT_PRIVILEGED_ROLES = frozenset({"admin", "headquarters_administrator", "technical_operations", "security_owner"})
_MFA_METHODS = frozenset({"mfa", "otp", "totp", "webauthn", "fido2", "passkey"})


def parse_privileged_roles(value: str | Iterable[str] | None) -> frozenset[str]:
    if value is None:
        return DEFAULT_PRIVILEGED_ROLES
    candidates = value.split(",") if isinstance(value, str) else value
    roles = frozenset(str(item).strip().lower() for item in candidates if str(item).strip())
    return roles or DEFAULT_PRIVILEGED_ROLES


def has_mfa_assurance(claims: Mapping[str, object]) -> bool:
    if claims.get("mfa_completed") is True:
        return True
    methods = claims.get("amr", [])
    if isinstance(methods, str):
        methods = [methods]
    if isinstance(methods, Iterable):
        if any(str(method).strip().lower() in _MFA_METHODS for method in methods):
            return True
    return "mfa" in str(claims.get("acr", "")).lower()


def enforce_mfa_for_privileged_role(
    claims: Mapping[str, object], *, role: str, enabled: bool, privileged_roles: str | Iterable[str] | None = None
) -> None:
    if enabled and role.strip().lower() in parse_privileged_roles(privileged_roles) and not has_mfa_assurance(claims):
        raise AccessTokenError("Multi-factor authentication is required for this role")
