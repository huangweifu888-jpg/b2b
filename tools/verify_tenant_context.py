"""Fast local checks for the tenant-boundary contract."""

from __future__ import annotations

from pathlib import Path
import sys


BACKEND = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(BACKEND))

from core.tenant_context import TenantContextError, build_tenant_context  # noqa: E402


def assert_raises(**kwargs: str) -> None:
    try:
        build_tenant_context(**kwargs)
    except TenantContextError:
        return
    raise AssertionError(f"Expected TenantContextError for {kwargs}")


def main() -> int:
    context = build_tenant_context(
        agent_path="agency-a/sub-agency-b",
        tenant_id="tenant-acme",
        client_id="client-acme",
        plan_id="plan-spring-2026",
    )
    assert context.asset_prefix == "tenants/tenant-acme/clients/client-acme/plans/plan-spring-2026"
    assert_raises(agent_path="../agency", tenant_id="tenant-acme", client_id="client-acme")
    assert_raises(agent_path="agency-a", tenant_id="tenant/acme", client_id="client-acme")
    assert_raises(agent_path="agency-a", tenant_id="tenant-acme", client_id="")
    print("Tenant context: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
