import asyncio,hashlib,json
import pytest
from datetime import datetime,timezone
from sqlalchemy.ext.asyncio import create_async_engine,async_sessionmaker
from core.database import Base
from core.tenant_context import build_tenant_context
from models.factory_identity_resolution import FactoryGoldenProfile,FactoryGoldenProfileVersion
from models.factory_customer_timeline import FactoryCustomerTimeline,FactoryCustomerTimelineVersion
from models.factory_segments_consent import FactoryAudienceSegmentVersion
from services.factory_cdp import FactoryCdpService
def h(x):return hashlib.sha256(json.dumps(x,sort_keys=True,separators=(',',':')).encode()).hexdigest()
def ctx(p):return dict(project_id=p,agent_path=f"hq/cdp-{p}",tenant_id=f"tenant-{p}",client_id=f"client-{p}",plan_id=f"plan-{p}")
async def sources(db,p=91):
 c=ctx(p);now=datetime.now(timezone.utc);profile=FactoryGoldenProfile(id=f"profile-{p}",**c,profile_number=f"P-{p}",account_reference="ACME",match_case_id="match",match_case_number="M",member_signal_ids_json=[],source_manifest_json={},source_manifest_hash=h({}),status="published",authored_by="author",published_by="review",published_at=now,revision=2,created_at=now,updated_at=now);pv=FactoryGoldenProfileVersion(id=f"pv-{p}",**c,version_number_ref=f"PV-{p}",profile_id=profile.id,profile_number=profile.profile_number,version_number=1,manifest_json={"profile":"ACME"},manifest_hash=h({"profile":"ACME"}),status="published",published_by="review",published_at=now);timeline=FactoryCustomerTimeline(id=f"timeline-{p}",**c,timeline_number=f"T-{p}",timeline_name="ACME journey",account_reference="ACME",scope="customer-360",status="published",authored_by="author",published_by="review",published_at=now,revision=2,created_at=now,updated_at=now);tv=FactoryCustomerTimelineVersion(id=f"tv-{p}",**c,version_reference=f"TV-{p}",timeline_id=timeline.id,timeline_number=timeline.timeline_number,version_number=1,manifest_json={"journey":"ACME"},manifest_hash=h({"journey":"ACME"}),event_count=5,source_type_count=5,high_intent_event_count=3,status="published",published_by="review",published_at=now);sm={"segment":"consented","members":[{"account_reference":"ACME"}]};sv=FactoryAudienceSegmentVersion(id=f"sv-{p}",**c,version_reference=f"SV-{p}",segment_id=f"seg-{p}",segment_number=f"S-{p}",version_number=1,manifest_json=sm,manifest_hash=h(sm),member_count=1,status="published",published_by="review",published_at=now);db.add_all([profile,pv,timeline,tv,sv]);await db.flush();return pv,tv,sv
def test_cdp_requires_independent_approval_release_and_consumer_receipts():
 async def go():
  e=create_async_engine("sqlite+aiosqlite:///:memory:");
  async with e.begin() as c:await c.run_sync(Base.metadata.create_all)
  async with async_sessionmaker(e,expire_on_commit=False)() as db:
   pv,tv,sv=await sources(db);service=FactoryCdpService(db);c=build_tenant_context(agent_path="hq/cdp-91",tenant_id="tenant-91",client_id="client-91",plan_id="plan-91");x=await service.create_product(project_id=91,context=c,actor="author",product_key="ACME-360",profile_version_id=pv.id,timeline_version_id=tv.id,segment_version_id=sv.id)
   with pytest.raises(ValueError,match="independent approval"):await service.approve_product(x["id"],project_id=91,actor="author",expected_revision=1,reference="SELF")
   x=await service.approve_product(x["id"],project_id=91,actor="reviewer",expected_revision=1,reference="APPROVE")
   with pytest.raises(ValueError,match="independent release"):await service.publish_product(x["id"],project_id=91,context=c,actor="reviewer",expected_revision=2,consumers=["crm"])
   r=await service.publish_product(x["id"],project_id=91,context=c,actor="publisher",expected_revision=2,consumers=["crm","service"])
   for item in r["publications"]:await service.acknowledge_publication(item["id"],project_id=91,actor="consumer",expected_revision=1,reference="RECEIPT")
   w=await service.list_workspace(project_id=91);assert w["metrics"]=={"released_products":1,"consumer_receipt_percent":100.0};assert w["contract"]["source_records_copied"] is False;assert [(item["account_reference"],item["segment_version_id"]) for item in w["sources"]]==[("ACME",sv.id)];assert (await service.list_workspace(project_id=92))["products"]==[]
  await e.dispose()
 asyncio.run(go())
def test_cdp_blocks_release_when_a_pinned_source_drifts():
 async def go():
  e=create_async_engine("sqlite+aiosqlite:///:memory:")
  async with e.begin() as c:await c.run_sync(Base.metadata.create_all)
  async with async_sessionmaker(e,expire_on_commit=False)() as db:
   pv,tv,sv=await sources(db,93);service=FactoryCdpService(db);c=build_tenant_context(agent_path="hq/cdp-93",tenant_id="tenant-93",client_id="client-93",plan_id="plan-93");x=await service.create_product(project_id=93,context=c,actor="author",product_key="DRIFT",profile_version_id=pv.id,timeline_version_id=tv.id,segment_version_id=sv.id);x=await service.approve_product(x["id"],project_id=93,actor="reviewer",expected_revision=1,reference="APPROVE");sv.status="draft";await db.flush()
   with pytest.raises(ValueError,match="source versions drifted"):await service.publish_product(x["id"],project_id=93,context=c,actor="publisher",expected_revision=2,consumers=["crm"])
  await e.dispose()
 asyncio.run(go())
def test_cdp_requires_a_segment_with_a_member_for_the_same_account():
 async def go():
  e=create_async_engine("sqlite+aiosqlite:///:memory:")
  async with e.begin() as c:await c.run_sync(Base.metadata.create_all)
  async with async_sessionmaker(e,expire_on_commit=False)() as db:
   pv,tv,sv=await sources(db,94);service=FactoryCdpService(db);c=build_tenant_context(agent_path="hq/cdp-94",tenant_id="tenant-94",client_id="client-94",plan_id="plan-94");manifest={"segment":"consented","members":[{"account_reference":"OTHER-ACCOUNT"}]};sv.manifest_json=manifest;sv.manifest_hash=h(manifest);await db.flush()
   with pytest.raises(ValueError,match="account-consented"):await service.create_product(project_id=94,context=c,actor="author",product_key="WRONG-SEGMENT",profile_version_id=pv.id,timeline_version_id=tv.id,segment_version_id=sv.id)
  await e.dispose()
 asyncio.run(go())
