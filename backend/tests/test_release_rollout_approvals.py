import asyncio

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import models  # noqa: F401
from core.database import Base
from services.release_rollouts import ReleaseRolloutService


def test_release_creator_cannot_approve_own_stage():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        session_factory = async_sessionmaker(engine, expire_on_commit=False)
        async with session_factory() as db:
            service = ReleaseRolloutService(db)
            rollout = await service.create(
                {
                    "version": "v-test-approval",
                    "release_role": "agency",
                    "deployment_id": "test-stamp-a",
                    "manifest_sha256": "a" * 64,
                    "created_by": "release-author",
                }
            )
            await service.act(rollout["id"], stage_key="hq", action="start", note=None, actor="release-author")
            with pytest.raises(ValueError, match="cannot approve"):
                await service.act(rollout["id"], stage_key="hq", action="approve", note=None, actor="release-author")

            approved = await service.act(
                rollout["id"], stage_key="hq", action="approve", note="reviewed", actor="independent-reviewer"
            )
            assert approved["stages"][0]["status"] == "approved"
            assert approved["stages"][1]["status"] == "ready"
        await engine.dispose()

    asyncio.run(scenario())


def test_rollout_requires_evidence_for_approval_and_failure():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            service = ReleaseRolloutService(db)
            rollout = await service.create({"version": "v-evidence", "release_role": "client", "deployment_id": "stamp-a", "manifest_sha256": "b" * 64, "created_by": "author"})
            await service.act(rollout["id"], stage_key="hq", action="start", note=None, actor="author")
            with pytest.raises(ValueError, match="evidence"):
                await service.act(rollout["id"], stage_key="hq", action="approve", note=None, actor="reviewer")
            with pytest.raises(ValueError, match="evidence"):
                await service.act(rollout["id"], stage_key="hq", action="fail", note="", actor="reviewer")
        await engine.dispose()

    asyncio.run(scenario())
