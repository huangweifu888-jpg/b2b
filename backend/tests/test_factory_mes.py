import asyncio
from datetime import datetime, timedelta, timezone
from decimal import Decimal
import json

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import models  # noqa: F401
from core.database import Base
from core.tenant_context import build_tenant_context
from models.factory_planning import FactoryProductionPlan
from services.factory_mes import FactoryMesService


def context(project_id: int):
    return build_tenant_context(agent_path="org-1/org-2", tenant_id="tenant-1", client_id="client-2", plan_id=f"plan-{project_id}")


def released_plan(project_id: int, suffix: str):
    now = datetime.now(timezone.utc)
    return FactoryProductionPlan(
        id=f"production-plan-{suffix}", project_id=project_id, agent_path="org-1/org-2",
        tenant_id="tenant-1", client_id="client-2", plan_id=f"plan-{project_id}",
        production_plan_number=f"PLAN-{suffix}", demand_order_id=f"order-{suffix}",
        demand_order_number=f"SO-{suffix}", engineering_version_id=f"engineering-{suffix}",
        engineering_number=f"ENG-{suffix}", product_reference="PUMP-001", sku_reference="PUMP-001-380V",
        demand_quantity=Decimal("10"), resource_id=f"resource-{suffix}", resource_number=f"RES-{suffix}",
        effective_daily_capacity=Decimal("4"), capacity_days=3, planned_start_at=now,
        planned_end_at=now + timedelta(days=3), due_at=now + timedelta(days=30),
        material_requirements_json=json.dumps([
            {"material_reference": "MAT-MOTOR-001", "required_quantity": "10", "receiving_evidence": ["GRN-1"]},
            {"material_reference": "MAT-SEAL-001", "required_quantity": "10", "receiving_evidence": ["GRN-1"]},
        ]), shortage_json="[]", material_readiness_status="ready", schedule_status="on-time",
        lifecycle_status="released", release_reference=f"PLAN-RELEASE-{suffix}",
        work_order_intent_reference=f"WOI-PLAN-{suffix}", milestones_json="[]", revision=4,
    )


def lots():
    return [
        {"material_reference": "MAT-MOTOR-001", "lot_reference": "LOT-MOTOR-001", "issued_quantity": "10", "source_receiving_reference": "GRN-1"},
        {"material_reference": "MAT-SEAL-001", "lot_reference": "LOT-SEAL-001", "issued_quantity": "10", "source_receiving_reference": "GRN-1"},
    ]


def routing():
    return [
        {"operation_sequence": 10, "operation_code": "ASSEMBLY", "operation_name": "Pump assembly", "work_center_reference": "WC-ASSEMBLY"},
        {"operation_sequence": 20, "operation_code": "TEST", "operation_name": "Performance test", "work_center_reference": "WC-TEST"},
    ]


async def create_order(service: FactoryMesService, project_id: int, suffix: str):
    return await service.create_work_order(
        project_id=project_id, context=context(project_id), actor="planner",
        production_plan_id=f"production-plan-{suffix}", batch_reference=f"BATCH-{suffix}",
        material_lots=lots(), routing=routing(),
    )


def test_mes_requires_released_plan_complete_material_trace_and_unique_scope():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            db.add(released_plan(1, "1"))
            await db.flush()
            service = FactoryMesService(db)
            with pytest.raises(ValueError, match="cover every"):
                await service.create_work_order(project_id=1, context=context(1), actor="planner", production_plan_id="production-plan-1", batch_reference="BATCH-BAD", material_lots=lots()[:1], routing=routing())
            item = await create_order(service, 1, "1")
            assert item["lifecycle_status"] == "draft"
            assert len(item["material_lots"]) == 2
            assert [row["operation_code"] for row in item["operations"]] == ["ASSEMBLY", "TEST"]
            with pytest.raises(ValueError, match="already"):
                await create_order(service, 1, "1")
            assert (await service.list_workspace(project_id=2))["work_orders"] == []
        await engine.dispose()
    asyncio.run(scenario())


def test_mes_enforces_sequence_downtime_and_quantity_genealogy_to_completion():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            db.add(released_plan(2, "2"))
            await db.flush()
            service = FactoryMesService(db)
            item = await create_order(service, 2, "2")
            item = await service.transition_work_order(item["id"], project_id=2, expected_revision=item["revision"], actor="supervisor", action="release", evidence_reference="MO-RELEASE-2")
            with pytest.raises(ValueError, match="sequence"):
                await service.start_operation(item["operations"][1]["id"], project_id=2, expected_revision=1, actor="operator", operator_reference="OP-2", evidence_reference="START-TEST-EARLY")
            first = item["operations"][0]
            item = await service.start_operation(first["id"], project_id=2, expected_revision=first["revision"], actor="operator", operator_reference="OP-1", evidence_reference="START-ASSEMBLY-2")
            item = await service.open_downtime(first["id"], project_id=2, context=context(2), actor="supervisor", reason_code="EQUIPMENT", reason_note="Torque station sensor stopped responding")
            assert item["lifecycle_status"] == "paused"
            downtime = item["downtimes"][0]
            with pytest.raises(ValueError, match="unpaused"):
                await service.complete_operation(first["id"], project_id=2, expected_revision=2, actor="operator", good_quantity=Decimal("9"), scrap_quantity=Decimal("1"), evidence_reference="ASSEMBLY-COMPLETE")
            item = await service.resolve_downtime(downtime["id"], project_id=2, expected_revision=downtime["revision"], actor="supervisor", resolution_note="Sensor connector replaced and torque calibration passed", evidence_reference="MAINTENANCE-2")
            first = item["operations"][0]
            with pytest.raises(ValueError, match="must equal"):
                await service.complete_operation(first["id"], project_id=2, expected_revision=first["revision"], actor="operator", good_quantity=Decimal("9"), scrap_quantity=Decimal("0"), evidence_reference="BAD-COUNT")
            item = await service.complete_operation(first["id"], project_id=2, expected_revision=first["revision"], actor="operator", good_quantity=Decimal("9"), scrap_quantity=Decimal("1"), evidence_reference="ASSEMBLY-COMPLETE-2")
            second = item["operations"][1]
            item = await service.start_operation(second["id"], project_id=2, expected_revision=second["revision"], actor="operator", operator_reference="OP-2", evidence_reference="START-TEST-2")
            second = item["operations"][1]
            assert Decimal(second["input_quantity"]) == Decimal("9")
            item = await service.complete_operation(second["id"], project_id=2, expected_revision=second["revision"], actor="operator", good_quantity=Decimal("9"), scrap_quantity=Decimal("0"), evidence_reference="TEST-COMPLETE-2")
            assert item["lifecycle_status"] == "ready-to-complete"
            assert Decimal(item["completed_quantity"]) == Decimal("9")
            assert Decimal(item["scrap_quantity"]) == Decimal("1")
            item = await service.transition_work_order(item["id"], project_id=2, expected_revision=item["revision"], actor="supervisor", action="complete", evidence_reference="MO-CLOSE-2")
            assert item["lifecycle_status"] == "completed"
            assert [row["lifecycle_status"] for row in item["operations"]] == ["completed", "completed"]
            assert {row["lifecycle_status"] for row in item["downtimes"]} == {"resolved"}
        await engine.dispose()
    asyncio.run(scenario())


def test_mes_optimistic_revisions_block_stale_operation_and_work_order_updates():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            db.add(released_plan(3, "3"))
            await db.flush()
            service = FactoryMesService(db)
            item = await create_order(service, 3, "3")
            item = await service.transition_work_order(item["id"], project_id=3, expected_revision=1, actor="supervisor", action="release", evidence_reference="MO-RELEASE-3")
            with pytest.raises(ValueError, match="changed"):
                await service.transition_work_order(item["id"], project_id=3, expected_revision=1, actor="supervisor", action="complete", evidence_reference="STALE")
            first = item["operations"][0]
            item = await service.start_operation(first["id"], project_id=3, expected_revision=1, actor="operator", operator_reference="OP-3", evidence_reference="START-3")
            with pytest.raises(ValueError, match="changed"):
                await service.complete_operation(first["id"], project_id=3, expected_revision=1, actor="operator", good_quantity=Decimal("10"), scrap_quantity=Decimal("0"), evidence_reference="STALE-OP")
        await engine.dispose()
    asyncio.run(scenario())
