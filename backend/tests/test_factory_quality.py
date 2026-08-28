import asyncio
from decimal import Decimal
import json

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import models  # noqa: F401
from core.database import Base
from core.tenant_context import build_tenant_context
from models.factory_contract import FactoryCoreEventContract
from models.factory_fulfillment import FactoryFulfillmentOrder
from services.factory_fulfillment import FactoryFulfillmentService
from services.factory_quality import FactoryQualityService


def context(project_id: int):
    return build_tenant_context(agent_path="org-1/org-2", tenant_id="tenant-1", client_id="client-2", plan_id=f"plan-{project_id}")


def produced_order(project_id: int, suffix: str = "1", *, historical_release: bool = False):
    evidence = [
        {"action": "allocate", "reference": f"INV-{suffix}"},
        {"action": "start-production", "reference": f"WO-{suffix}"},
        {"action": "complete-production", "reference": f"BATCH-{suffix}"},
    ]
    events = [{"eventType": "production-completed", "subjectId": f"BATCH-{suffix}"}]
    status = "production-completed"
    if historical_release:
        evidence.append({"action": "release-quality", "reference": f"QMS-{suffix}"})
        events.append({"eventType": "quality-released", "subjectId": f"BATCH-{suffix}", "inspectionReference": f"QMS-{suffix}"})
        status = "delivered"
    return FactoryFulfillmentOrder(
        id=f"order-{suffix}", project_id=project_id, agent_path="org-1/org-2", tenant_id="tenant-1",
        client_id="client-2", plan_id=f"plan-{project_id}", order_number=f"SO-{suffix}", quote_id=f"quote-{suffix}",
        quote_number=f"CPQ-{suffix}", order_intent_id=f"intent-{suffix}", account_reference="BUYER-1",
        currency="USD", exchange_rate=Decimal("1"),
        lines_json=json.dumps([{"product_reference": "PUMP-001", "sku_reference": "PUMP-001-380V", "quantity": "10"}]),
        order_total=Decimal("1000"), status=status, authority_source="factory-oms", validation_json="{}",
        fulfillment_evidence_json=json.dumps(evidence), emitted_events_json=json.dumps(events), revision=5,
    )


def quality_contract():
    return FactoryCoreEventContract(
        id="quality-released", sequence=3, label="quality-released", subject_id="batch", producer="fulfillment",
        consumers_json='["operations"]', required_fields_json='["eventId","tenantId"]', compatibility="backward",
        lifecycle_status="frozen", schema_version=1, revision=1,
    )


def results(*, dimensions_passed: bool):
    return [
        {"check_code": code, "passed": dimensions_passed if code == "dimensions" else True,
         "measured_value": "within specification" if code != "dimensions" or dimensions_passed else "0.8mm over tolerance",
         "evidence_reference": f"EVIDENCE-{code.upper()}"}
        for code in ("appearance", "dimensions", "performance", "safety", "documentation")
    ]


def test_inspection_requires_authoritative_batch_and_preserves_historical_reference():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            db.add_all([produced_order(1, "1", historical_release=True), produced_order(2, "2")])
            await db.flush()
            service = FactoryQualityService(db)
            with pytest.raises(ValueError, match="preserve the original"):
                await service.create_inspection(project_id=1, context=context(1), actor="quality", order_id="order-1", product_reference="PUMP-001", sku_reference="PUMP-001-380V", inspection_reference="QMS-OTHER", inspection_type="final", sample_size=5)
            item = await service.create_inspection(project_id=1, context=context(1), actor="quality", order_id="order-1", product_reference="PUMP-001", sku_reference="PUMP-001-380V", inspection_reference="QMS-1", inspection_type="final", sample_size=5)
            assert item["work_order_reference"] == "WO-1"
            assert item["batch_reference"] == "BATCH-1"
            assert item["tenant_id"] == "tenant-1"
            assert len((await service.list_workspace(project_id=1))["inspections"]) == 1
            assert (await service.list_workspace(project_id=3))["inspections"] == []
        await engine.dispose()
    asyncio.run(scenario())


def test_failed_check_requires_closed_finding_before_frozen_quality_release():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            db.add_all([produced_order(3, "3"), quality_contract()])
            await db.flush()
            service = FactoryQualityService(db)
            item = await service.create_inspection(project_id=3, context=context(3), actor="quality", order_id="order-3", product_reference="PUMP-001", sku_reference="PUMP-001-380V", inspection_reference="QMS-3", inspection_type="final", sample_size=5)
            item = await service.start_inspection(item["id"], project_id=3, expected_revision=item["revision"], actor="quality", inspector="Inspector Chen")
            item = await service.record_results(item["id"], project_id=3, expected_revision=item["revision"], actor="quality", accepted_quantity=4, rejected_quantity=1, check_results=results(dimensions_passed=False))
            with pytest.raises(ValueError, match="closed quality finding"):
                await service.release_inspection(item["id"], project_id=3, expected_revision=item["revision"], actor="quality-manager", approval_reference="APR-1", release_note="release after disposition approval")
            created = await service.create_finding(item["id"], project_id=3, context=context(3), actor="quality", expected_revision=item["revision"], check_code="dimensions", severity="major", description="Flange dimension exceeds tolerance", affected_quantity=1)
            resolved = await service.resolve_finding(created["finding"]["id"], project_id=3, expected_revision=created["finding"]["revision"], expected_inspection_revision=created["inspection"]["revision"], actor="quality-manager", disposition="rework", root_cause="Fixture positioning drift", corrective_action="Recalibrate fixture and rework flange", resolution_evidence_reference="CAPA-3")
            released = await service.release_inspection(item["id"], project_id=3, expected_revision=resolved["inspection"]["revision"], actor="quality-manager", approval_reference="APR-3", release_note="Rework evidence reviewed and approved")
            assert released["lifecycle_status"] == "released"
            assert released["findings"][0]["lifecycle_status"] == "closed"
            assert released["emitted_events"][0]["eventType"] == "quality-released"
            assert released["emitted_events"][0]["inspectionReference"] == "QMS-3"
        await engine.dispose()
    asyncio.run(scenario())


def test_oms_quality_milestone_requires_released_qms_evidence_and_revision():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            db.add_all([produced_order(4, "4"), quality_contract()])
            await db.flush()
            oms = FactoryFulfillmentService(db)
            with pytest.raises(ValueError, match="approved QMS inspection"):
                await oms.advance("order-4", project_id=4, expected_revision=5, actor="operator", action="release-quality", evidence_reference="QMS-4", note="quality release is requested")
            qms = FactoryQualityService(db)
            item = await qms.create_inspection(project_id=4, context=context(4), actor="quality", order_id="order-4", product_reference="PUMP-001", sku_reference="PUMP-001-380V", inspection_reference="QMS-4", inspection_type="final", sample_size=5)
            item = await qms.start_inspection(item["id"], project_id=4, expected_revision=item["revision"], actor="quality", inspector="Inspector Liu")
            item = await qms.record_results(item["id"], project_id=4, expected_revision=item["revision"], actor="quality", accepted_quantity=5, rejected_quantity=0, check_results=results(dimensions_passed=True))
            await qms.release_inspection(item["id"], project_id=4, expected_revision=item["revision"], actor="quality-manager", approval_reference="APR-4", release_note="All inspection checks passed and approved")
            order = next(row for row in await oms.list(project_id=4) if row["id"] == "order-4")
            order = await oms.advance("order-4", project_id=4, expected_revision=order["revision"], actor="operator", action="release-quality", evidence_reference="QMS-4", note="QMS approval evidence is attached")
            assert order["status"] == "quality-released"
            assert [event["eventType"] for event in order["emitted_events"]] == ["production-completed", "quality-released"]
        await engine.dispose()
    asyncio.run(scenario())
