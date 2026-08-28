import asyncio
from datetime import datetime,timedelta,timezone
from decimal import Decimal
import hashlib

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker,create_async_engine

import models  # noqa: F401
from core.database import Base
from core.tenant_context import build_tenant_context
from models.factory_cpq import FactoryCpqQuote
from models.factory_fulfillment import FactoryFulfillmentOrder
from models.factory_legal_contracts import FactoryLegalParty
from services.factory_account_graph import FactoryAccountGraphService
from services.factory_identity_resolution import FactoryIdentityResolutionService


def context(project_id=67):return build_tenant_context(agent_path=f"hq/client-account-graph-{project_id}",tenant_id=f"tenant-account-graph-{project_id}",client_id=f"client-account-graph-{project_id}",plan_id=f"plan-{project_id}")
def digest(value):return hashlib.sha256(value.encode()).hexdigest()
def tenant(ctx,project_id):return dict(project_id=project_id,agent_path=ctx.agent_path,tenant_id=ctx.tenant_id,client_id=ctx.client_id,plan_id=ctx.plan_id)


async def sources(db,ctx,project_id=67):
    now=datetime.now(timezone.utc);scope=tenant(ctx,project_id)
    legal=FactoryLegalParty(id=f"legal-{project_id}",**scope,party_number=f"LPTY-{project_id}",party_reference=f"LEGAL-ACCOUNT-{project_id}",party_type="customer",legal_name="Governed Buyer Group",country_code="CN",identity_fingerprint=digest(f"legal-{project_id}"),registration_reference="registry://buyer",tax_profile_reference="tax://buyer",registered_address_reference="address://buyer",source_type="cpq-quote",source_id=None,source_number=None,source_revision=None,kyb_evidence_reference="kyb://buyer",sanctions_screening_reference="screen://buyer",status="active",authored_by="legal-author",approved_by="legal-reviewer",approved_at=now,approval_reference="LEGAL-APPROVAL",revision=2,updated_by="legal-reviewer",created_at=now,updated_at=now);db.add(legal)
    quote_legal=FactoryCpqQuote(id=f"quote-legal-{project_id}",**scope,quote_number=f"CPQ-LEGAL-{project_id}",account_reference=legal.party_reference,currency="CNY",exchange_rate=Decimal("1"),valid_until=now+timedelta(days=30),lines_json="[]",subtotal=Decimal("10000"),cost_total=Decimal("7000"),gross_margin_percent=Decimal("30"),status="draft",emitted_events_json="[]",revision=1,created_at=now,updated_at=now);db.add(quote_legal)
    quote_order=FactoryCpqQuote(id=f"quote-order-{project_id}",**scope,quote_number=f"CPQ-ORDER-{project_id}",account_reference=f"ACCOUNT-{project_id}",currency="USD",exchange_rate=Decimal("1"),valid_until=now+timedelta(days=30),lines_json="[]",subtotal=Decimal("25000"),cost_total=Decimal("17000"),gross_margin_percent=Decimal("32"),status="accepted",order_intent_id=f"intent-{project_id}",emitted_events_json="[]",revision=5,created_at=now,updated_at=now);db.add(quote_order)
    order=FactoryFulfillmentOrder(id=f"order-{project_id}",**scope,order_number=f"OMS-{project_id}",quote_id=quote_order.id,quote_number=quote_order.quote_number,order_intent_id=f"order-intent-{project_id}",account_reference=quote_order.account_reference,currency="USD",exchange_rate=Decimal("1"),lines_json="[]",order_total=Decimal("25000"),status="confirmed",authority_source="factory-oms",validation_json="{}",fulfillment_evidence_json="[]",emitted_events_json="[]",confirmed_by="order-reviewer",confirmed_at=now,revision=2,updated_by="order-reviewer",created_at=now,updated_at=now);db.add(order);await db.flush()
    identity=FactoryIdentityResolutionService(db);consent=await identity.create_consent(project_id=project_id,context=ctx,actor="privacy-owner",subject_reference=f"CONTACT-{project_id}",account_reference=quote_order.account_reference,consent_reference=f"CONSENT-{project_id}",lawful_basis="consent",purposes=["customer-identity"],expires_at=now+timedelta(days=365));consent=await identity.approve_consent(consent["id"],project_id=project_id,actor="privacy-reviewer",expected_revision=1,reference="DPO")
    signals=[]
    for kind,raw,hint in (("account",quote_order.account_reference,"acct"),("email",f"buyer-{project_id}@example.test","mail")):
        item=await identity.add_signal(project_id=project_id,context=ctx,actor="identity-capture",consent_id=consent["id"],signal_type=kind,identifier_hash=digest(raw),display_hint=hint,source_type="consent-event",source_reference=consent["consent_reference"],source_revision=consent["revision"],source_fingerprint=consent["source_event_hash"]);signals.append(await identity.verify_signal(item["id"],project_id=project_id,actor="identity-reviewer",expected_revision=1,reference=f"VERIFY-{kind}"))
    match=await identity.propose_match(project_id=project_id,context=ctx,actor="identity-analyst",account_reference=quote_order.account_reference,signal_ids=[x["id"] for x in signals],match_method="deterministic",match_score=100,reasons=["same governed account"]);match=await identity.decide_match(match["id"],project_id=project_id,actor="identity-steward",expected_revision=1,decision="approved",reference="MATCH-APPROVED");profile=await identity.create_profile(match["id"],project_id=project_id,context=ctx,actor="profile-author");published=await identity.publish_profile(profile["id"],project_id=project_id,context=ctx,actor="profile-publisher",expected_revision=1,consumers=["cdp"],remote_reference_prefix="PROFILE")
    return {"legal-party":legal.id,"legal-quote":quote_legal.id,"order-quote":quote_order.id,"fulfillment-order":order.id,"golden-profile":published["profile"]["id"],"identity-signal":next(x["id"] for x in signals if x["signal_type"]=="email")}


def test_account_graph_publishes_real_enterprise_contact_opportunity_and_order_relations():
    async def scenario():
        engine=create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine,expire_on_commit=False)() as db:
            ctx=context();refs=await sources(db,ctx);service=FactoryAccountGraphService(db);graph=await service.create_graph(project_id=67,context=ctx,actor="graph-author",graph_code="GLOBAL-ACCOUNT",graph_name="Global account relationship graph",scope="account-360");nodes={}
            for label,source_type,source_id in (("legal","legal-party",refs["legal-party"]),("legal_quote","cpq-quote",refs["legal-quote"]),("account","golden-profile",refs["golden-profile"]),("contact","identity-signal",refs["identity-signal"]),("order_quote","cpq-quote",refs["order-quote"]),("order","fulfillment-order",refs["fulfillment-order"])):
                node=await service.add_node(graph["id"],project_id=67,context=ctx,actor="graph-curator",source_type=source_type,source_id=source_id);nodes[label]=await service.verify_node(node["id"],project_id=67,actor="graph-reviewer",expected_revision=1,reference=f"VERIFY-{label}")
            edges=[]
            for left,right,relation in (("legal","legal_quote","has-opportunity"),("account","contact","contact-at"),("order_quote","order","fulfills")):
                edge=await service.add_edge(graph["id"],project_id=67,context=ctx,actor="relation-author",from_node_id=nodes[left]["id"],to_node_id=nodes[right]["id"],relation_type=relation,strength="strong",evidence_reference=f"RELATION-{relation}");edges.append(await service.verify_edge(edge["id"],project_id=67,actor="relation-reviewer",expected_revision=1,reference=f"VERIFY-{relation}"))
            with pytest.raises(ValueError,match="independent publisher"):await service.publish_graph(graph["id"],project_id=67,context=ctx,actor="graph-author",expected_revision=1,consumers=["crm"],delivery_reference_prefix="SELF")
            result=await service.publish_graph(graph["id"],project_id=67,context=ctx,actor="graph-publisher",expected_revision=1,consumers=["crm","cdp","sales","service"],delivery_reference_prefix="ACCOUNT-GRAPH-V1")
            for item in result["publications"]:await service.acknowledge_publication(item["id"],project_id=67,actor="consumer-owner",expected_revision=1,reference=f"ACK-{item['consumer']}")
            workspace=await service.list_workspace(project_id=67);assert workspace["metrics"]=={"verified_nodes":6,"source_type_coverage_percent":100.0,"verified_edges":3,"relation_verification_percent":100.0,"published_versions":1,"handoff_acknowledgement_percent":100.0};assert result["version"]["node_count"]==6 and result["version"]["edge_count"]==3;assert all(x["consumer_mutated"] is False for x in result["publications"]);assert (await service.list_workspace(project_id=68))["graphs"]==[]
        await engine.dispose()
    asyncio.run(scenario())


def test_account_graph_blocks_self_verification_wrong_semantics_and_source_drift():
    async def scenario():
        engine=create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine,expire_on_commit=False)() as db:
            ctx=context(68);refs=await sources(db,ctx,68);service=FactoryAccountGraphService(db);graph=await service.create_graph(project_id=68,context=ctx,actor="author",graph_code="DRIFT",graph_name="Drift graph",scope="account-360");legal=await service.add_node(graph["id"],project_id=68,context=ctx,actor="curator",source_type="legal-party",source_id=refs["legal-party"])
            with pytest.raises(ValueError,match="independent"):await service.verify_node(legal["id"],project_id=68,actor="curator",expected_revision=1,reference="SELF")
            legal=await service.verify_node(legal["id"],project_id=68,actor="reviewer",expected_revision=1,reference="VERIFY");contact=await service.add_node(graph["id"],project_id=68,context=ctx,actor="curator",source_type="identity-signal",source_id=refs["identity-signal"]);contact=await service.verify_node(contact["id"],project_id=68,actor="reviewer",expected_revision=1,reference="VERIFY-CONTACT")
            with pytest.raises(ValueError,match="endpoint types"):await service.add_edge(graph["id"],project_id=68,context=ctx,actor="curator",from_node_id=legal["id"],to_node_id=contact["id"],relation_type="contact-at",strength="strong",evidence_reference="WRONG")
            source=await service._get(FactoryLegalParty,refs["legal-party"],68,"Legal party");source.legal_name="Changed without graph review";source.revision+=1;await db.flush()
            quote=await service.add_node(graph["id"],project_id=68,context=ctx,actor="curator",source_type="cpq-quote",source_id=refs["legal-quote"]);quote=await service.verify_node(quote["id"],project_id=68,actor="reviewer",expected_revision=1,reference="VERIFY-QUOTE")
            with pytest.raises(ValueError,match="drifted"):await service.add_edge(graph["id"],project_id=68,context=ctx,actor="curator",from_node_id=legal["id"],to_node_id=quote["id"],relation_type="has-opportunity",strength="strong",evidence_reference="DRIFT")
        await engine.dispose()
    asyncio.run(scenario())
