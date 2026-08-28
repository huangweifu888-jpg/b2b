from __future__ import annotations

import asyncio
import json

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import models  # noqa: F401
from core.database import Base
from models.platform import AuditLog, Organization, PlanRuntimeConfig, Project
from models.template_snapshot import (
    TemplateSnapshotInstance,
    TemplateSnapshotReleaseBatch,
    TemplateSnapshotTemplate,
    TemplateSnapshotVersion,
)
from services import job_worker
from services.template_release_batches import TemplateReleaseBatchService


class _SessionContext:
    async def __aenter__(self):
        return object()

    async def __aexit__(self, exc_type, exc, traceback):
        return False


def test_template_batch_job_waits_for_active_lease_and_reprocesses_before_ack(monkeypatch):
    async def scenario():
        responses = [
            {
                "status": "running",
                "retry_after_seconds": 7,
                "succeeded_targets": 0,
                "failed_targets": 0,
            },
            {
                "status": "completed",
                "retry_after_seconds": None,
                "succeeded_targets": 1,
                "failed_targets": 0,
            },
        ]
        process_calls: list[str] = []
        sleeps: list[int] = []

        async def fake_process(_self, batch_id: str):
            process_calls.append(batch_id)
            return responses.pop(0)

        async def fake_sleep(seconds: int):
            sleeps.append(seconds)

        monkeypatch.setattr(job_worker.db_manager, "async_session_maker", lambda: _SessionContext())
        monkeypatch.setattr(TemplateReleaseBatchService, "process", fake_process)
        monkeypatch.setattr(job_worker.asyncio, "sleep", fake_sleep)

        result = await job_worker.execute_job(
            {"type": "template_sync_batch", "payload": {"batch_id": "batch-with-active-lease"}}
        )

        assert process_calls == ["batch-with-active-lease", "batch-with-active-lease"]
        assert sleeps == [7]
        assert result == {
            "status": "completed",
            "batch_id": "batch-with-active-lease",
            "succeeded": 1,
            "failed": 0,
        }

    asyncio.run(scenario())


def test_template_batch_job_never_acknowledges_running_without_retry_metadata(monkeypatch):
    async def scenario():
        async def fake_process(_self, _batch_id: str):
            return {
                "status": "running",
                "retry_after_seconds": None,
                "succeeded_targets": 0,
                "failed_targets": 0,
            }

        monkeypatch.setattr(job_worker.db_manager, "async_session_maker", lambda: _SessionContext())
        monkeypatch.setattr(TemplateReleaseBatchService, "process", fake_process)

        with pytest.raises(RuntimeError, match="omitted durable lease retry metadata"):
            await job_worker.execute_job(
                {"type": "template_sync_batch", "payload": {"batch_id": "invalid-running-batch"}}
            )

    asyncio.run(scenario())


def test_worker_process_automatically_promotes_a_zero_plan_factory_release_without_a_browser(monkeypatch):
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        session_factory = async_sessionmaker(engine, expire_on_commit=False)
        config = {
            "products": [{"path": "/news", "status": "active"}],
            "productOrder": ["/news"],
            "layoutStyle": {"title": "worker factory", "contentBgColor": "#f4f5f7"},
            "customerServiceSections": [{"id": "expert", "title": "Expert"}],
            "soundEnabled": True,
        }
        async with session_factory() as db:
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
                        changelog="Product Market factory default 2026-08-27.1",
                        review_status="published",
                    ),
                ]
            )
            await db.commit()
            batch = await TemplateReleaseBatchService(db).create(
                template_id=template.template_id,
                instance_ids=None,
                expected_version="v1",
                created_by=None,
            )
            assert batch["status"] == "queued"
            assert template.factory_default_version is None

        async def no_redis_job(_timeout_seconds: int):
            return None

        monkeypatch.setattr(job_worker, "claim_background_job", no_redis_job)
        monkeypatch.setattr(job_worker.db_manager, "async_session_maker", session_factory)
        assert await job_worker.JobWorker().process_one(timeout_seconds=0) is True

        async with session_factory() as verification_db:
            stored = await verification_db.scalar(
                select(TemplateSnapshotTemplate).where(
                    TemplateSnapshotTemplate.template_id == "client-source-global"
                )
            )
            assert stored is not None
            assert stored.factory_default_version == "v1"
            assert stored.factory_default_release_batch_id == batch["id"]
            assert stored.factory_default_contract_version == "2026-08-27.1"
            assert stored.factory_default_promoted_at is not None
        await engine.dispose()

    asyncio.run(scenario())


def test_worker_reconciles_a_plan_activated_after_zero_target_batch_creation(monkeypatch):
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        session_factory = async_sessionmaker(engine, expire_on_commit=False)
        old_config = {
            "products": [{"path": "/news", "status": "active"}],
            "productOrder": ["/news"],
            "layoutStyle": {"title": "old factory", "contentBgColor": "#ffffff"},
            "customerServiceSections": [{"id": "expert", "title": "Expert"}],
            "soundEnabled": True,
        }
        next_config = {
            **old_config,
            "layoutStyle": {"title": "reconciled factory", "contentBgColor": "#f4f5f7"},
        }
        async with session_factory() as db:
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
                        changelog="Product Market factory default 2026-08-27.1",
                        review_status="published",
                    ),
                ]
            )
            await db.commit()
            batch = await TemplateReleaseBatchService(db).create(
                template_id=template.template_id,
                instance_ids=None,
                expected_version="v2",
                created_by=None,
            )
            assert batch["status"] == "queued"
            assert batch["total_targets"] == 0

            client = Organization(
                name="Late worker client",
                code="LATE_WORKER_CLIENT",
                org_type="client",
                status="active",
            )
            db.add(client)
            await db.flush()
            project = Project(
                client_org_id=client.id,
                name="Late worker plan",
                code="LATE_WORKER_PLAN",
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
                        parent_id=f"client:{client.code}",
                        name="Late worker plan runtime",
                        base_template_id=template.template_id,
                        base_template_version="v1",
                        snapshot_config_json=json.dumps(old_config),
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

        async def no_redis_job(_timeout_seconds: int):
            return None

        monkeypatch.setattr(job_worker, "claim_background_job", no_redis_job)
        monkeypatch.setattr(job_worker.db_manager, "async_session_maker", session_factory)
        assert await job_worker.JobWorker().process_one(timeout_seconds=0) is True

        async with session_factory() as verification_db:
            verification_service = TemplateReleaseBatchService(verification_db)
            assert (
                await verification_service._reconcile_full_client_batch_targets(batch["id"])
                is False
            )
            stored_batch = await verification_db.scalar(
                select(TemplateSnapshotReleaseBatch).where(
                    TemplateSnapshotReleaseBatch.id == batch["id"]
                )
            )
            stored_template = await verification_db.scalar(
                select(TemplateSnapshotTemplate).where(
                    TemplateSnapshotTemplate.template_id == "client-source-global"
                )
            )
            stored_instance = await verification_db.scalar(
                select(TemplateSnapshotInstance).where(
                    TemplateSnapshotInstance.instance_id == instance_id
                )
            )
            stored_runtime = await verification_db.scalar(
                select(PlanRuntimeConfig).where(PlanRuntimeConfig.project_id == project.id)
            )
            promotion_audits = (
                await verification_db.execute(
                    select(AuditLog).where(
                        AuditLog.action == "product_market_factory_default_promoted",
                        AuditLog.target_id == "client-source-global",
                    )
                )
            ).scalars().all()
            reconciliation_audits = (
                await verification_db.execute(
                    select(AuditLog).where(
                        AuditLog.action
                        == "product_market_factory_default_target_set_reconciled",
                        AuditLog.target_id == batch["id"],
                    )
                )
            ).scalars().all()
            assert stored_batch is not None
            assert stored_batch.status == "completed"
            assert stored_batch.total_targets == 1
            assert stored_batch.succeeded_targets == 1
            assert stored_batch.failed_targets == 0
            assert stored_template is not None
            assert stored_template.factory_default_version == "v2"
            assert stored_template.factory_default_release_batch_id == batch["id"]
            assert stored_instance is not None
            assert stored_instance.base_template_version == "v2"
            assert stored_runtime is not None
            assert stored_runtime.template_version == "v2"
            assert len(promotion_audits) == 1
            assert len(reconciliation_audits) == 1
        await engine.dispose()

    asyncio.run(scenario())


def test_idle_worker_recovers_oldest_queued_factory_release_without_a_redis_job(monkeypatch):
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        session_factory = async_sessionmaker(engine, expire_on_commit=False)
        old_config = {
            "products": [{"path": "/news", "status": "active"}],
            "productOrder": ["/news"],
            "layoutStyle": {"title": "old worker factory", "contentBgColor": "#ffffff"},
            "customerServiceSections": [{"id": "expert", "title": "Expert"}],
            "soundEnabled": True,
        }
        next_config = {
            **old_config,
            "layoutStyle": {"title": "recovered worker factory", "contentBgColor": "#f4f5f7"},
        }
        async with session_factory() as db:
            client = Organization(name="Worker client", code="WORKER_CLIENT", org_type="client", status="active")
            db.add(client)
            await db.flush()
            project = Project(client_org_id=client.id, name="Worker plan", code="WORKER_PLAN", status="active")
            db.add(project)
            await db.flush()
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
                        changelog="Product Market factory default 2026-08-27.1",
                        review_status="published",
                    ),
                    TemplateSnapshotInstance(
                        instance_id="client-plan:WORKER_PLAN",
                        instance_type="client-plan",
                        owner_scope="client",
                        owner_id=project.code,
                        organization_id=client.id,
                        project_id=project.id,
                        parent_id=f"client:{client.code}",
                        name="Worker plan runtime",
                        base_template_id=template.template_id,
                        base_template_version="v1",
                        snapshot_config_json=json.dumps(old_config),
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
            batch = await TemplateReleaseBatchService(db).create(
                template_id=template.template_id,
                instance_ids=None,
                expected_version="v2",
                created_by=None,
            )
            assert batch["status"] == "queued"
            assert template.factory_default_version is None

        async def no_redis_job(_timeout_seconds: int):
            return None

        monkeypatch.setattr(job_worker, "claim_background_job", no_redis_job)
        monkeypatch.setattr(job_worker.db_manager, "async_session_maker", session_factory)

        original_promote = TemplateReleaseBatchService.promote_product_market_factory_default
        promotion_attempts = 0

        async def fail_first_promotion(self, **kwargs):
            nonlocal promotion_attempts
            promotion_attempts += 1
            if promotion_attempts == 1:
                raise RuntimeError("simulated promotion transaction interruption")
            return await original_promote(self, **kwargs)

        monkeypatch.setattr(
            TemplateReleaseBatchService,
            "promote_product_market_factory_default",
            fail_first_promotion,
        )

        assert await job_worker.JobWorker().process_one(timeout_seconds=0) is False
        async with session_factory() as interrupted_db:
            interrupted_batch = await interrupted_db.scalar(
                select(TemplateSnapshotReleaseBatch).where(TemplateSnapshotReleaseBatch.id == batch["id"])
            )
            interrupted_template = await interrupted_db.scalar(
                select(TemplateSnapshotTemplate).where(
                    TemplateSnapshotTemplate.template_id == "client-source-global"
                )
            )
            assert interrupted_batch is not None and interrupted_batch.status == "running"
            assert interrupted_batch.completed_at is None
            assert interrupted_template is not None and interrupted_template.factory_default_version is None

        assert await job_worker.JobWorker().process_one(timeout_seconds=0) is True
        duplicate = await job_worker.execute_job(
            {"type": "template_sync_batch", "payload": {"batch_id": batch["id"]}}
        )
        assert duplicate["status"] == "completed"

        async with session_factory() as verification_db:
            stored_batch = await verification_db.scalar(
                select(TemplateSnapshotReleaseBatch).where(TemplateSnapshotReleaseBatch.id == batch["id"])
            )
            stored_template = await verification_db.scalar(
                select(TemplateSnapshotTemplate).where(
                    TemplateSnapshotTemplate.template_id == "client-source-global"
                )
            )
            stored_instance = await verification_db.scalar(
                select(TemplateSnapshotInstance).where(
                    TemplateSnapshotInstance.instance_id == "client-plan:WORKER_PLAN"
                )
            )
            stored_runtime = await verification_db.scalar(
                select(PlanRuntimeConfig).where(PlanRuntimeConfig.project_id == project.id)
            )
            promotion_audits = (
                await verification_db.execute(
                    select(AuditLog).where(
                        AuditLog.action == "product_market_factory_default_promoted",
                        AuditLog.target_id == "client-source-global",
                    )
                )
            ).scalars().all()
            assert stored_batch is not None
            assert stored_batch.status == "completed"
            assert stored_batch.succeeded_targets == 1
            assert stored_batch.failed_targets == 0
            assert stored_template is not None
            assert stored_template.factory_default_version == "v2"
            assert stored_template.factory_default_release_batch_id == batch["id"]
            assert stored_instance is not None
            assert stored_instance.base_template_version == "v2"
            assert stored_runtime is not None
            assert stored_runtime.template_version == "v2"
            assert len(promotion_audits) == 1
            assert batch["id"] in (promotion_audits[0].detail_json or "")
        await engine.dispose()

    asyncio.run(scenario())


def test_idle_worker_returns_false_when_redis_and_database_have_no_jobs(monkeypatch):
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        session_factory = async_sessionmaker(engine, expire_on_commit=False)

        async def no_redis_job(_timeout_seconds: int):
            return None

        monkeypatch.setattr(job_worker, "claim_background_job", no_redis_job)
        monkeypatch.setattr(job_worker.db_manager, "async_session_maker", session_factory)

        assert await job_worker.JobWorker().process_one(timeout_seconds=0) is False
        await engine.dispose()

    asyncio.run(scenario())


def test_idle_worker_survives_queue_and_durable_execution_failures(monkeypatch):
    async def scenario():
        discovered_job = {
            "id": "db-template-sync-batch:recover-me",
            "type": "template_sync_batch",
            "payload": {"batch_id": "recover-me"},
            "attempt": 0,
        }
        execute_calls: list[str] = []

        async def unavailable_queue(_timeout_seconds: int):
            raise ConnectionError("redis unavailable")

        async def discover_durable_job():
            return discovered_job

        async def transient_execution_failure(job):
            execute_calls.append(job["payload"]["batch_id"])
            raise RuntimeError("database temporarily unavailable")

        monkeypatch.setattr(job_worker, "claim_background_job", unavailable_queue)
        monkeypatch.setattr(job_worker, "_oldest_unfinished_template_batch_job", discover_durable_job)
        monkeypatch.setattr(job_worker, "execute_job", transient_execution_failure)

        assert await job_worker.JobWorker().process_one(timeout_seconds=0) is False
        assert execute_calls == ["recover-me"]

    asyncio.run(scenario())
