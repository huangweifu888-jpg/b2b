import asyncio
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import models  # noqa: F401
from core.database import Base
from core.tenant_context import build_tenant_context
from models.factory_forecast import FactoryForecastRun
from models.factory_health_cockpit import FactoryHealthCockpitAlert, FactoryHealthCockpitSnapshot
from models.factory_revenue_profit import FactoryRevenueProfitRun
from services.factory_ai_command import FactoryAiCommandService


def _context():
    return build_tenant_context(agent_path="hq/client-ai", tenant_id="tenant-ai",
                                client_id="client-ai", plan_id="plan-54")


async def _facts(db, context):
    now = datetime.now(timezone.utc)
    shared = dict(project_id=54, agent_path=context.agent_path, tenant_id=context.tenant_id,
                  client_id=context.client_id, plan_id=context.plan_id, revision=3)
    health = FactoryHealthCockpitSnapshot(
        id="ai-health-1", snapshot_number="HCS-AI-1", snapshot_reference="AI-HEALTH",
        period_start=now - timedelta(days=30), period_end=now, overall_score=Decimal("72.50"),
        health_grade="B", metric_count=12, available_metric_count=11, alert_count=1,
        dimensions_json="[]", source_watermarks_json="[]", methodology_version="v1",
        status="published", generated_by="health-engine", generated_at=now, **shared,
    )
    alert = FactoryHealthCockpitAlert(
        id="ai-alert-1", alert_number="HCA-AI-1", snapshot_id=health.id,
        snapshot_number=health.snapshot_number, dimension="cash", metric_code="cash.net",
        metric_label="净现金风险", severity="high", actual_value=Decimal("-315"),
        threshold_value=Decimal("0"), unit="USD", source_object_type="forecast-run",
        source_reference="FCR-AI-1", status="open", created_at=now, updated_at=now, **shared,
    )
    profit = FactoryRevenueProfitRun(
        id="ai-profit-1", run_number="RPR-AI-1", analysis_reference="AI-PROFIT",
        binding_id="binding-ai", binding_number="RPB-AI", policy_id="policy-ai",
        policy_version_id="version-ai", policy_version_number=1, policy_fingerprint="a" * 64,
        model_type="last-touch", correlation_id="corr-ai", account_reference="BUYER-AI",
        currency="USD", recognized_revenue=Decimal("950"), governed_sales_cost=Decimal("500"),
        marketing_spend=Decimal("315"), contribution_margin=Decimal("135"),
        contribution_margin_percent=Decimal("14.2105"), touchpoint_count=2,
        profit_classification="management-contribution-estimate", status="published",
        calculated_by="profit-engine", calculated_at=now, verification_reference="PROFIT-VERIFY",
        verification_note="Independently reconciled and published", verified_by="profit-verifier",
        verified_at=now, updated_by="profit-verifier", created_at=now, updated_at=now, **shared,
    )
    forecast = FactoryForecastRun(
        id="ai-forecast-1", run_number="FCR-AI-1", forecast_reference="AI-FORECAST",
        policy_id="forecast-policy", policy_version_id="forecast-version", policy_version_number=1,
        policy_fingerprint="b" * 64, model_type="weighted-pipeline-capacity-cash", as_of_at=now,
        horizon_days=90, bucket_days=30, currency="USD", source_count=6, input_fact_count=8,
        pipeline_demand_value=Decimal("0"), confirmed_order_value=Decimal("8140"),
        required_capacity_units=Decimal("12.1"), available_capacity_units=Decimal("360"),
        capacity_gap_units=Decimal("347.9"), expected_cash_in=Decimal("0"),
        expected_cash_out=Decimal("315"), net_cash_change=Decimal("-315"),
        status="published", calculated_by="forecast-engine", calculated_at=now,
        verification_reference="FORECAST-VERIFY", verification_note="Published governed forecast",
        verified_by="forecast-verifier", verified_at=now, updated_by="forecast-verifier",
        created_at=now, updated_at=now, **shared,
    )
    db.add_all([health, alert, profit, forecast]); await db.flush()
    return health, alert, profit, forecast


def test_ai_command_answers_only_from_published_cited_facts():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection: await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            context = _context(); _, _, _, forecast = await _facts(db, context)
            service = FactoryAiCommandService(db)
            result = await service.ask(project_id=54, context=context, actor="decision-owner",
                query_reference="AI-Q-CASH", question="未来现金和产能情况怎么样？")
            assert result["query"]["intent"] == "forecast-cash-capacity"
            assert result["query"]["classification"] == "governed-decision-assistance"
            assert result["query"]["verified_fact_count"] == 1
            assert result["citations"][0]["source_id"] == forecast.id
            assert result["citations"][0]["source_revision"] == 3
            assert "-315" in result["query"]["answer"] and "347.9000" in result["query"]["answer"]
            with pytest.raises(ValueError, match="no answer was fabricated"):
                await service.ask(project_id=54, context=context, actor="decision-owner",
                    query_reference="AI-Q-UNKNOWN", question="请告诉我明天彩票号码")
            workspace = await service.list_workspace(project_id=54)
            assert workspace["contract"]["external_llm_called"] is False
            assert workspace["contract"]["answers_require_citations"] is True
            assert (await service.list_workspace(project_id=55))["queries"] == []
        await engine.dispose()
    asyncio.run(scenario())


def test_ai_command_scenario_pins_forecast_without_writeback():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection: await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            context = _context(); _, _, _, forecast = await _facts(db, context)
            service = FactoryAiCommandService(db)
            result = await service.simulate(project_id=54, context=context, actor="scenario-owner",
                scenario_reference="AI-S-STRESS", name="订单增长与回款承压",
                demand_change_percent="20", capacity_change_percent="-10",
                cash_in_change_percent="-15", cash_out_change_percent="10")
            assert result["base_forecast_run_id"] == forecast.id
            assert result["base_forecast_revision"] == 3
            assert result["simulated_order_value"] == "9768.00"
            assert result["simulated_available_capacity"] == "324.0000"
            assert result["simulated_net_cash"] == "-346.50"
            assert forecast.confirmed_order_value == Decimal("8140")
            assert forecast.net_cash_change == Decimal("-315")
        await engine.dispose()
    asyncio.run(scenario())


def test_ai_command_requires_independent_approval_before_business_handoff():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection: await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            context = _context(); await _facts(db, context); service = FactoryAiCommandService(db)
            query = await service.ask(project_id=54, context=context, actor="recommendation-author",
                query_reference="AI-Q-RISK", question="当前有哪些经营风险预警？")
            recommendation = await service.create_recommendation(
                project_id=54, context=context, actor="recommendation-author",
                query_id=query["query"]["id"], scenario_id=None, title="控制短期现金流出",
                rationale="依据已发布净现金风险预警，复核非关键采购付款节奏",
                target_system="ERP", owner="finance-owner",
                due_at=datetime.now(timezone.utc) + timedelta(days=3), risk_level="high")
            with pytest.raises(ValueError, match="Only approved"):
                await service.handoff(recommendation["id"], project_id=54, actor="operator",
                    expected_revision=recommendation["revision"], handoff_reference="ERP-TASK-BLOCKED")
            with pytest.raises(ValueError, match="independent"):
                await service.approve_recommendation(recommendation["id"], project_id=54,
                    actor="recommendation-author", expected_revision=recommendation["revision"],
                    approval_reference="SELF-APPROVAL")
            approved = await service.approve_recommendation(recommendation["id"], project_id=54,
                actor="independent-approver", expected_revision=recommendation["revision"],
                approval_reference="AI-REC-APPROVAL")
            result = await service.handoff(approved["id"], project_id=54, actor="handoff-operator",
                expected_revision=approved["revision"], handoff_reference="ERP-TASK-2026-54")
            assert result["recommendation"]["status"] == "handed-off"
            assert result["handoff"]["execution_reference"] is None
            closed = await service.close_handoff(result["handoff"]["id"], project_id=54,
                actor="erp-evidence-recorder", expected_revision=result["handoff"]["revision"],
                execution_reference="ERP-WORKFLOW-EXECUTED-54")
            assert closed["handoff"]["status"] == "closed"
            assert closed["recommendation"]["status"] == "closed"
        await engine.dispose()
    asyncio.run(scenario())
