import asyncio,hashlib,json
from datetime import datetime,timedelta,timezone
from decimal import Decimal
import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker,create_async_engine
import models  # noqa:F401
from core.database import Base
from core.tenant_context import build_tenant_context
from models.factory_cpq import FactoryCpqQuote
from models.factory_customer_timeline import FactoryCustomerTimeline,FactoryCustomerTimelineEvent,FactoryCustomerTimelineVersion
from models.factory_icp import FactoryIcpBuyingRole,FactoryIcpProfile,FactoryIcpVersion
from services.factory_abm import FactoryAbmService
from services.factory_buying_committee import FactoryBuyingCommitteeService
from services.factory_identity_resolution import FactoryIdentityResolutionService
from services.factory_segments_consent import FactorySegmentsConsentService
def context(pid=74):return build_tenant_context(agent_path=f"hq/client-abm-{pid}",tenant_id=f"tenant-abm-{pid}",client_id=f"client-abm-{pid}",plan_id=f"plan-{pid}")
def scope(c,p):return dict(project_id=p,agent_path=c.agent_path,tenant_id=c.tenant_id,client_id=c.client_id,plan_id=c.plan_id)
def digest(x):return hashlib.sha256((x if isinstance(x,str) else json.dumps(x,ensure_ascii=False,sort_keys=True,separators=(",",":"),default=str)).encode()).hexdigest()
async def sources(db,c,pid=74):
 now=datetime.now(timezone.utc);s=scope(c,pid);account=f"ABM-BUYER-{pid}";quote=FactoryCpqQuote(id=f"abm-quote-{pid}",**s,quote_number=f"ABM-CPQ-{pid}",account_reference=account,currency="USD",exchange_rate=Decimal("1.000000"),valid_until=now+timedelta(days=30),lines_json="[]",subtotal=Decimal("50000.00"),cost_total=Decimal("35000.00"),gross_margin_percent=Decimal("30.00"),status="accepted",order_intent_id=f"intent-{pid}",emitted_events_json="[]",revision=5,created_at=now,updated_at=now);db.add(quote)
 profile=FactoryIcpProfile(id=f"abm-icp-{pid}",**s,profile_number=f"ABM-ICP-{pid}",profile_code=f"ABM-ICP-{pid}",profile_name="ABM industrial buyers",market_mode="overseas",customer_type="b2b",objective="ABM roles",current_version=1,status="active",authored_by="icp-author",approved_by="icp-reviewer",approved_at=now,approval_reference="ICP-APPROVAL",revision=2,updated_by="icp-reviewer",created_at=now,updated_at=now);db.add(profile);version=FactoryIcpVersion(id=f"abm-icpv-{pid}",**s,version_reference=f"ABM-ICPV-{pid}",profile_id=profile.id,profile_number=profile.profile_number,version_number=1,countries_json=["US"],industries_json=["automation"],company_size_bands_json=["mid"],product_references_json=["ROBOT"],required_roles_json=["CFO","CTO","CHAMPION"],buying_triggers_json=["capacity"],minimum_potential_value=Decimal("10000"),currency="USD",scoring_weights_json={"fit":100},definition_hash=digest(f"definition-{pid}"),status="active",created_by="icp-author",created_at=now,activated_by="icp-reviewer",activated_at=now);db.add(version);roles=[]
 for i,(code,name,influence) in enumerate((("CFO","Economic buyer","economic-buyer"),("CTO","Technical buyer","technical-buyer"),("CHAMPION","Plant champion","champion")),1):
  role=FactoryIcpBuyingRole(id=f"abm-role-{pid}-{i}",**s,role_number=f"ABM-ICPR-{pid}-{i}",profile_id=profile.id,profile_number=profile.profile_number,role_code=code,role_name=name,influence_type=influence,pains_json=["risk"],proof_requirements_json=["ROI"],preferred_channels_json=["meeting"],created_by="icp-author",created_at=now);db.add(role);roles.append(role)
 await db.flush();identity=FactoryIdentityResolutionService(db);consent=await identity.create_consent(project_id=pid,context=c,actor="privacy-owner",subject_reference=f"ABM-COMMITTEE-{pid}",account_reference=account,consent_reference=f"ABM-CONSENT-{pid}",lawful_basis="consent",purposes=["abm-activation"],expires_at=now+timedelta(days=365));consent=await identity.approve_consent(consent["id"],project_id=pid,actor="privacy-reviewer",expected_revision=1,reference="DPO");signals=[]
 for i in range(3):
  item=await identity.add_signal(project_id=pid,context=c,actor="capture",consent_id=consent["id"],signal_type="contact",identifier_hash=digest(f"abm-contact-{pid}-{i}"),display_hint=f"buyer{i+1}",source_type="consent-event",source_reference=consent["consent_reference"],source_revision=consent["revision"],source_fingerprint=consent["source_event_hash"]);signals.append(await identity.verify_signal(item["id"],project_id=pid,actor="contact-reviewer",expected_revision=1,reference=f"VERIFY-{i}"))
 timeline=FactoryCustomerTimeline(id=f"abm-timeline-{pid}",**s,timeline_number=f"ABM-CTL-{pid}",timeline_name="ABM journey",account_reference=account,scope="customer-360",status="published",authored_by="timeline-author",published_by="timeline-publisher",published_at=now,revision=2,created_at=now,updated_at=now);db.add(timeline);tm={"timeline":timeline.timeline_number,"account":account};tv=FactoryCustomerTimelineVersion(id=f"abm-timeline-version-{pid}",**s,version_reference=f"ABM-CTV-{pid}",timeline_id=timeline.id,timeline_number=timeline.timeline_number,version_number=1,manifest_json=tm,manifest_hash=digest(tm),event_count=5,source_type_count=5,high_intent_event_count=3,status="published",published_by="timeline-publisher",published_at=now);db.add(tv)
 for i,kind in enumerate(("marketing-touchpoint","inquiry-flow","cpq-quote","fulfillment-order","service-ticket")):
  snap={"kind":kind,"revision":1};db.add(FactoryCustomerTimelineEvent(id=f"abm-event-{pid}-{i}",**s,event_number=f"ABM-CTE-{pid}-{i}",timeline_id=timeline.id,timeline_number=timeline.timeline_number,account_reference=account,event_type=f"{kind}-activity",occurred_at=now+timedelta(minutes=i),intent_level="high" if i<3 else "medium",source_type=kind,source_id=f"abm-source-{pid}-{i}",source_number=f"ABM-SRC-{pid}-{i}",source_revision=1,source_status="active",source_fingerprint=digest(snap),source_snapshot_json=snap,status="verified",created_by="curator",verified_by="reviewer",verified_at=now,verification_reference="VERIFY",revision=2,created_at=now))
 await db.flush();buy=FactoryBuyingCommitteeService(db);committee=await buy.create_committee(project_id=pid,context=c,actor="committee-author",committee_name="ABM committee",opportunity_source_id=quote.id,icp_profile_id=profile.id);members=[]
 for i,(role,signal) in enumerate(zip(roles,signals)):
  m=await buy.add_member(committee["id"],project_id=pid,context=c,actor="member-author",role_id=role.id,contact_signal_id=signal["id"],influence_score=90-i*10,relationship_strength="strong",stance="supportive",preferred_channel="meeting",evidence_reference=f"DISCOVERY-{i}");members.append(await buy.verify_member(m["id"],project_id=pid,actor="member-reviewer",expected_revision=1,reference=f"MEMBER-{i}"))
 for i in range(2):
  e=await buy.add_influence(committee["id"],project_id=pid,context=c,actor="edge-author",from_member_id=members[i]["id"],to_member_id=members[i+1]["id"],influence_direction="influences",strength="strong",evidence_reference=f"EDGE-{i}");await buy.verify_influence(e["id"],project_id=pid,actor="edge-reviewer",expected_revision=1,reference=f"EDGE-VERIFY-{i}")
 published_committee=await buy.publish_committee(committee["id"],project_id=pid,context=c,actor="committee-publisher",expected_revision=1,consumers=["crm"],delivery_reference_prefix="COMMITTEE")
 seg=FactorySegmentsConsentService(db);segment=await seg.create_segment(project_id=pid,context=c,actor="segment-author",segment_code=f"ABM-{pid}",segment_name="ABM consented buyers",business_purpose="Coordinate consented account-based marketing",allowed_channels=["crm","marketing","ads","service"]);rule=await seg.create_rule(segment["id"],project_id=pid,context=c,actor="rule-author",rule_code="ABM-CONSENT",rule_name="ABM consent and journey",minimum_high_intent_events=1,required_source_types=["marketing-touchpoint","inquiry-flow","cpq-quote","fulfillment-order","service-ticket"],required_consent_purposes=["abm-activation"]);rule=await seg.approve_rule(rule["id"],project_id=pid,actor="rule-reviewer",expected_revision=1,reference="RULE")
 for signal in signals:
  m=await seg.evaluate_membership(segment["id"],project_id=pid,context=c,actor="evaluator",rule_id=rule["id"],contact_signal_id=signal["id"]);await seg.verify_membership(m["id"],project_id=pid,actor="membership-reviewer",expected_revision=1,reference="MEMBER")
 published_segment=await seg.publish_segment(segment["id"],project_id=pid,context=c,actor="segment-publisher",expected_revision=1,consumers=["crm"],delivery_reference_prefix="SEGMENT")
 return published_segment["segment"],published_committee["committee"],members,consent
def test_abm_publishes_consent_safe_complete_role_coverage_and_acknowledges():
 async def scenario():
  engine=create_async_engine("sqlite+aiosqlite:///:memory:")
  async with engine.begin() as x:await x.run_sync(Base.metadata.create_all)
  async with async_sessionmaker(engine,expire_on_commit=False)() as db:
   c=context();segment,committee,members,_=await sources(db,c);svc=FactoryAbmService(db);program=await svc.create_program(project_id=74,context=c,actor="program-author",program_code="STRATEGIC-ABM",program_name="Strategic factory accounts",business_objective="Coordinate marketing and sales by buying role",allowed_consumers=["crm","marketing","ads","sales"]);target=await svc.add_target(program["id"],project_id=74,context=c,actor="target-curator",audience_segment_id=segment["id"],buying_committee_id=committee["id"],priority_tier="tier-1",fit_score=92);target=await svc.verify_target(target["id"],project_id=74,actor="target-reviewer",expected_revision=1,reference="TARGET-VERIFY");plays=[]
   for i,m in enumerate(members,1):
    p=await svc.add_role_play(target["id"],project_id=74,context=c,actor="play-author",committee_member_id=m["id"],owner_team="sales" if i<3 else "marketing",channel="meeting",action_code=f"ROLE-{i}",message_intent=f"Address {m['role_name']} decision criteria",success_signal="Verified stakeholder response",sequence_order=i);plays.append(await svc.approve_role_play(p["id"],project_id=74,actor="play-reviewer",expected_revision=1,reference=f"PLAY-{i}"))
   with pytest.raises(ValueError,match="independent publisher"):await svc.publish_program(program["id"],project_id=74,context=c,actor="program-author",expected_revision=1,consumers=["crm"],delivery_reference_prefix="SELF")
   result=await svc.publish_program(program["id"],project_id=74,context=c,actor="program-publisher",expected_revision=1,consumers=["crm","marketing","ads","sales"],delivery_reference_prefix="ABM-V1")
   for a in result["activations"]:await svc.acknowledge_activation(a["id"],project_id=74,actor="consumer-owner",expected_revision=1,reference=f"ACK-{a['consumer']}")
   w=await svc.list_workspace(project_id=74);assert w["metrics"]=={"active_programs":1,"verified_accounts":1,"role_coverage_percent":100.0,"approved_role_plays":3,"published_versions":1,"activation_acknowledgement_percent":100.0};assert result["version"]["role_coverage_percent"]==100.0 and (await svc.list_workspace(project_id=75))["programs"]==[]
  await engine.dispose()
 asyncio.run(scenario())
def test_abm_blocks_self_review_incomplete_roles_and_consent_revocation():
 async def scenario():
  engine=create_async_engine("sqlite+aiosqlite:///:memory:")
  async with engine.begin() as x:await x.run_sync(Base.metadata.create_all)
  async with async_sessionmaker(engine,expire_on_commit=False)() as db:
   c=context(75);segment,committee,members,consent=await sources(db,c,75);svc=FactoryAbmService(db);program=await svc.create_program(project_id=75,context=c,actor="author",program_code="STRICT",program_name="Strict",business_objective="Strict consent",allowed_consumers=["crm"]);target=await svc.add_target(program["id"],project_id=75,context=c,actor="target-author",audience_segment_id=segment["id"],buying_committee_id=committee["id"],priority_tier="tier-1",fit_score=90)
   with pytest.raises(ValueError,match="independent"):await svc.verify_target(target["id"],project_id=75,actor="target-author",expected_revision=1,reference="SELF")
   target=await svc.verify_target(target["id"],project_id=75,actor="reviewer",expected_revision=1,reference="VERIFY");p=await svc.add_role_play(target["id"],project_id=75,context=c,actor="play-author",committee_member_id=members[0]["id"],owner_team="sales",channel="meeting",action_code="ONE",message_intent="One role only",success_signal="Response",sequence_order=1);p=await svc.approve_role_play(p["id"],project_id=75,actor="play-reviewer",expected_revision=1,reference="APPROVE")
   with pytest.raises(ValueError,match="Every verified"):await svc.publish_program(program["id"],project_id=75,context=c,actor="publisher",expected_revision=1,consumers=["crm"],delivery_reference_prefix="INCOMPLETE")
   consent_row=await svc._get(__import__("models.factory_identity_resolution",fromlist=["FactoryIdentityConsent"]).FactoryIdentityConsent,consent["id"],75,"Consent");consent_row.status="revoked";await db.flush()
   with pytest.raises(ValueError,match="active pinned consent"):await svc._validate_target(await svc._get(__import__("models.factory_abm",fromlist=["FactoryAbmTargetAccount"]).FactoryAbmTargetAccount,target["id"],75,"Target"))
  await engine.dispose()
 asyncio.run(scenario())
