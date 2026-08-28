import asyncio
from datetime import datetime,timezone
import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker,create_async_engine
import models
from core.database import Base
from core.tenant_context import build_tenant_context
from models.factory_reputation import FactoryReputationAssessment,FactoryReputationMention
from services.factory_social_listening import FactorySocialListeningService as S
def ctx():return build_tenant_context(agent_path="hq/social",tenant_id="tenant-s",client_id="client-s",plan_id="plan-92")
def scope():return dict(project_id=92,agent_path="hq/social",tenant_id="tenant-s",client_id="client-s",plan_id="plan-92")
def test_social_listening_only_uses_verified_public_assessments_and_separates_roles():
 async def run():
  e=create_async_engine("sqlite+aiosqlite:///:memory:")
  async with e.begin()as c:await c.run_sync(Base.metadata.create_all)
  async with async_sessionmaker(e,expire_on_commit=False)()as db:
   m=FactoryReputationMention(id="mention-public",**scope(),mention_number="RPM-92",public_reference="https://public.example/mention",channel="linkedin",sentiment="negative",observed_on="2026-08-08",status="registered",created_by="author",created_at=datetime.now(timezone.utc),revision=1);a=FactoryReputationAssessment(id="assessment-verified",**scope(),assessment_number="RPA-92",mention_id=m.id,mention_number=m.mention_number,assessment_manifest_json={"fact":"public"},manifest_hash="a"*64,status="verified",authored_by="author",verified_by="reviewer",created_at=datetime.now(timezone.utc),revision=2);db.add_all([m,a]);await db.flush();s=S(db);x=await s.capture(project_id=92,context=ctx(),actor="author",signal_key="public-issue",assessment_id=a.id,signal_type="issue",priority="high");assert x["public_reference"]==m.public_reference
   with pytest.raises(ValueError,match="independent"):await s.verify(x["id"],project_id=92,actor="author",expected_revision=1)
   x=await s.verify(x["id"],project_id=92,actor="reviewer",expected_revision=1)
   with pytest.raises(ValueError,match="separate"):await s.route(x["id"],project_id=92,context=ctx(),actor="reviewer",expected_revision=2,destination="service-owner",reference="TRIAGE")
   r=await s.route(x["id"],project_id=92,context=ctx(),actor="router",expected_revision=2,destination="service-owner",reference="TRIAGE")
   with pytest.raises(ValueError,match="independent"):await s.acknowledge(r["handoff"]["id"],project_id=92,actor="router",expected_revision=1,reference="ACK")
   assert (await s.acknowledge(r["handoff"]["id"],project_id=92,actor="owner",expected_revision=1,reference="ACK"))["status"]=="acknowledged"
  await e.dispose()
 asyncio.run(run())
