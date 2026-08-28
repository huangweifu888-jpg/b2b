import asyncio
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import models  # noqa: F401
from core.database import Base
from core.tenant_context import build_tenant_context
from models.factory_contract import FactoryCoreEventContract
from models.factory_customer_asset import FactoryCustomerAsset
from services.factory_customer_success import FactoryCustomerSuccessService


def context(): return build_tenant_context(agent_path="org/a", tenant_id="tenant-a", client_id="client-a", plan_id="plan-7")


def asset():
    now = datetime.now(timezone.utc)
    return FactoryCustomerAsset(id="asset-1", project_id=7, agent_path="org/a", tenant_id="tenant-a", client_id="client-a", plan_id="plan-7", asset_number="ASSET-1", order_id="order-1", order_number="SO-1", account_reference="account-1", product_reference="pump", sku_reference="pump-1", serial_number="serial-1", installation_location="line-1", installed_at=now-timedelta(days=3), warranty_until=now+timedelta(days=10), next_service_due_at=now+timedelta(days=20), status="active", renewal_status="action-required", renewal_owner="renewal-owner", renewal_action="Prepare a governed renewal review", service_count=1, revision=3)


def contract(): return FactoryCoreEventContract(id="customer-success-handoff-released", sequence=36, label="handoff", subject_id="customer-success-review", producer="care", consumers_json='["renewal-growth"]', required_fields_json='["eventId","tenantId"]', compatibility="backward", lifecycle_status="frozen", schema_version=1, revision=1)


def test_customer_success_requires_independent_review_approval_and_receipt():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection: await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            db.add_all([asset(), contract()]); await db.flush(); service = FactoryCustomerSuccessService(db)
            review = await service.create(project_id=7, context=context(), actor="author", asset_id="asset-1", success_summary="Service results and warranty timing require proactive renewal planning")
            assert review["source_fingerprint"] and review["risk_level"] == "medium"
            with pytest.raises(ValueError, match="independent"):
                await service.review(review["id"], project_id=7, expected_revision=1, actor="author", review_reference="REV-1", note="Independent evidence note")
            review = await service.review(review["id"], project_id=7, expected_revision=1, actor="reviewer", review_reference="REV-1", note="Independent evidence note")
            with pytest.raises(ValueError, match="independent"):
                await service.approve(review["id"], project_id=7, expected_revision=2, actor="reviewer", approval_reference="APR-1", note="Independent approval note")
            review = await service.approve(review["id"], project_id=7, expected_revision=2, actor="approver", approval_reference="APR-1", note="Independent approval note")
            result = await service.handoff(review["id"], project_id=7, expected_revision=3, actor="approver", release_reference="HANDOFF-1")
            with pytest.raises(ValueError, match="independent"):
                await service.acknowledge(result["handoff"]["id"], project_id=7, expected_revision=1, actor="approver", receipt_reference="RECEIPT-1")
            receipt = await service.acknowledge(result["handoff"]["id"], project_id=7, expected_revision=1, actor="renewal-owner", receipt_reference="RECEIPT-1")
            assert receipt["status"] == "acknowledged"
            workspace = await service.list_workspace(project_id=7)
            assert [row["event_type"] for row in workspace["evidence"]] == ["success-review-created", "success-review-reviewed", "success-review-approved", "customer-success-handoff-released"]
        await engine.dispose()
    asyncio.run(scenario())
