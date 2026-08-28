"""Verify rotation sequencing without accepting or exposing any secret value."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class RotationPlan:
    secret_kind: str
    change_id: str
    replacement_reference: str
    invalidation: str
    reencrypt_required: bool


def validate(plan: RotationPlan) -> list[str]:
    errors: list[str] = []
    if plan.secret_kind not in {"JWT_SECRET_KEY", "CONTENT_DOWNLOAD_SECRET", "MASK_KEY"}:
        errors.append("unsupported secret kind")
    if len(plan.change_id.strip()) < 8:
        errors.append("change_id is required")
    if not plan.replacement_reference.startswith("secret-manager:"):
        errors.append("replacement must be a secret-manager reference, never a value")
    if plan.secret_kind == "JWT_SECRET_KEY" and plan.invalidation != "invalidate-sessions":
        errors.append("JWT rotation requires session invalidation")
    if plan.secret_kind == "CONTENT_DOWNLOAD_SECRET" and plan.invalidation != "invalidate-download-tickets":
        errors.append("download-secret rotation requires ticket invalidation")
    if plan.secret_kind == "MASK_KEY" and not plan.reencrypt_required:
        errors.append("MASK_KEY rotation requires a planned re-encryption migration")
    return errors


def main() -> int:
    plans = (
        RotationPlan("JWT_SECRET_KEY", "CHG-2001", "secret-manager:staging/jwt/next", "invalidate-sessions", False),
        RotationPlan("CONTENT_DOWNLOAD_SECRET", "CHG-2002", "secret-manager:staging/download/next", "invalidate-download-tickets", False),
        RotationPlan("MASK_KEY", "CHG-2003", "secret-manager:staging/mask/next", "planned-reencrypt", True),
    )
    assert all(not validate(plan) for plan in plans)
    assert validate(RotationPlan("MASK_KEY", "CHG-2003", "secret-manager:staging/mask/next", "planned-reencrypt", False))
    print("Secret rotation drill: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
