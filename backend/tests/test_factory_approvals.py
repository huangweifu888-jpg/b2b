import asyncio
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import models  # noqa: F401
from core.database import Base
from core.tenant_context import build_tenant_context
from models.factory_cpq import FactoryCpqQuote
from services.factory_approvals import FactoryApprovalService


def _context():
    return build_tenant_context(agent_path="hq/client-approvals", tenant_id="tenant-approvals",
                                client_id="client-approvals", plan_id="plan-59")


def _quote(context, *, project_id=59):
    now = datetime.now(timezone.utc)
    return FactoryCpqQuote(id=f"approval-quote-{project_id}", project_id=project_id,
        agent_path=context.agent_path, tenant_id=context.tenant_id, client_id=context.client_id,
        plan_id=context.plan_id, quote_number=f"CPQ-APPROVAL-{project_id}", account_reference="BUYER-APPROVAL",
        currency="USD", exchange_rate=Decimal("1"), valid_until=now + timedelta(days=30), lines_json="[]",
        subtotal=Decimal("10000"), cost_total=Decimal("7000"), gross_margin_percent=Decimal("30"),
        status="draft", emitted_events_json="[]", revision=1, updated_by="quote-author", created_at=now, updated_at=now)


async def _workflow(service, context):
    created = await service.create_workflow(project_id=59, context=context, actor="workflow-author",
        workflow_code="CPQ-HIGH-VALUE", workflow_name="High value quote approval", subject_type="cpq-quote",
        steps=[{"name": "Commercial review", "assignee_reference": "commercial-approver", "due_hours": 8},
               {"name": "Finance review", "assignee_reference": "finance-approver", "due_hours": 20}],
        sla_hours=24, allow_delegation=True)
    with pytest.raises(ValueError, match="independent"):
        await service.approve_workflow(created["workflow"]["id"], project_id=59, actor="workflow-author",
            expected_revision=1, approval_reference="SELF")
    approved = await service.approve_workflow(created["workflow"]["id"], project_id=59,
        actor="governance-approver", expected_revision=1, approval_reference="WORKFLOW-CONTROL-APPROVAL")
    return approved


def test_approval_center_orders_steps_and_emits_acknowledged_handoff_without_mutating_source():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection: await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            context = _context(); quote = _quote(context); db.add(quote); await db.flush()
            service = FactoryApprovalService(db); workflow = await _workflow(service, context)
            request = await service.create_request(project_id=59, context=context, actor="requester",
                workflow_id=workflow["id"], subject_id=quote.id, subject_revision=1,
                request_reference="APPROVE-CPQ-59", business_reason="Customer quote exceeds delegated commercial threshold.",
                evidence_reference="CPQ-RISK-PACK-59")
            with pytest.raises(ValueError, match="not the assigned"):
                await service.review_step(request["id"], project_id=59, actor="finance-approver",
                    expected_revision=1, decision="approve", reason="Attempted out-of-sequence review.",
                    evidence_reference="EARLY-FINANCE", channel="mobile")
            request = await service.review_step(request["id"], project_id=59, actor="commercial-approver",
                expected_revision=1, decision="approve", reason="Commercial margin evidence is sufficient.",
                evidence_reference="COMMERCIAL-REVIEW-59", channel="mobile")
            assert request["status"] == "in-review" and request["current_sequence"] == 2
            request = await service.review_step(request["id"], project_id=59, actor="finance-approver",
                expected_revision=2, decision="approve", reason="Finance independently confirms risk and margin.",
                evidence_reference="FINANCE-REVIEW-59", channel="web")
            assert request["status"] == "approved" and quote.status == "draft" and quote.revision == 1
            workspace = await service.list_workspace(project_id=59)
            handoff = workspace["handoffs"][0]
            assert handoff["status"] == "ready" and len(workspace["actions"]) == 3
            acknowledged = await service.acknowledge_handoff(handoff["id"], project_id=59,
                actor="domain-owner", expected_revision=1, acknowledgement_reference="CPQ-DOMAIN-ACK-59")
            assert acknowledged["status"] == "acknowledged" and quote.status == "draft"
            workspace = await service.list_workspace(project_id=59)
            assert workspace["contract"]["final_approval_mutates_domain_record"] is False
            assert workspace["metrics"]["active_workflows"] == 1
            assert (await service.list_workspace(project_id=60))["requests"] == []
        await engine.dispose()
    asyncio.run(scenario())


def test_approval_center_enforces_source_revision_self_approval_and_scoped_delegation():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection: await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            context = _context(); quote = _quote(context); db.add(quote); await db.flush()
            service = FactoryApprovalService(db); workflow = await _workflow(service, context)
            with pytest.raises(ValueError, match="source revision conflict"):
                await service.create_request(project_id=59, context=context, actor="requester",
                    workflow_id=workflow["id"], subject_id=quote.id, subject_revision=99,
                    request_reference="STALE", business_reason="Stale source version must be rejected.", evidence_reference="STALE")
            request = await service.create_request(project_id=59, context=context, actor="requester",
                workflow_id=workflow["id"], subject_id=quote.id, subject_revision=1,
                request_reference="DELEGATED-CPQ-59", business_reason="Time-bound delegation acceptance scenario.",
                evidence_reference="DELEGATION-PACK-59")
            now = datetime.now(timezone.utc)
            delegation = await service.create_delegation(project_id=59, context=context, actor="governance-owner",
                workflow_id=workflow["id"], subject_type="cpq-quote", delegator_reference="commercial-approver",
                delegate_reference="commercial-delegate", starts_at=now - timedelta(minutes=1), ends_at=now + timedelta(hours=4),
                reason="Commercial approver is unavailable during a controlled window.", evidence_reference="DELEGATION-59")
            assert delegation["status"] == "active"
            request = await service.review_step(request["id"], project_id=59, actor="commercial-delegate",
                expected_revision=1, decision="approve", reason="Delegated commercial review completed with evidence.",
                evidence_reference="DELEGATED-ACTION-59", channel="mobile")
            actions = (await service.list_workspace(project_id=59))["actions"]
            delegated = next(x for x in actions if x["action"] == "approve")
            assert delegated["acting_for_reference"] == "commercial-approver"
            quote.revision = 2
            with pytest.raises(ValueError, match="source revision conflict"):
                await service.review_step(request["id"], project_id=59, actor="finance-approver",
                    expected_revision=2, decision="approve", reason="Changed source cannot use old approval.",
                    evidence_reference="STALE-FINAL", channel="api")
        await engine.dispose()
    asyncio.run(scenario())
