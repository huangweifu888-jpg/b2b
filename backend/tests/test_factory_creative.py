import asyncio,hashlib,json
from datetime import datetime,timezone
import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker,create_async_engine
import models  # noqa:F401
from core.database import Base
from core.tenant_context import build_tenant_context
from models.factory_abm import FactoryAbmProgram,FactoryAbmRolePlay,FactoryAbmVersion
from services.factory_creative import FactoryCreativeService
from services.factory_dam_localization import FactoryDamLocalizationService
from test_factory_dam_localization import source as dam_source,masters as dam_masters
def context(pid=76):return build_tenant_context(agent_path=f"hq/client-creative-{pid}",tenant_id=f"tenant-creative-{pid}",client_id=f"client-creative-{pid}",plan_id=f"plan-{pid}")
def scope(c,p):return dict(project_id=p,agent_path=c.agent_path,tenant_id=c.tenant_id,client_id=c.client_id,plan_id=c.plan_id)
def digest(x):return hashlib.sha256(json.dumps(x,ensure_ascii=False,sort_keys=True,separators=(",",":"),default=str).encode()).hexdigest()
async def sources(db,c,pid=76):
 now=datetime.now(timezone.utc);s=scope(c,pid);src=await dam_source(db,pid);dam=FactoryDamLocalizationService(db);asset,rights,glossary=await dam_masters(dam,c,src,pid);job=await dam.create_job(project_id=pid,context=c,actor="owner",asset_id=asset["id"],rights_grant_id=rights["id"],glossary_id=glossary["id"],target_market="US",target_locale="en-US",channel="cms",brief="Creative rights-safe source");rendition=await dam.submit_rendition(job["id"],project_id=pid,context=c,actor="translator",expected_revision=1,localized_storage_reference="private://creative/source.png",localized_sha256="b"*64,translator_reference="TRANSLATOR",ai_assisted=True,machine_translation_provider_reference="MT");reviewed=await dam.review_rendition(rendition["id"],project_id=pid,context=c,actor="reviewer",expected_revision=1,linguistic_score=95,terminology_score=95,brand_score=95,cultural_score=95,findings=[],recommendation="approve",compliance_assessment_reference="CREATIVE-COMPLIANCE");pack=await dam.create_pack(project_id=pid,context=c,actor="owner",pack_code=f"CREATIVE-{pid}",pack_name="Creative country pack",target_market="US",target_locale="en-US",rendition_ids=[reviewed["rendition"]["id"]],compliance_assessment_reference="REGIONAL",tax_reviewed=True,privacy_reviewed=True,market_access_reviewed=True);published=await dam.publish_pack(pack["id"],project_id=pid,context=c,actor="publisher",expected_revision=1,consumer="cms",delivery_reference="CMS")
 program=FactoryAbmProgram(id=f"creative-abm-{pid}",**s,program_number=f"ABM-CREATIVE-{pid}",program_code=f"CREATIVE-{pid}",program_name="Creative ABM",business_objective="Role creative",allowed_consumers_json=["ads","marketing","sales"],status="published",authored_by="abm-author",published_by="abm-publisher",published_at=now,revision=2,created_at=now,updated_at=now);db.add(program);plays=[]
 for i,(code,name) in enumerate((("CFO","Economic buyer"),("CTO","Technical buyer"),("CHAMPION","Plant champion")),1):
  definition=digest({"role":code,"order":i});p=FactoryAbmRolePlay(id=f"creative-play-{pid}-{i}",**s,play_number=f"ABP-CREATIVE-{pid}-{i}",program_id=program.id,target_id=f"target-{pid}",target_number=f"TARGET-{pid}",account_reference=f"BUYER-{pid}",committee_member_id=f"member-{pid}-{i}",committee_member_number=f"MEMBER-{pid}-{i}",role_code=code,role_name=name,contact_hash=digest(f"contact-{i}"),member_fingerprint=digest(f"member-{i}"),owner_team="sales",channel="meeting",action_code=f"ROLE-{code}",message_intent=f"Address {name}",success_signal="Response",sequence_order=i,definition_hash=definition,status="approved",authored_by="play-author",approved_by="play-reviewer",approved_at=now,revision=2,created_at=now);db.add(p);plays.append(p)
 manifest={"program":program.program_number,"plays":[x.play_number for x in plays]};v=FactoryAbmVersion(id=f"creative-abmv-{pid}",**s,version_reference=f"ABV-CREATIVE-{pid}",program_id=program.id,program_number=program.program_number,version_number=1,manifest_json=manifest,manifest_hash=digest(manifest),target_count=1,role_play_count=3,role_coverage_percent=100,status="published",published_by="abm-publisher",published_at=now);db.add(v);await db.flush();return v,published["pack"],plays
def test_creative_center_publishes_human_reviewed_role_variants_and_acknowledges():
 async def scenario():
  engine=create_async_engine("sqlite+aiosqlite:///:memory:")
  async with engine.begin() as x:await x.run_sync(Base.metadata.create_all)
  async with async_sessionmaker(engine,expire_on_commit=False)() as db:
   c=context();version,pack,plays=await sources(db,c);svc=FactoryCreativeService(db);brief=await svc.create_brief(project_id=76,context=c,actor="brief-author",brief_code="ROLE-CREATIVE",brief_name="Role creative launch",objective="Create rights-safe role content",abm_version_id=version.id,country_pack_id=pack["id"],allowed_consumers=["ads","marketing","sales","web"])
   for i,play in enumerate(plays,1):
    v=await svc.create_variant(brief["id"],project_id=76,context=c,actor="creator",abm_play_id=play.id,channel="display",headline=f"Verified value for {play.role_code}",message_body=f"Evidence-led message for {play.role_name}",call_to_action="Review verified proof",ai_assisted=True,model_reference="approved-model-v1",prompt_reference=f"PROMPT-{i}");await svc.approve_variant(v["id"],project_id=76,actor="creative-reviewer",expected_revision=1,reference=f"HUMAN-{i}")
   with pytest.raises(ValueError,match="independent publisher"):await svc.publish_brief(brief["id"],project_id=76,context=c,actor="brief-author",expected_revision=1,consumers=["ads"],delivery_reference_prefix="SELF")
   result=await svc.publish_brief(brief["id"],project_id=76,context=c,actor="creative-publisher",expected_revision=1,consumers=["ads","marketing","sales","web"],delivery_reference_prefix="CREATIVE-V1")
   for a in result["activations"]:await svc.acknowledge_activation(a["id"],project_id=76,actor="consumer-owner",expected_revision=1,reference=f"ACK-{a['consumer']}")
   w=await svc.list_workspace(project_id=76);assert w["metrics"]=={"published_briefs":1,"approved_variants":3,"role_coverage_percent":100.0,"ai_review_percent":100.0,"published_versions":1,"activation_acknowledgement_percent":100.0};assert (await svc.list_workspace(project_id=77))["briefs"]==[]
  await engine.dispose()
 asyncio.run(scenario())
def test_creative_center_blocks_ai_self_approval_incomplete_roles_and_pack_drift():
 async def scenario():
  engine=create_async_engine("sqlite+aiosqlite:///:memory:")
  async with engine.begin() as x:await x.run_sync(Base.metadata.create_all)
  async with async_sessionmaker(engine,expire_on_commit=False)() as db:
   c=context(77);version,pack,plays=await sources(db,c,77);svc=FactoryCreativeService(db);brief=await svc.create_brief(project_id=77,context=c,actor="author",brief_code="STRICT",brief_name="Strict",objective="Human review",abm_version_id=version.id,country_pack_id=pack["id"],allowed_consumers=["ads"]);v=await svc.create_variant(brief["id"],project_id=77,context=c,actor="creator",abm_play_id=plays[0].id,channel="display",headline="One",message_body="One role",call_to_action="Review",ai_assisted=True,model_reference="model",prompt_reference="prompt")
   with pytest.raises(ValueError,match="independent human"):await svc.approve_variant(v["id"],project_id=77,actor="creator",expected_revision=1,reference="SELF")
   await svc.approve_variant(v["id"],project_id=77,actor="reviewer",expected_revision=1,reference="HUMAN")
   with pytest.raises(ValueError,match="Every approved"):await svc.publish_brief(brief["id"],project_id=77,context=c,actor="publisher",expected_revision=1,consumers=["ads"],delivery_reference_prefix="INCOMPLETE")
   pack_row=await svc._get(__import__("models.factory_dam_localization",fromlist=["FactoryCountryContentPack"]).FactoryCountryContentPack,pack["id"],77,"Pack");pack_row.manifest_hash="0"*64;await db.flush()
   with pytest.raises(ValueError,match="manifest changed"):await svc._validate_brief(await svc._get(__import__("models.factory_creative",fromlist=["FactoryCreativeBrief"]).FactoryCreativeBrief,brief["id"],77,"Brief"))
  await engine.dispose()
 asyncio.run(scenario())
