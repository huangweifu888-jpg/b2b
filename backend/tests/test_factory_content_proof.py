import asyncio
import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
import models  # noqa:F401
from core.database import Base
from core.tenant_context import build_tenant_context
from models.factory_content_proof import FactoryContentProofVersion
from models.factory_contract import FactoryCoreEventContract, FactoryCoreObjectContract
from services.factory_content_proof import FactoryContentProofService
def context(p): return build_tenant_context(agent_path=f"hq/proof-{p}",tenant_id=f"tenant-{p}",client_id=f"client-{p}",plan_id=f"plan-{p}")
async def contracts(db): db.add_all([FactoryCoreObjectContract(id="authorized-proof-content-version",sequence=32,label="Authorized proof content version",system_of_record="content",identity_rule="tenant",minimum_fields_json="[]",lifecycle_status="frozen",schema_version=1,revision=1),FactoryCoreEventContract(id="authorized-proof-content-released",sequence=24,label="Authorized proof content released",subject_id="authorized-proof-content-version",producer="content",consumers_json="[]",required_fields_json="[]",compatibility="backward",lifecycle_status="frozen",schema_version=1,revision=1)]);await db.flush()
def test_content_proof_closes_authorized_independent_release():
 async def scenario():
  engine=create_async_engine("sqlite+aiosqlite:///:memory:")
  async with engine.begin() as c: await c.run_sync(Base.metadata.create_all)
  async with async_sessionmaker(engine,expire_on_commit=False)() as db:
   await contracts(db);s=FactoryContentProofService(db);t=context(907);a=await s.create_asset(project_id=907,context=t,actor="owner",content_type="cases",content_reference="CASE-907",display_name="Authorized case",source_reference="SOURCE-907",authorization_reference="AUTH-907",public_scope="global website")
   v=await s.draft_version(a["id"],project_id=907,context=t,actor="author",locale="en-US",content_manifest={"title":"Authorized factory case","summary":"Verified delivery"})
   with pytest.raises(ValueError,match="independent verification"): await s.verify_version(v["id"],project_id=907,actor="author",expected_revision=1,verification_reference="SELF")
   v=await s.verify_version(v["id"],project_id=907,actor="verifier",expected_revision=1,verification_reference="VERIFY-907");r=await s.prepare_publication(v["id"],project_id=907,context=t,actor="release-owner",target="website-case",rollback_reference="ROLLBACK-907")
   with pytest.raises(ValueError,match="independent approval"): await s.approve_publication(r["id"],project_id=907,actor="release-owner",expected_revision=1,approval_reference="SELF")
   r=await s.approve_publication(r["id"],project_id=907,actor="approver",expected_revision=1,approval_reference="APPROVE-907")
   with pytest.raises(ValueError,match="separate handoff actor"): await s.acknowledge_publication(r["id"],project_id=907,actor="approver",expected_revision=2,consumer_receipt_reference="SELF")
   r=await s.acknowledge_publication(r["id"],project_id=907,actor="consumer",expected_revision=2,consumer_receipt_reference="RECEIPT-907");w=await s.workspace(project_id=907)
   assert r["available"] and w["availability"]["status"]=="available" and len(w["evidence"])==6 and (await s.workspace(project_id=908))["assets"]==[]
  await engine.dispose()
 asyncio.run(scenario())
def test_content_proof_blocks_sensitive_or_tampered_content():
 async def scenario():
  engine=create_async_engine("sqlite+aiosqlite:///:memory:")
  async with engine.begin() as c: await c.run_sync(Base.metadata.create_all)
  async with async_sessionmaker(engine,expire_on_commit=False)() as db:
   await contracts(db);s=FactoryContentProofService(db);t=context(909);a=await s.create_asset(project_id=909,context=t,actor="owner",content_type="videos",content_reference="VIDEO-909",display_name="Video",source_reference="SOURCE",authorization_reference="AUTH",public_scope="EU")
   with pytest.raises(ValueError,match="safe content manifest"): await s.draft_version(a["id"],project_id=909,context=t,actor="author",locale="zh-CN",content_manifest={"customer_email":"private@example.com"})
   v=await s.draft_version(a["id"],project_id=909,context=t,actor="author",locale="zh-CN",content_manifest={"title":"Safe"});stored=await s._get(FactoryContentProofVersion,v["id"],909,"Version");stored.content_manifest_json={"title":"tampered"};await db.flush()
   with pytest.raises(ValueError,match="unchanged authorized content"): await s.verify_version(v["id"],project_id=909,actor="verifier",expected_revision=1,verification_reference="VERIFY")
  await engine.dispose()
 asyncio.run(scenario())
