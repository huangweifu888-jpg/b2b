import asyncio
import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from core.database import Base
from core.tenant_context import build_tenant_context
from models.factory_contract import FactoryCoreEventContract
from services.factory_inquiry import FactoryInquiryService

def context(project_id=301): return build_tenant_context(agent_path=f"hq/inquiry-{project_id}", tenant_id=f"tenant-{project_id}", client_id=f"client-{project_id}", plan_id=f"plan-{project_id}")
async def contracts(db):
    for sequence, identifier in enumerate(("inquiry-created", "quote-submitted", "quote-accepted", "order-confirmed", "invoice-issued", "payment-received"), start=1):
        db.add(FactoryCoreEventContract(id=identifier, sequence=sequence, label=identifier, subject_id="factory-inquiry", producer="convert", consumers_json="[]", required_fields_json="[]", compatibility="backward", lifecycle_status="frozen", schema_version=1, revision=1, updated_by="test"))
    await db.flush()
def test_inquiry_requires_independent_qualification_and_rule_governance():
    async def go():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection: await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            await contracts(db); service = FactoryInquiryService(db); c = context(); inquiry = await service.create_inquiry(project_id=301, context=c, actor="intake", source_channel="website", source_reference="WEB-001", account_reference="ACME", product_reference="ROBOT", country_code="US", requested_quantity=2, payload_summary="Need robotic cell", score=82)
            with pytest.raises(ValueError, match="independent reviewer"): await service.qualify_inquiry(inquiry["id"], project_id=301, actor="intake", expected_revision=1, reference="SELF")
            inquiry = await service.qualify_inquiry(inquiry["id"], project_id=301, actor="reviewer", expected_revision=1, reference="QUALIFY")
            rule = await service.create_rule(project_id=301, context=c, actor="author", rule_key="US-ROBOT", rule_name="US robot desk", priority=10, conditions={"country_code": "US", "product_reference": "ROBOT", "min_score": 80}, assignee_reference="sales-us")
            with pytest.raises(ValueError, match="independent approval"): await service.approve_rule(rule["id"], project_id=301, actor="author", expected_revision=1, reference="SELF")
            rule = await service.approve_rule(rule["id"], project_id=301, actor="reviewer", expected_revision=1, reference="APPROVE")
            rule = await service.activate_rule(rule["id"], project_id=301, actor="publisher", expected_revision=2)
            routed = await service.route_inquiry(inquiry["id"], project_id=301, context=c, actor="router", expected_revision=2); assignment = routed["assignment"]
            with pytest.raises(ValueError, match="independent"): await service.acknowledge_assignment(assignment["id"], project_id=301, actor="router", expected_revision=1, reference="SELF")
            assignment = await service.acknowledge_assignment(assignment["id"], project_id=301, actor="sales-us", expected_revision=1, reference="RECEIPT")
            handed = await service.handoff_to_revenue(inquiry["id"], project_id=301, context=c, actor="sales-us", expected_revision=3, currency="USD")
            assert handed["inquiry"]["status"] == "handed-off" and handed["revenue_flow"]["current_stage"] == "inquiry-created"
            workspace = await service.workspace(project_id=301); assert workspace["metrics"] == {"received_inquiries": 1, "qualified_inquiries": 1, "routing_receipt_percent": 100.0}; assert workspace["contract"]["raw_payload_stored"] is False
        await engine.dispose()
    asyncio.run(go())
def test_inquiry_deduplicates_source_without_cross_tenant_access():
    async def go():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection: await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            await contracts(db); service = FactoryInquiryService(db); c = context(); await service.create_inquiry(project_id=302, context=c, actor="intake", source_channel="email", source_reference="MAIL-1", account_reference="ACME", product_reference="ROBOT", country_code="DE", requested_quantity=None, payload_summary=None, score=40)
            with pytest.raises(ValueError, match="already registered"): await service.create_inquiry(project_id=302, context=c, actor="intake-2", source_channel="email", source_reference="MAIL-1", account_reference="ACME", product_reference="ROBOT", country_code="DE", requested_quantity=None, payload_summary=None, score=40)
            assert (await service.workspace(project_id=303))["inquiries"] == []
        await engine.dispose()
    asyncio.run(go())
