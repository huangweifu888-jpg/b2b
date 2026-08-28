import asyncio

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import models  # noqa: F401
from core.database import Base
from core.tenant_context import build_tenant_context
from services.factory_implementation import FactoryImplementationService, STAGE_ARTIFACTS


def context(project_id: int):
    return build_tenant_context(
        agent_path="org-1/org-2",
        tenant_id="tenant-1",
        client_id="client-2",
        plan_id=f"plan-{project_id}",
    )


def test_implementation_program_requires_stage_evidence_and_optimistic_revision():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            service = FactoryImplementationService(db)
            item = await service.create(
                project_id=7,
                context=context(7),
                actor="admin",
                title="首个客户实施",
                golden_flow="revenue",
                baseline_summary="报价到回款依赖人工表格",
                target_outcome="30天内跑通受控收入闭环",
            )
            assert item["current_stage"] == "day-7"
            assert item["plan_id"] == "plan-7"
            with pytest.raises(ValueError, match="missing"):
                await service.advance(item["id"], project_id=7, expected_revision=1, actor="admin")

            artifacts = {key: f"evidence:{key}" for key in STAGE_ARTIFACTS["day-7"]}
            updated = await service.update(item["id"], project_id=7, expected_revision=1, actor="admin", artifacts=artifacts, blockers=[])
            assert updated["revision"] == 2
            advanced = await service.advance(item["id"], project_id=7, expected_revision=2, actor="admin")
            assert advanced["current_stage"] == "day-30"
            with pytest.raises(ValueError, match="refresh"):
                await service.update(item["id"], project_id=7, expected_revision=2, actor="admin", next_action="旧修订覆盖")
        await engine.dispose()

    asyncio.run(scenario())


def test_implementation_program_is_plan_scoped_and_blocks_duplicate_active_programs():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            service = FactoryImplementationService(db)
            item = await service.create(
                project_id=11,
                context=context(11),
                actor="admin",
                title="实施A",
                golden_flow="revenue",
                baseline_summary="基线",
                target_outcome="目标",
            )
            with pytest.raises(ValueError, match="already has"):
                await service.create(
                    project_id=11,
                    context=context(11),
                    actor="admin",
                    title="实施B",
                    golden_flow="manufacturing",
                    baseline_summary="基线",
                    target_outcome="目标",
                )
            assert await service.list(project_id=12) == []
            with pytest.raises(KeyError, match="tenant plan"):
                await service.update(item["id"], project_id=12, expected_revision=1, actor="admin", next_action="越权更新")
        await engine.dispose()

    asyncio.run(scenario())


def test_implementation_blockers_prevent_stage_advance():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            service = FactoryImplementationService(db)
            item = await service.create(
                project_id=21,
                context=context(21),
                actor="admin",
                title="受阻实施",
                golden_flow="asset-renewal",
                baseline_summary="基线",
                target_outcome="目标",
            )
            artifacts = {key: key for key in STAGE_ARTIFACTS["day-7"]}
            updated = await service.update(item["id"], project_id=21, expected_revision=1, actor="admin", artifacts=artifacts, blockers=["数据授权未完成"])
            assert updated["status"] == "blocked"
            with pytest.raises(ValueError, match="blockers"):
                await service.advance(item["id"], project_id=21, expected_revision=2, actor="admin")
        await engine.dispose()

    asyncio.run(scenario())
