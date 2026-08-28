import asyncio
from datetime import datetime, timezone
import json

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import models  # noqa: F401
from core.database import Base
from models.platform import Organization, PlanRuntimeConfig, Project
from models.template_snapshot import (
    TemplateSnapshotBackup,
    TemplateSnapshotInstance,
    TemplateSnapshotReleaseBatch,
    TemplateSnapshotTemplate,
    TemplateSnapshotVersion,
)
from services import tenant_provisioning as tenant_provisioning_service
from services.template_release_batches import TemplateReleaseBatchService
from services.tenant_provisioning import (
    agency_runtime_instance_id,
    client_plan_runtime_instance_id,
    provision_agency_runtime_template,
    provision_client_plan,
    provision_plan_activation_set,
    provision_plan_runtime_and_template,
)


FACTORY_DEFAULT_CONTRACT = "2026-08-27.1"


def _product_market_config(label: str, *, sound_enabled: bool = True) -> dict:
    return {
        "products": [{"path": "/news", "status": "active"}],
        "productOrder": ["/news"],
        "layoutStyle": {"title": label, "contentBgColor": "#f4f5f7"},
        "customerServiceSections": [{"id": "expert", "title": f"{label} expert"}],
        "soundEnabled": sound_enabled,
    }


async def _install_zero_target_factory_pointer(
    db,
    *,
    template: TemplateSnapshotTemplate,
    version: str,
    batch_id: str,
) -> TemplateSnapshotReleaseBatch:
    promoted_at = datetime.now(timezone.utc)
    batch = TemplateSnapshotReleaseBatch(
        id=batch_id,
        template_id=template.template_id,
        template_version=version,
        owner_scope="client",
        sections_json="[]",
        status="completed",
        total_targets=0,
        succeeded_targets=0,
        failed_targets=0,
        completed_at=promoted_at,
    )
    db.add(batch)
    await db.flush()
    template.factory_default_version = version
    template.factory_default_release_batch_id = batch.id
    template.factory_default_contract_version = FACTORY_DEFAULT_CONTRACT
    template.factory_default_promoted_at = promoted_at
    await db.flush()
    return batch


def test_agency_to_client_plan_provisioning_keeps_tenant_bindings():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        session_factory = async_sessionmaker(engine, expire_on_commit=False)

        async with session_factory() as db:
            hq = Organization(name="总部", code="HQ", org_type="hq", status="active", lineage_path="1")
            db.add(hq)
            await db.flush()
            agency = Organization(
                name="一级代理01有限公司",
                code="D01",
                org_type="agency",
                parent_id=hq.id,
                root_org_id=hq.id,
                root_agency_id=None,
                agent_level=1,
                status="active",
                lineage_path=f"{hq.id}/2",
            )
            db.add_all([
                agency,
                TemplateSnapshotTemplate(
                    template_id="client-source-global",
                    template_type="hq-client",
                    owner_scope="client_source",
                    organization_id=hq.id,
                    name="客户源通用模板",
                    config_json=json.dumps({"modules": ["content"]}),
                    latest_version="v1.0.0",
                    is_published=True,
                ),
            ])
            await db.flush()
            agency.root_agency_id = agency.id
            db.add(
                TemplateSnapshotVersion(
                    template_id="client-source-global",
                    version="v1.0.0",
                    config_json=json.dumps({"modules": ["content"]}),
                    review_status="published",
                )
            )
            await db.flush()

            result = await provision_client_plan(
                db,
                agency_org_id=agency.id,
                client_name="客户0101有限公司",
                client_code="K0101",
                plan_name="计划01",
                plan_code="P01",
            )
            await db.commit()

            client = await db.scalar(select(Organization).where(Organization.id == result.client_org_id))
            project = await db.scalar(select(Project).where(Project.id == result.project_id))
            runtime = await db.scalar(select(PlanRuntimeConfig).where(PlanRuntimeConfig.project_id == result.project_id))
            instance = await db.scalar(
                select(TemplateSnapshotInstance).where(TemplateSnapshotInstance.instance_id == result.template_instance_id)
            )
            assert client is not None and client.parent_id == agency.id
            assert client.root_agency_id == agency.id
            assert project is not None and project.client_org_id == client.id
            assert runtime is not None and runtime.deployment_id == "shared-stamp-a"
            assert instance is not None
            assert instance.organization_id == client.id and instance.project_id == project.id
            assert instance.base_template_version == "v1.0.0"

            with pytest.raises(ValueError, match="client code already exists"):
                await provision_client_plan(
                    db,
                    agency_org_id=agency.id,
                    client_name="重复客户",
                    client_code="K0101",
                    plan_name="重复计划",
                    plan_code="P02",
                )
        await engine.dispose()

    asyncio.run(scenario())


def test_clients_may_reuse_a_plan_code_and_both_receive_the_factory_release():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        session_factory = async_sessionmaker(engine, expire_on_commit=False)

        async with session_factory() as db:
            v1_config = _product_market_config("shared-code-v1")
            template = TemplateSnapshotTemplate(
                template_id="client-source-global",
                template_type="hq-client",
                owner_scope="client_source",
                name="Client source",
                latest_version="v1",
                config_json=json.dumps(v1_config),
                is_published=True,
            )
            v1 = TemplateSnapshotVersion(
                template_id=template.template_id,
                version="v1",
                config_json=json.dumps(v1_config),
                changelog=f"Product Market factory default {FACTORY_DEFAULT_CONTRACT}",
                review_status="published",
            )
            first_client = Organization(name="Client A", code="CLIENT-A", org_type="client", status="active")
            second_client = Organization(name="Client B", code="CLIENT-B", org_type="client", status="active")
            db.add_all([template, v1, first_client, second_client])
            await db.flush()
            await _install_zero_target_factory_pointer(
                db,
                template=template,
                version="v1",
                batch_id="shared-code-v1-factory-batch",
            )
            first_project = Project(client_org_id=first_client.id, name="Basic A", code="BASIC", status="active")
            second_project = Project(client_org_id=second_client.id, name="Basic B", code="BASIC", status="active")
            db.add_all([first_project, second_project])
            await db.flush()

            first_instance_id = await provision_plan_runtime_and_template(
                db,
                client=first_client,
                project=first_project,
            )
            second_instance_id = await provision_plan_runtime_and_template(
                db,
                client=second_client,
                project=second_project,
            )
            await db.commit()

            assert first_instance_id == client_plan_runtime_instance_id(
                "BASIC",
                organization_id=first_client.id,
                project_id=first_project.id,
            )
            assert second_instance_id == client_plan_runtime_instance_id(
                "BASIC",
                organization_id=second_client.id,
                project_id=second_project.id,
            )
            assert first_instance_id != second_instance_id

            v2_config = _product_market_config("shared-code-v2", sound_enabled=False)
            v1.review_status = "archived"
            template.latest_version = "v2"
            template.config_json = json.dumps(v2_config)
            db.add(
                TemplateSnapshotVersion(
                    template_id=template.template_id,
                    version="v2",
                    config_json=json.dumps(v2_config),
                    changelog=f"Product Market factory default {FACTORY_DEFAULT_CONTRACT}",
                    review_status="published",
                )
            )
            await db.commit()

            service = TemplateReleaseBatchService(db)
            batch = await service.create(
                template_id=template.template_id,
                instance_ids=None,
                expected_version="v2",
                created_by="hq-test",
            )
            assert batch["total_targets"] == 2
            assert {target["instance_id"] for target in batch["targets"]} == {
                first_instance_id,
                second_instance_id,
            }
            completed = await service.process(batch["id"])
            assert completed["status"] == "completed"
            assert completed["succeeded_targets"] == 2
            assert completed["failed_targets"] == 0

            runtime_versions = set(
                (
                    await db.execute(
                        select(PlanRuntimeConfig.template_version).where(
                            PlanRuntimeConfig.project_id.in_((first_project.id, second_project.id))
                        )
                    )
                ).scalars().all()
            )
            assert runtime_versions == {"v2"}
            assert template.factory_default_version == "v2"
        await engine.dispose()

    asyncio.run(scenario())


def test_plan_runtime_and_activation_reject_cross_client_project_binding_without_writes():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            owner = Organization(name="Owner", code="OWNER", org_type="client", status="active")
            other = Organization(name="Other", code="OTHER", org_type="client", status="inactive")
            db.add_all([owner, other])
            await db.flush()
            project = Project(client_org_id=owner.id, name="Owner plan", code="OWNER-PLAN", status="active")
            db.add(project)
            await db.flush()

            with pytest.raises(ValueError, match="does not belong to the requested client organization"):
                await provision_plan_runtime_and_template(db, client=other, project=project)
            with pytest.raises(ValueError, match="does not belong to the requested client organization"):
                await provision_plan_activation_set(db, client=other, projects=[project])

            assert (await db.execute(select(TemplateSnapshotInstance))).scalars().all() == []
            assert (await db.execute(select(PlanRuntimeConfig))).scalars().all() == []
        await engine.dispose()

    asyncio.run(scenario())


def test_hq_to_three_agency_levels_to_multiple_client_plans_rolls_out_canonical_instances():
    """One in-memory rehearsal of the commercial tenancy and release chain."""
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        session_factory = async_sessionmaker(engine, expire_on_commit=False)

        async with session_factory() as db:
            hq = Organization(name="HQ", code="HQ", org_type="hq", status="active", lineage_path="1")
            db.add(hq)
            await db.flush()
            agency_1 = Organization(name="Level 1", code="A01", org_type="agency", parent_id=hq.id, root_org_id=hq.id, agent_level=1, status="active", lineage_path=f"{hq.id}")
            db.add(agency_1)
            await db.flush()
            agency_1.root_agency_id = agency_1.id
            agency_2 = Organization(name="Level 2", code="A0101", org_type="sub_agency", parent_id=agency_1.id, root_org_id=hq.id, root_agency_id=agency_1.id, agent_level=2, status="active", lineage_path=f"{hq.id}/{agency_1.id}")
            agency_3 = Organization(name="Level 3", code="A010101", org_type="sub_agency", parent_id=agency_2.id, root_org_id=hq.id, root_agency_id=agency_1.id, agent_level=3, status="active", lineage_path=f"{hq.id}/{agency_1.id}/{agency_2.id}")
            db.add_all([agency_2, agency_3])
            await db.flush()
            db.add_all([
                TemplateSnapshotTemplate(template_id="agency-source-global", template_type="hq-agency", owner_scope="agency_source", organization_id=hq.id, name="Agency source", latest_version="v1", config_json=json.dumps({"layout": {"title": "agency-v1"}}), is_published=True),
                TemplateSnapshotTemplate(template_id="client-source-global", template_type="hq-client", owner_scope="client_source", organization_id=hq.id, name="Client source", latest_version="v1", config_json=json.dumps({"layout": {"title": "client-v1"}}), is_published=True),
                TemplateSnapshotVersion(template_id="agency-source-global", version="v1", config_json=json.dumps({"layout": {"title": "agency-v1"}}), review_status="published"),
                TemplateSnapshotVersion(template_id="client-source-global", version="v1", config_json=json.dumps({"layout": {"title": "client-v1"}}), review_status="published"),
            ])
            await db.flush()

            for agency in (agency_1, agency_2, agency_3):
                await provision_agency_runtime_template(db, agency=agency)

            first = await provision_client_plan(db, agency_org_id=agency_1.id, client_name="Client 1", client_code="C01", plan_name="Plan 01", plan_code="P01")
            second = await provision_client_plan(db, agency_org_id=agency_2.id, client_name="Client 2", client_code="C02", plan_name="Plan 02", plan_code="P02")
            third = await provision_client_plan(db, agency_org_id=agency_3.id, client_name="Client 3", client_code="C03", plan_name="Plan 03", plan_code="P03")
            first_client = await db.scalar(select(Organization).where(Organization.id == first.client_org_id))
            assert first_client is not None
            extra_plan = Project(client_org_id=first_client.id, name="Plan 04", code="P04", status="active")
            db.add(extra_plan)
            await db.flush()
            await provision_plan_runtime_and_template(db, client=first_client, project=extra_plan)
            await db.commit()

            agency_instances = (await db.execute(select(TemplateSnapshotInstance).where(TemplateSnapshotInstance.owner_scope == "agency"))).scalars().all()
            client_instances = (await db.execute(select(TemplateSnapshotInstance).where(TemplateSnapshotInstance.owner_scope == "client"))).scalars().all()
            assert {item.instance_id for item in agency_instances} == {agency_runtime_instance_id("A01"), agency_runtime_instance_id("A0101"), agency_runtime_instance_id("A010101")}
            assert {item.instance_id for item in client_instances} == {
                client_plan_runtime_instance_id("P01", organization_id=first.client_org_id, project_id=first.project_id),
                client_plan_runtime_instance_id("P02", organization_id=second.client_org_id, project_id=second.project_id),
                client_plan_runtime_instance_id("P03", organization_id=third.client_org_id, project_id=third.project_id),
                client_plan_runtime_instance_id("P04", organization_id=first_client.id, project_id=extra_plan.id),
            }
            assert {item.organization_id for item in agency_instances} == {agency_1.id, agency_2.id, agency_3.id}
            assert {item.project_id for item in client_instances} == {first.project_id, second.project_id, third.project_id, extra_plan.id}

            agency_template = await db.scalar(select(TemplateSnapshotTemplate).where(TemplateSnapshotTemplate.template_id == "agency-source-global"))
            client_template = await db.scalar(select(TemplateSnapshotTemplate).where(TemplateSnapshotTemplate.template_id == "client-source-global"))
            assert agency_template is not None and client_template is not None
            for template, title in ((agency_template, "agency"), (client_template, "client")):
                v1 = await db.scalar(
                    select(TemplateSnapshotVersion).where(
                        TemplateSnapshotVersion.template_id == template.template_id,
                        TemplateSnapshotVersion.version == "v1",
                    )
                )
                assert v1 is not None
                v1.review_status = "archived"
                db.add(TemplateSnapshotVersion(template_id=template.template_id, version="v2", config_json=json.dumps({"layout": {"title": f"{title}-v2"}}), review_status="published"))
                template.latest_version = "v2"
                template.config_json = json.dumps({"layout": {"title": f"{title}-v2"}})
            await db.commit()

            for template_id, target_count in (("agency-source-global", 3), ("client-source-global", 4)):
                service = TemplateReleaseBatchService(db)
                batch = await service.create(template_id=template_id, instance_ids=None, created_by="hq-test")
                completed = await service.process(batch["id"])
                assert completed["status"] == "completed"
                assert completed["succeeded_targets"] == target_count

            all_instances = (await db.execute(select(TemplateSnapshotInstance))).scalars().all()
            assert all(item.base_template_version == "v2" for item in all_instances)
            assert all(json.loads(item.snapshot_config_json)["layout"]["title"].endswith("v2") for item in all_instances)
        await engine.dispose()

    asyncio.run(scenario())


def test_new_client_plan_uses_confirmed_factory_default_instead_of_unpromoted_latest_version():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            confirmed_config = _product_market_config("confirmed-v1")
            unpromoted_latest_config = _product_market_config("unpromoted-v2", sound_enabled=False)
            template = TemplateSnapshotTemplate(
                template_id="client-source-global",
                template_type="hq-client",
                owner_scope="client_source",
                name="client source",
                latest_version="v2",
                is_published=True,
                config_json=json.dumps(unpromoted_latest_config),
            )
            db.add_all([
                template,
                TemplateSnapshotVersion(
                    template_id=template.template_id,
                    version="v1",
                    config_json=json.dumps(confirmed_config),
                    changelog=f"Product Market factory default {FACTORY_DEFAULT_CONTRACT}",
                    review_status="archived",
                ),
                TemplateSnapshotVersion(
                    template_id=template.template_id,
                    version="v2",
                    config_json=json.dumps(unpromoted_latest_config),
                    changelog=f"Product Market factory default {FACTORY_DEFAULT_CONTRACT}",
                    review_status="published",
                ),
            ])
            await db.flush()
            completed_batch = await _install_zero_target_factory_pointer(
                db,
                template=template,
                version="v1",
                batch_id="confirmed-zero-plan-full-batch",
            )
            await db.commit()

            client = Organization(name="Factory Client", code="FACTORY-CLIENT", org_type="client", status="active")
            db.add(client)
            await db.flush()
            project = Project(client_org_id=client.id, name="New Plan", code="NEW-PLAN", status="active")
            db.add(project)
            await db.flush()

            instance_id = await provision_plan_runtime_and_template(
                db,
                client=client,
                project=project,
            )
            await db.commit()

            instance = await db.scalar(
                select(TemplateSnapshotInstance).where(TemplateSnapshotInstance.instance_id == instance_id)
            )
            runtime = await db.scalar(
                select(PlanRuntimeConfig).where(PlanRuntimeConfig.project_id == project.id)
            )
            assert instance is not None
            assert runtime is not None
            assert instance.base_template_version == "v1"
            assert json.loads(instance.snapshot_config_json) == confirmed_config
            assert runtime.template_version == "v1"
            assert json.loads(instance.snapshot_config_json) != unpromoted_latest_config
            assert template.factory_default_release_batch_id == completed_batch.id
            assert template.factory_default_promoted_at is not None
        await engine.dispose()

    asyncio.run(scenario())


def test_zero_active_plan_release_auto_promotes_and_the_first_plan_inherits_it():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            factory_config = _product_market_config("zero-plan-factory")
            template = TemplateSnapshotTemplate(
                template_id="client-source-global",
                template_type="hq-client",
                owner_scope="client_source",
                name="client source",
                latest_version="v1",
                is_published=True,
                config_json=json.dumps(factory_config),
            )
            db.add_all(
                [
                    template,
                    TemplateSnapshotVersion(
                        template_id=template.template_id,
                        version="v1",
                        config_json=json.dumps(factory_config),
                        changelog=f"Product Market factory default {FACTORY_DEFAULT_CONTRACT}",
                        review_status="published",
                    ),
                ]
            )
            await db.commit()

            release_service = TemplateReleaseBatchService(db)
            batch = await release_service.create(
                template_id=template.template_id,
                instance_ids=None,
                expected_version="v1",
                created_by=None,
            )
            assert batch["status"] == "queued"
            assert batch["total_targets"] == 0
            completed = await release_service.process(batch["id"])
            await db.refresh(template)
            assert completed["status"] == "completed"
            assert template.factory_default_version == "v1"
            assert template.factory_default_release_batch_id == batch["id"]
            assert template.factory_default_contract_version == FACTORY_DEFAULT_CONTRACT
            assert template.factory_default_promoted_at is not None

            client = Organization(name="First Client", code="FIRST-CLIENT", org_type="client", status="active")
            db.add(client)
            await db.flush()
            project = Project(client_org_id=client.id, name="First Plan", code="FIRST-PLAN", status="active")
            db.add(project)
            await db.flush()
            instance_id = await provision_plan_runtime_and_template(db, client=client, project=project)
            await db.commit()

            instance = await db.scalar(
                select(TemplateSnapshotInstance).where(TemplateSnapshotInstance.instance_id == instance_id)
            )
            assert instance is not None
            assert instance.base_template_version == "v1"
            assert json.loads(instance.snapshot_config_json) == factory_config
        await engine.dispose()

    asyncio.run(scenario())


def test_activation_provisioning_is_caller_owned_and_rolls_back_every_partial_write():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        session_factory = async_sessionmaker(engine, expire_on_commit=False)
        async with session_factory() as db:
            v1_config = _product_market_config("v1", sound_enabled=False)
            v2_config = _product_market_config("v2")
            template = TemplateSnapshotTemplate(
                template_id="client-source-global",
                template_type="hq-client",
                owner_scope="client_source",
                name="client source",
                latest_version="v2",
                is_published=True,
                config_json=json.dumps(v2_config),
            )
            client = Organization(name="Original Client", code="ROLLBACK-CLIENT", org_type="client", status="inactive")
            db.add_all(
                [
                    template,
                    client,
                    TemplateSnapshotVersion(
                        template_id=template.template_id,
                        version="v1",
                        config_json=json.dumps(v1_config),
                        review_status="archived",
                    ),
                    TemplateSnapshotVersion(
                        template_id=template.template_id,
                        version="v2",
                        config_json=json.dumps(v2_config),
                        changelog=f"Product Market factory default {FACTORY_DEFAULT_CONTRACT}",
                        review_status="published",
                    ),
                ]
            )
            await db.flush()
            project = Project(client_org_id=client.id, name="Existing Plan", code="ROLLBACK-PLAN", status="active")
            db.add(project)
            await db.flush()
            instance = TemplateSnapshotInstance(
                instance_id=client_plan_runtime_instance_id(project.code),
                instance_type="client-plan",
                owner_scope="client",
                owner_id=project.code,
                organization_id=client.id,
                project_id=project.id,
                name="Existing runtime",
                base_template_id=template.template_id,
                base_template_version="v1",
                snapshot_config_json=json.dumps(v1_config),
                override_config_json="{}",
            )
            db.add(instance)
            await db.flush()
            await _install_zero_target_factory_pointer(
                db,
                template=template,
                version="v2",
                batch_id="rollback-factory-batch",
            )
            await db.commit()
            client_id, project_id, instance_id = client.id, project.id, instance.instance_id

            client.name = "Should Roll Back"
            await provision_plan_activation_set(db, client=client, projects=[project])
            client.status = "active"
            await db.flush()
            assert instance.base_template_version == "v2"
            assert len((await db.execute(select(TemplateSnapshotBackup))).scalars().all()) == 1
            await db.rollback()

        async with session_factory() as verification_db:
            stored_client = await verification_db.scalar(select(Organization).where(Organization.id == client_id))
            stored_project = await verification_db.scalar(select(Project).where(Project.id == project_id))
            stored_instance = await verification_db.scalar(
                select(TemplateSnapshotInstance).where(TemplateSnapshotInstance.instance_id == instance_id)
            )
            assert stored_client is not None and stored_client.name == "Original Client"
            assert stored_client.status == "inactive"
            assert stored_project is not None and stored_project.status == "active"
            assert stored_instance is not None and stored_instance.base_template_version == "v1"
            assert (await verification_db.execute(select(TemplateSnapshotBackup))).scalars().all() == []
            assert (await verification_db.execute(select(PlanRuntimeConfig))).scalars().all() == []
        await engine.dispose()

    asyncio.run(scenario())


def test_multi_plan_resurrection_retries_a_mixed_factory_pointer_before_activation(monkeypatch):
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            configs = {
                "v0": _product_market_config("v0", sound_enabled=False),
                "v1": _product_market_config("v1"),
                "v2": _product_market_config("v2", sound_enabled=False),
            }
            template = TemplateSnapshotTemplate(
                template_id="client-source-global",
                template_type="hq-client",
                owner_scope="client_source",
                name="client source",
                latest_version="v2",
                is_published=True,
                config_json=json.dumps(configs["v2"]),
            )
            client = Organization(name="Resurrection Client", code="RESURRECT", org_type="client", status="inactive")
            db.add_all(
                [
                    template,
                    client,
                    TemplateSnapshotVersion(template_id=template.template_id, version="v0", config_json=json.dumps(configs["v0"]), review_status="archived"),
                    TemplateSnapshotVersion(template_id=template.template_id, version="v1", config_json=json.dumps(configs["v1"]), review_status="archived"),
                    TemplateSnapshotVersion(template_id=template.template_id, version="v2", config_json=json.dumps(configs["v2"]), review_status="published"),
                ]
            )
            await db.flush()
            projects = [
                Project(client_org_id=client.id, name=f"Plan {index}", code=f"RES-{index}", status="active")
                for index in (1, 2)
            ]
            db.add_all(projects)
            await db.flush()
            for project in projects:
                db.add(
                    TemplateSnapshotInstance(
                        instance_id=client_plan_runtime_instance_id(
                            project.code,
                            organization_id=client.id,
                            project_id=project.id,
                        ),
                        instance_type="client-plan",
                        owner_scope="client",
                        owner_id=project.code,
                        organization_id=client.id,
                        project_id=project.id,
                        name=f"{project.name} runtime",
                        base_template_id=template.template_id,
                        base_template_version="v0",
                        snapshot_config_json=json.dumps(configs["v0"]),
                        override_config_json="{}",
                    )
                )
            await db.commit()

            call_count = 0
            observed_versions: list[list[str]] = []

            async def interleaved_resolver(resolver_db, _template):
                nonlocal call_count
                call_count += 1
                if call_count in {3, 6}:
                    rows = (
                        await resolver_db.execute(
                            select(TemplateSnapshotInstance).order_by(TemplateSnapshotInstance.instance_id)
                        )
                    ).scalars().all()
                    observed_versions.append([row.base_template_version for row in rows])
                resolved = "v1" if call_count == 1 else "v2"
                return resolved, json.dumps(configs[resolved])

            monkeypatch.setattr(
                tenant_provisioning_service,
                "resolve_product_market_runtime_default",
                interleaved_resolver,
            )
            confirmed = await provision_plan_activation_set(db, client=client, projects=projects)
            assert client.status == "inactive"
            client.status = "active"
            await db.commit()

            instances = (
                await db.execute(
                    select(TemplateSnapshotInstance).order_by(TemplateSnapshotInstance.instance_id)
                )
            ).scalars().all()
            assert confirmed == "v2"
            assert observed_versions == [["v1", "v2"], ["v2", "v2"]]
            assert {instance.base_template_version for instance in instances} == {"v2"}
            assert client.status == "active"
        await engine.dispose()

    asyncio.run(scenario())


def test_active_plan_provisioning_fails_closed_without_a_published_immutable_source():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            client = Organization(name="Fail Closed", code="FAIL-CLOSED", org_type="client", status="active")
            db.add(client)
            await db.flush()
            project = Project(client_org_id=client.id, name="Blocked Plan", code="BLOCKED", status="active")
            db.add(project)
            await db.commit()

            with pytest.raises(ValueError, match="requires a published client-source template"):
                await provision_plan_runtime_and_template(db, client=client, project=project)
            await db.rollback()

            dangling = TemplateSnapshotTemplate(
                template_id="client-source-global",
                template_type="hq-client",
                owner_scope="client_source",
                name="dangling source",
                latest_version="missing-version",
                is_published=True,
                config_json=json.dumps(_product_market_config("dangling")),
            )
            db.add(dangling)
            await db.commit()
            with pytest.raises(ValueError, match="not backed by immutable history"):
                await provision_plan_runtime_and_template(db, client=client, project=project)
            await db.rollback()

            assert (await db.execute(select(TemplateSnapshotInstance))).scalars().all() == []
            assert (await db.execute(select(PlanRuntimeConfig))).scalars().all() == []
        await engine.dispose()

    asyncio.run(scenario())
