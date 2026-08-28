import asyncio
import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker,create_async_engine
import models  # noqa:F401
from core.database import Base
from core.tenant_context import build_tenant_context
from models.factory_contract import FactoryCoreEventContract,FactoryCoreObjectContract
from models.factory_search_share import FactorySearchShareSnapshot
from services.factory_search_share import FactorySearchShareService
def ctx(p):return build_tenant_context(agent_path=f"hq/search-share-{p}",tenant_id=f"tenant-{p}",client_id=f"client-{p}",plan_id=f"plan-{p}")
async def contracts(db):db.add_all([FactoryCoreObjectContract(id="search-share-performance-snapshot",sequence=36,label="Search share snapshot",system_of_record="trust",identity_rule="tenant",minimum_fields_json="[]",lifecycle_status="frozen",schema_version=1,revision=1),FactoryCoreEventContract(id="search-share-analysis-released",sequence=28,label="Search share released",subject_id="search-share-performance-snapshot",producer="trust",consumers_json="[]",required_fields_json="[]",compatibility="backward",lifecycle_status="frozen",schema_version=1,revision=1)]);await db.flush()
def test_search_share_closes_independent_performance_analysis_handoff():
 async def case():
  e=create_async_engine("sqlite+aiosqlite:///:memory:")
  async with e.begin()as c:await c.run_sync(Base.metadata.create_all)
  async with async_sessionmaker(e,expire_on_commit=False)()as db:
   await contracts(db);s=FactorySearchShareService(db);c=ctx(961);d=await s.create_dataset(project_id=961,context=c,actor="hq",source_reference="GSC-961",market="US",search_engine="google",device="desktop",observed_from="2026-07-01",observed_to="2026-07-31");p=await s.capture_snapshot(d["id"],project_id=961,context=c,actor="analyst",performance_manifest={"brand_share":0.12,"competitor_scope":["competitor-a"],"top10_keywords":8})
   with pytest.raises(ValueError,match="independent verification"):await s.verify_snapshot(p["id"],project_id=961,actor="analyst",expected_revision=1,verification_reference="SELF")
   p=await s.verify_snapshot(p["id"],project_id=961,actor="agency",expected_revision=1,verification_reference="VERIFY");r=await s.prepare_release(p["id"],project_id=961,context=c,actor="marketing",target="marketing-owner",analysis_manifest={"trend":"observed","single_action_causality_claimed":False},rollback_reference="ROLLBACK")
   with pytest.raises(ValueError,match="independent approval"):await s.approve_release(r["id"],project_id=961,actor="marketing",expected_revision=1,approval_reference="SELF")
   r=await s.approve_release(r["id"],project_id=961,actor="hq-approve",expected_revision=1,approval_reference="APPROVE");r=await s.acknowledge_release(r["id"],project_id=961,actor="client",expected_revision=2,consumer_receipt_reference="RECEIPT");w=await s.workspace(project_id=961);assert r["available"] and w["availability"]["status"]=="available" and len(w["evidence"])==6 and (await s.workspace(project_id=962))["datasets"]==[]
  await e.dispose()
 asyncio.run(case())
def test_search_share_blocks_sensitive_or_tampered_observations():
 async def case():
  e=create_async_engine("sqlite+aiosqlite:///:memory:")
  async with e.begin()as c:await c.run_sync(Base.metadata.create_all)
  async with async_sessionmaker(e,expire_on_commit=False)()as db:
   await contracts(db);s=FactorySearchShareService(db);d=await s.create_dataset(project_id=962,context=ctx(962),actor="hq",source_reference="GSC",market="CN",search_engine="baidu",device="mobile",observed_from="2026-07-01",observed_to="2026-07-31")
   with pytest.raises(ValueError,match="safe performance manifest"):await s.capture_snapshot(d["id"],project_id=962,context=ctx(962),actor="analyst",performance_manifest={"api_key":"private"})
   p=await s.capture_snapshot(d["id"],project_id=962,context=ctx(962),actor="analyst",performance_manifest={"brand_share":0.2});x=await s._get(FactorySearchShareSnapshot,p["id"],962,"Snapshot");x.performance_manifest_json={"brand_share":0.4};await db.flush()
   with pytest.raises(ValueError,match="unchanged observed data"):await s.verify_snapshot(p["id"],project_id=962,actor="agency",expected_revision=1,verification_reference="VERIFY")
  await e.dispose()
 asyncio.run(case())
