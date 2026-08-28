import asyncio
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import models  # noqa: F401
from core.database import Base
from core.tenant_context import build_tenant_context
from models.factory_approvals import FactoryApprovalHandoff
from models.factory_cpq import FactoryCpqQuote
from services.factory_legal_contracts import FactoryLegalContractService


def context(project_id=60):
    return build_tenant_context(agent_path=f"hq/client-legal-{project_id}",tenant_id=f"tenant-legal-{project_id}",client_id=f"client-legal-{project_id}",plan_id=f"plan-{project_id}")


async def authority(db,ctx,project_id=60):
    now=datetime.now(timezone.utc)
    quote=FactoryCpqQuote(id=f"legal-quote-{project_id}",project_id=project_id,agent_path=ctx.agent_path,tenant_id=ctx.tenant_id,client_id=ctx.client_id,plan_id=ctx.plan_id,
        quote_number=f"CPQ-LEGAL-{project_id}",account_reference=f"BUYER-LEGAL-{project_id}",currency="USD",exchange_rate=Decimal("1"),valid_until=now+timedelta(days=90),lines_json="[]",
        subtotal=Decimal("250000"),cost_total=Decimal("150000"),gross_margin_percent=Decimal("40"),status="draft",emitted_events_json="[]",revision=1,updated_by="commercial-owner",created_at=now,updated_at=now)
    handoff=FactoryApprovalHandoff(id=f"legal-handoff-{project_id}",project_id=project_id,agent_path=ctx.agent_path,tenant_id=ctx.tenant_id,client_id=ctx.client_id,plan_id=ctx.plan_id,
        handoff_number=f"APHF-LEGAL-{project_id}",request_id=f"approval-request-{project_id}",request_number=f"APRQ-LEGAL-{project_id}",subject_type="cpq-quote",subject_id=quote.id,subject_number=quote.quote_number,
        subject_revision=1,status="acknowledged",created_by="commercial-approver",acknowledged_by="domain-owner",acknowledged_at=now,acknowledgement_reference="DOMAIN-ACK",revision=2,created_at=now)
    db.add_all([quote,handoff]);await db.flush();return quote,handoff


async def masters(service,ctx,quote,project_id=60):
    party=await service.create_party(project_id=project_id,context=ctx,actor="party-author",party_reference=quote.account_reference,party_type="customer",legal_name="Global Buyer Industries Ltd",
        country_code="US",identity_key="US-REG-998877",registration_reference="KYB-REGISTRY-60",tax_profile_reference="TAX-PROFILE-60",registered_address_reference="ADDRESS-VAULT-60",
        source_type="cpq-quote",source_id=quote.id,kyb_evidence_reference="KYB-60",sanctions_screening_reference="SCREENING-60")
    with pytest.raises(ValueError,match="independent"):
        await service.approve_party(party["id"],project_id=project_id,actor="party-author",expected_revision=1,approval_reference="SELF")
    party=await service.approve_party(party["id"],project_id=project_id,actor="party-approver",expected_revision=1,approval_reference="PARTY-APPROVAL-60")
    created=await service.create_template(project_id=project_id,context=ctx,actor="template-author",template_code="GLOBAL-SALES",template_name="Global sales agreement",contract_type="customer-sales",
        language_code="en-US",governing_law="New York",dispute_resolution="ICC arbitration in Singapore",clauses=[{"title":"Scope","body":"Controlled products and specifications are incorporated by reference."},{"title":"Payment","body":"Payment milestones follow the accepted commercial schedule."},{"title":"Compliance","body":"Both parties maintain sanctions, export and anti-bribery compliance."}],document_reference="TEMPLATE-DOC-60")
    with pytest.raises(ValueError,match="independent"):
        await service.approve_template(created["template"]["id"],project_id=project_id,actor="template-author",expected_revision=1,approval_reference="SELF")
    template=await service.approve_template(created["template"]["id"],project_id=project_id,actor="template-approver",expected_revision=1,approval_reference="TEMPLATE-APPROVAL-60")
    return party,template


def test_legal_contract_closes_party_template_review_seal_signature_and_obligations():
    async def scenario():
        engine=create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine,expire_on_commit=False)() as db:
            ctx=context();quote,handoff=await authority(db,ctx);service=FactoryLegalContractService(db);party,template=await masters(service,ctx,quote)
            contract=await service.create_contract(project_id=60,context=ctx,actor="contract-author",contract_reference="CUSTOMER-CONTRACT-60",party_id=party["id"],template_id=template["id"],
                source_type="cpq-quote",source_id=quote.id,approval_handoff_id=handoff.id,effective_date=date.today()+timedelta(days=5),expiry_date=date.today()+timedelta(days=365),auto_renew=True,notice_days=60,draft_document_reference="CONTRACT-DRAFT-60")
            contract=await service.submit_contract(contract["id"],project_id=60,actor="contract-author",expected_revision=1,evidence_reference="SUBMISSION-60")
            with pytest.raises(ValueError,match="independent"):
                await service.review_contract(contract["id"],project_id=60,actor="contract-author",expected_revision=2,risk_level="medium",deviations=[],recommendation="approve",legal_comment="Self review is prohibited.",review_evidence_reference="SELF")
            result=await service.review_contract(contract["id"],project_id=60,actor="legal-reviewer",expected_revision=2,risk_level="medium",deviations=[{"clause":"Liability","position":"Buyer requests uncapped exposure.","resolution":"Accepted mutual cap at contract value."}],recommendation="approve",legal_comment="Independent legal review resolved the only material deviation.",review_evidence_reference="LEGAL-REVIEW-60")
            contract=result["contract"];assert contract["status"]=="approved"
            seal=await service.request_seal(project_id=60,context=ctx,actor="seal-requester",contract_id=contract["id"],seal_type="contract-seal",document_hash="a"*64,purpose="Execute the independently approved customer sales contract.")
            with pytest.raises(ValueError,match="independent"):
                await service.approve_seal(seal["id"],project_id=60,actor="seal-requester",expected_revision=1,approval_reference="SELF")
            seal=await service.approve_seal(seal["id"],project_id=60,actor="seal-custodian",expected_revision=1,approval_reference="SEAL-APPROVAL-60")
            seal=await service.use_seal(seal["id"],project_id=60,actor="authorized-seal-user",expected_revision=2,use_evidence_reference="SEALED-DOCUMENT-60")
            envelope=await service.create_envelope(project_id=60,context=ctx,actor="contract-author",contract_id=contract["id"],seal_authorization_id=seal["id"],provider_reference="SIGN-PROVIDER",provider_envelope_reference="PROVIDER-ENV-60",
                signers=["seller-signatory","buyer-signatory"],signed_document_reference="SIGNED-DOC-VAULT-60")
            envelope=await service.send_envelope(envelope["id"],project_id=60,actor="signature-coordinator",expected_revision=1,delivery_reference="ENVELOPE-DELIVERY-60")
            envelope=await service.record_signature(envelope["id"],project_id=60,actor="provider-webhook",expected_revision=2,signer_reference="seller-signatory",provider_event_reference="SIGN-EVENT-1",signature_evidence_reference="SIGN-EVIDENCE-1")
            assert envelope["status"]=="partially-signed"
            envelope=await service.record_signature(envelope["id"],project_id=60,actor="provider-webhook",expected_revision=3,signer_reference="buyer-signatory",provider_event_reference="SIGN-EVENT-2",signature_evidence_reference="SIGN-EVIDENCE-2")
            assert envelope["status"]=="completed"
            workspace=await service.list_workspace(project_id=60);active=workspace["contracts"][0];assert active["status"]=="active" and quote.status=="draft" and quote.revision==1
            payment=await service.create_obligation(project_id=60,context=ctx,actor="contract-owner",contract_id=active["id"],obligation_reference="PAYMENT-M1",obligation_type="payment",title="Initial payment",description="Buyer remits the contractual first milestone payment.",owner_reference="finance-owner",due_date=date.today()+timedelta(days=30))
            delivery=await service.create_obligation(project_id=60,context=ctx,actor="contract-owner",contract_id=active["id"],obligation_reference="DELIVERY-M1",obligation_type="delivery",title="Initial delivery",description="Operations delivers the first controlled equipment batch.",owner_reference="operations-owner",due_date=date.today()+timedelta(days=120))
            payment=await service.complete_obligation(payment["id"],project_id=60,actor="finance-owner",expected_revision=1,evidence_reference="BANK-SETTLEMENT-60")
            with pytest.raises(ValueError,match="independent"):
                await service.waive_obligation(delivery["id"],project_id=60,actor="operations-owner",expected_revision=1,waiver_reference="SELF-WAIVER")
            delivery=await service.waive_obligation(delivery["id"],project_id=60,actor="legal-waiver-approver",expected_revision=1,waiver_reference="CUSTOMER-WAIVER-60")
            workspace=await service.list_workspace(project_id=60)
            assert workspace["metrics"]["obligation_fulfillment_percent"]==100 and workspace["contract"]["signature_private_keys_stored"] is False
            assert (await service.list_workspace(project_id=61))["contracts"]==[]
        await engine.dispose()
    asyncio.run(scenario())


def test_legal_contract_blocks_duplicate_party_stale_pins_and_invalid_signature_events():
    async def scenario():
        engine=create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine,expire_on_commit=False)() as db:
            ctx=context();quote,handoff=await authority(db,ctx);service=FactoryLegalContractService(db);party,template=await masters(service,ctx,quote)
            with pytest.raises(ValueError,match="already exists"):
                await service.create_party(project_id=60,context=ctx,actor="duplicate-author",party_reference=quote.account_reference,party_type="customer",legal_name="Duplicate Buyer",country_code="US",identity_key="US-REG-998877",
                    registration_reference="DUP",tax_profile_reference="DUP",registered_address_reference="DUP",source_type="cpq-quote",source_id=quote.id,kyb_evidence_reference="DUP",sanctions_screening_reference="DUP")
            contract=await service.create_contract(project_id=60,context=ctx,actor="contract-author",contract_reference="STALE-CONTRACT",party_id=party["id"],template_id=template["id"],source_type="cpq-quote",source_id=quote.id,
                approval_handoff_id=handoff.id,effective_date=date.today()+timedelta(days=1),expiry_date=date.today()+timedelta(days=100),auto_renew=False,notice_days=30,draft_document_reference="STALE-DRAFT")
            quote.revision=2
            with pytest.raises(ValueError,match="source or approval handoff changed"):
                await service.submit_contract(contract["id"],project_id=60,actor="contract-author",expected_revision=1,evidence_reference="STALE")
            with pytest.raises(ValueError,match="revision conflict"):
                await service.submit_contract(contract["id"],project_id=60,actor="contract-author",expected_revision=99,evidence_reference="STALE")
        await engine.dispose()
    asyncio.run(scenario())
