"""Reset local tenant runtime data and seed a two-branch hierarchy rehearsal.

This local-only tool preserves headquarters and published template sources. By
default it deletes only records that this script previously marked as a local
rehearsal fixture, then rebuilds two agents at every branch, two customers per
agency, and two plans per customer.  Deleting every tenant requires an explicit
second acknowledgement flag.
"""

from __future__ import annotations

import argparse
import asyncio
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import models  # noqa: F401
from core.database import db_manager
from core.path_registry import get_path_registry
from models.platform import Organization, Project
from models.template_snapshot import TemplateSnapshotInstance
from services.organization_roles import ensure_default_roles
from services.tenant_provisioning import provision_agency_runtime_template, provision_plan_runtime_and_template
from sqlalchemy import delete, select, text


TENANT_TABLES_BY_PROJECT = {
    "memberships_platform": "project_id", "audit_logs_platform": "project_id",
    "content_download_assets": "project_id", "template_snapshot_legacy_mappings": "project_id",
    "billing_ledger_entries": "project_id", "support_tickets": "project_id",
    "membership_invites_platform": "project_id", "template_snapshot_release_targets": "project_id",
}
TENANT_TABLES_BY_ORG = {
    "roles_platform": "org_id", "data_backups_platform": "org_id", "ai_provider_configs": "org_id",
    "ai_app_assignments": "org_id", "memberships_platform": "org_id", "audit_logs_platform": "org_id",
    "local_accounts": "org_id", "content_download_assets": "client_org_id",
    "template_snapshot_legacy_mappings": "organization_id", "billing_ledger_entries": "org_id",
    "support_tickets": "org_id", "membership_invites_platform": "org_id",
    "template_snapshot_release_targets": "organization_id",
}
FIXTURE_GENERATION = "local-multitenant-rehearsal-v1"


def fixture_settings() -> str:
    return json.dumps(
        {"fixture": {"managed": True, "generation": FIXTURE_GENERATION}},
        ensure_ascii=False,
    )


def is_managed_fixture(org: Organization) -> bool:
    try:
        settings = json.loads(org.settings_json or "{}")
    except json.JSONDecodeError:
        return False
    fixture = settings.get("fixture") if isinstance(settings, dict) else None
    return isinstance(fixture, dict) and fixture.get("managed") is True and fixture.get("generation") == FIXTURE_GENERATION


async def clear_and_seed(*, all_tenants: bool = False) -> dict[str, int | str]:
    await db_manager.init_db()
    if not db_manager.async_session_maker:
        raise RuntimeError("Database session factory is unavailable")

    async with db_manager.async_session_maker() as db:
        hq = await db.scalar(select(Organization).where(Organization.org_type == "hq").order_by(Organization.id))
        if not hq:
            raise RuntimeError("Headquarters organization is required before seeding")
        candidates = (await db.execute(select(Organization).where(Organization.org_type.in_(("agency", "sub_agency", "client"))))).scalars().all()
        tenant_orgs = candidates if all_tenants else [org for org in candidates if is_managed_fixture(org)]
        tenant_org_ids = [org.id for org in tenant_orgs]
        project_ids = list((await db.execute(select(Project.id).where(Project.client_org_id.in_(tenant_org_ids)))).scalars()) if tenant_org_ids else []

        if project_ids:
            for table, column in TENANT_TABLES_BY_PROJECT.items():
                await db.execute(text(f"DELETE FROM {table} WHERE {column} IN ({','.join(str(item) for item in project_ids)})"))
            await db.execute(delete(TemplateSnapshotInstance).where(TemplateSnapshotInstance.project_id.in_(project_ids)))
            await db.execute(text(f"DELETE FROM plan_runtime_configs WHERE project_id IN ({','.join(str(item) for item in project_ids)})"))
            await db.execute(delete(Project).where(Project.id.in_(project_ids)))
        if tenant_org_ids:
            for table, column in TENANT_TABLES_BY_ORG.items():
                await db.execute(text(f"DELETE FROM {table} WHERE {column} IN ({','.join(str(item) for item in tenant_org_ids)})"))
            await db.execute(delete(TemplateSnapshotInstance).where(TemplateSnapshotInstance.organization_id.in_(tenant_org_ids)))
            await db.execute(text("DELETE FROM template_snapshot_backups"))
            await db.execute(text("DELETE FROM template_snapshot_release_targets"))
            await db.execute(text("DELETE FROM template_snapshot_release_batches"))
            for org in sorted(tenant_orgs, key=lambda item: (item.lineage_path or "").count("/"), reverse=True):
                await db.delete(org)
                # Self-referencing parent/root-agency FKs require descendants
                # to be flushed before their parent row is removed.
                await db.flush()
        await db.flush()

        agencies: list[Organization] = []
        for first_index in range(1, 3):
            first_code = f"D{first_index:02d}"
            first = Organization(name=f"一级代理{first_index:02d}有限公司", code=first_code, org_type="agency", parent_id=hq.id, root_org_id=hq.id, agent_level=1, status="active", lineage_path=f"{hq.id}", settings_json=fixture_settings())
            db.add(first)
            await db.flush()
            first.root_agency_id, first.lineage_path = first.id, f"{hq.id}/{first.id}"
            await ensure_default_roles(db, first)
            await provision_agency_runtime_template(db, agency=first)
            agencies.append(first)
            for second_index in range(1, 3):
                second_code = f"{first_code}{second_index:02d}"
                second = Organization(name=f"二级代理{first_index:02d}{second_index:02d}有限公司", code=second_code, org_type="sub_agency", parent_id=first.id, root_org_id=hq.id, root_agency_id=first.id, agent_level=2, status="active", lineage_path=f"{hq.id}/{first.id}", settings_json=fixture_settings())
                db.add(second)
                await db.flush()
                second.lineage_path = f"{hq.id}/{first.id}/{second.id}"
                await ensure_default_roles(db, second)
                await provision_agency_runtime_template(db, agency=second)
                agencies.append(second)
                for third_index in range(1, 3):
                    third_code = f"{second_code}{third_index:02d}"
                    third = Organization(name=f"三级代理{first_index:02d}{second_index:02d}{third_index:02d}有限公司", code=third_code, org_type="sub_agency", parent_id=second.id, root_org_id=hq.id, root_agency_id=first.id, agent_level=3, status="active", lineage_path=f"{hq.id}/{first.id}/{second.id}", settings_json=fixture_settings())
                    db.add(third)
                    await db.flush()
                    third.lineage_path = f"{hq.id}/{first.id}/{second.id}/{third.id}"
                    await ensure_default_roles(db, third)
                    await provision_agency_runtime_template(db, agency=third)
                    agencies.append(third)

        clients = 0
        plans = 0
        for agency in agencies:
            for client_index in range(1, 3):
                client_code = f"K{agency.code[1:]}{client_index:02d}"
                client = Organization(name=f"{agency.code}客户{client_index:02d}有限公司", code=client_code, org_type="client", parent_id=agency.id, root_org_id=hq.id, root_agency_id=agency.root_agency_id or agency.id, status="active", lineage_path=agency.lineage_path, settings_json=fixture_settings())
                db.add(client)
                await db.flush()
                client.lineage_path = f"{agency.lineage_path}/{client.id}"
                await ensure_default_roles(db, client)
                clients += 1
                for plan_index in range(1, 3):
                    project = Project(client_org_id=client.id, name=f"计划{plan_index:02d}", code=f"J{agency.code[1:]}{client_index:02d}{plan_index:02d}", status="active", settings_json=fixture_settings())
                    db.add(project)
                    await db.flush()
                    await provision_plan_runtime_and_template(db, client=client, project=project)
                    plans += 1
        await db.commit()

        instances = await db.scalar(select(text("count(*)")).select_from(TemplateSnapshotInstance))
        result = {"cleared_organizations": len(tenant_orgs), "agencies": len(agencies), "clients": clients, "plans": plans, "runtime_instances": int(instances or 0), "fixture_generation": FIXTURE_GENERATION}
    await db_manager.close_db()
    # Published client pages are plan-owned runtime artifacts; retaining them
    # after the plan reset would leak stale tenant context into the local UI.
    published_sites = get_path_registry().backend_root / "published_sites.json"
    published_sites.write_text("[]\n", encoding="utf-8")
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Required acknowledgement for destructive local reset")
    parser.add_argument("--all-tenants", action="store_true", help="Also delete non-fixture agency, client, and plan tenants")
    args = parser.parse_args()
    if not args.apply:
        parser.error("--apply is required")
    print(json.dumps(asyncio.run(clear_and_seed(all_tenants=args.all_tenants)), ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
