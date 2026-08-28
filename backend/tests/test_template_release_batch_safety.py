from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
import importlib.util
import json
from pathlib import Path

import pytest
from sqlalchemy import create_engine, select, text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from starlette.requests import Request

import models  # noqa: F401
from core.database import Base
from models.auth import User
from models.platform import AuditLog
from models.template_snapshot import (
    TemplateSnapshotBackup,
    TemplateSnapshotInstance,
    TemplateSnapshotReleaseBatch,
    TemplateSnapshotReleaseTarget,
    TemplateSnapshotTemplate,
    TemplateSnapshotVersion,
)
from routers.template_snapshot import cancel_release_batch
from schemas.auth import UserResponse
from services.template_release_batches import TemplateReleaseBatchService


def _request(method: str) -> Request:
    return Request(
        {
            "type": "http",
            "method": method,
            "path": "/api/template-snapshot/release-batches/test/cancel",
            "headers": [],
            "client": ("127.0.0.1", 10000),
            "query_string": b"",
            "server": ("test", 80),
            "scheme": "http",
        }
    )


async def _seed_release(db, suffix: str):
    template = TemplateSnapshotTemplate(
        template_id=f"release-safety-{suffix}",
        template_type="hq-client",
        owner_scope="client_source",
        name="release safety",
        latest_version="2.0.0",
        is_published=True,
        config_json=json.dumps({"layout": {"title": "new"}}),
    )
    instance = TemplateSnapshotInstance(
        instance_id=f"release-safety-instance-{suffix}",
        instance_type="client-plan",
        owner_scope="client",
        name="release safety instance",
        base_template_id=template.template_id,
        base_template_version="1.0.0",
        snapshot_config_json=json.dumps({"layout": {"title": "old"}}),
        override_config_json="{}",
    )
    db.add_all(
        [
            template,
            instance,
            TemplateSnapshotVersion(
                template_id=template.template_id,
                version="1.0.0",
                config_json=json.dumps({"layout": {"title": "old"}}),
                review_status="archived",
            ),
            TemplateSnapshotVersion(
                template_id=template.template_id,
                version="2.0.0",
                config_json=template.config_json,
                review_status="published",
            ),
        ]
    )
    await db.commit()
    created = await TemplateReleaseBatchService(db).create(
        template_id=template.template_id,
        instance_ids=[instance.instance_id],
        created_by=None,
    )
    batch = await db.scalar(
        select(TemplateSnapshotReleaseBatch).where(TemplateSnapshotReleaseBatch.id == created["id"])
    )
    target = await db.scalar(
        select(TemplateSnapshotReleaseTarget).where(TemplateSnapshotReleaseTarget.batch_id == created["id"])
    )
    return template, instance, batch, target


def test_release_batch_recovers_an_interrupted_expired_running_target():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            _template, instance, batch, target = await _seed_release(db, "stale")
            batch.status = "running"
            target.status = "running"
            target.lease_expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
            await db.commit()

            result = await TemplateReleaseBatchService(db).process(batch.id)
            await db.refresh(instance)
            await db.refresh(target)

            assert result["status"] == "completed"
            assert target.status == "succeeded"
            assert target.attempt_count == 1
            assert target.lease_expires_at is None
            assert json.loads(instance.snapshot_config_json)["layout"]["title"] == "new"
        await engine.dispose()

    asyncio.run(scenario())


def test_active_target_lease_returns_retry_metadata_then_expires_safely():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            _template, _instance, batch, target = await _seed_release(db, "active-lease")
            batch.status = "running"
            target.status = "running"
            target.lease_expires_at = datetime.now(timezone.utc) + timedelta(seconds=30)
            await db.commit()

            waiting = await TemplateReleaseBatchService(db).process(batch.id)
            assert waiting["status"] == "running"
            assert 1 <= waiting["retry_after_seconds"] <= 30
            assert (await db.execute(select(TemplateSnapshotBackup))).scalars().all() == []

            target.lease_expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
            await db.commit()
            completed = await TemplateReleaseBatchService(db).process(batch.id)
            assert completed["status"] == "completed"
            assert completed["retry_after_seconds"] is None
        await engine.dispose()

    asyncio.run(scenario())


def test_release_batch_resume_processes_paused_pending_targets():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            _template, _instance, batch, target = await _seed_release(db, "resume")
            service = TemplateReleaseBatchService(db)
            paused = await service.pause(batch.id)
            assert paused["status"] == "paused"
            assert target.status == "pending"

            resumed = await service.resume(batch.id)
            assert resumed["status"] == "queued"
            completed = await service.process(batch.id)
            assert completed["status"] == "completed"
        await engine.dispose()

    asyncio.run(scenario())


def test_global_admin_can_auditably_cancel_and_terminalize_an_unresolved_batch():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            template, _instance, batch, target = await _seed_release(db, "cancel")
            admin = User(id="cancel-admin", email="cancel-admin@example.test", role="admin")
            db.add(admin)
            await db.commit()
            actor = UserResponse(id=admin.id, email=admin.email, role="admin")

            cancelled = await cancel_release_batch(
                batch_id=batch.id,
                request=_request("POST"),
                db=db,
                current_user=actor,
            )
            await db.refresh(target)
            assert cancelled["status"] == "cancelled"
            assert target.status == "cancelled"
            assert target.lease_expires_at is None
            audit = await db.scalar(
                select(AuditLog).where(AuditLog.action == "template_snapshot_release_batch_cancelled")
            )
            assert audit is not None
            assert audit.actor_user_id == admin.id
            assert audit.target_id == batch.id

            service = TemplateReleaseBatchService(db)
            with pytest.raises(ValueError, match="cancelled release batch cannot be processed"):
                await service.process(batch.id)
            with pytest.raises(ValueError, match="cancelled release batch cannot be retried"):
                await service.retry_failed(batch.id)
            with pytest.raises(ValueError, match="Only a paused release batch"):
                await service.resume(batch.id)

            db.add(
                TemplateSnapshotVersion(
                    template_id=template.template_id,
                    version="3.0.0",
                    config_json=json.dumps({"layout": {"title": "newer"}}),
                    review_status="published",
                )
            )
            template.latest_version = "3.0.0"
            template.config_json = json.dumps({"layout": {"title": "newer"}})
            await db.commit()
            replacement = await service.create(
                template_id=template.template_id,
                instance_ids=[target.instance_id],
                expected_version="3.0.0",
                created_by=admin.id,
            )
            assert replacement["status"] == "queued"
            assert replacement["id"] != batch.id
        await engine.dispose()

    asyncio.run(scenario())


def test_cancel_refuses_a_paused_batch_while_a_target_lease_is_active():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            _template, _instance, batch, target = await _seed_release(db, "cancel-active-lease")
            batch.status = "paused"
            target.status = "running"
            target.lease_expires_at = datetime.now(timezone.utc) + timedelta(seconds=30)
            await db.commit()

            service = TemplateReleaseBatchService(db)
            with pytest.raises(ValueError, match="active target lease"):
                await service.cancel(batch.id)
            target.lease_expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
            await db.commit()
            cancelled = await service.cancel(batch.id)
            assert cancelled["status"] == "cancelled"
        await engine.dispose()

    asyncio.run(scenario())


def test_completed_targets_are_never_double_processed():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            _template, _instance, batch, target = await _seed_release(db, "idempotent")
            service = TemplateReleaseBatchService(db)
            first = await service.process(batch.id)
            backups_after_first = (await db.execute(select(TemplateSnapshotBackup))).scalars().all()
            second = await service.process(batch.id)
            backups_after_second = (await db.execute(select(TemplateSnapshotBackup))).scalars().all()
            await db.refresh(target)

            assert first["status"] == second["status"] == "completed"
            assert target.attempt_count == 1
            assert len(backups_after_first) == len(backups_after_second) == 1
        await engine.dispose()

    asyncio.run(scenario())


def test_batch_fails_closed_if_target_tenant_binding_changes_after_queueing():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            _template, instance, batch, target = await _seed_release(db, "binding")
            before = instance.snapshot_config_json
            instance.project_id = 999999
            await db.commit()

            result = await TemplateReleaseBatchService(db).process(batch.id)
            await db.refresh(instance)
            await db.refresh(target)
            backups = (await db.execute(select(TemplateSnapshotBackup))).scalars().all()

            assert result["status"] == "partial_failed"
            assert target.status == "failed"
            assert "tenant binding changed" in (target.error_message or "")
            assert instance.snapshot_config_json == before
            assert backups == []
        await engine.dispose()

    asyncio.run(scenario())


def _load_release_migration():
    path = (
        Path(__file__).resolve().parents[1]
        / "alembic"
        / "versions"
        / "b17e6c4a9d20_developer_global_frame_release_sections.py"
    )
    spec = importlib.util.spec_from_file_location("developer_global_frame_release_sections", path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_migration_downgrade_refuses_partial_or_nonterminal_batches(monkeypatch):
    module = _load_release_migration()
    engine = create_engine("sqlite:///:memory:")
    with engine.begin() as connection:
        connection.execute(
            text(
                "CREATE TABLE template_snapshot_release_batches "
                "(status VARCHAR(50) NOT NULL, sections_json TEXT NOT NULL)"
            )
        )
        connection.execute(
            text(
                "INSERT INTO template_snapshot_release_batches(status, sections_json) "
                "VALUES ('completed', '[\"developer_global_frame\"]')"
            )
        )
        monkeypatch.setattr(module.op, "get_bind", lambda: connection)
        dropped: list[tuple] = []
        monkeypatch.setattr(module.op, "drop_index", lambda *args, **kwargs: dropped.append((args, kwargs)))
        monkeypatch.setattr(module.op, "drop_column", lambda *args, **kwargs: dropped.append((args, kwargs)))

        with pytest.raises(RuntimeError, match="Cannot downgrade release controls"):
            module.downgrade()
        assert dropped == []

        connection.execute(text("DELETE FROM template_snapshot_release_batches"))
        connection.execute(
            text(
                "INSERT INTO template_snapshot_release_batches(status, sections_json) "
                "VALUES ('completed', '[]')"
            )
        )
        module.downgrade()
        assert len(dropped) == 4
