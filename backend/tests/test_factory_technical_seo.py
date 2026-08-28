import asyncio
import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
import models  # noqa: F401
from core.database import Base
from core.tenant_context import build_tenant_context
from models.factory_contract import FactoryCoreEventContract, FactoryCoreObjectContract
from models.factory_technical_seo import FactoryTechnicalSeoSnapshot
from services.factory_technical_seo import FactoryTechnicalSeoService

def context(project): return build_tenant_context(agent_path=f"hq/seo-{project}",tenant_id=f"tenant-{project}",client_id=f"client-{project}",plan_id=f"plan-{project}")
async def contracts(db): db.add_all([FactoryCoreObjectContract(id="technical-seo-evidence-snapshot",sequence=33,label="Technical SEO evidence snapshot",system_of_record="seo",identity_rule="tenant",minimum_fields_json="[]",lifecycle_status="frozen",schema_version=1,revision=1),FactoryCoreEventContract(id="technical-seo-remediation-released",sequence=25,label="Technical SEO remediation released",subject_id="technical-seo-evidence-snapshot",producer="trust",consumers_json="[]",required_fields_json="[]",compatibility="backward",lifecycle_status="frozen",schema_version=1,revision=1)]); await db.flush()
def test_technical_seo_closes_independent_remediation_handoff():
 async def scenario():
  engine=create_async_engine("sqlite+aiosqlite:///:memory:")
  async with engine.begin() as connection: await connection.run_sync(Base.metadata.create_all)
  async with async_sessionmaker(engine,expire_on_commit=False)() as db:
   await contracts(db); service=FactoryTechnicalSeoService(db); tenant=context(931); audit=await service.create_audit(project_id=931,context=tenant,actor="owner",site_reference="SITE-931",audit_reference="CRAWL-931",public_scope="global")
   snapshot=await service.capture_snapshot(audit["id"],project_id=931,context=tenant,actor="author",evidence_manifest={"checks":["robots","sitemap"],"finding":"review"})
   with pytest.raises(ValueError,match="independent verification"): await service.verify_snapshot(snapshot["id"],project_id=931,actor="author",expected_revision=1,verification_reference="SELF")
   snapshot=await service.verify_snapshot(snapshot["id"],project_id=931,actor="verifier",expected_revision=1,verification_reference="VERIFY-931"); release=await service.prepare_release(snapshot["id"],project_id=931,context=tenant,actor="release-owner",target="site-owner",remediation_manifest={"actions":["review"]},rollback_reference="ROLLBACK-931")
   with pytest.raises(ValueError,match="independent approval"): await service.approve_release(release["id"],project_id=931,actor="release-owner",expected_revision=1,approval_reference="SELF")
   release=await service.approve_release(release["id"],project_id=931,actor="approver",expected_revision=1,approval_reference="APPROVE-931")
   with pytest.raises(ValueError,match="Consumer acknowledgement"): await service.acknowledge_release(release["id"],project_id=931,actor="approver",expected_revision=2,consumer_receipt_reference="SELF")
   release=await service.acknowledge_release(release["id"],project_id=931,actor="consumer",expected_revision=2,consumer_receipt_reference="RECEIPT-931"); workspace=await service.workspace(project_id=931)
   assert release["available"] and workspace["availability"]["status"]=="available" and len(workspace["evidence"])==6 and (await service.workspace(project_id=932))["audits"]==[]
  await engine.dispose()
 asyncio.run(scenario())
def test_technical_seo_blocks_sensitive_or_tampered_evidence():
 async def scenario():
  engine=create_async_engine("sqlite+aiosqlite:///:memory:")
  async with engine.begin() as connection: await connection.run_sync(Base.metadata.create_all)
  async with async_sessionmaker(engine,expire_on_commit=False)() as db:
   await contracts(db); service=FactoryTechnicalSeoService(db); tenant=context(932); audit=await service.create_audit(project_id=932,context=tenant,actor="owner",site_reference="SITE",audit_reference="CRAWL",public_scope="EU")
   with pytest.raises(ValueError,match="safe crawl"): await service.capture_snapshot(audit["id"],project_id=932,context=tenant,actor="author",evidence_manifest={"api_key":"private"})
   snapshot=await service.capture_snapshot(audit["id"],project_id=932,context=tenant,actor="author",evidence_manifest={"finding":"safe"}); stored=await service._get(FactoryTechnicalSeoSnapshot,snapshot["id"],932,"Snapshot"); stored.evidence_manifest_json={"finding":"tampered"}; await db.flush()
   with pytest.raises(ValueError,match="unchanged SEO evidence"): await service.verify_snapshot(snapshot["id"],project_id=932,actor="verifier",expected_revision=1,verification_reference="VERIFY")
  await engine.dispose()
 asyncio.run(scenario())
