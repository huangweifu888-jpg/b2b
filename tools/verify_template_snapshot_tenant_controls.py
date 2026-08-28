"""Verify template snapshot bindings, legacy mapping, and version restore are tenant safe."""

from __future__ import annotations

import asyncio
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

import models  # noqa: F401, E402
from core.database import Base  # noqa: E402
from fastapi import HTTPException  # noqa: E402
from models.platform import Membership, Organization, Project  # noqa: E402
from models.template_snapshot import TemplateSnapshotInstance, TemplateSnapshotTemplate, TemplateSnapshotVersion  # noqa: E402
from routers.template_snapshot import _resolve_and_authorize_binding  # noqa: E402
from schemas.auth import UserResponse  # noqa: E402
from services.template_snapshot import TemplateSnapshotService  # noqa: E402
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine  # noqa: E402


async def verify() -> None:
    with tempfile.TemporaryDirectory(prefix="b2b-template-tenant-") as directory:
        database = Path(directory) / "template.sqlite3"
        engine = create_async_engine(f"sqlite+aiosqlite:///{database.as_posix()}")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        try:
            async with sessions() as session:
                session.add_all(
                    [
                        Organization(id=1, name="Agency", code="agency", org_type="agency", lineage_path="1"),
                        Organization(id=2, name="Client A", code="client-a", org_type="client", lineage_path="1/2"),
                        Organization(id=3, name="Client B", code="client-b", org_type="client", lineage_path="3"),
                        Project(id=10, client_org_id=2, name="Plan A", code="plan-a"),
                        Project(id=20, client_org_id=3, name="Plan B", code="plan-b"),
                        Membership(user_id="agency-user", org_id=1, project_id=None, status="active"),
                    ]
                )
                await session.commit()
                service = TemplateSnapshotService(session)
                agent = UserResponse(id="agency-user", email="agent@example.invalid", role="user")
                admin = UserResponse(id="admin", email="admin@example.invalid", role="admin")

                assert await _resolve_and_authorize_binding(
                    session, current_user=agent, owner_scope="client", owner_id=None, organization_id=None, project_id=10
                ) == (None, 10)
                try:
                    await _resolve_and_authorize_binding(
                        session, current_user=agent, owner_scope="client", owner_id=None, organization_id=None, project_id=20
                    )
                    raise AssertionError("agent reached a sibling client plan")
                except HTTPException as exc:
                    assert exc.status_code == 403

                mapping = await service.upsert_legacy_mapping(
                    {"owner_scope": "client", "legacy_owner_id": "legacy-site-a", "project_id": 10, "created_by": admin.id}
                )
                assert mapping["project_id"] == 10
                assert await _resolve_and_authorize_binding(
                    session, current_user=agent, owner_scope="client", owner_id="legacy-site-a", organization_id=None, project_id=None
                ) == (None, 10)
                try:
                    await _resolve_and_authorize_binding(
                        session, current_user=agent, owner_scope="client", owner_id="unmapped-site", organization_id=None, project_id=None
                    )
                    raise AssertionError("unmapped snapshot was exposed to a tenant")
                except HTTPException as exc:
                    assert exc.status_code == 403

                template = TemplateSnapshotTemplate(
                    template_id="client-source-a", template_type="hq-client", owner_scope="client_source",
                    organization_id=2, name="Client template", config_json='{"title":"new"}', latest_version="2.0",
                )
                session.add(template)
                session.add(TemplateSnapshotVersion(template_id="client-source-a", version="1.0", config_json='{"title":"old"}'))
                session.add(TemplateSnapshotVersion(template_id="client-source-a", version="2.0", config_json='{"title":"new"}'))
                session.add(
                    TemplateSnapshotInstance(
                        instance_id="client-plan-a", instance_type="client-plan", owner_scope="client", project_id=10,
                        name="Plan instance", base_template_id="client-source-a", base_template_version="2.0", snapshot_config_json='{"title":"new"}',
                    )
                )
                await session.commit()
                restored = await service.restore_template(
                    "client-plan-a", {"target": "all", "template_version": "1.0", "create_backup": True, "operator": admin.id}
                )
                assert restored["snapshot_config_json"] == {"title": "old"}
                assert restored["base_template_version"] == "1.0"

                session.add(
                    TemplateSnapshotTemplate(
                        template_id="legacy-unbound", template_type="hq-client", owner_scope="client_source",
                        name="Legacy unbound template", config_json="{}",
                    )
                )
                await session.commit()
                unmapped = await service.list_unmapped_resources()
                assert any(item["resource_id"] == "legacy-unbound" for item in unmapped)
                bound = await service.bind_unmapped_resource(
                    resource_type="template", resource_id="legacy-unbound", organization_id=2, project_id=None
                )
                assert bound["organization_id"] == 2
        finally:
            await engine.dispose()


def main() -> int:
    asyncio.run(verify())
    print("Template snapshot tenant controls: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
