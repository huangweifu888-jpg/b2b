import asyncio
import pytest
from sqlalchemy.ext.asyncio import create_async_engine,async_sessionmaker
import models  # noqa:F401
from core.database import Base
from core.tenant_context import build_tenant_context
from models.factory_contract import FactoryCoreEventContract,FactoryCoreObjectContract
from models.factory_fact_library import FactoryFactLibraryVersion
from services.factory_fact_library import FactoryFactLibraryService
def test_fact_library_closes_independent_source_bound_handoff():
 async def case():
  e=create_async_engine("sqlite+aiosqlite:///:memory:")
  async with e.begin()as c:await c.run_sync(Base.metadata.create_all)
  async with async_sessionmaker(e,expire_on_commit=False)()as db:
   db.add_all([FactoryCoreObjectContract(id="ai-readable-fact-version",sequence=400,label="Fact version",system_of_record="recommend",identity_rule="tenant fact version",minimum_fields_json="[]",lifecycle_status="frozen",schema_version=1,revision=1,updated_by="test"),FactoryCoreEventContract(id="ai-readable-fact-released",sequence=320,label="Fact release",subject_id="ai-readable-fact-version",producer="recommend",consumers_json="[]",required_fields_json="[]",compatibility="backward",lifecycle_status="frozen",schema_version=1,revision=1,updated_by="test")]);await db.flush();c=build_tenant_context(agent_path="hq/facts",tenant_id="t",client_id="c",plan_id="p");s=FactoryFactLibraryService(db);f=await s.create_fact(project_id=993,context=c,actor="hq",fact_key="product-output",fact_type="product",source_reference="PLM-1",authority_reference="QA-1");v=await s.draft_version(f["id"],project_id=993,context=c,actor="author",fact_manifest={"statement":"Output is source-bound","citations":["PLM-1","QA-1"]})
   with pytest.raises(ValueError,match="independent verification"):await s.verify_version(v["id"],project_id=993,actor="author",expected_revision=1,verification_reference="SELF")
   v=await s.verify_version(v["id"],project_id=993,actor="agency",expected_revision=1,verification_reference="VERIFY");r=await s.prepare_release(v["id"],project_id=993,context=c,actor="marketing",target="geo-owner",handoff_manifest={"consumer":"geo","automatic_content_publish":False})
   with pytest.raises(ValueError,match="independent approval"):await s.approve_release(r["id"],project_id=993,actor="marketing",expected_revision=1,approval_reference="SELF")
   r=await s.approve_release(r["id"],project_id=993,actor="review",expected_revision=1,approval_reference="APPROVE");r=await s.acknowledge_release(r["id"],project_id=993,actor="geo-owner",expected_revision=2,consumer_receipt_reference="RECEIPT");assert r["available"]
  await e.dispose()
 asyncio.run(case())
def test_fact_library_blocks_sensitive_or_tampered_manifest():
 async def case():
  e=create_async_engine("sqlite+aiosqlite:///:memory:")
  async with e.begin()as c:await c.run_sync(Base.metadata.create_all)
  async with async_sessionmaker(e,expire_on_commit=False)()as db:
   c=build_tenant_context(agent_path="hq/facts",tenant_id="t",client_id="c",plan_id="p");s=FactoryFactLibraryService(db);f=await s.create_fact(project_id=994,context=c,actor="hq",fact_key="service-scope",fact_type="service",source_reference="SVC-1",authority_reference="LEGAL-1")
   with pytest.raises(ValueError,match="safe source-bound manifest"):await s.draft_version(f["id"],project_id=994,context=c,actor="author",fact_manifest={"token":"do-not-store"})
   v=await s.draft_version(f["id"],project_id=994,context=c,actor="author",fact_manifest={"statement":"safe","citations":["SVC-1"]});stored=await db.get(FactoryFactLibraryVersion,v["id"]);stored.fact_manifest_json={"statement":"tampered","citations":["SVC-1"]}
   with pytest.raises(ValueError,match="independent verification"):await s.verify_version(v["id"],project_id=994,actor="agency",expected_revision=1,verification_reference="VERIFY")
  await e.dispose()
 asyncio.run(case())
