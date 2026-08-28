import asyncio
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import models  # noqa: F401
from core.database import Base
from core.tenant_context import build_tenant_context
from models.factory_revenue import FactoryRevenueFlowRun
from services.factory_rfq_sample import FactoryRfqSampleService


def context(project_id):
    return build_tenant_context(
        agent_path="hq/agency/client", tenant_id="tenant-rfq",
        client_id="client-rfq", plan_id=f"plan-{project_id}",
    )


def source_flow(project_id=90):
    now = datetime.now(timezone.utc)
    return FactoryRevenueFlowRun(
        id=f"revenue-flow-{project_id}", project_id=project_id,
        agent_path="hq/agency/client", tenant_id="tenant-rfq",
        client_id="client-rfq", plan_id=f"plan-{project_id}",
        correlation_id=f"CORR-RFQ-{project_id}", product_reference="ROBOT-CELL",
        account_reference="BUYER-PRIVATE-REFERENCE", currency="USD",
        quoted_amount=Decimal("125000"), ordered_amount=0, invoiced_amount=0,
        paid_amount=0, current_stage="inquiry-created", emitted_events_json="[]",
        revision=2, updated_by="sales-owner", created_at=now, updated_at=now,
    )


def test_rfq_sample_closes_independent_requirements_dispatch_and_feedback():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            flow = source_flow()
            db.add(flow)
            await db.flush()
            svc = FactoryRfqSampleService(db)
            ctx = context(90)
            case = await svc.create_case(
                project_id=90, context=ctx, actor="sales-owner",
                source_flow_id=flow.id, objective="Validate fit before commercial quote",
            )
            requirement = await svc.add_requirement(
                case["id"], project_id=90, context=ctx, actor="engineer-author",
                requirement_code="VOLTAGE", requirement_name="Power profile",
                specification="480V three phase, 60Hz", quantity=2,
                target_date=(datetime.now(timezone.utc) + timedelta(days=14)).date(),
                critical=True,
            )
            with pytest.raises(ValueError, match="independent technical approval"):
                await svc.approve_requirement(
                    requirement["id"], project_id=90, actor="engineer-author",
                    expected_revision=1, approval_reference="SELF",
                )
            requirement = await svc.approve_requirement(
                requirement["id"], project_id=90, actor="engineering-reviewer",
                expected_revision=1, approval_reference="TECH-QA-90",
            )
            sample = await svc.create_sample(
                case["id"], project_id=90, context=ctx, actor="sample-planner",
                sample_code="SAMPLE-A", requirement_ids=[requirement["id"]], quantity=2,
                unit_cost=Decimal("125.50"), currency="usd",
                promised_at=datetime.now(timezone.utc) + timedelta(days=7),
            )
            with pytest.raises(ValueError, match="independent cost and scope approval"):
                await svc.approve_sample(
                    sample["id"], project_id=90, actor="sample-planner",
                    expected_revision=1, approval_reference="SELF",
                )
            sample = await svc.approve_sample(
                sample["id"], project_id=90, actor="sample-reviewer",
                expected_revision=1, approval_reference="SAMPLE-QA-90",
            )
            sample = await svc.dispatch_sample(
                sample["id"], project_id=90, actor="logistics-owner",
                expected_revision=sample["revision"], shipping_reference="DHL-TRACK-90",
            )
            with pytest.raises(ValueError, match="independent actor"):
                await svc.record_feedback(
                    sample["id"], project_id=90, context=ctx, actor="logistics-owner",
                    outcome="accepted", quality_score=96, feedback_note="Approved",
                    conversion_intent=True,
                )
            feedback = await svc.record_feedback(
                sample["id"], project_id=90, context=ctx, actor="customer-success",
                outcome="accepted", quality_score=96,
                feedback_note="Sample matches all validated requirements",
                conversion_intent=True,
            )
            with pytest.raises(ValueError, match="independent acknowledgement"):
                await svc.acknowledge_feedback(
                    feedback["id"], project_id=90, actor="customer-success",
                    expected_revision=1, acknowledgement_reference="SELF",
                )
            await svc.acknowledge_feedback(
                feedback["id"], project_id=90, actor="sales-owner",
                expected_revision=1, acknowledgement_reference="SALES-ACK-90",
            )
            workspace = await svc.list_workspace(project_id=90)
            assert workspace["metrics"] == {
                "rfq_cases": 1, "requirement_review_percent": 100.0,
                "approved_samples": 1, "dispatched_samples": 1,
                "accepted_feedback": 1, "feedback_acknowledgement_percent": 100.0,
            }
            assert workspace["cases"][0]["status"] == "sample-accepted"
            assert workspace["contract"]["sample_cost_posts_finance"] is False
            assert workspace["contract"]["feedback_mutates_order"] is False
            assert flow.current_stage == "inquiry-created" and flow.revision == 2
            assert (await svc.list_workspace(project_id=91))["cases"] == []
        await engine.dispose()

    asyncio.run(scenario())


def test_rfq_source_list_accepts_qualified_inquiry_stage():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            flow = source_flow(92)
            flow.current_stage = "qualified-inquiry"
            db.add(flow)
            await db.flush()
            sources = await FactoryRfqSampleService(db).list_workspace(project_id=92)
            assert sources["sources"] and sources["sources"][0]["source_stage"] == "qualified-inquiry"
        await engine.dispose()
    asyncio.run(scenario())


def test_rfq_sample_blocks_incomplete_scope_invalid_values_and_source_drift():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            flow = source_flow(91)
            db.add(flow)
            await db.flush()
            svc = FactoryRfqSampleService(db)
            ctx = context(91)
            case = await svc.create_case(
                project_id=91, context=ctx, actor="sales",
                source_flow_id=flow.id, objective="Confirm sample scope",
            )
            requirement = await svc.add_requirement(
                case["id"], project_id=91, context=ctx, actor="engineer",
                requirement_code="ENCLOSURE", requirement_name="Ingress protection",
                specification="IP67 enclosure", quantity=1,
                target_date=(datetime.now(timezone.utc) + timedelta(days=10)).date(),
                critical=True,
            )
            with pytest.raises(ValueError, match="all approved requirements"):
                await svc.create_sample(
                    case["id"], project_id=91, context=ctx, actor="planner",
                    sample_code="EARLY", requirement_ids=[requirement["id"]], quantity=1,
                    unit_cost=Decimal("10"), currency="USD",
                    promised_at=datetime.now(timezone.utc) + timedelta(days=5),
                )
            flow.revision = 3
            await db.flush()
            with pytest.raises(ValueError, match="source changed"):
                await svc.approve_requirement(
                    requirement["id"], project_id=91, actor="reviewer",
                    expected_revision=1, approval_reference="TECH-QA",
                )
        await engine.dispose()

    asyncio.run(scenario())
