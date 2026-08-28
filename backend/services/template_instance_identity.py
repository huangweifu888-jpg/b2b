"""Stable, tenant-safe identifiers for template runtime instances."""

from __future__ import annotations


def client_plan_runtime_instance_id(
    plan_code: str,
    *,
    organization_id: int | None = None,
    project_id: int | None = None,
) -> str:
    """Return the scoped client-plan ID, with legacy output for old callers.

    Existing installations can still contain ``client-plan:<PLAN_CODE>``
    records.  New records include both database tenancy keys so two clients may
    legally reuse the same plan code without colliding with the global
    ``instance_id`` uniqueness constraint.
    """

    normalized_plan_code = plan_code.strip().upper()
    if not normalized_plan_code:
        raise ValueError("client plan runtime instance requires a plan code")
    if organization_id is None and project_id is None:
        return f"client-plan:{normalized_plan_code}"
    if not organization_id or organization_id < 1 or not project_id or project_id < 1:
        raise ValueError("client plan runtime instance requires positive organization and project ids")
    return f"client-plan:{organization_id}:{project_id}"


def is_canonical_client_plan_runtime_instance_id(
    instance_id: str,
    *,
    plan_code: str,
    organization_id: int,
    project_id: int,
) -> bool:
    """Accept the tenant-safe ID and the one legacy ID during migration."""

    return instance_id in {
        client_plan_runtime_instance_id(
            plan_code,
            organization_id=organization_id,
            project_id=project_id,
        ),
        client_plan_runtime_instance_id(plan_code),
    }
