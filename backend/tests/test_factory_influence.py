import asyncio
import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker,create_async_engine
import models
from core.database import Base
from core.tenant_context import build_tenant_context
from models.factory_community import FactoryCommunityActivation
from services.factory_influence import FactoryInfluenceService as S
def ctx():return build_tenant_context(agent_path="hq/influence",tenant_id="tenant-i",client_id="client-i",plan_id="plan-94")
def scope():return dict(project_id=94,agent_path="hq/influence",tenant_id="tenant-i",client_id="client-i",plan_id="plan-94")
def test_influence_requires_acknowledged_activation_and_independent_controls():
 async def run():
  e=create_async_engine("sqlite+aiosqlite:///:memory:")
  async with e.begin()as c:await c.run_sync(Base.metadata.create_all)
  async with async_sessionmaker(e,expire_on_commit=False)()as db:
   activation=FactoryCommunityActivation(id="activation-ack",**scope(),activation_number="ACT-94",activation_key="training",community_id="community-94",community_number="COM-94",event_title="Training",event_type="education",scheduled_on="2026-09-01",activation_manifest_json="{}",manifest_fingerprint="a"*64,status="acknowledged",planned_by="planner",approved_by="reviewer",acknowledged_by="owner",revision=3);db.add(activation);await db.flush();s=S(db)
   brief=await s.create(project_id=94,context=ctx(),actor="author",brief_key="expert-training",activation_id=activation.id,advocate_role="expert",topic="Factory product training")
   with pytest.raises(ValueError,match="independent"):await s.verify(brief["id"],project_id=94,actor="author",expected_revision=1,reference="VERIFY")
   brief=await s.verify(brief["id"],project_id=94,actor="reviewer",expected_revision=1,reference="VERIFY")
   with pytest.raises(ValueError,match="separate"):await s.authorize(brief["id"],project_id=94,context=ctx(),actor="reviewer",expected_revision=2,destination="event-owner",reference="AUTH")
   release=(await s.authorize(brief["id"],project_id=94,context=ctx(),actor="owner",expected_revision=2,destination="event-owner",reference="AUTH"))["release"]
   with pytest.raises(ValueError,match="independent"):await s.acknowledge(release["id"],project_id=94,actor="owner",expected_revision=1,reference="ACK")
   assert (await s.acknowledge(release["id"],project_id=94,actor="receiver",expected_revision=1,reference="ACK"))["status"]=="acknowledged"
  await e.dispose()
 asyncio.run(run())
