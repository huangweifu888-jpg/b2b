import asyncio
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import models  # noqa: F401
from core.database import Base
from core.tenant_context import build_tenant_context
from models.factory_customer_asset import FactoryCustomerAsset
from models.factory_fulfillment import FactoryFulfillmentOrder
from services.factory_partner_voice import FactoryPartnerVoiceService


def context(project_id: int):
    return build_tenant_context(agent_path="org-1/org-2", tenant_id="tenant-1", client_id="client-2", plan_id=f"plan-{project_id}")


def customer_facts(project_id: int, *, suffix: str = "1"):
    now = datetime.now(timezone.utc)
    order = FactoryFulfillmentOrder(
        id=f"partner-order-{suffix}", project_id=project_id, agent_path="org-1/org-2",
        tenant_id="tenant-1", client_id="client-2", plan_id=f"plan-{project_id}",
        order_number=f"SO-PARTNER-{suffix}", quote_id=f"quote-partner-{suffix}",
        quote_number=f"CPQ-PARTNER-{suffix}", order_intent_id=f"intent-partner-{suffix}",
        account_reference="BUYER-PARTNER-1", currency="USD", exchange_rate=Decimal("1"),
        lines_json="[]", order_total=Decimal("6400"), status="delivered",
        authority_source="factory-oms", validation_json="{}", fulfillment_evidence_json="[]",
        emitted_events_json="[]", confirmed_by="oms", confirmed_at=now - timedelta(days=30),
        revision=8, updated_by="oms",
    )
    asset = FactoryCustomerAsset(
        id=f"partner-asset-{suffix}", project_id=project_id, agent_path="org-1/org-2",
        tenant_id="tenant-1", client_id="client-2", plan_id=f"plan-{project_id}",
        asset_number=f"ASSET-PARTNER-{suffix}", order_id=order.id, order_number=order.order_number,
        account_reference=order.account_reference, product_reference="PUMP-002",
        sku_reference="PUMP-002-380V", serial_number=f"SN-PARTNER-{suffix}",
        installation_location="Customer production line", installed_at=now - timedelta(days=30),
        warranty_until=now + timedelta(days=335), next_service_due_at=now + timedelta(days=90),
        status="active", renewal_status="monitoring", service_count=0,
        emitted_events_json="[]", revision=1, updated_by="asset-team",
    )
    return order, asset


async def active_partner(service: FactoryPartnerVoiceService, project_id: int):
    item = await service.create_partner(
        project_id=project_id, context=context(project_id), actor="channel-manager",
        external_reference=f"DIST-CYCLE-{project_id}", legal_name="Verified Industrial Distribution Ltd",
        partner_type="distributor", country_code="CN", territory="East China",
        product_scope=["PUMP-002", "SERVICE"], primary_contact_reference="CRM-CONTACT-001",
        relationship_evidence_reference="PARTNER-DUE-DILIGENCE-001",
        account_reference="BUYER-PARTNER-1",
    )
    return await service.activate_partner(
        item["id"], project_id=project_id, expected_revision=1, actor="channel-director",
        agreement_reference="PARTNER-AGREEMENT-001",
        approval_note="Legal entity, territory, product scope and commercial agreement approved",
    )


def test_partner_requires_authoritative_customer_link_and_academy_pass_evidence():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection: await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            order, asset = customer_facts(1); db.add_all([order, asset]); await db.flush()
            service = FactoryPartnerVoiceService(db)
            with pytest.raises(ValueError, match="not backed"):
                await service.create_partner(project_id=1, context=context(1), actor="channel", external_reference="BAD-LINK", legal_name="Bad Link Partner", partner_type="dealer", country_code="CN", territory="North", product_scope=["PUMP"], primary_contact_reference="CRM-1", relationship_evidence_reference="DUE-1", account_reference="UNKNOWN")
            partner = await active_partner(service, 1)
            assert partner["status"] == "active"
            assert [row["evidence_type"] for row in partner["evidence"]] == ["relationship", "activation"]
            with pytest.raises(KeyError, match="tenant plan"):
                await service.activate_partner(partner["id"], project_id=2, expected_revision=2, actor="intruder", agreement_reference="X", approval_note="Cross tenant activation attempt")
            enrollment = await service.enroll_academy(project_id=1, context=context(1), actor="academy", partner_id=partner["id"], enrollment_reference="ACADEMY-ENROLL-001", learner_reference="CRM-CONTACT-001", course_code="PUMP-SERVICE", course_title="Pump commissioning and service", course_version="2026.1", passing_score=80, planned_completion_at=datetime.now(timezone.utc) + timedelta(days=30))
            with pytest.raises(ValueError, match="passing score"):
                await service.complete_academy(enrollment["id"], project_id=1, expected_revision=1, actor="academy", assessment_score=79, completion_evidence_reference="ASSESSMENT-FAIL")
            enrollment = await service.complete_academy(enrollment["id"], project_id=1, expected_revision=1, actor="academy", assessment_score=92, completion_evidence_reference="ASSESSMENT-PASS-001")
            enrollment = await service.certify_academy(enrollment["id"], project_id=1, expected_revision=2, actor="academy-director", certification_reference="CERT-PUMP-001", certification_expires_at=datetime.now(timezone.utc) + timedelta(days=365))
            assert enrollment["status"] == "certified"
            assert [row["evidence_type"] for row in enrollment["evidence"]] == ["enrollment", "completion", "certification"]
        await engine.dispose()
    asyncio.run(scenario())


def test_voc_score_source_sla_and_escalation_boundaries():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection: await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            order, asset = customer_facts(2); db.add_all([order, asset]); await db.flush()
            service = FactoryPartnerVoiceService(db)
            with pytest.raises(ValueError, match="0 to 10"):
                await service.create_voice(project_id=2, context=context(2), actor="voc", feedback_reference="NPS-BAD", source_type="nps", account_reference=order.account_reference, category="service", severity="medium", summary="Invalid NPS response must be rejected", score=11)
            item = await service.create_voice(project_id=2, context=context(2), actor="voc", feedback_reference="NPS-DETRACTOR", source_type="nps", account_reference=order.account_reference, category="service", severity="high", summary="Customer reported recurring downtime and slow response", score=4, related_order_id=order.id, related_asset_id=asset.id)
            assert item["sentiment"] == "detractor"
            with pytest.raises(ValueError, match="within 48 hours"):
                await service.triage_voice(item["id"], project_id=2, expected_revision=1, actor="voc", triage_reference="TRIAGE-LATE", owner="service-manager", due_at=datetime.now(timezone.utc) + timedelta(days=5))
            item = await service.triage_voice(item["id"], project_id=2, expected_revision=1, actor="voc", triage_reference="TRIAGE-001", owner="service-manager", due_at=datetime.now(timezone.utc) + timedelta(hours=24))
            item = await service.start_action(item["id"], project_id=2, expected_revision=2, actor="service-manager", root_cause="Insufficient preventive maintenance cadence", action_plan="Add quarterly inspection and critical spare stock review", action_reference="CAPA-VOC-001")
            with pytest.raises(ValueError, match="escalation evidence"):
                await service.resolve_voice(item["id"], project_id=2, expected_revision=3, actor="service-director", resolution_reference="RESOLUTION-001", resolution_note="Quarterly maintenance and spare kit have been agreed")
        await engine.dispose()
    asyncio.run(scenario())


def test_promoter_voice_closes_and_publishes_only_with_explicit_consent():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection: await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            order, asset = customer_facts(3); db.add_all([order, asset]); await db.flush()
            service = FactoryPartnerVoiceService(db); partner = await active_partner(service, 3)
            item = await service.create_voice(project_id=3, context=context(3), actor="voc", feedback_reference="NPS-PROMOTER-001", source_type="nps", partner_id=partner["id"], account_reference=order.account_reference, category="value", severity="low", summary="Customer confirmed reliable delivery, service quality and expansion value", score=10, related_order_id=order.id, related_asset_id=asset.id)
            item = await service.triage_voice(item["id"], project_id=3, expected_revision=1, actor="voc", triage_reference="TRIAGE-PROMOTER-001", owner="customer-success", due_at=datetime.now(timezone.utc) + timedelta(days=5))
            item = await service.start_action(item["id"], project_id=3, expected_revision=2, actor="customer-success", root_cause="Promoter outcome is supported by delivery and service evidence", action_plan="Document value proof, confirm follow-up and request optional advocacy consent", action_reference="PROMOTER-ACTION-001")
            item = await service.resolve_voice(item["id"], project_id=3, expected_revision=3, actor="customer-success", resolution_reference="VALUE-REVIEW-001", resolution_note="Value proof reviewed with customer and next service plan confirmed")
            item = await service.confirm_voice(item["id"], project_id=3, expected_revision=4, actor="customer-success", customer_confirmation_reference="CUSTOMER-VOC-ACK-001")
            item = await service.close_voice(item["id"], project_id=3, expected_revision=5, actor="voc-manager", closure_reference="VOC-CLOSURE-001")
            assert item["advocacy_status"] == "eligible"
            with pytest.raises(ValueError, match="explicit authorization"):
                await service.publish_advocacy(item["id"], project_id=3, expected_revision=6, actor="marketing", case_study_reference="CASE-UNAUTHORIZED", publication_channel="website")
            item = await service.invite_advocacy(item["id"], project_id=3, expected_revision=6, actor="customer-success", invitation_reference="ADVOCACY-INVITE-001")
            item = await service.authorize_advocacy(item["id"], project_id=3, expected_revision=7, actor="compliance", consent_reference="CUSTOMER-CONSENT-001", consent_scope="Company name, approved quote and verified outcome for website case study", consent_expires_at=datetime.now(timezone.utc) + timedelta(days=365))
            item = await service.publish_advocacy(item["id"], project_id=3, expected_revision=8, actor="marketing-approver", case_study_reference="CASE-PUBLISHED-001", publication_channel="official-website")
            assert item["advocacy_status"] == "published"
            assert item["revision"] == 9
            assert [row["evidence_type"] for row in item["evidence"]] == ["feedback-received", "triage", "action-started", "resolution", "customer-confirmation", "closure", "advocacy-invitation", "advocacy-consent", "advocacy-publication"]
            workspace = await service.list_workspace(project_id=3)
            assert workspace["metrics"] == {"nps_responses": 1, "promoters": 1, "detractors": 0, "nps": 100}
            assert order.status == "delivered" and order.revision == 8
            assert asset.status == "active" and asset.revision == 1
        await engine.dispose()
    asyncio.run(scenario())
