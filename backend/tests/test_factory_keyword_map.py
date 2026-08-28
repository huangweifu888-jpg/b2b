import asyncio
import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker,create_async_engine
import models  # noqa:F401
from core.database import Base
from core.tenant_context import build_tenant_context
from models.factory_contract import FactoryCoreEventContract,FactoryCoreObjectContract
from models.factory_keyword_map import FactoryKeywordMapVersion
from services.factory_keyword_map import FactoryKeywordMapService
def ctx(p):return build_tenant_context(agent_path=f"hq/keyword-{p}",tenant_id=f"tenant-{p}",client_id=f"client-{p}",plan_id=f"plan-{p}")
async def contracts(db):db.add_all([FactoryCoreObjectContract(id="keyword-topic-map-version",sequence=34,label="Keyword topic map",system_of_record="trust",identity_rule="tenant",minimum_fields_json="[]",lifecycle_status="frozen",schema_version=1,revision=1),FactoryCoreEventContract(id="keyword-topic-map-released",sequence=26,label="Keyword map released",subject_id="keyword-topic-map-version",producer="trust",consumers_json="[]",required_fields_json="[]",compatibility="backward",lifecycle_status="frozen",schema_version=1,revision=1)]);await db.flush()
def test_keyword_map_closes_independent_source_dated_handoff():
 async def case():
  e=create_async_engine("sqlite+aiosqlite:///:memory:")
  async with e.begin()as c:await c.run_sync(Base.metadata.create_all)
  async with async_sessionmaker(e,expire_on_commit=False)()as db:
   await contracts(db);s=FactoryKeywordMapService(db);c=ctx(941);a=await s.create_study(project_id=941,context=c,actor="owner",market="US",source_reference="DATA-941",observed_on="2026-08-06");v=await s.draft_version(a["id"],project_id=941,context=c,actor="author",topic_manifest={"topics":["industrial valves"],"intent":"procurement"})
   with pytest.raises(ValueError,match="independent verification"):await s.verify_version(v["id"],project_id=941,actor="author",expected_revision=1,verification_reference="SELF")
   v=await s.verify_version(v["id"],project_id=941,actor="verify",expected_revision=1,verification_reference="VERIFY");r=await s.prepare_release(v["id"],project_id=941,context=c,actor="prepare",target="content-team",activation_manifest={"actions":["brief-content"]},rollback_reference="ROLLBACK")
   with pytest.raises(ValueError,match="independent approval"):await s.approve_release(r["id"],project_id=941,actor="prepare",expected_revision=1,approval_reference="SELF")
   r=await s.approve_release(r["id"],project_id=941,actor="approve",expected_revision=1,approval_reference="APPROVE");r=await s.acknowledge_release(r["id"],project_id=941,actor="consumer",expected_revision=2,consumer_receipt_reference="RECEIPT");w=await s.workspace(project_id=941);assert r["available"] and w["availability"]["status"]=="available" and len(w["evidence"])==6 and (await s.workspace(project_id=942))["studies"]==[]
  await e.dispose()
 asyncio.run(case())
def test_keyword_map_blocks_sensitive_or_tampered_source():
 async def case():
  e=create_async_engine("sqlite+aiosqlite:///:memory:")
  async with e.begin()as c:await c.run_sync(Base.metadata.create_all)
  async with async_sessionmaker(e,expire_on_commit=False)()as db:
   await contracts(db);s=FactoryKeywordMapService(db);a=await s.create_study(project_id=942,context=ctx(942),actor="owner",market="EU",source_reference="DATA",observed_on="2026-08-06")
   with pytest.raises(ValueError,match="safe source"):await s.draft_version(a["id"],project_id=942,context=ctx(942),actor="author",topic_manifest={"api_key":"private"})
   v=await s.draft_version(a["id"],project_id=942,context=ctx(942),actor="author",topic_manifest={"topic":"safe"});x=await s._get(FactoryKeywordMapVersion,v["id"],942,"Version");x.topic_manifest_json={"topic":"tampered"};await db.flush()
   with pytest.raises(ValueError,match="unchanged source-dated"):await s.verify_version(v["id"],project_id=942,actor="verify",expected_revision=1,verification_reference="VERIFY")
  await e.dispose()
 asyncio.run(case())
