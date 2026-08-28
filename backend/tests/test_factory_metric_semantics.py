import asyncio
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import models  # noqa: F401
from core.database import Base
from core.tenant_context import build_tenant_context
from models.factory_fulfillment import FactoryFulfillmentOrder
from models.factory_data_warehouse import FactoryWarehouseLoadRun
from services.factory_data_warehouse import FactoryDataWarehouseService
from services.factory_metric_semantics import FactoryMetricSemanticsService


def _order(identifier: str, *, project_id: int, context, status: str, total: str, revision: int):
    recorded_at = datetime.now(timezone.utc) - timedelta(minutes=2)
    return FactoryFulfillmentOrder(
        id=f"metric-order-{identifier}", project_id=project_id, agent_path=context.agent_path,
        tenant_id=context.tenant_id, client_id=context.client_id, plan_id=context.plan_id,
        order_number=f"SO-METRIC-{identifier}", quote_id=f"quote-{identifier}",
        quote_number=f"CPQ-METRIC-{identifier}", order_intent_id=f"intent-{identifier}",
        account_reference="BUYER-METRIC", currency="USD", exchange_rate=Decimal("1"),
        order_total=Decimal(total), status=status, authority_source="factory-oms",
        revision=revision, created_at=recorded_at, updated_at=recorded_at,
    )


async def _published_warehouse(db, context):
    db.add_all([
        _order("001", project_id=7, context=context, status="delivered", total="1000", revision=8),
        _order("002", project_id=7, context=context, status="confirmed", total="6400", revision=2),
    ])
    await db.flush()
    service = FactoryDataWarehouseService(db)
    source = await service.create_source(
        project_id=7, context=context, actor="warehouse-owner", source_reference="DW-METRIC-ORDERS",
        source_code="orders", owner="warehouse-owner", purpose="Governed source for metric semantics tests",
        retention_days=730,
    )
    source = await service.activate_source(
        source["id"], project_id=7, expected_revision=source["revision"], actor="warehouse-approver",
        schema_contract_reference="SCHEMA-METRIC-ORDERS", approval_reference="APPROVAL-METRIC-ORDERS",
    )
    run = await service.extract(
        source["id"], project_id=7, expected_source_revision=source["revision"], actor="warehouse-operator",
        load_reference="LOAD-METRIC-ORDERS", cutoff_at=datetime.now(timezone.utc),
    )
    run = await service.validate(
        run["id"], project_id=7, expected_revision=run["revision"], actor="warehouse-validator",
        validation_reference="VALIDATE-METRIC-ORDERS",
    )
    published = await service.publish(
        run["id"], project_id=7, expected_revision=run["revision"], actor="warehouse-publisher",
        publication_reference="PUBLISH-METRIC-ORDERS",
    )
    return published["source"], published["run"]


def _definition_payload(source_id: str, *, version_reference: str = "METRIC-ORDER-V1"):
    return {
        "definition_reference": "METRIC-ORDER-VALUE", "metric_code": "orders.value",
        "domain": "delivery", "owner": "finance-data-owner",
        "purpose": "Provide one governed order value definition for executive decisions",
        "version_reference": version_reference, "label": "订单金额",
        "description": "已发布订单仓库事实的订单金额汇总口径", "unit": "USD",
        "aggregation": "sum", "source_id": source_id, "value_field": "order_total",
        "numerator_field": None, "denominator_field": None, "filter_field": None,
        "filter_operator": None, "filter_value": None, "dimensions": ["status"],
        "effective_from": datetime.now(timezone.utc), "change_reason": "Initial governed semantic definition",
    }


def test_metric_semantics_requires_declarative_formula_independent_approval_and_verification():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            context = build_tenant_context(
                agent_path="hq/client-1", tenant_id="tenant-1", client_id="client-1", plan_id="plan-7",
            )
            source, warehouse_run = await _published_warehouse(db, context)
            service = FactoryMetricSemanticsService(db)

            invalid = _definition_payload(source["id"], version_reference="METRIC-INVALID")
            invalid["metric_code"] = "orders.invalid"
            invalid["aggregation"] = "raw-sql"
            with pytest.raises(ValueError, match="approved declarative aggregation"):
                await service.create_definition(project_id=7, context=context, actor="metric-author", **invalid)

            created = await service.create_definition(
                project_id=7, context=context, actor="metric-author", **_definition_payload(source["id"]),
            )
            definition, version = created["definition"], created["version"]
            assert definition["status"] == "draft" and version["status"] == "draft"
            assert len(version["formula_hash"]) == 64
            duplicate = _definition_payload(source["id"], version_reference="METRIC-ORDER-DUP")
            duplicate["definition_reference"] = "METRIC-ORDER-DUP"
            with pytest.raises(ValueError, match="already exists"):
                await service.create_definition(project_id=7, context=context, actor="metric-author", **duplicate)

            version = await service.submit_version(
                version["id"], project_id=7, expected_revision=version["revision"], actor="metric-author",
                submission_reference="SUBMIT-METRIC-ORDER-V1",
            )
            with pytest.raises(ValueError, match="independent"):
                await service.approve_version(
                    version["id"], project_id=7, expected_revision=version["revision"], actor="metric-author",
                    approval_reference="APPROVE-SELF",
                )
            approved = await service.approve_version(
                version["id"], project_id=7, expected_revision=version["revision"], actor="metric-approver",
                approval_reference="APPROVE-METRIC-ORDER-V1",
            )
            assert approved["definition"]["status"] == "active"
            assert approved["version"]["status"] == "published"

            evaluated = await service.evaluate(
                version["id"], project_id=7, actor="metric-operator",
                warehouse_load_run_id=warehouse_run["id"], evaluation_reference="EVALUATE-METRIC-ORDER-V1",
            )
            run = evaluated["run"]
            assert run["metric_value"] == "7400.000000"
            assert (run["fact_count"], run["lineage_count"], run["observation_count"]) == (2, 2, 2)
            assert {item["dimensions"]["status"] for item in evaluated["observations"]} == {"delivered", "confirmed"}
            with pytest.raises(ValueError, match="already evaluated"):
                await service.evaluate(
                    version["id"], project_id=7, actor="metric-operator",
                    warehouse_load_run_id=warehouse_run["id"], evaluation_reference="EVALUATE-DUPLICATE",
                )
            with pytest.raises(ValueError, match="independent"):
                await service.verify_evaluation(
                    run["id"], project_id=7, expected_revision=run["revision"], actor="metric-operator",
                    verification_reference="VERIFY-SELF", verification_note="Self verification is forbidden",
                )
            published = await service.verify_evaluation(
                run["id"], project_id=7, expected_revision=run["revision"], actor="metric-verifier",
                verification_reference="VERIFY-METRIC-ORDER-V1",
                verification_note="Matched both source facts, lineage memberships and declared formula",
            )
            assert published["status"] == "published"
            workspace = await service.list_workspace(project_id=7)
            assert workspace["contract"] == {
                "formula_mode": "declarative-only", "allowed_aggregations": ["average", "count", "percentage", "ratio", "sum"],
                "historical_recalculation": False, "approval_independent": True,
                "evaluation_verification_independent": True, "warehouse_publication_required": True,
            }
        await engine.dispose()

    asyncio.run(scenario())


def test_metric_new_version_supersedes_definition_without_recalculating_history():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            context = build_tenant_context(
                agent_path="hq/client-1", tenant_id="tenant-1", client_id="client-1", plan_id="plan-7",
            )
            source, warehouse_run = await _published_warehouse(db, context)
            service = FactoryMetricSemanticsService(db)
            created = await service.create_definition(
                project_id=7, context=context, actor="author-v1", **_definition_payload(source["id"]),
            )
            version1 = await service.submit_version(
                created["version"]["id"], project_id=7, expected_revision=created["version"]["revision"],
                actor="author-v1", submission_reference="SUBMIT-V1",
            )
            approval1 = await service.approve_version(
                version1["id"], project_id=7, expected_revision=version1["revision"], actor="approver-v1",
                approval_reference="APPROVE-V1",
            )
            evaluated1 = await service.evaluate(
                version1["id"], project_id=7, actor="operator-v1",
                warehouse_load_run_id=warehouse_run["id"], evaluation_reference="EVALUATE-V1",
            )
            published1 = await service.verify_evaluation(
                evaluated1["run"]["id"], project_id=7, expected_revision=evaluated1["run"]["revision"],
                actor="verifier-v1", verification_reference="VERIFY-V1",
                verification_note="Version one result independently reconciled",
            )

            v2_payload = _definition_payload(source["id"], version_reference="METRIC-ORDER-V2")
            for key in ("definition_reference", "metric_code", "domain", "owner", "purpose"):
                v2_payload.pop(key)
            v2_payload["label"] = "平均订单金额"
            v2_payload["description"] = "已发布订单仓库事实的平均订单金额口径"
            v2_payload["aggregation"] = "average"
            v2_payload["dimensions"] = []
            v2_payload["change_reason"] = "Adopt average order value without rewriting version one history"
            version2_created = await service.create_version(
                created["definition"]["id"], project_id=7,
                expected_definition_revision=approval1["definition"]["revision"], actor="author-v2", **v2_payload,
            )
            assert version2_created["version"]["version_number"] == 2
            assert approval1["version"]["status"] == "published"
            version2 = await service.submit_version(
                version2_created["version"]["id"], project_id=7,
                expected_revision=version2_created["version"]["revision"], actor="author-v2",
                submission_reference="SUBMIT-V2",
            )
            approval2 = await service.approve_version(
                version2["id"], project_id=7, expected_revision=version2["revision"], actor="approver-v2",
                approval_reference="APPROVE-V2",
            )
            assert approval2["superseded_version"]["status"] == "superseded"
            assert approval2["definition"]["current_version_number"] == 2
            workspace = await service.list_workspace(project_id=7)
            historical = next(item for item in workspace["evaluation_runs"] if item["id"] == published1["id"])
            assert historical["status"] == "published"
            assert historical["metric_version_number"] == 1
            assert historical["metric_value"] == "7400.000000"
            with pytest.raises(ValueError, match="retroactively"):
                past_payload = dict(v2_payload)
                past_payload["version_reference"] = "METRIC-ORDER-V3-PAST"
                past_payload["effective_from"] = datetime.now(timezone.utc) - timedelta(days=1)
                await service.create_version(
                    created["definition"]["id"], project_id=7,
                    expected_definition_revision=approval2["definition"]["revision"], actor="author-v3", **past_payload,
                )
        await engine.dispose()

    asyncio.run(scenario())


def test_metric_evaluation_rejects_unpublished_warehouse_run_and_unapproved_fields():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            context = build_tenant_context(
                agent_path="hq/client-1", tenant_id="tenant-1", client_id="client-1", plan_id="plan-7",
            )
            source, warehouse_run = await _published_warehouse(db, context)
            service = FactoryMetricSemanticsService(db)
            invalid = _definition_payload(source["id"], version_reference="METRIC-SECRET-FIELD")
            invalid["metric_code"] = "orders.secret"
            invalid["value_field"] = "database_password"
            with pytest.raises(ValueError, match="outside the approved warehouse schema"):
                await service.create_definition(project_id=7, context=context, actor="author", **invalid)

            created = await service.create_definition(
                project_id=7, context=context, actor="author", **_definition_payload(source["id"]),
            )
            version = await service.submit_version(
                created["version"]["id"], project_id=7, expected_revision=created["version"]["revision"],
                actor="author", submission_reference="SUBMIT-BOUNDARY",
            )
            version = (await service.approve_version(
                version["id"], project_id=7, expected_revision=version["revision"], actor="approver",
                approval_reference="APPROVE-BOUNDARY",
            ))["version"]
            authority_run = await db.get(FactoryWarehouseLoadRun, warehouse_run["id"])
            authority_run.status = "validated"
            await db.flush()
            with pytest.raises(ValueError, match="published warehouse load run"):
                await service.evaluate(
                    version["id"], project_id=7, actor="operator",
                    warehouse_load_run_id=warehouse_run["id"], evaluation_reference="EVALUATE-UNPUBLISHED",
                )
        await engine.dispose()

    asyncio.run(scenario())
