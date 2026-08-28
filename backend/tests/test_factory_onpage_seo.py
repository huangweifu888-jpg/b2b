import asyncio
import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker,create_async_engine
import models  # noqa:F401
from core.database import Base
from core.tenant_context import build_tenant_context
from models.factory_contract import FactoryCoreEventContract,FactoryCoreObjectContract
from models.factory_onpage_seo import FactoryOnPageSeoVersion
from services.factory_onpage_seo import FactoryOnPageSeoService
def ctx(p):return build_tenant_context(agent_path=f"hq/onpage-{p}",tenant_id=f"tenant-{p}",client_id=f"client-{p}",plan_id=f"plan-{p}")
async def contracts(db):db.add_all([FactoryCoreObjectContract(id="onpage-seo-suggestion-version",sequence=35,label="On-page SEO",system_of_record="trust",identity_rule="tenant",minimum_fields_json="[]",lifecycle_status="frozen",schema_version=1,revision=1),FactoryCoreEventContract(id="onpage-seo-handoff-released",sequence=27,label="On-page SEO released",subject_id="onpage-seo-suggestion-version",producer="trust",consumers_json="[]",required_fields_json="[]",compatibility="backward",lifecycle_status="frozen",schema_version=1,revision=1)]);await db.flush()
def test_onpage_seo_closes_independent_page_recommendation_handoff():
 async def case():
  e=create_async_engine("sqlite+aiosqlite:///:memory:")
  async with e.begin()as c:await c.run_sync(Base.metadata.create_all)
  async with async_sessionmaker(e,expire_on_commit=False)()as db:
   await contracts(db);s=FactoryOnPageSeoService(db);c=ctx(951);p=await s.create_page(project_id=951,context=c,actor="owner",page_reference="/products/valves",source_reference="CMS-951",locale="en-US");v=await s.draft_version(p["id"],project_id=951,context=c,actor="author",suggestion_manifest={"title":"Valve supplier","links":["/contact"]})
   with pytest.raises(ValueError,match="independent review"):await s.review_version(v["id"],project_id=951,actor="author",expected_revision=1,review_reference="SELF")
   v=await s.review_version(v["id"],project_id=951,actor="review",expected_revision=1,review_reference="REVIEW");r=await s.prepare_release(v["id"],project_id=951,context=c,actor="prepare",target="content-owner",handoff_manifest={"actions":["editor-review"],"automatic_page_change":False},rollback_reference="ROLLBACK")
   with pytest.raises(ValueError,match="independent approval"):await s.approve_release(r["id"],project_id=951,actor="prepare",expected_revision=1,approval_reference="SELF")
   r=await s.approve_release(r["id"],project_id=951,actor="approve",expected_revision=1,approval_reference="APPROVE");r=await s.acknowledge_release(r["id"],project_id=951,actor="consumer",expected_revision=2,consumer_receipt_reference="RECEIPT");w=await s.workspace(project_id=951);assert r["available"] and w["availability"]["status"]=="available" and len(w["evidence"])==6 and (await s.workspace(project_id=952))["pages"]==[]
  await e.dispose()
 asyncio.run(case())
def test_onpage_seo_blocks_sensitive_or_tampered_suggestions():
 async def case():
  e=create_async_engine("sqlite+aiosqlite:///:memory:")
  async with e.begin()as c:await c.run_sync(Base.metadata.create_all)
  async with async_sessionmaker(e,expire_on_commit=False)()as db:
   await contracts(db);s=FactoryOnPageSeoService(db);p=await s.create_page(project_id=952,context=ctx(952),actor="owner",page_reference="/about",source_reference="CMS",locale="en")
   with pytest.raises(ValueError,match="safe manifest"):await s.draft_version(p["id"],project_id=952,context=ctx(952),actor="author",suggestion_manifest={"api_key":"private"})
   v=await s.draft_version(p["id"],project_id=952,context=ctx(952),actor="author",suggestion_manifest={"title":"Safe"});x=await s._get(FactoryOnPageSeoVersion,v["id"],952,"Version");x.suggestion_manifest_json={"title":"Tampered"};await db.flush()
   with pytest.raises(ValueError,match="unchanged page source"):await s.review_version(v["id"],project_id=952,actor="review",expected_revision=1,review_reference="REVIEW")
  await e.dispose()
 asyncio.run(case())
