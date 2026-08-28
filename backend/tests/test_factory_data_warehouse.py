import asyncio
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import models  # noqa: F401
from core.database import Base
from core.tenant_context import build_tenant_context
from models.factory_fulfillment import FactoryFulfillmentOrder
from services.factory_data_warehouse import FactoryDataWarehouseService


def _order(identifier: str, *, project_id: int, context, status: str, revision: int) -> FactoryFulfillmentOrder:
    recorded_at = datetime.now(timezone.utc) - timedelta(minutes=1)
    return FactoryFulfillmentOrder(
        id=f"order-{identifier}", project_id=project_id, agent_path=context.agent_path,
        tenant_id=context.tenant_id, client_id=context.client_id, plan_id=context.plan_id,
        order_number=f"SO-{identifier}", quote_id=f"quote-{identifier}", quote_number=f"CPQ-{identifier}",
        order_intent_id=f"intent-{identifier}", account_reference="BUYER-001", currency="USD",
        exchange_rate=Decimal("1"), order_total=Decimal("950"), status=status,
        authority_source="factory-oms", revision=revision,
        created_at=recorded_at, updated_at=recorded_at,
    )


def test_warehouse_governs_source_versions_lineage_and_independent_publication():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            context = build_tenant_context(
                agent_path="hq/client-1", tenant_id="tenant-1", client_id="client-1", plan_id="plan-7",
            )
            db.add_all([
                _order("001", project_id=7, context=context, status="delivered", revision=8),
                _order("002", project_id=7, context=context, status="confirmed", revision=2),
            ])
            await db.flush()
            service = FactoryDataWarehouseService(db)

            with pytest.raises(ValueError, match="approved internal adapter"):
                await service.create_source(
                    project_id=7, context=context, actor="data-owner", source_reference="DW-RAW-SQL",
                    source_code="raw-sql", owner="data-owner", purpose="Bypass governed adapters", retention_days=730,
                )
            source = await service.create_source(
                project_id=7, context=context, actor="data-owner", source_reference="DW-ORDERS-V1",
                source_code="orders", owner="data-owner", purpose="Governed order analytics and delivery reporting",
                retention_days=730,
            )
            with pytest.raises(ValueError, match="already registered"):
                await service.create_source(
                    project_id=7, context=context, actor="data-owner", source_reference="DW-ORDERS-DUP",
                    source_code="orders", owner="data-owner", purpose="Duplicate source should be rejected", retention_days=730,
                )
            with pytest.raises(KeyError, match="tenant plan"):
                await service.activate_source(
                    source["id"], project_id=8, expected_revision=1, actor="data-approver",
                    schema_contract_reference="SCHEMA-ORDERS-V1", approval_reference="APPROVAL-1",
                )
            source = await service.activate_source(
                source["id"], project_id=7, expected_revision=1, actor="data-approver",
                schema_contract_reference="SCHEMA-ORDERS-V1", approval_reference="APPROVAL-1",
            )
            assert source["status"] == "active"
            assert len(source["schema_fingerprint"]) == 64

            now = datetime.now(timezone.utc)
            run = await service.extract(
                source["id"], project_id=7, expected_source_revision=source["revision"], actor="etl-operator",
                load_reference="LOAD-ORDERS-001", cutoff_at=now + timedelta(seconds=1),
            )
            assert run["status"] == "extracted"
            assert (run["rows_read"], run["rows_accepted"], run["rows_rejected"]) == (2, 2, 0)
            assert run["quality_score"] == "100.00"
            with pytest.raises(ValueError, match="changed"):
                await service.validate(
                    run["id"], project_id=7, expected_revision=99, actor="data-validator",
                    validation_reference="VALIDATE-1",
                )
            run = await service.validate(
                run["id"], project_id=7, expected_revision=run["revision"], actor="data-validator",
                validation_reference="VALIDATE-1",
            )
            assert run["status"] == "validated"
            with pytest.raises(ValueError, match="independent"):
                await service.publish(
                    run["id"], project_id=7, expected_revision=run["revision"], actor="data-validator",
                    publication_reference="PUBLISH-1",
                )
            published = await service.publish(
                run["id"], project_id=7, expected_revision=run["revision"], actor="data-publisher",
                publication_reference="PUBLISH-2",
            )
            assert published["run"]["status"] == "published"
            assert published["source"]["last_load_run_id"] == run["id"]
            assert (await db.get(FactoryFulfillmentOrder, "order-001")).revision == 8
            assert (await db.get(FactoryFulfillmentOrder, "order-002")).revision == 2

            second = await service.extract(
                source["id"], project_id=7, expected_source_revision=published["source"]["revision"], actor="etl-operator",
                load_reference="LOAD-ORDERS-002", cutoff_at=now + timedelta(seconds=2),
            )
            assert second["rows_accepted"] == 2
            assert second["reused_fact_count"] == 2
            workspace = await service.list_workspace(project_id=7)
            assert len(workspace["facts"]) == 2
            assert len(workspace["lineage"]) == 4
            assert {edge["fact_id"] for edge in workspace["lineage"]} == {fact["id"] for fact in workspace["facts"]}
            assert workspace["contract"] == {
                "copy_mode": "analytical-read-only", "fact_version": "source-id+revision",
                "lineage_required": True, "credentials_exposed": False,
            }
        await engine.dispose()

    asyncio.run(scenario())


def test_warehouse_empty_snapshot_fails_validation_instead_of_publishing_false_success():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            context = build_tenant_context(
                agent_path="hq/client-1", tenant_id="tenant-1", client_id="client-1", plan_id="plan-7",
            )
            service = FactoryDataWarehouseService(db)
            source = await service.create_source(
                project_id=7, context=context, actor="data-owner", source_reference="DW-REVENUE-V1",
                source_code="revenue", owner="finance-data-owner", purpose="Governed revenue and collection analytics",
                retention_days=730,
            )
            source = await service.activate_source(
                source["id"], project_id=7, expected_revision=source["revision"], actor="data-approver",
                schema_contract_reference="SCHEMA-REVENUE-V1", approval_reference="APPROVAL-REVENUE-1",
            )
            run = await service.extract(
                source["id"], project_id=7, expected_source_revision=source["revision"], actor="etl-operator",
                load_reference="LOAD-EMPTY-1", cutoff_at=datetime.now(timezone.utc),
            )
            failed = await service.validate(
                run["id"], project_id=7, expected_revision=run["revision"], actor="data-validator",
                validation_reference="VALIDATE-EMPTY-1",
            )
            assert failed["status"] == "failed"
            assert "empty" in failed["failure_reason"]
            with pytest.raises(ValueError, match="validated"):
                await service.publish(
                    run["id"], project_id=7, expected_revision=failed["revision"], actor="data-publisher",
                    publication_reference="PUBLISH-EMPTY-1",
                )
        await engine.dispose()

    asyncio.run(scenario())


def test_warehouse_utc_cutoff_includes_authority_rows_saved_as_local_naive_time():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            context = build_tenant_context(
                agent_path="hq/client-1", tenant_id="tenant-1", client_id="client-1", plan_id="plan-7",
            )
            local_recorded_at = datetime.now() - timedelta(seconds=1)
            order = _order("local-time", project_id=7, context=context, status="confirmed", revision=3)
            order.created_at = local_recorded_at
            order.updated_at = local_recorded_at
            db.add(order)
            await db.flush()
            service = FactoryDataWarehouseService(db)
            source = await service.create_source(
                project_id=7, context=context, actor="data-owner", source_reference="DW-LOCAL-TIME",
                source_code="orders", owner="data-owner", purpose="Verify UTC cutoff against local authority timestamps",
                retention_days=730,
            )
            source = await service.activate_source(
                source["id"], project_id=7, expected_revision=source["revision"], actor="data-approver",
                schema_contract_reference="SCHEMA-LOCAL-TIME", approval_reference="APPROVAL-LOCAL-TIME",
            )
            run = await service.extract(
                source["id"], project_id=7, expected_source_revision=source["revision"], actor="etl-operator",
                load_reference="LOAD-LOCAL-TIME", cutoff_at=datetime.now(timezone.utc),
            )
            assert (run["rows_read"], run["rows_accepted"]) == (1, 1)
        await engine.dispose()

    asyncio.run(scenario())
