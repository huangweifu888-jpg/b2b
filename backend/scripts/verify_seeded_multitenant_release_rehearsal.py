"""Verify the local two-branch tenant fixture and execute both template rollouts."""

from __future__ import annotations

import asyncio
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import models  # noqa: F401
from core.database import db_manager
from models.auth import User
from models.platform import Organization, Project
from models.template_snapshot import TemplateSnapshotInstance, TemplateSnapshotTemplate
from services.template_release_batches import TemplateReleaseBatchService
from sqlalchemy import func, select


async def verify() -> dict[str, object]:
    await db_manager.init_db()
    if not db_manager.async_session_maker:
        raise RuntimeError("Database session factory is unavailable")
    async with db_manager.async_session_maker() as db:
        actor_id = await db.scalar(select(User.id).where(User.role == "admin").order_by(User.created_at))
        if not actor_id:
            raise RuntimeError("A retained administrator is required to audit release batches")
        levels = dict((await db.execute(
            select(Organization.agent_level, func.count()).where(Organization.org_type.in_(("agency", "sub_agency"))).group_by(Organization.agent_level)
        )).all())
        if levels != {1: 2, 2: 4, 3: 8}:
            raise RuntimeError(f"Unexpected agency hierarchy: {levels}")
        agencies = (await db.execute(select(Organization).where(Organization.org_type.in_(("agency", "sub_agency"))))).scalars().all()
        clients = (await db.execute(select(Organization).where(Organization.org_type == "client"))).scalars().all()
        if len(clients) != 28 or any(sum(item.parent_id == agency.id for item in clients) != 2 for agency in agencies):
            raise RuntimeError("Every agency must own exactly two clients")
        projects = (await db.execute(select(Project))).scalars().all()
        if len(projects) != 56 or any(sum(item.client_org_id == client.id for item in projects) != 2 for client in clients):
            raise RuntimeError("Every client must own exactly two plans")

        rollout_results: dict[str, dict[str, int | str]] = {}
        for template_id, expected_targets in (("agency-source-global", 14), ("client-source-global", 56)):
            template = await db.scalar(select(TemplateSnapshotTemplate).where(TemplateSnapshotTemplate.template_id == template_id))
            if not template or not template.is_published or not template.latest_version:
                raise RuntimeError(f"Published source template is unavailable: {template_id}")
            # Release batches audit the initiating user.  Use a retained local
            # administrator rather than a synthetic identifier so this rehearsal
            # exercises the same foreign-key and audit path as the UI.
            batch = await TemplateReleaseBatchService(db).create(template_id=template_id, instance_ids=None, created_by=actor_id)
            completed = await TemplateReleaseBatchService(db).process(batch["id"])
            if completed["status"] != "completed" or completed["succeeded_targets"] != expected_targets:
                raise RuntimeError(f"Rollout failed for {template_id}: {completed['status']}")
            installed = await db.scalar(select(func.count()).select_from(TemplateSnapshotInstance).where(
                TemplateSnapshotInstance.base_template_id == template_id,
                TemplateSnapshotInstance.base_template_version == template.latest_version,
            ))
            rollout_results[template_id] = {"status": completed["status"], "targets": expected_targets, "at_latest": int(installed or 0)}
    await db_manager.close_db()
    return {"status": "passed", "agency_levels": levels, "clients": len(clients), "plans": len(projects), "rollouts": rollout_results}


def main() -> int:
    print(json.dumps(asyncio.run(verify()), ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
