import asyncio
import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker,create_async_engine
import models  # noqa:F401
from core.database import Base
from services.factory_ai_sdr import FactoryAiSdrService
from services.factory_icp import FactoryIcpService
from test_factory_icp import authority,draft_profile,context

async def source(db,pid=78):
 c=context(pid);quote=await authority(db,c,pid);icp=FactoryIcpService(db);profile=await draft_profile(icp,c,pid);profile=await icp.approve_profile(profile["id"],project_id=pid,actor="icp-approver",expected_revision=1,approval_reference="ICP-APPROVED");evidence=await icp.capture_account_evidence(profile["id"],project_id=pid,context=c,actor="researcher",source_type="cpq-quote",source_id=quote.id,firmographic_country="US",firmographic_industry="industrial-automation",firmographic_company_size="500-5000",firmographic_evidence_reference="FIRM-VERIFIED",observed_roles=["CFO","CTO"],observed_triggers=["capacity-expansion"],observed_products=["ROBOT-CELL"]);evidence=await icp.verify_account_evidence(evidence["id"],project_id=pid,actor="research-reviewer",expected_revision=1,verification_reference="EVIDENCE-QA");assessment=await icp.assess_fit(profile["id"],project_id=pid,context=c,actor="analyst",account_evidence_id=evidence["id"]);assessment=await icp.verify_assessment(assessment["id"],project_id=pid,actor="fit-reviewer",expected_revision=1,verification_reference="FIT-QA");return c,quote,assessment

def test_ai_sdr_closes_human_reviewed_qualification_and_sales_acknowledgement():
 async def scenario():
  engine=create_async_engine("sqlite+aiosqlite:///:memory:")
  async with engine.begin() as x:await x.run_sync(Base.metadata.create_all)
  async with async_sessionmaker(engine,expire_on_commit=False)() as db:
   c,quote,assessment=await source(db);svc=FactoryAiSdrService(db);lead=await svc.create_lead(project_id=78,context=c,actor="sdr-operator",assessment_id=assessment["id"]);recommendation=await svc.generate_recommendation(lead["id"],project_id=78,context=c,actor="ai-operator",model_reference="approved-sdr-model-v1",prompt_reference="private prompt content",enrichment_summary="Verified ICP fit and expansion trigger support an immediate discovery call.",intent_score=92,qualification_proposal="qualified",reply_subject="Production capacity evidence review",reply_body="We can review the verified capacity and ROI evidence with your buying team.",next_action="Book a 30-minute discovery workshop")
   with pytest.raises(ValueError,match="independent documented"):await svc.review_recommendation(recommendation["id"],project_id=78,actor="ai-operator",expected_revision=1,decision="approve",review_reference="SELF",review_note="self")
   recommendation=await svc.review_recommendation(recommendation["id"],project_id=78,actor="sdr-reviewer",expected_revision=1,decision="approve",review_reference="SDR-HUMAN-QA",review_note="Evidence and response wording independently checked")
   handoff=await svc.create_handoff(recommendation["id"],project_id=78,context=c,actor="sdr-reviewer",owner_team="enterprise-sales",sla_minutes=30,delivery_reference="SALES-QUEUE-78")
   with pytest.raises(ValueError,match="independent acknowledgement"):await svc.acknowledge_handoff(handoff["id"],project_id=78,actor="sdr-reviewer",expected_revision=1,acknowledgement_reference="SELF")
   await svc.acknowledge_handoff(handoff["id"],project_id=78,actor="sales-owner",expected_revision=1,acknowledgement_reference="SALES-ACK-78");w=await svc.list_workspace(project_id=78);assert w["metrics"]=={"sdr_leads":1,"human_review_percent":100.0,"qualified_leads":1,"average_intent_score":92.0,"sales_handoffs":1,"handoff_acknowledgement_percent":100.0};assert w["contract"]["ai_output_direct_qualification"] is False and w["contract"]["crm_writeback"] is False and quote.revision==1;assert (await svc.list_workspace(project_id=79))["leads"]==[]
  await engine.dispose()
 asyncio.run(scenario())

def test_ai_sdr_blocks_unverified_fit_invalid_ai_and_authoritative_source_drift():
 async def scenario():
  engine=create_async_engine("sqlite+aiosqlite:///:memory:")
  async with engine.begin() as x:await x.run_sync(Base.metadata.create_all)
  async with async_sessionmaker(engine,expire_on_commit=False)() as db:
   c,quote,assessment=await source(db,79);svc=FactoryAiSdrService(db);lead=await svc.create_lead(project_id=79,context=c,actor="operator",assessment_id=assessment["id"])
   with pytest.raises(ValueError,match="requires provenance"):await svc.generate_recommendation(lead["id"],project_id=79,context=c,actor="ai",model_reference="",prompt_reference="",enrichment_summary="",intent_score=101,qualification_proposal="auto-close",reply_subject="",reply_body="",next_action="")
   quote.revision=2;await db.flush()
   with pytest.raises(ValueError,match="source changed"):await svc.generate_recommendation(lead["id"],project_id=79,context=c,actor="ai",model_reference="model",prompt_reference="prompt",enrichment_summary="summary",intent_score=50,qualification_proposal="nurture",reply_subject="subject",reply_body="body",next_action="wait")
  await engine.dispose()
 asyncio.run(scenario())
