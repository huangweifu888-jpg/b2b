import asyncio,hashlib,json
from datetime import datetime,timedelta,timezone
import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker,create_async_engine
import models  # noqa:F401
from core.database import Base
from core.tenant_context import build_tenant_context
from models.factory_customer_timeline import FactoryCustomerTimeline,FactoryCustomerTimelineEvent,FactoryCustomerTimelineVersion
from services.factory_identity_resolution import FactoryIdentityResolutionService
from services.factory_segments_consent import FactorySegmentsConsentService
def context(pid=72):return build_tenant_context(agent_path=f"hq/client-segment-{pid}",tenant_id=f"tenant-segment-{pid}",client_id=f"client-segment-{pid}",plan_id=f"plan-{pid}")
def scope(c,p):return dict(project_id=p,agent_path=c.agent_path,tenant_id=c.tenant_id,client_id=c.client_id,plan_id=c.plan_id)
def digest(x):return hashlib.sha256(json.dumps(x,ensure_ascii=False,sort_keys=True,separators=(",",":"),default=str).encode()).hexdigest()
async def sources(db,c,pid=72):
 now=datetime.now(timezone.utc);s=scope(c,pid);account=f"SEGMENT-BUYER-{pid}";identity=FactoryIdentityResolutionService(db);consent=await identity.create_consent(project_id=pid,context=c,actor="privacy-owner",subject_reference=f"CONTACT-{pid}",account_reference=account,consent_reference=f"CONSENT-{pid}",lawful_basis="consent",purposes=["segment-activation","service-personalization"],expires_at=now+timedelta(days=365));consent=await identity.approve_consent(consent["id"],project_id=pid,actor="privacy-reviewer",expected_revision=1,reference="DPO")
 signal=await identity.add_signal(project_id=pid,context=c,actor="capture",consent_id=consent["id"],signal_type="contact",identifier_hash=hashlib.sha256(f"contact-{pid}".encode()).hexdigest(),display_hint="buyer",source_type="consent-event",source_reference=consent["consent_reference"],source_revision=consent["revision"],source_fingerprint=consent["source_event_hash"]);signal=await identity.verify_signal(signal["id"],project_id=pid,actor="contact-reviewer",expected_revision=1,reference="CONTACT-VERIFY")
 timeline=FactoryCustomerTimeline(id=f"timeline-{pid}",**s,timeline_number=f"CTL-{pid}",timeline_name="Published journey",account_reference=account,scope="customer-360",status="published",authored_by="timeline-author",published_by="timeline-publisher",published_at=now,revision=2,created_at=now,updated_at=now);db.add(timeline);manifest={"timeline":timeline.timeline_number,"account":account};version=FactoryCustomerTimelineVersion(id=f"timeline-version-{pid}",**s,version_reference=f"CTV-{pid}",timeline_id=timeline.id,timeline_number=timeline.timeline_number,version_number=1,manifest_json=manifest,manifest_hash=digest(manifest),event_count=5,source_type_count=5,high_intent_event_count=3,status="published",published_by="timeline-publisher",published_at=now);db.add(version)
 for i,kind in enumerate(("marketing-touchpoint","inquiry-flow","cpq-quote","fulfillment-order","service-ticket")):
  snap={"kind":kind,"revision":1};db.add(FactoryCustomerTimelineEvent(id=f"event-{pid}-{i}",**s,event_number=f"CTE-{pid}-{i}",timeline_id=timeline.id,timeline_number=timeline.timeline_number,account_reference=account,event_type=f"{kind}-activity",occurred_at=now+timedelta(minutes=i),intent_level="high" if i in {1,2,3} else "medium",source_type=kind,source_id=f"source-{pid}-{i}",source_number=f"SRC-{pid}-{i}",source_revision=1,source_status="active",source_fingerprint=digest(snap),source_snapshot_json=snap,status="verified",created_by="event-curator",verified_by="event-reviewer",verified_at=now,verification_reference="VERIFY",revision=2,created_at=now))
 await db.flush();return account,signal,consent
def test_segments_consent_publishes_verified_member_and_acknowledges():
 async def scenario():
  engine=create_async_engine("sqlite+aiosqlite:///:memory:")
  async with engine.begin() as x:await x.run_sync(Base.metadata.create_all)
  async with async_sessionmaker(engine,expire_on_commit=False)() as db:
   c=context();_,signal,_=await sources(db,c);svc=FactorySegmentsConsentService(db);segment=await svc.create_segment(project_id=72,context=c,actor="segment-author",segment_code="HIGH-INTENT",segment_name="High intent factories",business_purpose="Coordinate consented complex sales",allowed_channels=["crm","marketing","ads","service"]);rule=await svc.create_rule(segment["id"],project_id=72,context=c,actor="rule-author",rule_code="INTENT-3",rule_name="Three high intent events",minimum_high_intent_events=3,required_source_types=["marketing-touchpoint","inquiry-flow","cpq-quote","fulfillment-order","service-ticket"],required_consent_purposes=["segment-activation"]);rule=await svc.approve_rule(rule["id"],project_id=72,actor="rule-reviewer",expected_revision=1,reference="RULE-APPROVAL");member=await svc.evaluate_membership(segment["id"],project_id=72,context=c,actor="segment-evaluator",rule_id=rule["id"],contact_signal_id=signal["id"]);member=await svc.verify_membership(member["id"],project_id=72,actor="segment-reviewer",expected_revision=1,reference="MEMBER-VERIFY")
   with pytest.raises(ValueError,match="independent publisher"):await svc.publish_segment(segment["id"],project_id=72,context=c,actor="segment-author",expected_revision=1,consumers=["crm"],delivery_reference_prefix="SELF")
   result=await svc.publish_segment(segment["id"],project_id=72,context=c,actor="segment-publisher",expected_revision=1,consumers=["crm","marketing","ads","service"],delivery_reference_prefix="SEGMENT-V1")
   for a in result["activations"]:await svc.acknowledge_activation(a["id"],project_id=72,actor="consumer-owner",expected_revision=1,reference=f"ACK-{a['consumer']}")
   w=await svc.list_workspace(project_id=72);assert w["metrics"]=={"active_segments":1,"verified_members":1,"consent_eligible_percent":100.0,"high_intent_members":1,"published_versions":1,"activation_acknowledgement_percent":100.0};assert (await svc.list_workspace(project_id=73))["segments"]==[]
  await engine.dispose()
 asyncio.run(scenario())
def test_segments_consent_blocks_self_review_rule_failure_and_revocation():
 async def scenario():
  engine=create_async_engine("sqlite+aiosqlite:///:memory:")
  async with engine.begin() as x:await x.run_sync(Base.metadata.create_all)
  async with async_sessionmaker(engine,expire_on_commit=False)() as db:
   c=context(73);_,signal,consent=await sources(db,c,73);svc=FactorySegmentsConsentService(db);segment=await svc.create_segment(project_id=73,context=c,actor="author",segment_code="STRICT",segment_name="Strict",business_purpose="Consented sales",allowed_channels=["crm"]);rule=await svc.create_rule(segment["id"],project_id=73,context=c,actor="rule-author",rule_code="TOO-HIGH",rule_name="Too high",minimum_high_intent_events=4,required_source_types=["cpq-quote"],required_consent_purposes=["segment-activation"])
   with pytest.raises(ValueError,match="independent"):await svc.approve_rule(rule["id"],project_id=73,actor="rule-author",expected_revision=1,reference="SELF")
   rule=await svc.approve_rule(rule["id"],project_id=73,actor="reviewer",expected_revision=1,reference="APPROVE")
   with pytest.raises(ValueError,match="does not satisfy"):await svc.evaluate_membership(segment["id"],project_id=73,context=c,actor="evaluator",rule_id=rule["id"],contact_signal_id=signal["id"])
   consent_row=await svc._get(__import__("models.factory_identity_resolution",fromlist=["FactoryIdentityConsent"]).FactoryIdentityConsent,consent["id"],73,"Consent");consent_row.status="revoked";await db.flush()
   with pytest.raises(ValueError,match="active pinned consent"):await svc._candidate(signal["id"],73)
  await engine.dispose()
 asyncio.run(scenario())
