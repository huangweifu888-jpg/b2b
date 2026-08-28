import asyncio
import pytest
from sqlalchemy.ext.asyncio import create_async_engine,async_sessionmaker
import models  # noqa:F401
from core.database import Base
from core.tenant_context import build_tenant_context
from models.factory_contract import FactoryCoreEventContract,FactoryCoreObjectContract
from models.factory_geo_aeo import FactoryGeoAeoAnswerVersion
from services.factory_geo_aeo import FactoryGeoAeoService
def test_geo_answer_requires_independent_source_bound_verification():
 async def case():
  e=create_async_engine("sqlite+aiosqlite:///:memory:")
  async with e.begin()as c:await c.run_sync(Base.metadata.create_all)
  async with async_sessionmaker(e,expire_on_commit=False)()as db:
   db.add_all([FactoryCoreObjectContract(id="geo-aeo-answer-version",sequence=390,label="GEO answer",system_of_record="recommend",identity_rule="tenant and version",minimum_fields_json="[]",lifecycle_status="frozen",schema_version=1,revision=1,updated_by="test"),FactoryCoreEventContract(id="geo-aeo-handoff-released",sequence=310,label="GEO handoff",subject_id="geo-aeo-answer-version",producer="recommend",consumers_json="[]",required_fields_json="[]",compatibility="backward",lifecycle_status="frozen",schema_version=1,revision=1,updated_by="test")]);await db.flush();c=build_tenant_context(agent_path="hq/geo",tenant_id="t",client_id="c",plan_id="p");s=FactoryGeoAeoService(db);q=await s.create_question(project_id=991,context=c,actor="hq",question_reference="BUYER-Q",market="US",locale="en-US");v=await s.draft_answer(q["id"],project_id=991,context=c,actor="author",answer_manifest={"answer":"source-bound","citations":["FACT-1"]})
   with pytest.raises(ValueError,match="independent verification"):await s.verify_answer(v["id"],project_id=991,actor="author",expected_revision=1,verification_reference="SELF")
   v=await s.verify_answer(v["id"],project_id=991,actor="agency",expected_revision=1,verification_reference="VERIFY");r=await s.prepare_release(v["id"],project_id=991,context=c,actor="marketing",target="geo-owner",handoff_manifest={"consumer":"geo","automatic_site_publish":False})
   with pytest.raises(ValueError,match="independent approval"):await s.approve_release(r["id"],project_id=991,actor="marketing",expected_revision=1,reference="SELF")
   r=await s.approve_release(r["id"],project_id=991,actor="review",expected_revision=1,reference="APPROVE");r=await s.acknowledge_release(r["id"],project_id=991,actor="geo-owner",expected_revision=2,reference="RECEIPT");assert v["status"]=="verified" and r["available"]
  await e.dispose()
 asyncio.run(case())

def test_geo_answer_rejects_sensitive_or_tampered_source_manifest():
 async def case():
  e=create_async_engine("sqlite+aiosqlite:///:memory:")
  async with e.begin()as c:await c.run_sync(Base.metadata.create_all)
  async with async_sessionmaker(e,expire_on_commit=False)()as db:
   c=build_tenant_context(agent_path="hq/geo",tenant_id="t",client_id="c",plan_id="p");s=FactoryGeoAeoService(db);q=await s.create_question(project_id=992,context=c,actor="hq",question_reference="BUYER-Q-TAMPER",market="US",locale="en-US")
   with pytest.raises(ValueError,match="safe source-bound manifest"):await s.draft_answer(q["id"],project_id=992,context=c,actor="author",answer_manifest={"secret":"must not store"})
   v=await s.draft_answer(q["id"],project_id=992,context=c,actor="author",answer_manifest={"answer":"verified source","citations":["FACT-2"]});stored=await db.get(FactoryGeoAeoAnswerVersion,v["id"]);stored.answer_manifest_json={"answer":"tampered","citations":["FACT-2"]}
   with pytest.raises(ValueError,match="independent verification"):await s.verify_answer(v["id"],project_id=992,actor="agency",expected_revision=1,verification_reference="VERIFY")
  await e.dispose()
 asyncio.run(case())
