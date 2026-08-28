from __future__ import annotations

import asyncio
import json

import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from starlette.requests import Request

import models  # noqa: F401
from core.database import Base
from models.auth import User
from models.platform import Membership, Organization, Project
from models.template_snapshot import TemplateSnapshotInstance, TemplateSnapshotTemplate
from routers.template_snapshot import (
    create_template,
    merge_developer_global_frame_draft,
    publish_template,
    upsert_instance,
    upsert_template,
)
from schemas.auth import UserResponse
from schemas.template_snapshot import (
    DeveloperGlobalFrameDraftMergeRequest,
    InstanceUpsertRequest,
    TemplateCreateRequest,
    TemplatePublishRequest,
    TemplateUpsertRequest,
)
from services.template_snapshot import TemplateSnapshotService


def _request(method: str) -> Request:
    return Request(
        {
            "type": "http",
            "method": method,
            "path": "/api/template-snapshot/test",
            "headers": [],
            "client": ("127.0.0.1", 10000),
            "query_string": b"",
            "server": ("test", 80),
            "scheme": "http",
        }
    )


def test_existing_snapshot_ids_cannot_be_rebound_or_taken_over_cross_tenant():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            attacker = User(id="tenant-a-user", email="a@example.test", role="user")
            tenant_a = Organization(name="Tenant A", code="TA", org_type="client", status="active")
            tenant_b = Organization(name="Tenant B", code="TB", org_type="client", status="active")
            db.add_all([attacker, tenant_a, tenant_b])
            await db.flush()
            plan_a = Project(client_org_id=tenant_a.id, name="Plan A", code="PA", status="active")
            plan_b = Project(client_org_id=tenant_b.id, name="Plan B", code="PB", status="active")
            db.add_all([plan_a, plan_b, Membership(user_id=attacker.id, org_id=tenant_a.id, status="active")])
            await db.flush()

            victim_template = TemplateSnapshotTemplate(
                template_id="victim-template",
                template_type="hq-client",
                owner_scope="client_source",
                organization_id=tenant_b.id,
                name="Victim template",
                config_json=json.dumps({"layout": {"title": "victim"}}),
            )
            victim_instance = TemplateSnapshotInstance(
                instance_id="victim-instance",
                instance_type="client-plan",
                owner_scope="client",
                project_id=plan_b.id,
                name="Victim instance",
                snapshot_config_json=json.dumps({"layout": {"title": "victim"}}),
                override_config_json="{}",
            )
            db.add_all([victim_template, victim_instance])
            await db.commit()

            actor = UserResponse(id=attacker.id, email=attacker.email, role="user")
            template_payload = TemplateUpsertRequest(
                template_id=victim_template.template_id,
                template_type="hq-client",
                owner_scope="client_source",
                organization_id=tenant_a.id,
                name="Taken over",
                config_json={"layout": {"title": "attacker"}},
            )
            with pytest.raises(HTTPException) as denied_template:
                await upsert_template(
                    template_id=victim_template.template_id,
                    payload=template_payload,
                    request=_request("PUT"),
                    db=db,
                    current_user=actor,
                )
            assert denied_template.value.status_code == 403

            # Route authorization must use the template's current binding
            # before the section payload reaches the merge service.
            section_payload = DeveloperGlobalFrameDraftMergeRequest.model_construct(
                base_draft_hash="0" * 64,
                developer_global_frame={},
            )
            with pytest.raises(HTTPException) as denied_section_merge:
                await merge_developer_global_frame_draft(
                    template_id=victim_template.template_id,
                    payload=section_payload,
                    request=_request("PATCH"),
                    db=db,
                    current_user=actor,
                )
            assert denied_section_merge.value.status_code == 403

            instance_payload = InstanceUpsertRequest(
                instance_id=victim_instance.instance_id,
                instance_type="client-plan",
                owner_scope="client",
                project_id=plan_a.id,
                name="Taken over",
                snapshot_config_json={"layout": {"title": "attacker"}},
            )
            with pytest.raises(HTTPException) as denied_instance:
                await upsert_instance(
                    instance_id=victim_instance.instance_id,
                    payload=instance_payload,
                    request=_request("PUT"),
                    db=db,
                    current_user=actor,
                )
            assert denied_instance.value.status_code == 403

            create_payload = TemplateCreateRequest(
                template_id=victim_template.template_id,
                template_type="hq-client",
                owner_scope="client_source",
                organization_id=tenant_a.id,
                name="Conflicting create",
                config_json={"layout": {"title": "attacker"}},
            )
            with pytest.raises(HTTPException) as conflict:
                await create_template(
                    payload=create_payload,
                    request=_request("POST"),
                    db=db,
                    current_user=actor,
                )
            assert conflict.value.status_code == 409

            await db.refresh(victim_template)
            await db.refresh(victim_instance)
            assert victim_template.organization_id == tenant_b.id
            assert json.loads(victim_template.config_json)["layout"]["title"] == "victim"
            assert victim_template.draft_config_json is None
            assert victim_instance.project_id == plan_b.id
            assert json.loads(victim_instance.snapshot_config_json)["layout"]["title"] == "victim"

            service = TemplateSnapshotService(db)
            with pytest.raises(ValueError, match="owner binding is immutable"):
                await service.upsert_template(template_payload.model_dump())
            with pytest.raises(ValueError, match="owner binding is immutable"):
                await service.upsert_instance(instance_payload.model_dump())
        await engine.dispose()

    asyncio.run(scenario())


def test_client_runtime_browser_upsert_updates_only_a_provisioned_instance():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            admin = User(id="runtime-admin", email="runtime-admin@example.test", role="admin")
            client = Organization(name="Runtime client", code="RC", org_type="client", status="active")
            db.add_all([admin, client])
            await db.flush()
            project = Project(client_org_id=client.id, name="Runtime plan", code="RP", status="active")
            db.add(project)
            await db.flush()
            actor = UserResponse(id=admin.id, email=admin.email, role="admin")
            instance_id = f"client-plan:{client.id}:{project.id}"
            payload = InstanceUpsertRequest(
                instance_id=instance_id,
                instance_type="client-plan",
                owner_scope="client",
                owner_id=project.code,
                organization_id=client.id,
                project_id=project.id,
                name="Runtime plan",
                base_template_id="client-source-global",
                snapshot_config_json={"layout": {"title": "browser draft"}},
            )

            with pytest.raises(HTTPException) as missing:
                await upsert_instance(
                    instance_id=instance_id,
                    payload=payload,
                    request=_request("PUT"),
                    db=db,
                    current_user=actor,
                )
            assert missing.value.status_code == 409
            assert await db.get(TemplateSnapshotInstance, instance_id) is None

            provisioned = TemplateSnapshotInstance(
                instance_id=instance_id,
                instance_type="client-plan",
                owner_scope="client",
                owner_id=project.code,
                organization_id=client.id,
                project_id=project.id,
                name="Runtime plan",
                base_template_id="client-source-global",
                snapshot_config_json=json.dumps({"layout": {"title": "provisioned"}}),
                override_config_json="{}",
            )
            db.add(provisioned)
            await db.commit()

            updated = await upsert_instance(
                instance_id=instance_id,
                payload=payload,
                request=_request("PUT"),
                db=db,
                current_user=actor,
            )
            assert updated["instance_id"] == instance_id
            assert updated["organization_id"] == client.id
            assert updated["project_id"] == project.id
            await db.refresh(provisioned)
            assert json.loads(provisioned.snapshot_config_json)["layout"]["title"] == "browser draft"
        await engine.dispose()

    asyncio.run(scenario())


def test_non_admin_headquarters_member_cannot_create_update_or_publish_source_templates():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            member = User(id="hq-member", email="hq-member@example.test", role="user")
            hq = Organization(name="Headquarters", code="HQ", org_type="hq", status="active")
            db.add_all([member, hq])
            await db.flush()
            db.add(Membership(user_id=member.id, org_id=hq.id, status="active"))
            existing = TemplateSnapshotTemplate(
                template_id="client-source-global",
                template_type="hq-client",
                owner_scope="client_source",
                organization_id=hq.id,
                name="Client source",
                latest_version="v1",
                config_json=json.dumps({"layout": {"title": "released"}}),
                is_published=True,
            )
            db.add(existing)
            await db.commit()
            actor = UserResponse(id=member.id, email=member.email, role="user")

            create_payload = TemplateCreateRequest(
                template_id="agency-source-new",
                template_type="hq-agent",
                owner_scope="agency_source",
                organization_id=hq.id,
                name="Unauthorized source",
                config_json={"layout": {"title": "unauthorized"}},
            )
            with pytest.raises(HTTPException) as denied_create:
                await create_template(
                    payload=create_payload,
                    request=_request("POST"),
                    db=db,
                    current_user=actor,
                )
            assert denied_create.value.status_code == 403

            update_payload = TemplateUpsertRequest(
                template_id=existing.template_id,
                template_type="hq-client",
                owner_scope="client_source",
                organization_id=hq.id,
                name="Unauthorized update",
                config_json={"layout": {"title": "unauthorized"}},
            )
            with pytest.raises(HTTPException) as denied_update:
                await upsert_template(
                    template_id=existing.template_id,
                    payload=update_payload,
                    request=_request("PUT"),
                    db=db,
                    current_user=actor,
                )
            assert denied_update.value.status_code == 403

            with pytest.raises(HTTPException) as denied_publish:
                await publish_template(
                    template_id=existing.template_id,
                    payload=TemplatePublishRequest(version="v2"),
                    request=_request("POST"),
                    db=db,
                    current_user=actor,
                )
            assert denied_publish.value.status_code == 403

            await db.refresh(existing)
            assert existing.name == "Client source"
            assert json.loads(existing.config_json)["layout"]["title"] == "released"
            assert existing.latest_version == "v1"
        await engine.dispose()

    asyncio.run(scenario())
