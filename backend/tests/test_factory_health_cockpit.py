import asyncio
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import models  # noqa: F401
from core.database import Base
from core.tenant_context import build_tenant_context
from models.factory_partner_voice import FactoryPartnerAccount
from models.factory_revenue import FactoryRevenueFlowRun
from services.factory_health_cockpit import FactoryHealthCockpitService


def test_health_cockpit_derives_authority_metrics_and_closes_responsibility_loop():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            context = build_tenant_context(
                agent_path="hq/client-1", tenant_id="tenant-1", client_id="client-1", plan_id="plan-7",
            )
            db.add(FactoryRevenueFlowRun(
                id="revenue-1", project_id=7, agent_path=context.agent_path,
                tenant_id=context.tenant_id, client_id=context.client_id, plan_id=context.plan_id,
                correlation_id="corr-health-1", product_reference="PUMP-001",
                account_reference="BUYER-001", currency="USD", quoted_amount=Decimal("1000"),
                ordered_amount=Decimal("1000"), invoiced_amount=Decimal("1000"),
                paid_amount=Decimal("1000"), current_stage="payment-received",
            ))
            db.add(FactoryPartnerAccount(
                id="partner-1", project_id=7, agent_path=context.agent_path,
                tenant_id=context.tenant_id, client_id=context.client_id, plan_id=context.plan_id,
                partner_number="PRM-TEST-1", external_reference="PARTNER-TEST-1",
                legal_name="Test Industrial Distributor", partner_type="distributor",
                country_code="CN", territory="East China", product_scope_json='["PUMP-001"]',
                account_reference="BUYER-001", primary_contact_reference="CONTACT-1",
                relationship_evidence_reference="DUE-DILIGENCE-1", agreement_reference="AGREEMENT-1",
                status="active", activated_by="partner-manager", activated_at=datetime.now(timezone.utc),
            ))
            await db.flush()

            service = FactoryHealthCockpitService(db)
            now = datetime.now(timezone.utc)
            result = await service.refresh(
                project_id=7, context=context, actor="executive-1", snapshot_reference="HEALTH-2026-08",
                period_start=now - timedelta(days=30), period_end=now,
            )
            metrics = {item["code"]: item for item in result["snapshot"]["dimensions"]}
            assert metrics["cash_collection"]["actual"] == "100.00"
            assert metrics["partner_readiness"]["actual"] == "100.00"
            assert metrics["data_coverage"]["actual"] == "28.57"
            assert result["snapshot"]["metric_count"] == 8
            assert result["snapshot"]["available_metric_count"] == 3
            assert len(result["alerts"]) == 6

            with pytest.raises(ValueError, match="already exists"):
                await service.refresh(
                    project_id=7, context=context, actor="executive-1", snapshot_reference="HEALTH-2026-08",
                    period_start=now - timedelta(days=30), period_end=now,
                )

            alert = next(item for item in result["alerts"] if item["metric_code"] == "quote_to_order")
            with pytest.raises(KeyError, match="tenant plan"):
                await service.acknowledge_alert(
                    alert["id"], project_id=8, expected_revision=1, actor="manager-1", owner="sales-owner",
                    due_at=now + timedelta(days=3), acknowledgement_reference="ACK-1",
                )
            alert = await service.acknowledge_alert(
                alert["id"], project_id=7, expected_revision=1, actor="manager-1", owner="sales-owner",
                due_at=now + timedelta(days=3), acknowledgement_reference="ACK-1",
            )
            with pytest.raises(ValueError, match="changed"):
                await service.create_task(
                    alert["id"], project_id=7, expected_alert_revision=1, actor="manager-1",
                    owner="sales-owner", action_plan="Review accepted quotes and recover stalled orders",
                    due_at=now + timedelta(days=3), assignment_reference="TASK-ASSIGN-1",
                )
            task = await service.create_task(
                alert["id"], project_id=7, expected_alert_revision=alert["revision"], actor="manager-1",
                owner="sales-owner", action_plan="Review accepted quotes and recover stalled orders",
                due_at=now + timedelta(days=3), assignment_reference="TASK-ASSIGN-1",
            )
            task = await service.start_task(
                task["id"], project_id=7, expected_revision=task["revision"],
                actor="sales-owner", start_reference="TASK-START-1",
            )
            task = await service.complete_task(
                task["id"], project_id=7, expected_revision=task["revision"], actor="sales-owner",
                completion_note="Recovered the qualified quote and documented the customer decision.",
                completion_evidence_reference="TASK-COMPLETE-1",
            )
            with pytest.raises(ValueError, match="independent"):
                await service.verify_task(
                    task["id"], project_id=7, expected_revision=task["revision"], actor="sales-owner",
                    verification_reference="VERIFY-1", verification_note="Checked source order and payment records.",
                )
            verified = await service.verify_task(
                task["id"], project_id=7, expected_revision=task["revision"], actor="finance-auditor",
                verification_reference="VERIFY-2", verification_note="Checked source order and payment records independently.",
            )
            assert verified["task"]["status"] == "verified"
            assert verified["alert"]["status"] == "resolved"
            assert (await db.get(FactoryRevenueFlowRun, "revenue-1")).revision == 1
            assert (await db.get(FactoryPartnerAccount, "partner-1")).revision == 1
            workspace = await service.list_workspace(project_id=7)
            ordered_evidence = list(reversed(workspace["evidence"]))
            assert [item["evidence_type"] for item in ordered_evidence] == [
                "snapshot-generated", "acknowledgement", "assignment", "work-started", "completion", "verification",
            ]
            assert ordered_evidence[0]["subject_number"] == result["snapshot"]["snapshot_number"]
            assert ordered_evidence[1]["subject_number"] == alert["alert_number"]
            assert {item["subject_number"] for item in ordered_evidence[2:]} == {verified["task"]["task_number"]}
        await engine.dispose()

    asyncio.run(scenario())
