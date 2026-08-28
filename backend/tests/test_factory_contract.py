import asyncio
import json

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import models  # noqa: F401
from core.database import Base
from models.factory_contract import FactoryCoreEventContract, FactoryCoreObjectContract
from services.factory_contract import FactoryContractService, REQUIRED_EVENT_FIELDS


def _object(index: int, *, status: str = "draft") -> FactoryCoreObjectContract:
    object_id = f"object-{index}"
    return FactoryCoreObjectContract(
        id=object_id,
        sequence=index,
        label=f"对象{index}",
        system_of_record="operations",
        identity_rule="租户内稳定标识唯一。",
        minimum_fields_json=json.dumps(["tenantId", f"object{index}Id", "status"]),
        lifecycle_status=status,
    )


def _event(index: int, *, status: str = "draft") -> FactoryCoreEventContract:
    return FactoryCoreEventContract(
        id=f"event-{index}",
        sequence=index,
        label=f"事件{index}",
        subject_id=f"object-{index}",
        producer="operations",
        consumers_json=json.dumps(["decision"]),
        required_fields_json=json.dumps(sorted(REQUIRED_EVENT_FIELDS)),
        lifecycle_status=status,
    )


def test_contract_updates_validate_envelopes_and_revision():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            db.add_all([_object(1), _event(1)])
            await db.commit()
            service = FactoryContractService(db)
            with pytest.raises(ValueError, match="subject object"):
                await service.update_event("event-1", expected_revision=1, actor="admin", changes={"lifecycle_status": "frozen"})
            await db.rollback()
            updated_object = await service.update_object("object-1", expected_revision=1, actor="admin", changes={"lifecycle_status": "frozen"})
            assert updated_object["revision"] == 2
            updated_event = await service.update_event("event-1", expected_revision=1, actor="admin", changes={"lifecycle_status": "frozen"})
            assert updated_event["lifecycle_status"] == "frozen"
            with pytest.raises(ValueError, match="refresh"):
                await service.update_event("event-1", expected_revision=1, actor="admin", changes={"lifecycle_status": "deprecated"})
        await engine.dispose()

    asyncio.run(scenario())


def test_contract_registry_freezes_exact_governed_scope():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            db.add_all([_object(index) for index in range(1, 23)])
            db.add_all([_event(index) for index in range(1, 15)])
            await db.flush()
            registry = await FactoryContractService(db).freeze_all(actor="contract-owner")
            assert registry["summary"] == {
                "object_count": 22,
                "event_count": 14,
                "frozen_object_count": 22,
                "frozen_event_count": 14,
            }
            assert all(item["revision"] == 2 for item in registry["objects"])
            assert all(item["lifecycle_status"] == "frozen" for item in registry["events"])
        await engine.dispose()

    asyncio.run(scenario())
