import asyncio
from datetime import datetime, timedelta, timezone
import json

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import models  # noqa: F401
from core.database import Base
from models.platform import AuditLog, Organization, PlanRuntimeConfig, Project
from models.template_snapshot import (
    TemplateSnapshotBackup,
    TemplateSnapshotInstance,
    TemplateSnapshotReleaseBatch,
    TemplateSnapshotReleaseTarget,
    TemplateSnapshotTemplate,
    TemplateSnapshotVersion,
)
from services.product_market_factory_default import (
    PRODUCT_MARKET_FACTORY_DEFAULT_CONTRACT_VERSION,
    validate_product_market_config_shape,
)
from services.template_release_batches import TemplateReleaseBatchService
from services.template_snapshot import TemplateSnapshotService


FACTORY_DEFAULT_CONTRACT = "2026-08-27.1"


def _product_market_config(
    label: str,
    *,
    sound_enabled: bool = True,
    product_status: str = "active",
    spacing: str = "relaxed",
) -> dict:
    return {
        "products": [{"path": "/news", "status": product_status}],
        "productOrder": ["/news"],
        "layoutStyle": {
            "title": label,
            "contentBgColor": "#f4f5f7" if product_status == "active" else "#ffffff",
            "sharedSpacing": spacing,
        },
        "customerServiceSections": [{"id": "expert", "title": f"{label} expert"}],
        "soundEnabled": sound_enabled,
    }


@pytest.mark.parametrize(
    ("mutation", "message"),
    [
        (lambda config: config["products"].append(dict(config["products"][0])), "unique non-empty paths"),
        (lambda config: config.__setitem__("productOrder", ["/different"]), "exactly cover unique product paths"),
        (lambda config: config.__setitem__("layoutStyle", {}), "layoutStyle must not be empty"),
        (lambda config: config.__setitem__("customerServiceSections", []), "customerServiceSections require"),
    ],
)
def test_product_market_factory_config_requires_consistent_non_empty_areas(mutation, message):
    config = _product_market_config("strict-shape")
    mutation(config)
    with pytest.raises(ValueError, match=message):
        validate_product_market_config_shape(json.dumps(config))


async def _add_active_client_plan(
    db,
    *,
    template_id: str,
    plan_code: str,
    base_version: str,
    snapshot: dict,
    overrides: dict | None = None,
) -> tuple[Organization, Project, TemplateSnapshotInstance]:
    normalized_plan_code = plan_code.strip().upper()
    client = Organization(
        name=f"Client {normalized_plan_code}",
        code=f"CLIENT-{normalized_plan_code}",
        org_type="client",
        status="active",
    )
    db.add(client)
    await db.flush()
    project = Project(
        client_org_id=client.id,
        name=f"Plan {normalized_plan_code}",
        code=normalized_plan_code,
        status="active",
    )
    db.add(project)
    await db.flush()
    instance = TemplateSnapshotInstance(
        instance_id=f"client-plan:{normalized_plan_code}",
        instance_type="client-plan",
        owner_scope="client",
        owner_id=normalized_plan_code,
        organization_id=client.id,
        project_id=project.id,
        name=f"Plan {normalized_plan_code} runtime",
        base_template_id=template_id,
        base_template_version=base_version,
        snapshot_config_json=json.dumps(snapshot),
        override_config_json=json.dumps(overrides or {}),
    )
    db.add(instance)
    db.add(
        PlanRuntimeConfig(
            project_id=project.id,
            template_version=base_version,
            status="active",
        )
    )
    await db.flush()
    return client, project, instance


async def _install_completed_factory_pointer(
    db,
    *,
    template: TemplateSnapshotTemplate,
    version: str,
    batch_id: str,
    instance: TemplateSnapshotInstance | None,
) -> TemplateSnapshotReleaseBatch:
    promoted_at = datetime.now(timezone.utc)
    total_targets = 1 if instance else 0
    batch = TemplateSnapshotReleaseBatch(
        id=batch_id,
        template_id=template.template_id,
        template_version=version,
        owner_scope="client",
        sections_json="[]",
        status="completed",
        total_targets=total_targets,
        succeeded_targets=total_targets,
        failed_targets=0,
        completed_at=promoted_at,
    )
    db.add(batch)
    await db.flush()
    if instance:
        db.add(
            TemplateSnapshotReleaseTarget(
                batch_id=batch.id,
                instance_id=instance.instance_id,
                organization_id=instance.organization_id,
                project_id=instance.project_id,
                status="succeeded",
                completed_at=promoted_at,
            )
        )
    template.factory_default_version = version
    template.factory_default_release_batch_id = batch.id
    template.factory_default_contract_version = FACTORY_DEFAULT_CONTRACT
    template.factory_default_promoted_at = promoted_at
    await db.flush()
    return batch


def test_template_release_batch_syncs_each_target_and_records_backup():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        session_factory = async_sessionmaker(engine, expire_on_commit=False)
        async with session_factory() as db:
            template = TemplateSnapshotTemplate(
                template_id="test-template-release",
                template_type="client-source",
                owner_scope="client_source",
                name="test template",
                latest_version="v2",
                is_published=True,
                config_json=json.dumps({"layout": {"title": "new"}}),
            )
            db.add_all([
                template,
                TemplateSnapshotVersion(
                    template_id=template.template_id,
                    version="v1",
                    config_json=json.dumps({"layout": {"title": "old"}}),
                    review_status="archived",
                ),
                TemplateSnapshotVersion(
                    template_id=template.template_id,
                    version="v2",
                    config_json=json.dumps({"layout": {"title": "new"}}),
                    review_status="published",
                ),
                TemplateSnapshotInstance(
                    instance_id="test-template-release-instance",
                    instance_type="client-plan",
                    owner_scope="client",
                    name="test instance",
                    base_template_id=template.template_id,
                    base_template_version="v1",
                    snapshot_config_json=json.dumps({"layout": {"title": "old"}}),
                    override_config_json="{}",
                ),
            ])
            await db.commit()

            service = TemplateReleaseBatchService(db)
            created = await service.create(
                template_id=template.template_id,
                instance_ids=["test-template-release-instance"],
                created_by=None,
            )
            result = await service.process(created["id"])

            assert result["status"] == "completed"
            assert result["succeeded_targets"] == 1
            assert result["failed_targets"] == 0
            assert result["targets"][0]["status"] == "succeeded"
            instance = await db.scalar(select(TemplateSnapshotInstance).where(TemplateSnapshotInstance.instance_id == "test-template-release-instance"))
            assert instance is not None and instance.base_template_version == "v2"
            assert json.loads(instance.snapshot_config_json)["layout"]["title"] == "new"
            backups = (await db.execute(select(TemplateSnapshotBackup))).scalars().all()
            assert len(backups) == 1
            assert backups[0].target_id == "test-template-release-instance"
        await engine.dispose()

    asyncio.run(scenario())


def test_client_source_all_target_batch_is_idempotent_and_covers_every_client_plan():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        session_factory = async_sessionmaker(engine, expire_on_commit=False)
        async with session_factory() as db:
            previous_config = _product_market_config(
                "factory-v2",
                sound_enabled=False,
                product_status="hidden",
                spacing="compact",
            )
            latest_config = _product_market_config("factory-v3")
            template = TemplateSnapshotTemplate(
                template_id="client-source-global",
                template_type="hq-client",
                owner_scope="client_source",
                name="client source",
                latest_version="v3",
                is_published=True,
                config_json=json.dumps(latest_config),
            )
            db.add(template)
            db.add_all([
                TemplateSnapshotVersion(
                    template_id=template.template_id,
                    version="v2",
                    config_json=json.dumps(previous_config),
                    review_status="archived",
                ),
                TemplateSnapshotVersion(
                    template_id=template.template_id,
                    version="v3",
                    config_json=template.config_json,
                    review_status="published",
                ),
            ])
            for index in range(2):
                runtime_snapshot = json.loads(json.dumps(previous_config))
                runtime_snapshot["layoutStyle"]["tenantAccent"] = f"tenant-{index + 1}"
                runtime_snapshot["tenantBusinessSentinel"] = {
                    "leadId": f"LEAD-{index + 1}",
                    "amount": 100 + index,
                }
                await _add_active_client_plan(
                    db,
                    template_id=template.template_id,
                    plan_code=f"ALL-{index + 1}",
                    base_version="v2",
                    snapshot=runtime_snapshot,
                    overrides={"layoutStyle": {"tenantAccent": f"tenant-{index + 1}"}},
                )
            await db.commit()

            service = TemplateReleaseBatchService(db)
            first = await service.create(
                template_id=template.template_id,
                instance_ids=None,
                created_by="publisher",
            )
            repeated = await service.create(
                template_id=template.template_id,
                instance_ids=None,
                created_by="publisher",
            )
            assert repeated["id"] == first["id"]
            assert repeated["total_targets"] == 2
            assert {target["instance_id"] for target in repeated["targets"]} == {
                "client-plan:ALL-1",
                "client-plan:ALL-2",
            }
            assert len((await db.execute(select(TemplateSnapshotReleaseBatch))).scalars().all()) == 1

            completed = await service.process(first["id"])
            assert completed["status"] == "completed"
            assert completed["succeeded_targets"] == completed["total_targets"] == 2
            after_completion = await service.create(
                template_id=template.template_id,
                instance_ids=None,
                created_by="publisher",
            )
            assert after_completion["id"] == first["id"]
            assert len((await db.execute(select(TemplateSnapshotBackup))).scalars().all()) == 2

            instances = (
                await db.execute(
                    select(TemplateSnapshotInstance).order_by(TemplateSnapshotInstance.instance_id)
                )
            ).scalars().all()
            assert len(instances) == 2
            for index, instance in enumerate(instances, start=1):
                effective = json.loads(instance.snapshot_config_json)
                overrides = json.loads(instance.override_config_json)
                assert instance.base_template_version == "v3"
                assert effective["layoutStyle"]["title"] == "factory-v3"
                assert effective["layoutStyle"]["sharedSpacing"] == "relaxed"
                assert effective["layoutStyle"]["tenantAccent"] == f"tenant-{index}"
                assert effective["tenantBusinessSentinel"] == {
                    "leadId": f"LEAD-{index}",
                    "amount": 99 + index,
                }
                assert overrides["layoutStyle"]["tenantAccent"] == f"tenant-{index}"
                assert overrides["tenantBusinessSentinel"] == effective["tenantBusinessSentinel"]
            runtimes = (
                await db.execute(select(PlanRuntimeConfig).order_by(PlanRuntimeConfig.project_id))
            ).scalars().all()
            assert len(runtimes) == 2
            assert {runtime.template_version for runtime in runtimes} == {"v3"}
        await engine.dispose()

    asyncio.run(scenario())


def test_client_source_full_rollout_rejects_an_active_plan_without_a_canonical_instance():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            first_client = Organization(name="Client One", code="CLIENT-ONE", org_type="client", status="active")
            missing_client = Organization(name="Client Missing", code="CLIENT-MISSING", org_type="client", status="active")
            db.add_all([first_client, missing_client])
            await db.flush()
            first_project = Project(client_org_id=first_client.id, name="Plan One", code="PLAN-ONE", status="active")
            missing_project = Project(client_org_id=missing_client.id, name="Plan Missing", code="PLAN-MISSING", status="active")
            db.add_all([first_project, missing_project])
            await db.flush()
            current_config = _product_market_config("v1")
            template = TemplateSnapshotTemplate(
                template_id="client-source-global",
                template_type="hq-client",
                owner_scope="client_source",
                name="client source",
                latest_version="v1",
                is_published=True,
                config_json=json.dumps(current_config),
            )
            db.add_all([
                template,
                TemplateSnapshotVersion(
                    template_id=template.template_id,
                    version="v1",
                    config_json=template.config_json,
                    review_status="published",
                ),
                TemplateSnapshotInstance(
                    instance_id="client-plan:PLAN-ONE",
                    instance_type="client-plan",
                    owner_scope="client",
                    owner_id=first_project.code,
                    organization_id=first_client.id,
                    project_id=first_project.id,
                    name="Plan One runtime",
                    base_template_id=template.template_id,
                    base_template_version="v1",
                    snapshot_config_json=template.config_json,
                    override_config_json="{}",
                ),
            ])
            await db.commit()

            with pytest.raises(ValueError, match="active client plans are missing canonical template instances"):
                await TemplateReleaseBatchService(db).create(
                    template_id=template.template_id,
                    instance_ids=None,
                    created_by="publisher",
                )
            assert (await db.execute(select(TemplateSnapshotReleaseBatch))).scalars().all() == []
        await engine.dispose()

    asyncio.run(scenario())


def test_completed_full_client_rollout_promotes_and_reads_back_product_market_factory_default():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            assert PRODUCT_MARKET_FACTORY_DEFAULT_CONTRACT_VERSION == FACTORY_DEFAULT_CONTRACT
            previous_config = _product_market_config(
                "v1",
                sound_enabled=False,
                product_status="hidden",
                spacing="compact",
            )
            factory_config = _product_market_config("v2")
            template = TemplateSnapshotTemplate(
                template_id="client-source-global",
                template_type="hq-client",
                owner_scope="client_source",
                name="client source",
                latest_version="v2",
                is_published=True,
                config_json=json.dumps(factory_config),
            )
            db.add_all([
                template,
                TemplateSnapshotVersion(
                    template_id=template.template_id,
                    version="v1",
                    config_json=json.dumps(previous_config),
                    changelog=f"Product Market factory default {FACTORY_DEFAULT_CONTRACT}",
                    review_status="archived",
                ),
                TemplateSnapshotVersion(
                    template_id=template.template_id,
                    version="v2",
                    config_json=json.dumps(factory_config),
                    changelog=f"Product Market factory default {FACTORY_DEFAULT_CONTRACT}",
                    review_status="published",
                ),
            ])
            _client, project, _instance = await _add_active_client_plan(
                db,
                template_id=template.template_id,
                plan_code="FACTORY-ONE",
                base_version="v1",
                snapshot=previous_config,
            )
            await db.commit()

            service = TemplateReleaseBatchService(db)
            batch = await service.create(
                template_id=template.template_id,
                instance_ids=None,
                created_by="publisher",
            )
            completed = await service.process(batch["id"])
            assert completed["status"] == "completed"

            await db.refresh(template)
            assert template.factory_default_version == "v2"
            assert template.factory_default_release_batch_id == batch["id"]
            assert template.factory_default_promoted_at is not None

            promoted = await service.promote_product_market_factory_default(
                template_id=template.template_id,
                release_batch_id=batch["id"],
                contract_version=FACTORY_DEFAULT_CONTRACT,
                promoted_by="publisher",
            )
            await db.refresh(template)
            assert promoted["valid"] is True
            assert promoted["covered_areas"] == ["operations", "modules", "layout", "service"]
            assert promoted["factory_default_config_json"] == factory_config
            assert promoted["total_targets"] == promoted["succeeded_targets"] == 1
            assert template.factory_default_version == "v2"
            assert template.factory_default_release_batch_id == batch["id"]
            assert template.factory_default_contract_version == FACTORY_DEFAULT_CONTRACT
            assert await service.get_product_market_factory_default(template.template_id) == promoted

            runtime = await db.scalar(
                select(PlanRuntimeConfig).where(PlanRuntimeConfig.project_id == project.id)
            )
            assert runtime is not None
            runtime.template_version = "v1"
            await db.commit()
            with pytest.raises(ValueError, match="stale client-plan runtime configuration"):
                await service.promote_product_market_factory_default(
                    template_id=template.template_id,
                    release_batch_id=batch["id"],
                    contract_version=FACTORY_DEFAULT_CONTRACT,
                    promoted_by="publisher",
                )
        await engine.dispose()

    asyncio.run(scenario())


def test_partial_failed_rollout_cannot_advance_existing_product_market_factory_default():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            template_id = "client-source-global"
            previous_config = _product_market_config(
                "v1",
                sound_enabled=False,
                product_status="hidden",
                spacing="compact",
            )
            next_config = _product_market_config("v2")
            template = TemplateSnapshotTemplate(
                template_id=template_id,
                template_type="hq-client",
                owner_scope="client_source",
                name="client source",
                latest_version="v2",
                is_published=True,
                config_json=json.dumps(next_config),
            )
            db.add_all([
                template,
                TemplateSnapshotVersion(
                    template_id=template.template_id,
                    version="v1",
                    config_json=json.dumps(previous_config),
                    changelog=f"Product Market factory default {FACTORY_DEFAULT_CONTRACT}",
                    review_status="archived",
                ),
                TemplateSnapshotVersion(
                    template_id=template.template_id,
                    version="v2",
                    config_json=template.config_json,
                    changelog=f"Product Market factory default {FACTORY_DEFAULT_CONTRACT}",
                    review_status="published",
                ),
            ])
            _client, project, instance = await _add_active_client_plan(
                db,
                template_id=template.template_id,
                plan_code="FAIL-ONE",
                base_version="v1",
                snapshot=previous_config,
            )
            previous_batch = await _install_completed_factory_pointer(
                db,
                template=template,
                version="v1",
                batch_id="previous-completed-full-batch",
                instance=instance,
            )
            previous_batch_id = previous_batch.id
            await db.commit()

            service = TemplateReleaseBatchService(db)
            batch = await service.create(
                template_id=template.template_id,
                instance_ids=None,
                created_by="publisher",
            )
            instance.project_id = project.id + 999
            await db.commit()
            failed = await service.process(batch["id"])
            assert failed["status"] == "partial_failed"
            assert failed["failed_targets"] == 1

            with pytest.raises(ValueError, match="requires every client-plan target to succeed"):
                await service.promote_product_market_factory_default(
                    template_id=template_id,
                    release_batch_id=batch["id"],
                    contract_version=FACTORY_DEFAULT_CONTRACT,
                    promoted_by="publisher",
                )
            await db.refresh(template)
            assert template.factory_default_version == "v1"
            assert template.factory_default_release_batch_id == previous_batch_id
            assert template.factory_default_contract_version == FACTORY_DEFAULT_CONTRACT
            assert template.factory_default_promoted_at is not None
        await engine.dispose()

    asyncio.run(scenario())


def test_client_source_batch_rejects_a_non_client_plan_target():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            template = TemplateSnapshotTemplate(
                template_id="client-source-invalid-target",
                template_type="hq-client",
                owner_scope="client_source",
                name="client source",
                latest_version="v1",
                is_published=True,
                config_json="{}",
            )
            db.add_all([
                template,
                TemplateSnapshotVersion(
                    template_id=template.template_id,
                    version="v1",
                    config_json="{}",
                    review_status="published",
                ),
                TemplateSnapshotInstance(
                    instance_id="agency-runtime-invalid-client-release",
                    instance_type="agency",
                    owner_scope="agency",
                    name="wrong target",
                    base_template_id=template.template_id,
                    base_template_version="v1",
                    snapshot_config_json="{}",
                    override_config_json="{}",
                ),
            ])
            await db.commit()

            try:
                await TemplateReleaseBatchService(db).create(
                    template_id=template.template_id,
                    instance_ids=["agency-runtime-invalid-client-release"],
                    created_by=None,
                )
            except ValueError as exc:
                assert "client-plan" in str(exc)
            else:
                raise AssertionError("client-source rollout accepted a non-client-plan target")
        await engine.dispose()

    asyncio.run(scenario())


def test_client_source_full_rollout_rejects_a_missing_immutable_plan_baseline():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            latest_config = _product_market_config("v2")
            template = TemplateSnapshotTemplate(
                template_id="client-source-global",
                template_type="hq-client",
                owner_scope="client_source",
                name="client source",
                latest_version="v2",
                is_published=True,
                config_json=json.dumps(latest_config),
            )
            db.add_all(
                [
                    template,
                    TemplateSnapshotVersion(
                        template_id=template.template_id,
                        version="v2",
                        config_json=json.dumps(latest_config),
                        review_status="published",
                    ),
                ]
            )
            await _add_active_client_plan(
                db,
                template_id=template.template_id,
                plan_code="MISSING-BASELINE",
                base_version="v1-missing",
                snapshot=_product_market_config("orphaned-v1"),
            )
            await db.commit()

            with pytest.raises(ValueError, match="invalid immutable template baseline"):
                await TemplateReleaseBatchService(db).create(
                    template_id=template.template_id,
                    instance_ids=None,
                    expected_version="v2",
                    created_by="publisher",
                )
            assert (await db.execute(select(TemplateSnapshotReleaseBatch))).scalars().all() == []
        await engine.dispose()

    asyncio.run(scenario())


def test_malformed_product_market_config_cannot_be_automatically_promoted():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            malformed_config = _product_market_config("malformed")
            malformed_config.pop("customerServiceSections")
            template = TemplateSnapshotTemplate(
                template_id="client-source-global",
                template_type="hq-client",
                owner_scope="client_source",
                name="client source",
                latest_version="v1",
                is_published=True,
                config_json=json.dumps(malformed_config),
            )
            db.add_all(
                [
                    template,
                    TemplateSnapshotVersion(
                        template_id=template.template_id,
                        version="v1",
                        config_json=json.dumps(malformed_config),
                        changelog=f"Product Market factory default {FACTORY_DEFAULT_CONTRACT}",
                        review_status="published",
                    ),
                ]
            )
            await db.commit()

            service = TemplateReleaseBatchService(db)
            with pytest.raises(ValueError, match="missing required area fields: customerServiceSections"):
                await service.create(
                    template_id=template.template_id,
                    instance_ids=None,
                    expected_version="v1",
                    created_by="publisher",
                )
            assert (await db.execute(select(TemplateSnapshotReleaseBatch))).scalars().all() == []
            await db.refresh(template)
            assert template.factory_default_version is None
            assert template.factory_default_release_batch_id is None
            assert template.factory_default_promoted_at is None

            valid_config = _product_market_config("valid-after-malformed")
            template.latest_version = "v2"
            template.config_json = json.dumps(valid_config)
            db.add(
                TemplateSnapshotVersion(
                    template_id=template.template_id,
                    version="v2",
                    config_json=json.dumps(valid_config),
                    changelog=f"Product Market factory default {FACTORY_DEFAULT_CONTRACT}",
                    review_status="published",
                )
            )
            await db.commit()
            valid_batch = await service.create(
                template_id=template.template_id,
                instance_ids=None,
                expected_version="v2",
                created_by="publisher",
            )
            completed = await service.process(valid_batch["id"])
            await db.refresh(template)
            assert completed["status"] == "completed"
            assert template.factory_default_release_batch_id == valid_batch["id"]
        await engine.dispose()

    asyncio.run(scenario())


def test_explicit_factory_promotion_rejects_a_version_without_exact_lifecycle_evidence():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            valid_config = _product_market_config("missing-evidence")
            template = TemplateSnapshotTemplate(
                template_id="client-source-global",
                template_type="hq-client",
                owner_scope="client_source",
                name="client source",
                latest_version="v1",
                is_published=True,
                config_json=json.dumps(valid_config),
            )
            db.add_all(
                [
                    template,
                    TemplateSnapshotVersion(
                        template_id=template.template_id,
                        version="v1",
                        config_json=json.dumps(valid_config),
                        changelog="ordinary publication without lifecycle evidence",
                        review_status="published",
                    ),
                ]
            )
            await db.commit()
            service = TemplateReleaseBatchService(db)
            batch = await service.create(
                template_id=template.template_id,
                instance_ids=None,
                expected_version="v1",
                created_by=None,
            )
            completed = await service.process(batch["id"])
            assert completed["status"] == "completed"
            await db.refresh(template)
            assert template.factory_default_version is None

            with pytest.raises(ValueError, match="requires exact Product Market lifecycle evidence"):
                await service.promote_product_market_factory_default(
                    template_id=template.template_id,
                    release_batch_id=batch["id"],
                    contract_version=FACTORY_DEFAULT_CONTRACT,
                    promoted_by=None,
                )
            await db.refresh(template)
            assert template.factory_default_release_batch_id is None
        await engine.dispose()

    asyncio.run(scenario())


def test_expected_version_prevents_interleaved_publication_from_retargeting_a_batch():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            baseline_config = _product_market_config("v0", spacing="compact")
            first_config = _product_market_config("v1")
            template = TemplateSnapshotTemplate(
                template_id="client-source-global",
                template_type="hq-client",
                owner_scope="client_source",
                name="client source",
                latest_version="v1",
                is_published=True,
                config_json=json.dumps(first_config),
            )
            db.add_all(
                [
                    template,
                    TemplateSnapshotVersion(
                        template_id=template.template_id,
                        version="v0",
                        config_json=json.dumps(baseline_config),
                        review_status="archived",
                    ),
                    TemplateSnapshotVersion(
                        template_id=template.template_id,
                        version="v1",
                        config_json=json.dumps(first_config),
                        review_status="published",
                    ),
                ]
            )
            _client, _project, instance = await _add_active_client_plan(
                db,
                template_id=template.template_id,
                plan_code="INTERLEAVED",
                base_version="v0",
                snapshot=baseline_config,
            )
            await db.commit()

            service = TemplateReleaseBatchService(db)
            pinned = await service.create(
                template_id=template.template_id,
                instance_ids=None,
                expected_version="v1",
                created_by="first-publisher",
            )
            second_config = _product_market_config("v2", sound_enabled=False)
            db.add(
                TemplateSnapshotVersion(
                    template_id=template.template_id,
                    version="v2",
                    config_json=json.dumps(second_config),
                    review_status="published",
                )
            )
            template.latest_version = "v2"
            template.config_json = json.dumps(second_config)
            await db.commit()

            with pytest.raises(ValueError, match="published template version changed"):
                await service.create(
                    template_id=template.template_id,
                    instance_ids=None,
                    expected_version="v1",
                    created_by="stale-publisher",
                )

            completed = await service.process(pinned["id"])
            await db.refresh(instance)
            assert completed["status"] == "completed"
            assert completed["template_version"] == "v1"
            assert instance.base_template_version == "v1"
            assert json.loads(instance.snapshot_config_json)["layoutStyle"]["title"] == "v1"
        await engine.dispose()

    asyncio.run(scenario())


def test_interleaved_newer_publication_conflicts_and_an_older_batch_cannot_downgrade_runtime():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            baseline_config = _product_market_config("baseline", spacing="compact")
            release_a_config = _product_market_config("release-a")
            release_b_config = _product_market_config("release-b", sound_enabled=False)
            template = TemplateSnapshotTemplate(
                template_id="client-source-global",
                template_type="hq-client",
                owner_scope="client_source",
                name="client source",
                latest_version="release-a",
                is_published=True,
                config_json=json.dumps(release_a_config),
            )
            db.add_all(
                [
                    template,
                    TemplateSnapshotVersion(
                        template_id=template.template_id,
                        version="baseline",
                        config_json=json.dumps(baseline_config),
                        review_status="archived",
                    ),
                    TemplateSnapshotVersion(
                        template_id=template.template_id,
                        version="release-a",
                        config_json=json.dumps(release_a_config),
                        review_status="published",
                    ),
                    TemplateSnapshotVersion(
                        template_id=template.template_id,
                        version="release-b",
                        config_json=json.dumps(release_b_config),
                        review_status="published",
                    ),
                ]
            )
            client, project, instance = await _add_active_client_plan(
                db,
                template_id=template.template_id,
                plan_code="MONOTONIC",
                base_version="baseline",
                snapshot=baseline_config,
            )
            await db.commit()

            release_service = TemplateReleaseBatchService(db)
            batch_a = await release_service.create(
                template_id=template.template_id,
                instance_ids=None,
                expected_version="release-a",
                created_by="publisher-a",
            )
            template.latest_version = "release-b"
            template.config_json = json.dumps(release_b_config)
            await db.commit()

            with pytest.raises(ValueError, match="unresolved full rollout batch"):
                await release_service.create(
                    template_id=template.template_id,
                    instance_ids=None,
                    expected_version="release-b",
                    created_by="publisher-b",
                )

            await TemplateSnapshotService(db).sync_latest(
                instance.instance_id,
                {
                    "sync_mode": "merge",
                    "create_backup": True,
                    "operator": "publisher-b",
                    "template_version": "release-b",
                    "expected_template_id": template.template_id,
                    "expected_owner_scope": "client",
                    "expected_organization_id": client.id,
                    "expected_project_id": project.id,
                },
            )
            stale_result = await release_service.process(batch_a["id"])
            await db.refresh(instance)

            assert stale_result["status"] == "partial_failed"
            assert stale_result["failed_targets"] == 1
            assert "cannot move an instance back" in stale_result["targets"][0]["error_message"]
            assert instance.base_template_version == "release-b"
            assert json.loads(instance.snapshot_config_json)["layoutStyle"]["title"] == "release-b"
            backups = (await db.execute(select(TemplateSnapshotBackup))).scalars().all()
            assert len(backups) == 1
            assert backups[0].version == "baseline"
        await engine.dispose()

    asyncio.run(scenario())


def test_full_client_rollout_rolls_back_when_plan_runtime_configuration_is_missing():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            previous_config = _product_market_config("v1")
            next_config = _product_market_config("v2")
            template = TemplateSnapshotTemplate(
                template_id="client-source-global",
                template_type="hq-client",
                owner_scope="client_source",
                name="client source",
                latest_version="v2",
                is_published=True,
                config_json=json.dumps(next_config),
            )
            db.add_all(
                [
                    template,
                    TemplateSnapshotVersion(
                        template_id=template.template_id,
                        version="v1",
                        config_json=json.dumps(previous_config),
                        review_status="archived",
                    ),
                    TemplateSnapshotVersion(
                        template_id=template.template_id,
                        version="v2",
                        config_json=json.dumps(next_config),
                        review_status="published",
                    ),
                ]
            )
            _client, project, instance = await _add_active_client_plan(
                db,
                template_id=template.template_id,
                plan_code="MISSING-RUNTIME",
                base_version="v1",
                snapshot=previous_config,
            )
            runtime = await db.scalar(
                select(PlanRuntimeConfig).where(PlanRuntimeConfig.project_id == project.id)
            )
            assert runtime is not None
            await db.delete(runtime)
            await db.commit()

            service = TemplateReleaseBatchService(db)
            batch = await service.create(
                template_id=template.template_id,
                instance_ids=None,
                expected_version="v2",
                created_by="publisher",
            )
            completed = await service.process(batch["id"])
            await db.refresh(instance)

            assert completed["status"] == "partial_failed"
            assert completed["failed_targets"] == 1
            assert "no runtime configuration" in completed["targets"][0]["error_message"]
            assert instance.base_template_version == "v1"
            assert json.loads(instance.snapshot_config_json) == previous_config
            assert (await db.execute(select(TemplateSnapshotBackup))).scalars().all() == []
        await engine.dispose()

    asyncio.run(scenario())


def test_pending_target_for_an_already_current_plan_completes_without_duplicate_backup():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            current_config = _product_market_config("current")
            template = TemplateSnapshotTemplate(
                template_id="client-source-global",
                template_type="hq-client",
                owner_scope="client_source",
                name="client source",
                latest_version="v1",
                is_published=True,
                config_json=json.dumps(current_config),
            )
            db.add_all(
                [
                    template,
                    TemplateSnapshotVersion(
                        template_id=template.template_id,
                        version="v1",
                        config_json=json.dumps(current_config),
                        review_status="published",
                    ),
                ]
            )
            _client, project, instance = await _add_active_client_plan(
                db,
                template_id=template.template_id,
                plan_code="ALREADY-CURRENT",
                base_version="v1",
                snapshot=current_config,
            )
            runtime = await db.scalar(
                select(PlanRuntimeConfig).where(PlanRuntimeConfig.project_id == project.id)
            )
            assert runtime is not None
            runtime.template_version = "legacy-stale-version"
            await db.commit()

            service = TemplateReleaseBatchService(db)
            batch = await service.create(
                template_id=template.template_id,
                instance_ids=None,
                expected_version="v1",
                created_by="publisher",
            )
            completed = await service.process(batch["id"])
            await db.refresh(instance)

            assert completed["status"] == "completed"
            assert completed["succeeded_targets"] == 1
            assert completed["targets"][0]["result"]["base_template_version"] == "v1"
            assert completed["targets"][0]["result"]["plan_runtime_template_version"] == "v1"
            assert instance.base_template_version == "v1"
            await db.refresh(runtime)
            assert runtime.template_version == "v1"
            assert (await db.execute(select(TemplateSnapshotBackup))).scalars().all() == []

            runtime.template_version = "legacy-stale-version"
            await db.commit()
            repeated = await service.process(batch["id"])
            await db.refresh(runtime)
            assert repeated["status"] == "completed"
            assert runtime.template_version == "v1"
            assert (await db.execute(select(TemplateSnapshotBackup))).scalars().all() == []
        await engine.dispose()

    asyncio.run(scenario())


def test_completed_unpromoted_batch_reconciles_a_reactivated_stale_plan_before_promotion():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            old_config = _product_market_config("before-reactivation")
            next_config = _product_market_config("after-reactivation")
            template = TemplateSnapshotTemplate(
                template_id="client-source-global",
                template_type="hq-client",
                owner_scope="client_source",
                name="client source",
                latest_version="v2",
                is_published=True,
                config_json=json.dumps(next_config),
            )
            db.add_all(
                [
                    template,
                    TemplateSnapshotVersion(
                        template_id=template.template_id,
                        version="v1",
                        config_json=json.dumps(old_config),
                        changelog="previous Product Market release",
                        review_status="archived",
                    ),
                    TemplateSnapshotVersion(
                        template_id=template.template_id,
                        version="v2",
                        config_json=json.dumps(next_config),
                        changelog=f"Product Market factory default {FACTORY_DEFAULT_CONTRACT}",
                        review_status="published",
                    ),
                ]
            )
            _client, project, instance = await _add_active_client_plan(
                db,
                template_id=template.template_id,
                plan_code="REACTIVATED",
                base_version="v1",
                snapshot=old_config,
            )
            batch = TemplateSnapshotReleaseBatch(
                id="reactivated-stale-batch",
                template_id=template.template_id,
                template_version="v2",
                owner_scope="client",
                sections_json="[]",
                status="completed",
                total_targets=1,
                succeeded_targets=1,
                failed_targets=0,
                completed_at=datetime.now(timezone.utc),
            )
            db.add(batch)
            await db.flush()
            db.add(
                TemplateSnapshotReleaseTarget(
                    batch_id=batch.id,
                    instance_id=instance.instance_id,
                    organization_id=instance.organization_id,
                    project_id=instance.project_id,
                    status="succeeded",
                    result_json=json.dumps(
                        {
                            "template_version": "v2",
                            "base_template_version": "v2",
                            "plan_runtime_template_version": "v2",
                            "sections": [],
                        }
                    ),
                    completed_at=datetime.now(timezone.utc),
                )
            )
            await db.commit()

            completed = await TemplateReleaseBatchService(db).process(batch.id)
            runtime = await db.scalar(
                select(PlanRuntimeConfig).where(PlanRuntimeConfig.project_id == project.id)
            )
            reconciliation_audits = (
                await db.execute(
                    select(AuditLog).where(
                        AuditLog.action
                        == "product_market_factory_default_target_set_reconciled",
                        AuditLog.target_id == batch.id,
                    )
                )
            ).scalars().all()
            promotion_audits = (
                await db.execute(
                    select(AuditLog).where(
                        AuditLog.action == "product_market_factory_default_promoted",
                        AuditLog.target_id == template.template_id,
                    )
                )
            ).scalars().all()

            await db.refresh(instance)
            await db.refresh(template)
            assert completed["status"] == "completed"
            assert completed["total_targets"] == completed["succeeded_targets"] == 1
            assert completed["targets"][0]["attempt_count"] == 1
            assert instance.base_template_version == "v2"
            assert runtime is not None and runtime.template_version == "v2"
            assert template.factory_default_release_batch_id == batch.id
            assert len(reconciliation_audits) == 1
            assert len(promotion_audits) == 1
        await engine.dispose()

    asyncio.run(scenario())


def test_promoted_batch_evidence_is_immutable_when_the_active_plan_set_later_changes():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            config = _product_market_config("immutable-default")
            template = TemplateSnapshotTemplate(
                template_id="client-source-global",
                template_type="hq-client",
                owner_scope="client_source",
                name="client source",
                latest_version="v1",
                is_published=True,
                config_json=json.dumps(config),
            )
            db.add_all(
                [
                    template,
                    TemplateSnapshotVersion(
                        template_id=template.template_id,
                        version="v1",
                        config_json=json.dumps(config),
                        changelog=f"Product Market factory default {FACTORY_DEFAULT_CONTRACT}",
                        review_status="published",
                    ),
                ]
            )
            _client, _project, instance = await _add_active_client_plan(
                db,
                template_id=template.template_id,
                plan_code="ORIGINAL",
                base_version="v1",
                snapshot=config,
            )
            promoted_batch = await _install_completed_factory_pointer(
                db,
                template=template,
                version="v1",
                batch_id="immutable-promoted-batch",
                instance=instance,
            )
            await db.commit()

            await _add_active_client_plan(
                db,
                template_id=template.template_id,
                plan_code="JOINED-LATER",
                base_version="v1",
                snapshot=config,
            )
            await db.commit()

            service = TemplateReleaseBatchService(db)
            # Simulate a second worker entering with a stale exception after a
            # first worker already certified this batch.  The locked recheck
            # must preserve immutable evidence and consume no retry attempt.
            assert await service._reconcile_full_client_batch_targets(promoted_batch.id) is False
            repeated = await service.process(promoted_batch.id)
            stored_targets = (
                await db.execute(
                    select(TemplateSnapshotReleaseTarget).where(
                        TemplateSnapshotReleaseTarget.batch_id == promoted_batch.id
                    )
                )
            ).scalars().all()
            reconciliation_audits = (
                await db.execute(
                    select(AuditLog).where(
                        AuditLog.action
                        == "product_market_factory_default_target_set_reconciled",
                        AuditLog.target_id == promoted_batch.id,
                    )
                )
            ).scalars().all()
            resolved = await service.get_product_market_factory_default(
                template.template_id
            )

            await db.refresh(template)
            await db.refresh(promoted_batch)
            assert repeated["status"] == "completed"
            assert promoted_batch.total_targets == promoted_batch.succeeded_targets == 1
            assert len(stored_targets) == 1
            assert stored_targets[0].status == "succeeded"
            assert reconciliation_audits == []
            assert template.factory_default_release_batch_id == promoted_batch.id
            assert resolved["factory_default_release_batch_id"] == promoted_batch.id
        await engine.dispose()

    asyncio.run(scenario())


def test_older_same_version_batch_replay_cannot_replace_newer_factory_evidence():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            config = _product_market_config("same-version-order")
            now = datetime.now(timezone.utc)
            template = TemplateSnapshotTemplate(
                template_id="client-source-global",
                template_type="hq-client",
                owner_scope="client_source",
                name="client source",
                latest_version="v1",
                is_published=True,
                config_json=json.dumps(config),
            )
            db.add_all(
                [
                    template,
                    TemplateSnapshotVersion(
                        template_id=template.template_id,
                        version="v1",
                        config_json=json.dumps(config),
                        changelog=f"Product Market factory default {FACTORY_DEFAULT_CONTRACT}",
                        review_status="published",
                    ),
                ]
            )
            _client, _project, instance = await _add_active_client_plan(
                db,
                template_id=template.template_id,
                plan_code="ORDERED",
                base_version="v1",
                snapshot=config,
            )
            old_batch = TemplateSnapshotReleaseBatch(
                id="same-version-old-batch",
                template_id=template.template_id,
                template_version="v1",
                owner_scope="client",
                sections_json="[]",
                status="completed",
                total_targets=1,
                succeeded_targets=1,
                failed_targets=0,
                completed_at=now - timedelta(seconds=20),
                created_at=now - timedelta(seconds=20),
            )
            current_batch = TemplateSnapshotReleaseBatch(
                id="same-version-current-batch",
                template_id=template.template_id,
                template_version="v1",
                owner_scope="client",
                sections_json="[]",
                status="completed",
                total_targets=1,
                succeeded_targets=1,
                failed_targets=0,
                completed_at=now,
                created_at=now,
            )
            db.add_all([old_batch, current_batch])
            await db.flush()
            for release_batch in (old_batch, current_batch):
                db.add(
                    TemplateSnapshotReleaseTarget(
                        batch_id=release_batch.id,
                        instance_id=instance.instance_id,
                        organization_id=instance.organization_id,
                        project_id=instance.project_id,
                        status="succeeded",
                        completed_at=release_batch.completed_at,
                    )
                )
            template.factory_default_version = "v1"
            template.factory_default_release_batch_id = current_batch.id
            template.factory_default_contract_version = FACTORY_DEFAULT_CONTRACT
            template.factory_default_promoted_at = now
            current_batch_id = current_batch.id
            await db.commit()

            service = TemplateReleaseBatchService(db)
            repeated = await service.process(old_batch.id)
            with pytest.raises(ValueError, match="newer publication or release batch"):
                await service.promote_product_market_factory_default(
                    template_id=template.template_id,
                    release_batch_id=old_batch.id,
                    contract_version=FACTORY_DEFAULT_CONTRACT,
                    promoted_by=None,
                )
            await db.rollback()
            await db.refresh(template)
            promotion_audits = (
                await db.execute(
                    select(AuditLog).where(
                        AuditLog.action == "product_market_factory_default_promoted"
                    )
                )
            ).scalars().all()

            assert repeated["status"] == "completed"
            assert template.factory_default_release_batch_id == current_batch_id
            assert promotion_audits == []
            assert (
                await service.get_product_market_factory_default(template.template_id)
            )["factory_default_release_batch_id"] == current_batch_id
        await engine.dispose()

    asyncio.run(scenario())


def test_target_set_reconciliation_is_durably_bounded_and_a_fresh_batch_can_continue():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            config = _product_market_config("terminal-reconciliation")
            template_id = "client-source-global"
            template = TemplateSnapshotTemplate(
                template_id=template_id,
                template_type="hq-client",
                owner_scope="client_source",
                name="client source",
                latest_version="v1",
                is_published=True,
                config_json=json.dumps(config),
            )
            db.add_all(
                [
                    template,
                    TemplateSnapshotVersion(
                        template_id=template.template_id,
                        version="v1",
                        config_json=json.dumps(config),
                        changelog=f"Product Market factory default {FACTORY_DEFAULT_CONTRACT}",
                        review_status="published",
                    ),
                ]
            )
            await db.commit()
            service = TemplateReleaseBatchService(db)
            terminal = await service.create(
                template_id=template.template_id,
                instance_ids=None,
                expected_version="v1",
                created_by=None,
            )
            client = Organization(
                name="Changing target client",
                code="CHANGING-TARGET-CLIENT",
                org_type="client",
                status="active",
            )
            db.add(client)
            await db.flush()
            project = Project(
                client_org_id=client.id,
                name="Changing target plan",
                code="CHANGING-TARGET-PLAN",
                status="active",
            )
            db.add(project)
            await db.flush()
            instance_id = f"client-plan:{client.id}:{project.id}"
            db.add_all(
                [
                    TemplateSnapshotInstance(
                        instance_id=instance_id,
                        instance_type="client-plan",
                        owner_scope="client",
                        owner_id=project.code,
                        organization_id=client.id,
                        project_id=project.id,
                        name="Changing target runtime",
                        base_template_id=template_id,
                        base_template_version="v1",
                        snapshot_config_json=json.dumps(config),
                        override_config_json="{}",
                    ),
                    PlanRuntimeConfig(
                        project_id=project.id,
                        template_version="v1",
                        status="active",
                    ),
                ]
            )
            await db.commit()

            assert await service._reconcile_full_client_batch_targets(terminal["id"]) is True
            project.status = "inactive"
            await db.commit()
            assert await service._reconcile_full_client_batch_targets(terminal["id"]) is True
            project.status = "active"
            await db.commit()
            assert await service._reconcile_full_client_batch_targets(terminal["id"]) is True
            project.status = "inactive"
            await db.commit()
            assert await service._reconcile_full_client_batch_targets(terminal["id"]) is False

            terminal_result = await service.process(terminal["id"])
            repeated = await service.process(terminal["id"])
            terminal_row = await db.scalar(
                select(TemplateSnapshotReleaseBatch).where(
                    TemplateSnapshotReleaseBatch.id == terminal["id"]
                )
            )
            assert terminal_row is not None
            reconciliation_audits = (
                await db.execute(
                    select(AuditLog).where(
                        AuditLog.action
                        == "product_market_factory_default_target_set_reconciled",
                        AuditLog.target_id == terminal_row.id,
                    )
                )
            ).scalars().all()
            unstable_audits = (
                await db.execute(
                    select(AuditLog).where(
                        AuditLog.action
                        == "product_market_factory_default_target_set_unstable",
                        AuditLog.target_id == terminal_row.id,
                    )
                )
            ).scalars().all()
            assert terminal_result["status"] == "partial_failed"
            assert repeated["status"] == "partial_failed"
            assert terminal_row.status == "partial_failed"
            assert len(reconciliation_audits) == 3
            assert len(unstable_audits) == 1

            fresh = await service.create(
                template_id=template_id,
                instance_ids=None,
                expected_version="v1",
                created_by=None,
            )
            completed = await service.process(fresh["id"])

            await db.refresh(terminal_row)
            await db.refresh(template)
            assert terminal_row.status == "partial_failed"
            assert fresh["id"] != terminal_row.id
            assert completed["status"] == "completed"
            assert template.factory_default_release_batch_id == fresh["id"]
        await engine.dispose()

    asyncio.run(scenario())


def test_runtime_normal_save_then_source_publish_updates_source_fields_and_preserves_local_data():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            initial_config = _product_market_config(
                "v1",
                sound_enabled=False,
                product_status="hidden",
                spacing="compact",
            )
            template = TemplateSnapshotTemplate(
                template_id="client-source-global",
                template_type="hq-client",
                owner_scope="client_source",
                name="client source",
                latest_version="v1",
                is_published=True,
                config_json=json.dumps(initial_config),
            )
            db.add_all(
                [
                    template,
                    TemplateSnapshotVersion(
                        template_id=template.template_id,
                        version="v1",
                        config_json=json.dumps(initial_config),
                        review_status="published",
                    ),
                ]
            )
            client, project, instance = await _add_active_client_plan(
                db,
                template_id=template.template_id,
                plan_code="RUNTIME-SAVE",
                base_version="v1",
                snapshot=initial_config,
            )
            await db.commit()

            runtime_saved = json.loads(json.dumps(initial_config))
            runtime_saved["layoutStyle"]["tenantAccent"] = "tenant-copper"
            runtime_saved["tenantBusinessSentinel"] = {
                "leadId": "LEAD-RUNTIME-SAVE",
                "amount": 888,
            }
            snapshot_service = TemplateSnapshotService(db)
            await snapshot_service.upsert_instance(
                {
                    "instance_id": instance.instance_id,
                    "instance_type": "client-plan",
                    "owner_scope": "client",
                    "owner_id": project.code,
                    "organization_id": client.id,
                    "project_id": project.id,
                    "name": instance.name,
                    "base_template_id": template.template_id,
                    "base_template_version": "v1",
                    "snapshot_config_json": runtime_saved,
                    "override_config_json": {},
                }
            )

            released_config = _product_market_config("v2")
            await snapshot_service.upsert_template(
                {
                    "template_id": template.template_id,
                    "template_type": "hq-client",
                    "owner_scope": "client_source",
                    "owner_id": None,
                    "organization_id": None,
                    "project_id": None,
                    "name": template.name,
                    "config_json": released_config,
                    "is_published": True,
                }
            )
            await snapshot_service.publish_template(
                template.template_id,
                {
                    "version": "v2",
                    "changelog": "ordinary Product Market source publication",
                    "published_by": None,
                },
            )

            release_service = TemplateReleaseBatchService(db)
            batch = await release_service.create(
                template_id=template.template_id,
                instance_ids=None,
                expected_version="v2",
                created_by=None,
            )
            completed = await release_service.process(batch["id"])
            await db.refresh(instance)
            effective = json.loads(instance.snapshot_config_json)
            overrides = json.loads(instance.override_config_json)

            assert completed["status"] == "completed"
            assert instance.owner_id == project.code
            assert instance.organization_id == client.id
            assert instance.project_id == project.id
            assert instance.base_template_version == "v2"
            assert effective["products"] == released_config["products"]
            assert effective["productOrder"] == released_config["productOrder"]
            assert effective["layoutStyle"]["title"] == "v2"
            assert effective["layoutStyle"]["sharedSpacing"] == "relaxed"
            assert effective["soundEnabled"] is True
            assert effective["layoutStyle"]["tenantAccent"] == "tenant-copper"
            assert effective["tenantBusinessSentinel"] == {
                "leadId": "LEAD-RUNTIME-SAVE",
                "amount": 888,
            }
            assert overrides["layoutStyle"]["tenantAccent"] == "tenant-copper"
            assert overrides["tenantBusinessSentinel"] == effective["tenantBusinessSentinel"]
        await engine.dispose()

    asyncio.run(scenario())
