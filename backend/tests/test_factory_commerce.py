import asyncio,json
import inspect
from datetime import datetime,timedelta,timezone
from decimal import Decimal
import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker,create_async_engine
import models  # noqa:F401
from core.database import Base
from core.tenant_context import build_tenant_context
from models.factory_channel_feed import FactoryChannelListing
from models.factory_cpq import FactoryCpqQuote
from models.factory_fulfillment import FactoryFulfillmentOrder
from services.factory_commerce import FactoryCommerceService
from routers.factory_commerce import _run

def ctx(pid):return build_tenant_context(agent_path="hq/agency/client",tenant_id="tenant-commerce",client_id="client-commerce",plan_id=f"plan-{pid}")

def test_commerce_router_accepts_payment_method_without_executor_collision():
 bound=inspect.signature(_run).bind(None,None,None,95,"permission","action","target",object(),method="purchase-order")
 assert bound.arguments["kw"]["method"]=="purchase-order"
def quote(pid=95):
 now=datetime.now(timezone.utc);lines=[{"line_number":1,"product_reference":"ROBOT-CELL","sku_reference":"RC-01","quantity":"2","moq":"1","unit_price":"500.00","unit_cost":"300.00","lead_time_days":30,"line_total":"1000.00"}]
 return FactoryCpqQuote(id=f"cpq-commerce-{pid}",project_id=pid,agent_path="hq/agency/client",tenant_id="tenant-commerce",client_id="client-commerce",plan_id=f"plan-{pid}",quote_number=f"CPQ-COM-{pid}",account_reference="PRIVATE-BUYER",currency="USD",exchange_rate=1,valid_until=now+timedelta(days=30),lines_json=json.dumps(lines),subtotal=1000,cost_total=600,gross_margin_percent=40,status="accepted",approval_note="approved",order_intent_id=f"order-intent-commerce-{pid}",emitted_events_json="[]",revision=5,updated_by="sales",created_at=now,updated_at=now)

def test_commerce_b2b_closes_terms_payment_and_authoritative_oms_acknowledgement():
 async def scenario():
  engine=create_async_engine("sqlite+aiosqlite:///:memory:")
  async with engine.begin() as c:await c.run_sync(Base.metadata.create_all)
  async with async_sessionmaker(engine,expire_on_commit=False)() as db:
   q=quote();db.add(q);await db.flush();svc=FactoryCommerceService(db);c=ctx(95);checkout=await svc.create_checkout(project_id=95,context=c,actor="sales",commerce_mode="b2b",source_id=q.id,buyer_reference="BUYER-PRIVATE",quantity=1);acceptance=await svc.accept_terms(checkout["id"],project_id=95,context=c,actor="buyer",terms_version="TERMS-2026.1",locale="en-US",destination_country="US",fulfillment_mode="ocean",purchase_reference="PO-PRIVATE-95",acceptance_reference="BUYER-SIGN-95")
   with pytest.raises(ValueError,match="independent documented"):await svc.review_terms(acceptance["id"],project_id=95,actor="buyer",expected_revision=1,decision="approve",review_reference="SELF",review_note="self")
   acceptance=await svc.review_terms(acceptance["id"],project_id=95,actor="legal",expected_revision=1,decision="approve",review_reference="TERMS-QA",review_note="Terms and destination reviewed");payment=await svc.initiate_payment(checkout["id"],project_id=95,context=c,actor="buyer",method="purchase-order",processor_reference="PRIVATE-PO-TOKEN")
   with pytest.raises(ValueError,match="independent verification"):await svc.verify_payment(payment["id"],project_id=95,actor="buyer",expected_revision=1,verification_reference="SELF")
   payment=await svc.verify_payment(payment["id"],project_id=95,actor="finance",expected_revision=1,verification_reference="PO-VERIFIED");handoff=await svc.submit_order(checkout["id"],project_id=95,context=c,actor="sales",delivery_reference="OMS-QUEUE-95")
   now=datetime.now(timezone.utc);order=FactoryFulfillmentOrder(id="order-commerce-95",project_id=95,agent_path=c.agent_path,tenant_id=c.tenant_id,client_id=c.client_id,plan_id=c.plan_id,order_number="SO-COM-95",quote_id=q.id,quote_number=q.quote_number,order_intent_id=q.order_intent_id,account_reference=q.account_reference,currency=q.currency,exchange_rate=q.exchange_rate,lines_json=q.lines_json,order_total=q.subtotal,status="confirmed",authority_source="factory-oms",validation_json="{}",fulfillment_evidence_json="[]",emitted_events_json="[]",confirmed_by="oms",confirmed_at=now,revision=2,updated_by="oms",created_at=now,updated_at=now);db.add(order);await db.flush()
   with pytest.raises(ValueError,match="independent acknowledgement"):await svc.acknowledge_order(handoff["id"],project_id=95,actor="sales",expected_revision=1,decision="confirmed",authority_system="factory-oms",authority_reference="OMS-ACK",authoritative_order_id=order.id)
   await svc.acknowledge_order(handoff["id"],project_id=95,actor="oms",expected_revision=1,decision="confirmed",authority_system="factory-oms",authority_reference="OMS-ACK",authoritative_order_id=order.id);w=await svc.list_workspace(project_id=95);assert w["metrics"]=={"checkouts":1,"b2b_checkouts":1,"b2c_checkouts":0,"terms_review_percent":100.0,"payment_verification_percent":100.0,"order_confirmation_percent":100.0};assert w["contract"]["payment_charge_created"] is False and w["contract"]["checkout_direct_order_confirmation"] is False and q.revision==5;assert (await svc.list_workspace(project_id=96))["checkouts"]==[]
  await engine.dispose()
 asyncio.run(scenario())

def test_commerce_supports_b2c_connector_facts_and_blocks_source_drift():
 async def scenario():
  engine=create_async_engine("sqlite+aiosqlite:///:memory:")
  async with engine.begin() as c:await c.run_sync(Base.metadata.create_all)
  async with async_sessionmaker(engine,expire_on_commit=False)() as db:
   now=datetime.now(timezone.utc);l=FactoryChannelListing(id="listing-commerce-96",project_id=96,agent_path="hq/agency/client",tenant_id="tenant-commerce",client_id="client-commerce",plan_id="plan-96",listing_number="CHL-COM-96",catalog_id="catalog",catalog_number="CHC",account_id="account",account_number="CHA",external_sku="SKU-96",product_name="Robot Cell",product_identifier="ROBOT-CELL",source_product_hash="a"*64,price_mode="connector-reference",price_amount=Decimal("25.00"),currency="USD",price_reference="PRICE-AUTH",inventory_mode="connector-reference",availability_status="in_stock",inventory_reference="STOCK-AUTH",channel_attributes_json={"title":"Robot Cell"},status="validated",created_by="catalog",validated_by="reviewer",revision=2,created_at=now);db.add(l);await db.flush();svc=FactoryCommerceService(db);checkout=await svc.create_checkout(project_id=96,context=ctx(96),actor="commerce",commerce_mode="b2c",source_id=l.id,buyer_reference="CONSUMER-PRIVATE",quantity=Decimal("2"));assert checkout["subtotal"]=="50.00";l.revision=3;await db.flush()
   with pytest.raises(ValueError,match="source changed"):await svc.accept_terms(checkout["id"],project_id=96,context=ctx(96),actor="buyer",terms_version="T1",locale="en-US",destination_country="US",fulfillment_mode="parcel",purchase_reference="ORDER-REF",acceptance_reference="CLICKWRAP")
  await engine.dispose()
 asyncio.run(scenario())
