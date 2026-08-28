import asyncio
from datetime import datetime, timedelta, timezone
from decimal import Decimal
import json

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import models  # noqa: F401
from core.database import Base
from core.tenant_context import build_tenant_context
from models.factory_contract import FactoryCoreEventContract
from models.factory_customer_asset import FactoryCustomerAsset
from models.factory_fulfillment import FactoryFulfillmentOrder
from services.factory_product_passport import FactoryProductPassportService


def context(project_id: int):
    return build_tenant_context(
        agent_path="org-1/org-2",
        tenant_id="tenant-1",
        client_id="client-2",
        plan_id=f"plan-{project_id}",
    )


def delivered_order(project_id: int, suffix: str = "1", *, complete_evidence: bool = True):
    evidence = [
        {"action": "allocate", "reference": f"INV-{suffix}"},
        {"action": "start-production", "reference": f"WO-{suffix}"},
        {"action": "complete-production", "reference": f"BATCH-{suffix}"},
        {"action": "release-quality", "reference": f"QC-{suffix}"},
        {"action": "ship", "reference": f"SHIP-{suffix}"},
        {"action": "deliver", "reference": f"POD-{suffix}"},
    ]
    if not complete_evidence:
        evidence = evidence[:3]
    return FactoryFulfillmentOrder(
        id=f"order-{suffix}",
        project_id=project_id,
        agent_path="org-1/org-2",
        tenant_id="tenant-1",
        client_id="client-2",
        plan_id=f"plan-{project_id}",
        order_number=f"SO-{suffix}",
        quote_id=f"quote-{suffix}",
        quote_number=f"CPQ-{suffix}",
        order_intent_id=f"intent-{suffix}",
        account_reference="BUYER-1",
        currency="USD",
        exchange_rate=Decimal("1"),
        lines_json=json.dumps([
            {
                "product_reference": "PUMP-001",
                "sku_reference": "PUMP-001-380V",
                "quantity": "2",
                "unit_price": "100",
            }
        ]),
        order_total=Decimal("200"),
        status="delivered",
        authority_source="factory-oms",
        validation_json="{}",
        fulfillment_evidence_json=json.dumps(evidence),
        emitted_events_json="[]",
        revision=8,
    )


def frozen_event(event_id: str, sequence: int):
    subject = "product" if event_id == "engineering-version-released" else "product-passport"
    return FactoryCoreEventContract(
        id=event_id,
        sequence=sequence,
        label=event_id,
        subject_id=subject,
        producer="fulfillment",
        consumers_json='["decision"]',
        required_fields_json='["eventId","tenantId"]',
        compatibility="backward",
        lifecycle_status="frozen",
        schema_version=1,
        revision=1,
    )


def bom():
    return [
        {
            "material_reference": "MAT-MOTOR-001",
            "material_name": "IE3 motor",
            "supplier_reference": "SUP-MOTOR-01",
            "quantity": "1",
            "unit": "EA",
            "origin_country": "CN",
        },
        {
            "material_reference": "MAT-SEAL-001",
            "material_name": "Mechanical seal",
            "supplier_reference": "SUP-SEAL-02",
            "quantity": "1",
            "unit": "EA",
            "origin_country": "DE",
        },
    ]


async def create_released_engineering(service, project_id: int, order_id: str):
    item = await service.create_engineering_version(
        project_id=project_id,
        context=context(project_id),
        actor="engineer",
        order_id=order_id,
        product_reference="PUMP-001",
        sku_reference="PUMP-001-380V",
        product_name="Industrial circulation pump",
        engineering_version="EV-1.0",
        specification={"rated_power": "15kW", "voltage": "380V", "standard": "IEC 60034"},
        bom_components=bom(),
    )
    return await service.release_engineering_version(
        item["id"],
        project_id=project_id,
        expected_revision=1,
        actor="chief-engineer",
        release_reference="ECR-APPROVAL-001",
        release_note="Engineering specification and BOM approved for production",
    )


def test_engineering_version_requires_delivered_line_and_traceable_bom():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            service = FactoryProductPassportService(db)
            with pytest.raises(ValueError, match="delivered authoritative order"):
                await service.create_engineering_version(
                    project_id=1,
                    context=context(1),
                    actor="engineer",
                    order_id="missing",
                    product_reference="PUMP-001",
                    sku_reference="PUMP-001-380V",
                    product_name="Pump",
                    engineering_version="EV-1.0",
                    specification={"power": "15kW", "voltage": "380V"},
                    bom_components=bom(),
                )
            order = delivered_order(1)
            db.add(order)
            await db.flush()
            with pytest.raises(ValueError, match="at least two traceable BOM"):
                await service.create_engineering_version(
                    project_id=1,
                    context=context(1),
                    actor="engineer",
                    order_id=order.id,
                    product_reference="PUMP-001",
                    sku_reference="PUMP-001-380V",
                    product_name="Pump",
                    engineering_version="EV-1.0",
                    specification={"power": "15kW", "voltage": "380V"},
                    bom_components=bom()[:1],
                )
            item = await service.create_engineering_version(
                project_id=1,
                context=context(1),
                actor="engineer",
                order_id=order.id,
                product_reference="PUMP-001",
                sku_reference="PUMP-001-380V",
                product_name="Pump",
                engineering_version="EV-1.0",
                specification={"power": "15kW", "voltage": "380V"},
                bom_components=bom(),
            )
            assert item["lifecycle_status"] == "draft"
            assert item["bom_components"][1]["supplier_reference"] == "SUP-SEAL-02"
        await engine.dispose()

    asyncio.run(scenario())


def test_product_passport_publishes_frozen_trace_and_links_customer_asset():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            order = delivered_order(3, "3")
            db.add_all([
                order,
                frozen_event("engineering-version-released", 1),
                frozen_event("product-passport-published", 2),
            ])
            await db.flush()
            service = FactoryProductPassportService(db)
            engineering = await create_released_engineering(service, 3, order.id)
            assert engineering["emitted_events"][0]["eventType"] == "engineering-version-released"
            passport = await service.create_passport(
                project_id=3,
                context=context(3),
                actor="compliance",
                engineering_version_id=engineering["id"],
                order_id=order.id,
                target_market="EU",
                access_mode="customer",
            )
            with pytest.raises(ValueError, match="valid verified certificate"):
                await service.publish_passport(
                    passport["id"],
                    project_id=3,
                    expected_revision=1,
                    actor="compliance",
                )
            now = datetime.now(timezone.utc)
            certificate_result = await service.add_certificate(
                passport["id"],
                project_id=3,
                context=context(3),
                actor="compliance",
                expected_revision=1,
                certificate_type="CE Declaration",
                certificate_number="CE-PUMP-2026-001",
                issuer="Factory Compliance Office",
                jurisdiction="EU",
                valid_from=now - timedelta(days=30),
                valid_until=now + timedelta(days=365),
                evidence_reference="DOC-CE-PUMP-001",
            )
            db.add(FactoryCustomerAsset(
                id="asset-3",
                project_id=3,
                agent_path="org-1/org-2",
                tenant_id="tenant-1",
                client_id="client-2",
                plan_id="plan-3",
                asset_number="ASSET-3",
                order_id=order.id,
                order_number=order.order_number,
                account_reference=order.account_reference,
                product_reference="PUMP-001",
                sku_reference="PUMP-001-380V",
                serial_number="SN-PUMP-003",
                installation_location="Customer plant line 1",
                installed_at=now - timedelta(days=10),
                warranty_until=now + timedelta(days=355),
                next_service_due_at=now + timedelta(days=80),
                status="active",
                renewal_status="monitoring",
                emitted_events_json="[]",
                revision=1,
            ))
            await db.flush()
            published = await service.publish_passport(
                passport["id"],
                project_id=3,
                expected_revision=certificate_result["passport"]["revision"],
                actor="compliance-owner",
            )
            assert published["lifecycle_status"] == "published"
            assert len(published["trace_digest"]) == 64
            assert published["qr_payload"].startswith("factory-passport:tenant-1:DPP-")
            assert published["emitted_events"][0]["eventType"] == "product-passport-published"
            assert published["linked_assets"][0]["serial_number"] == "SN-PUMP-003"
        await engine.dispose()

    asyncio.run(scenario())


def test_passport_requires_complete_fulfillment_and_project_revision_scope():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            order = delivered_order(5, "5", complete_evidence=False)
            db.add_all([order, frozen_event("engineering-version-released", 1)])
            await db.flush()
            service = FactoryProductPassportService(db)
            engineering = await create_released_engineering(service, 5, order.id)
            with pytest.raises(ValueError, match="complete fulfillment evidence"):
                await service.create_passport(
                    project_id=5,
                    context=context(5),
                    actor="compliance",
                    engineering_version_id=engineering["id"],
                    order_id=order.id,
                    target_market="EU",
                    access_mode="controlled",
                )
            with pytest.raises(KeyError, match="tenant plan"):
                await service.release_engineering_version(
                    engineering["id"],
                    project_id=6,
                    expected_revision=2,
                    actor="intruder",
                    release_reference="X",
                    release_note="Cross project release is forbidden",
                )
            workspace = await service.list_workspace(project_id=6)
            assert workspace["engineering_versions"] == []
        await engine.dispose()

    asyncio.run(scenario())
