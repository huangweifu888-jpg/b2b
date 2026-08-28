import asyncio,hashlib
from datetime import datetime,timedelta,timezone
from decimal import Decimal
import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker,create_async_engine
import models  # noqa:F401
from core.database import Base
from core.tenant_context import build_tenant_context
from models.factory_cpq import FactoryCpqQuote
from models.factory_customer_asset import FactoryAssetServiceTicket,FactoryCustomerAsset
from models.factory_fulfillment import FactoryFulfillmentOrder
from models.factory_revenue import FactoryRevenueFlowRun
from models.factory_revenue_profit import FactoryAttributionTouchpoint
from services.factory_customer_timeline import FactoryCustomerTimelineService
def context(pid=70):return build_tenant_context(agent_path=f"hq/client-timeline-{pid}",tenant_id=f"tenant-timeline-{pid}",client_id=f"client-timeline-{pid}",plan_id=f"plan-{pid}")
def scope(ctx,pid):return dict(project_id=pid,agent_path=ctx.agent_path,tenant_id=ctx.tenant_id,client_id=ctx.client_id,plan_id=ctx.plan_id)
async def sources(db,ctx,pid=70):
    now=datetime.now(timezone.utc);s=scope(ctx,pid);account=f"TIMELINE-BUYER-{pid}"
    touch=FactoryAttributionTouchpoint(id=f"touch-{pid}",**s,touchpoint_number=f"TOUCH-{pid}",external_event_reference=f"WEB-{pid}",correlation_id=f"CORR-{pid}",account_reference=account,channel="website",campaign_reference="organic",content_reference="case-study",occurred_at=now-timedelta(days=5),spend_amount=Decimal("0"),currency="USD",consent_reference=f"CONSENT-{pid}",evidence_fingerprint=hashlib.sha256(f"touch-{pid}".encode()).hexdigest(),recorded_by="marketing",created_at=now-timedelta(days=5));db.add(touch)
    flow=FactoryRevenueFlowRun(id=f"flow-{pid}",**s,correlation_id=f"INQUIRY-{pid}",product_reference="ROBOT",account_reference=account,currency="USD",quoted_amount=Decimal("50000"),ordered_amount=Decimal("50000"),invoiced_amount=Decimal("0"),paid_amount=Decimal("0"),current_stage="qualified-inquiry",emitted_events_json="[]",revision=2,updated_by="sales",created_at=now-timedelta(days=4),updated_at=now-timedelta(days=4));db.add(flow)
    quote=FactoryCpqQuote(id=f"quote-{pid}",**s,quote_number=f"CPQ-{pid}",account_reference=account,currency="USD",exchange_rate=Decimal("1"),valid_until=now+timedelta(days=30),lines_json="[]",subtotal=Decimal("50000"),cost_total=Decimal("35000"),gross_margin_percent=Decimal("30"),status="accepted",approval_note="approved",order_intent_id=f"intent-{pid}",emitted_events_json="[]",revision=3,created_at=now-timedelta(days=3),updated_at=now-timedelta(days=3));db.add(quote)
    order=FactoryFulfillmentOrder(id=f"order-{pid}",**s,order_number=f"OMS-{pid}",quote_id=quote.id,quote_number=quote.quote_number,order_intent_id=quote.order_intent_id,account_reference=account,currency="USD",exchange_rate=Decimal("1"),lines_json="[]",order_total=Decimal("50000"),status="confirmed",authority_source="factory-oms",validation_json="{}",fulfillment_evidence_json="[]",emitted_events_json="[]",confirmed_by="ops",confirmed_at=now-timedelta(days=2),revision=2,updated_by="ops",created_at=now-timedelta(days=2),updated_at=now-timedelta(days=2));db.add(order)
    asset=FactoryCustomerAsset(id=f"asset-{pid}",**s,asset_number=f"AST-{pid}",order_id=order.id,order_number=order.order_number,account_reference=account,product_reference="ROBOT",sku_reference="ROBOT-01",serial_number=f"SERIAL-{pid}",installation_location="Plant A",installed_at=now-timedelta(days=1),warranty_until=now+timedelta(days=365),next_service_due_at=now+timedelta(days=90),status="active",renewal_status="monitoring",service_count=1,last_service_at=now,emitted_events_json="[]",revision=1,created_at=now-timedelta(days=1),updated_at=now);db.add(asset)
    ticket=FactoryAssetServiceTicket(id=f"ticket-{pid}",**s,ticket_number=f"TKT-{pid}",asset_id=asset.id,asset_number=asset.asset_number,issue_summary="Commissioning follow-up",severity="medium",status="resolved",sla_due_at=now+timedelta(days=1),assigned_to="service",scheduled_for=now,resolution_reference="RESOLVED",resolution_note="Completed",emitted_events_json="[]",revision=2,updated_by="service",created_at=now,updated_at=now);db.add(ticket);await db.flush();return account,[touch,flow,quote,order,ticket]
def test_customer_timeline_publishes_five_source_journey_and_acknowledges():
    async def scenario():
        engine=create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as c:await c.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine,expire_on_commit=False)() as db:
            ctx=context();account,records=await sources(db,ctx);service=FactoryCustomerTimelineService(db);timeline=await service.create_timeline(project_id=70,context=ctx,actor="timeline-author",timeline_name="Full customer journey",account_reference=account);events=[]
            for kind,record in zip(("marketing-touchpoint","inquiry-flow","cpq-quote","fulfillment-order","service-ticket"),records):
                event=await service.add_event(timeline["id"],project_id=70,context=ctx,actor="event-curator",source_type=kind,source_id=record.id);events.append(await service.verify_event(event["id"],project_id=70,actor="event-reviewer",expected_revision=1,reference=f"VERIFY-{kind}"))
            await service.add_checkpoint(timeline["id"],project_id=70,context=ctx,actor="journey-owner",event_id=events[2]["id"],checkpoint_code="quote-accepted",note="Commercial intent confirmed")
            with pytest.raises(ValueError,match="independent publisher"):await service.publish_timeline(timeline["id"],project_id=70,context=ctx,actor="timeline-author",expected_revision=1,consumers=["crm"],delivery_reference_prefix="SELF")
            result=await service.publish_timeline(timeline["id"],project_id=70,context=ctx,actor="timeline-publisher",expected_revision=1,consumers=["crm","cdp","sales","service"],delivery_reference_prefix="TIMELINE-V1")
            for item in result["publications"]:await service.acknowledge_publication(item["id"],project_id=70,actor="consumer-owner",expected_revision=1,reference=f"ACK-{item['consumer']}")
            w=await service.list_workspace(project_id=70);assert w["metrics"]=={"verified_events":5,"source_coverage_percent":100.0,"high_intent_events":3,"journey_checkpoints":1,"published_versions":1,"handoff_acknowledgement_percent":100.0};assert result["version"]["event_count"]==5 and result["version"]["source_type_count"]==5;assert (await service.list_workspace(project_id=71))["timelines"]==[]
        await engine.dispose()
    asyncio.run(scenario())
def test_customer_timeline_blocks_self_verification_incomplete_publish_and_source_drift():
    async def scenario():
        engine=create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as c:await c.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine,expire_on_commit=False)() as db:
            ctx=context(71);account,records=await sources(db,ctx,71);service=FactoryCustomerTimelineService(db);timeline=await service.create_timeline(project_id=71,context=ctx,actor="author",timeline_name="Incomplete",account_reference=account);event=await service.add_event(timeline["id"],project_id=71,context=ctx,actor="curator",source_type="cpq-quote",source_id=records[2].id)
            with pytest.raises(ValueError,match="independent"):await service.verify_event(event["id"],project_id=71,actor="curator",expected_revision=1,reference="SELF")
            await service.verify_event(event["id"],project_id=71,actor="reviewer",expected_revision=1,reference="VERIFY")
            with pytest.raises(ValueError,match="five authority"):await service.publish_timeline(timeline["id"],project_id=71,context=ctx,actor="publisher",expected_revision=1,consumers=["crm"],delivery_reference_prefix="INCOMPLETE")
            records[2].status="expired";records[2].revision+=1;await db.flush()
            with pytest.raises(ValueError,match="drifted"):await service._validate_event(await service._get(__import__("models.factory_customer_timeline",fromlist=["FactoryCustomerTimelineEvent"]).FactoryCustomerTimelineEvent,event["id"],71,"Event"))
        await engine.dispose()
    asyncio.run(scenario())
