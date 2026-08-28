import asyncio
import pytest
from sqlalchemy.ext.asyncio import create_async_engine,async_sessionmaker
import models  # noqa:F401
from core.database import Base
from core.tenant_context import build_tenant_context
from models.factory_proof_center import FactoryProofCenterVersion
from models.factory_contract import FactoryCoreObjectContract,FactoryCoreEventContract
from services.factory_proof_center import FactoryProofCenterService
def ctx(p):return build_tenant_context(agent_path=f"hq/proof-{p}",tenant_id=f"tenant-{p}",client_id=f"client-{p}",plan_id=f"plan-{p}")
def test_proof_center_verifies_only_unexpired_evidence():
 async def case():
  e=create_async_engine("sqlite+aiosqlite:///:memory:")
  async with e.begin()as c:await c.run_sync(Base.metadata.create_all)
  async with async_sessionmaker(e,expire_on_commit=False)()as db:
   s=FactoryProofCenterService(db);a=await s.create_asset(project_id=981,context=ctx(981),actor="hq",asset_type="certificate",source_reference="CERT-981",rights_reference="RIGHTS-981",market_scope="GLOBAL",valid_until="2099-01-01");v=await s.draft_version(a["id"],project_id=981,context=ctx(981),actor="author",claim_manifest={"claim":"Certified scope"})
   with pytest.raises(ValueError,match="independent verification"):await s.verify_version(v["id"],project_id=981,actor="author",expected_revision=1,verification_reference="SELF")
   v=await s.verify_version(v["id"],project_id=981,actor="agency",expected_revision=1,verification_reference="VERIFY");assert v["status"]=="verified" and (await s.workspace(project_id=982))["assets"]==[]
  await e.dispose()
 asyncio.run(case())
def test_proof_center_blocks_expired_sensitive_and_tampered_evidence():
 async def case():
  e=create_async_engine("sqlite+aiosqlite:///:memory:")
  async with e.begin()as c:await c.run_sync(Base.metadata.create_all)
  async with async_sessionmaker(e,expire_on_commit=False)()as db:
   s=FactoryProofCenterService(db);a=await s.create_asset(project_id=982,context=ctx(982),actor="hq",asset_type="test-report",source_reference="TEST-982",rights_reference="RIGHTS-982",market_scope="GLOBAL",valid_until="2099-01-01")
   with pytest.raises(ValueError,match="safe claim manifest"):await s.draft_version(a["id"],project_id=982,context=ctx(982),actor="author",claim_manifest={"api_key":"x"})
   v=await s.draft_version(a["id"],project_id=982,context=ctx(982),actor="author",claim_manifest={"claim":"safe"});x=await s._get(FactoryProofCenterVersion,v["id"],982,"v");x.claim_manifest_json={"claim":"tampered"};await db.flush()
   with pytest.raises(ValueError,match="unchanged, unexpired"):await s.verify_version(v["id"],project_id=982,actor="agency",expected_revision=1,verification_reference="VERIFY")
  await e.dispose()
 asyncio.run(case())
def test_proof_center_closes_independent_page_handoff():
 async def case():
  e=create_async_engine("sqlite+aiosqlite:///:memory:")
  async with e.begin()as c:await c.run_sync(Base.metadata.create_all)
  async with async_sessionmaker(e,expire_on_commit=False)()as db:
   db.add_all([FactoryCoreObjectContract(id="proof-center-verified-asset",sequence=38,label="Proof asset",system_of_record="trust",identity_rule="tenant",minimum_fields_json="[]",lifecycle_status="frozen",schema_version=1,revision=1),FactoryCoreEventContract(id="proof-center-handoff-released",sequence=30,label="Proof released",subject_id="proof-center-verified-asset",producer="trust",consumers_json="[]",required_fields_json="[]",compatibility="backward",lifecycle_status="frozen",schema_version=1,revision=1)]);await db.flush();s=FactoryProofCenterService(db);a=await s.create_asset(project_id=983,context=ctx(983),actor="hq",asset_type="certificate",source_reference="CERT",rights_reference="RIGHTS",market_scope="GLOBAL",valid_until="2099-01-01");v=await s.draft_version(a["id"],project_id=983,context=ctx(983),actor="author",claim_manifest={"claim":"safe"});v=await s.verify_version(v["id"],project_id=983,actor="agency",expected_revision=1,verification_reference="VERIFY");r=await s.prepare_release(v["id"],project_id=983,context=ctx(983),actor="marketing",target="marketing-owner",handoff_manifest={"page":"service","website_published_automatically":False},rollback_reference="ROLLBACK")
   with pytest.raises(ValueError,match="independent approval"):await s.approve_release(r["id"],project_id=983,actor="marketing",expected_revision=1,approval_reference="SELF")
   r=await s.approve_release(r["id"],project_id=983,actor="quality",expected_revision=1,approval_reference="APPROVE");r=await s.acknowledge_release(r["id"],project_id=983,actor="client",expected_revision=2,consumer_receipt_reference="RECEIPT");assert r["available"] and (await s.workspace(project_id=983))["availability"]["status"]=="available"
  await e.dispose()
 asyncio.run(case())
