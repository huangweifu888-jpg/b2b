import asyncio
from datetime import datetime, timedelta, timezone
from decimal import Decimal
import json

import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import models  # noqa: F401
from core.database import Base
from core.tenant_context import build_tenant_context
from models.auth import User
from models.factory_contract import FactoryCoreEventContract
from models.factory_cpq import FactoryCpqQuote
from models.factory_quality import FactoryQualityInspection
from models.platform import Membership, Organization, Project, Role
from schemas.auth import UserResponse
from services.factory_fulfillment import FactoryFulfillmentService
from services.tenant_access import require_project_permission


def context(project_id: int):
    return build_tenant_context(agent_path="org-1/org-2", tenant_id="tenant-1", client_id="client-2", plan_id=f"plan-{project_id}")


def accepted_quote(project_id: int, suffix: str = "1"):
    return FactoryCpqQuote(
        id=f"quote-{suffix}", project_id=project_id, agent_path="org-1/org-2", tenant_id="tenant-1", client_id="client-2", plan_id=f"plan-{project_id}",
        quote_number=f"CPQ-{suffix}", account_reference="BUYER-1", currency="USD", exchange_rate=Decimal("1"),
        valid_until=datetime.now(timezone.utc) + timedelta(days=30), lines_json=json.dumps([{"line_number": 1, "product_reference": "PUMP-001", "sku_reference": "PUMP-001-380V", "quantity": "10", "unit_price": "100", "line_total": "1000"}]),
        subtotal=Decimal("1000"), cost_total=Decimal("700"), gross_margin_percent=Decimal("30"), status="accepted", order_intent_id=f"order-intent-{suffix}", emitted_events_json="[]", revision=5,
    )


def frozen_event(event_id: str, sequence: int):
    return FactoryCoreEventContract(id=event_id, sequence=sequence, label=event_id, subject_id="order", producer="fulfillment", consumers_json='["operations"]', required_fields_json='["eventId","tenantId"]', compatibility="backward", lifecycle_status="frozen", schema_version=1, revision=1)


def test_order_intent_requires_authoritative_checks_before_confirmation():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            quote = accepted_quote(1)
            db.add(quote)
            service = FactoryFulfillmentService(db)
            order = await service.register_intent(project_id=1, context=context(1), actor="oms", order_intent_id=quote.order_intent_id)
            assert order["status"] == "pending-validation"
            assert order["order_total"] == "1000.00"
            assert order["id"].startswith("order-")
            with pytest.raises(ValueError, match="all checks"):
                await service.decide(order["id"], project_id=1, expected_revision=1, actor="manager", action="confirm", validations={"product": True, "payment": True, "inventory": False, "capacity": True}, note="库存尚未锁定")
            with pytest.raises(ValueError, match="frozen order-confirmed"):
                await service.decide(order["id"], project_id=1, expected_revision=1, actor="manager", action="confirm", validations={key: True for key in ("product", "payment", "inventory", "capacity")}, note="四项权威检查均已通过")
            db.add(frozen_event("order-confirmed", 1))
            await db.flush()
            order = await service.decide(order["id"], project_id=1, expected_revision=1, actor="manager", action="confirm", validations={key: True for key in ("product", "payment", "inventory", "capacity")}, note="四项权威检查均已通过")
            assert order["status"] == "confirmed"
            assert order["confirmed_by"] == "manager"
            assert order["validation"]["inventory"] is True
            assert [event["eventType"] for event in order["emitted_events"]] == ["order-confirmed"]
        await engine.dispose()
    asyncio.run(scenario())


def test_fulfillment_requires_ordered_milestones_and_evidence():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            db.add_all([accepted_quote(3, "3"), frozen_event("order-confirmed", 1), frozen_event("production-completed", 2), frozen_event("quality-released", 3), frozen_event("shipment-delivered", 4)])
            await db.flush()
            service = FactoryFulfillmentService(db)
            order = await service.register_intent(project_id=3, context=context(3), actor="oms", order_intent_id="order-intent-3")
            order = await service.decide(order["id"], project_id=3, expected_revision=1, actor="manager", action="confirm", validations={key: True for key in ("product", "payment", "inventory", "capacity")}, note="交付约束核验通过")
            with pytest.raises(ValueError, match="requires status allocated"):
                await service.advance(order["id"], project_id=3, expected_revision=2, actor="planner", action="start-production", evidence_reference="WO-1", note="工单已审批")
            db.add(FactoryQualityInspection(
                id="inspection-3", project_id=3, agent_path="org-1/org-2", tenant_id="tenant-1", client_id="client-2", plan_id="plan-3",
                inspection_number="QIN-3", inspection_reference="QMS-1", order_id=order["id"], order_number=order["order_number"],
                product_reference="PUMP-001", sku_reference="PUMP-001-380V", work_order_reference="WO-1", batch_reference="BATCH-1",
                inspection_type="final", sample_size=5, accepted_quantity=5, rejected_quantity=0, lifecycle_status="released",
                check_results_json="[]", approval_reference="APR-1", release_note="Approved quality evidence",
                emitted_events_json=json.dumps([{"eventType": "quality-released", "subjectId": "BATCH-1", "inspectionReference": "QMS-1"}]), revision=4,
            ))
            await db.flush()
            milestones = [
                ("allocate", "INV-LOCK-1", "库存已经锁定"),
                ("start-production", "WO-1", "生产工单已审批"),
                ("complete-production", "BATCH-1", "批次生产已经完成"),
                ("release-quality", "QMS-1", "质量检验已经放行"),
                ("ship", "SHIP-1", "承运商已经接货"),
                ("deliver", "POD-1", "客户签收回执已归档"),
            ]
            for action, reference, note in milestones:
                order = await service.advance(order["id"], project_id=3, expected_revision=order["revision"], actor="operator", action=action, evidence_reference=reference, note=note)
            assert order["status"] == "delivered"
            assert len(order["fulfillment_evidence"]) == 6
            assert [event["eventType"] for event in order["emitted_events"]] == ["order-confirmed", "production-completed", "quality-released", "shipment-delivered"]
            assert await service.list(project_id=4) == []
        await engine.dispose()
    asyncio.run(scenario())


def test_project_permission_requires_explicit_fulfillment_role_grant():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            user = User(id="operator", email="operator@example.test", role="user")
            client = Organization(name="Client", code="CLIENT", org_type="client", status="active", lineage_path="1")
            db.add_all([user, client])
            await db.flush()
            client.lineage_path = str(client.id)
            project = Project(client_org_id=client.id, name="Plan", code="PLAN", status="active")
            denied_role = Role(org_id=client.id, scope="project", name="Viewer", permissions_json='["project.view_stats"]')
            db.add_all([project, denied_role])
            await db.flush()
            membership = Membership(user_id=user.id, org_id=client.id, project_id=project.id, role_id=denied_role.id, status="active")
            db.add(membership)
            await db.flush()
            actor = UserResponse(id=user.id, email=user.email, role="user")
            with pytest.raises(HTTPException) as denied:
                await require_project_permission(db, current_user=actor, project_id=project.id, permission="factory.fulfillment.order.confirm")
            assert denied.value.status_code == 403
            denied_role.permissions_json = '["factory.fulfillment.order.confirm"]'
            await db.flush()
            assert (await require_project_permission(db, current_user=actor, project_id=project.id, permission="factory.fulfillment.order.confirm")).project.id == project.id
        await engine.dispose()
    asyncio.run(scenario())
