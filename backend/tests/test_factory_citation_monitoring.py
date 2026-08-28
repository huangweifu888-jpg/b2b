import asyncio
import pytest
from sqlalchemy.ext.asyncio import create_async_engine,async_sessionmaker
import models  # noqa:F401
from core.database import Base
from core.tenant_context import build_tenant_context
from models.factory_contract import FactoryCoreEventContract,FactoryCoreObjectContract
from models.factory_citation_monitoring import FactoryCitationObservation as O
from services.factory_citation_monitoring import FactoryCitationMonitoringService
def test_citation_monitoring_requires_independent_governed_handoff():
 async def case():
  e=create_async_engine("sqlite+aiosqlite:///:memory:")
  async with e.begin()as c:await c.run_sync(Base.metadata.create_all)
  async with async_sessionmaker(e,expire_on_commit=False)()as db:
   db.add_all([FactoryCoreObjectContract(id="citation-observation",sequence=410,label="Citation",system_of_record="recommend",identity_rule="tenant",minimum_fields_json="[]",lifecycle_status="frozen",schema_version=1,revision=1,updated_by="test"),FactoryCoreEventContract(id="citation-analysis-released",sequence=330,label="Citation release",subject_id="citation-observation",producer="recommend",consumers_json="[]",required_fields_json="[]",compatibility="backward",lifecycle_status="frozen",schema_version=1,revision=1,updated_by="test")]);await db.flush();c=build_tenant_context(agent_path="hq/citation",tenant_id="t",client_id="c",plan_id="p");s=FactoryCitationMonitoringService(db);m=await s.create_monitor(project_id=995,context=c,actor="hq",monitor_key="MODEL-Q",market="US",locale="en-US",model_provider="model",question_reference="BUYER-Q");o=await s.capture(m["id"],project_id=995,context=c,actor="author",observation_manifest={"observed":"not guaranteed","at":"now"})
   with pytest.raises(ValueError,match="independent verification"):await s.verify(o["id"],project_id=995,actor="author",expected_revision=1,reference="SELF")
   o=await s.verify(o["id"],project_id=995,actor="agency",expected_revision=1,reference="VERIFY");r=await s.prepare_release(o["id"],project_id=995,context=c,actor="marketing",target="geo-owner",analysis_manifest={"bounded":True})
   with pytest.raises(ValueError,match="independent approval"):await s.approve_release(r["id"],project_id=995,actor="marketing",expected_revision=1,reference="SELF")
   r=await s.approve_release(r["id"],project_id=995,actor="review",expected_revision=1,reference="APPROVE");r=await s.acknowledge_release(r["id"],project_id=995,actor="geo-owner",expected_revision=2,reference="RECEIPT");assert r["available"]
  await e.dispose()
 asyncio.run(case())

def test_citation_monitoring_blocks_sensitive_or_tampered_observation():
 async def case():
  e=create_async_engine("sqlite+aiosqlite:///:memory:")
  async with e.begin()as c:await c.run_sync(Base.metadata.create_all)
  async with async_sessionmaker(e,expire_on_commit=False)()as db:
   db.add_all([FactoryCoreObjectContract(id="citation-observation",sequence=410,label="Citation",system_of_record="recommend",identity_rule="tenant",minimum_fields_json="[]",lifecycle_status="frozen",schema_version=1,revision=1,updated_by="test"),FactoryCoreEventContract(id="citation-analysis-released",sequence=330,label="Citation release",subject_id="citation-observation",producer="recommend",consumers_json="[]",required_fields_json="[]",compatibility="backward",lifecycle_status="frozen",schema_version=1,revision=1,updated_by="test")]);await db.flush();c=build_tenant_context(agent_path="hq/citation",tenant_id="t",client_id="c",plan_id="p");s=FactoryCitationMonitoringService(db);m=await s.create_monitor(project_id=996,context=c,actor="hq",monitor_key="MODEL-Q",market="US",locale="en-US",model_provider="model",question_reference="BUYER-Q")
   with pytest.raises(ValueError,match="safe captured manifest"):await s.capture(m["id"],project_id=996,context=c,actor="author",observation_manifest={"token":"must-not-store"})
   o=await s.capture(m["id"],project_id=996,context=c,actor="author",observation_manifest={"observed":"bounded","at":"now"});row=await s.get(O,o["id"],996,"Observation");row.observation_manifest_json={"observed":"tampered"}
   with pytest.raises(ValueError,match="unchanged data"):await s.verify(o["id"],project_id=996,actor="agency",expected_revision=1,reference="VERIFY")
  await e.dispose()
 asyncio.run(case())
