import asyncio
from datetime import datetime,timedelta,timezone
import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker,create_async_engine
import models  # noqa
from core.database import Base
from core.tenant_context import build_tenant_context
from models.factory_contract import FactoryCoreEventContract,FactoryCoreObjectContract
from services.factory_brand import FactoryBrandService
def ctx(p):return build_tenant_context(agent_path=f"hq/brand-{p}",tenant_id=f"tenant-{p}",client_id=f"client-{p}",plan_id=f"plan-{p}")
async def contracts(db):
 db.add_all([FactoryCoreObjectContract(id="brand-profile",sequence=26,label="Brand",system_of_record="identity",identity_rule="tenant",minimum_fields_json="[]",lifecycle_status="frozen",schema_version=1,revision=1),FactoryCoreEventContract(id="brand-released",sequence=18,label="Released",subject_id="brand-profile",producer="identity",consumers_json="[]",required_fields_json="[]",compatibility="backward",lifecycle_status="frozen",schema_version=1,revision=1)]);await db.flush()
async def draft(s,p,c):return await s.create_profile(project_id=p,context=c,actor="author",brand_name="ForgeFlow",market_scope="global",audience="Industrial automation buyers",positioning="Reliable flexible automation",value_promise="Proven throughput and support",tone="expert and practical",visual_tokens={"primary":"#0f766e","font":"Inter"},messaging={"headline":"Automation with evidence"})
def test_brand_closes_positioning_to_available_release():
 async def scenario():
  engine=create_async_engine("sqlite+aiosqlite:///:memory:")
  async with engine.begin() as con:await con.run_sync(Base.metadata.create_all)
  async with async_sessionmaker(engine,expire_on_commit=False)() as db:
   await contracts(db);s=FactoryBrandService(db);c=ctx(501);out=await draft(s,501,c);p=out["profile"]
   for i in range(2):
    claim=await s.add_claim(p["id"],project_id=501,context=c,actor="author",claim_type="capability",claim_text=f"Validated capacity claim {i}",evidence_reference=f"CASE-{i}")
    if i==0:
     with pytest.raises(ValueError,match="independent verification"):await s.verify_claim(claim["id"],project_id=501,actor="author",expected_revision=1,verification_reference="SELF")
    await s.verify_claim(claim["id"],project_id=501,actor="reviewer",expected_revision=1,verification_reference=f"QA-{i}")
   with pytest.raises(ValueError,match="independent approval"):await s.approve_profile(p["id"],project_id=501,actor="author",expected_revision=1,approval_reference="SELF")
   p=await s.approve_profile(p["id"],project_id=501,actor="brand-owner",expected_revision=1,approval_reference="BRAND-QA")
   release=await s.prepare_release(p["id"],project_id=501,context=c,actor="release-manager",release_version="2026.08.1",support_owner="brand-ops",support_until=datetime.now(timezone.utc)+timedelta(days=180),customer_trial_reference="TRIAL",role_training_reference="TRAIN",issue_closure_reference="ISSUE",monitoring_reference="MON",rollback_reference="ROLLBACK")
   with pytest.raises(ValueError,match="independent approval"):await s.approve_release(release["id"],project_id=501,actor="release-manager",expected_revision=1,approval_reference="SELF")
   release=await s.approve_release(release["id"],project_id=501,actor="ga",expected_revision=1,approval_reference="GA")
   w=await s.workspace(project_id=501);assert release["available"] and w["availability"]["status"]=="available" and w["contract"]["website_published"] is False and len(w["evidence"])==8 and (await s.workspace(project_id=502))["profiles"]==[]
  await engine.dispose()
 asyncio.run(scenario())
def test_brand_blocks_changed_claim_evidence():
 async def scenario():
  engine=create_async_engine("sqlite+aiosqlite:///:memory:")
  async with engine.begin() as con:await con.run_sync(Base.metadata.create_all)
  async with async_sessionmaker(engine,expire_on_commit=False)() as db:
   await contracts(db);s=FactoryBrandService(db);c=ctx(503);p=(await draft(s,503,c))["profile"]
   x=await s.add_claim(p["id"],project_id=503,context=c,actor="author",claim_type="proof",claim_text="Proof",evidence_reference="REF");claim=await s._get(__import__("models.factory_brand",fromlist=["FactoryBrandClaim"]).FactoryBrandClaim,x["id"],503,"claim");claim.claim_text="changed";await db.flush()
   with pytest.raises(ValueError,match="unchanged evidence"):await s.verify_claim(x["id"],project_id=503,actor="reviewer",expected_revision=1,verification_reference="QA")
  await engine.dispose()
 asyncio.run(scenario())
