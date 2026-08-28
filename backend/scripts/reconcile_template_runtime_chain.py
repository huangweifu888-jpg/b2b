"""Idempotently reconcile released template pointers and runtime instances.

Use after upgrading a local or staged database that predates server-owned
agency/plan instance provisioning.  It never deletes tenant data or publishes
drafts: an existing mutable configuration is retained as a draft while the
latest approved immutable version becomes the live rollout baseline.
"""

from __future__ import annotations

import asyncio
import json

import models  # noqa: F401  # ensure every ORM model is registered
from core.database import db_manager
from models.platform import Organization, Project
from models.template_snapshot import TemplateSnapshotTemplate, TemplateSnapshotVersion
from services.tenant_provisioning import provision_agency_runtime_template, provision_plan_runtime_and_template
from sqlalchemy import select


async def reconcile() -> dict[str, int]:
    await db_manager.init_db()
    if not db_manager.async_session_maker:
        raise RuntimeError("Database session factory is unavailable")

    restored_pointers = 0
    agency_instances = 0
    plan_instances = 0
    async with db_manager.async_session_maker() as db:
        templates = (await db.execute(select(TemplateSnapshotTemplate))).scalars().all()
        for template in templates:
            if not template.is_published or template.latest_version:
                continue
            approved = await db.scalar(
                select(TemplateSnapshotVersion)
                .where(
                    TemplateSnapshotVersion.template_id == template.template_id,
                    TemplateSnapshotVersion.review_status == "published",
                )
                .order_by(TemplateSnapshotVersion.published_at.desc(), TemplateSnapshotVersion.id.desc())
            )
            if not approved:
                continue
            if template.config_json != approved.config_json:
                template.draft_config_json = template.config_json
            template.latest_version = approved.version
            template.config_json = approved.config_json
            restored_pointers += 1

        agencies = (
            await db.execute(
                select(Organization).where(
                    Organization.org_type.in_(("agency", "sub_agency")),
                    Organization.status == "active",
                )
            )
        ).scalars().all()
        for agency in agencies:
            await provision_agency_runtime_template(db, agency=agency)
            agency_instances += 1

        plans = (
            await db.execute(
                select(Project, Organization)
                .join(Organization, Organization.id == Project.client_org_id)
                .where(Project.status == "active", Organization.status == "active", Organization.org_type == "client")
            )
        ).all()
        for project, client in plans:
            await provision_plan_runtime_and_template(db, client=client, project=project)
            plan_instances += 1

        await db.commit()
    await db_manager.close_db()
    return {
        "restored_release_pointers": restored_pointers,
        "agency_runtime_records_checked": agency_instances,
        "client_plan_runtime_records_checked": plan_instances,
    }


def main() -> None:
    print(json.dumps(asyncio.run(reconcile()), ensure_ascii=False))


if __name__ == "__main__":
    main()
