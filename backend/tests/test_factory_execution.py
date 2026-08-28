import asyncio
import json

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import models  # noqa: F401
from core.database import Base
from models.factory_execution import FactoryExecutionWorkstream
from services.factory_execution import FactoryExecutionService


def test_execution_desk_enforces_single_active_and_optimistic_revision():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            db.add_all([
                FactoryExecutionWorkstream(id="desk", sequence=1, label="执行中台", status="active", current_gate="intake-review", next_action="确认责任人"),
                FactoryExecutionWorkstream(id="events", sequence=2, label="对象事件", status="queued", current_gate="intake-review", next_action="冻结对象契约"),
            ])
            await db.flush()
            service = FactoryExecutionService(db)
            with pytest.raises(ValueError, match="Only one"):
                await service.update("events", expected_revision=1, actor="admin", changes={"status": "active"})
            updated = await service.update("events", expected_revision=1, actor="admin", changes={"blockers": ["等待评审"], "next_action": "组织对象评审"})
            assert updated["revision"] == 2
            assert updated["blockers"] == ["等待评审"]
            with pytest.raises(ValueError, match="refresh"):
                await service.update("events", expected_revision=1, actor="admin", changes={"status": "blocked"})
        await engine.dispose()

    asyncio.run(scenario())


def test_completed_workstream_requires_evidence():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            item = FactoryExecutionWorkstream(id="desk", sequence=1, label="执行中台", status="active", current_gate="intake-review", next_action="完成验收")
            db.add(item)
            await db.flush()
            service = FactoryExecutionService(db)
            with pytest.raises(ValueError, match="evidence"):
                await service.update("desk", expected_revision=1, actor="admin", changes={"status": "done"})
            updated = await service.update("desk", expected_revision=1, actor="admin", changes={"status": "done", "evidence": ["测试报告", "验收记录"]})
            assert updated["status"] == "done"
            assert json.loads(item.evidence_json) == ["测试报告", "验收记录"]
        await engine.dispose()

    asyncio.run(scenario())
