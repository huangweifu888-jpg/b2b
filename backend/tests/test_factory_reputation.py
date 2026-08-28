import asyncio
import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker,create_async_engine
import models  # noqa:F401
from core.database import Base
from core.tenant_context import build_tenant_context
from models.factory_contract import FactoryCoreEventContract,FactoryCoreObjectContract
from models.factory_reputation import FactoryReputationAssessment
from services.factory_reputation import FactoryReputationService
def ctx(p):return build_tenant_context(agent_path=f"hq/reputation-{p}",tenant_id=f"tenant-{p}",client_id=f"client-{p}",plan_id=f"plan-{p}")
async def contracts(db):db.add_all([FactoryCoreObjectContract(id="reputation-public-mention",sequence=37,label="Public mention",system_of_record="trust",identity_rule="tenant",minimum_fields_json="[]",lifecycle_status="frozen",schema_version=1,revision=1),FactoryCoreEventContract(id="reputation-response-released",sequence=29,label="Reputation response released",subject_id="reputation-public-mention",producer="trust",consumers_json="[]",required_fields_json="[]",compatibility="backward",lifecycle_status="frozen",schema_version=1,revision=1)]);await db.flush()
def test_reputation_closes_independent_public_mention_handoff():
 async def case():
  e=create_async_engine("sqlite+aiosqlite:///:memory:")
  async with e.begin()as c:await c.run_sync(Base.metadata.create_all)
  async with async_sessionmaker(e,expire_on_commit=False)()as db:
   await contracts(db);s=FactoryReputationService(db);c=ctx(971);m=await s.create_mention(project_id=971,context=c,actor="hq",public_reference="https://example.test/article",channel="media",sentiment="neutral",observed_on="2026-08-06");a=await s.draft_assessment(m["id"],project_id=971,context=c,actor="author",assessment_manifest={"summary":"observed mention","response_required":False})
   with pytest.raises(ValueError,match="independent verification"):await s.verify_assessment(a["id"],project_id=971,actor="author",expected_revision=1,verification_reference="SELF")
   a=await s.verify_assessment(a["id"],project_id=971,actor="agency",expected_revision=1,verification_reference="VERIFY");r=await s.prepare_release(a["id"],project_id=971,context=c,actor="marketing",target="marketing-owner",response_manifest={"action":"review","automatic_public_reply":False},rollback_reference="ROLLBACK")
   with pytest.raises(ValueError,match="independent approval"):await s.approve_release(r["id"],project_id=971,actor="marketing",expected_revision=1,approval_reference="SELF")
   r=await s.approve_release(r["id"],project_id=971,actor="approve",expected_revision=1,approval_reference="APPROVE");r=await s.acknowledge_release(r["id"],project_id=971,actor="client",expected_revision=2,consumer_receipt_reference="RECEIPT");w=await s.workspace(project_id=971);assert r["available"] and w["availability"]["status"]=="available" and len(w["evidence"])==6 and (await s.workspace(project_id=972))["mentions"]==[]
  await e.dispose()
 asyncio.run(case())
def test_reputation_blocks_fake_or_tampered_assessment():
 async def case():
  e=create_async_engine("sqlite+aiosqlite:///:memory:")
  async with e.begin()as c:await c.run_sync(Base.metadata.create_all)
  async with async_sessionmaker(e,expire_on_commit=False)()as db:
   await contracts(db);s=FactoryReputationService(db);m=await s.create_mention(project_id=972,context=ctx(972),actor="hq",public_reference="https://example.test/review",channel="review",sentiment="negative",observed_on="2026-08-06")
   with pytest.raises(ValueError,match="safe factual manifest"):await s.draft_assessment(m["id"],project_id=972,context=ctx(972),actor="author",assessment_manifest={"fake_review":"create"})
   a=await s.draft_assessment(m["id"],project_id=972,context=ctx(972),actor="author",assessment_manifest={"summary":"safe"});x=await s._get(FactoryReputationAssessment,a["id"],972,"Assessment");x.assessment_manifest_json={"summary":"tampered"};await db.flush()
   with pytest.raises(ValueError,match="unchanged public reference"):await s.verify_assessment(a["id"],project_id=972,actor="agency",expected_revision=1,verification_reference="VERIFY")
  await e.dispose()
 asyncio.run(case())
