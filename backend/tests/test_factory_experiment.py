import asyncio
import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker,create_async_engine
import models
from core.database import Base
from core.tenant_context import build_tenant_context
from services.factory_experiment import FactoryExperimentService as S
def ctx():return build_tenant_context(agent_path="hq/ads",tenant_id="tenant-a",client_id="client-a",plan_id="plan-97")
def test_experiment_requires_independent_review_decision_and_acknowledgement():
 async def run():
  e=create_async_engine("sqlite+aiosqlite:///:memory:")
  async with e.begin()as c:await c.run_sync(Base.metadata.create_all)
  async with async_sessionmaker(e,expire_on_commit=False)()as db:
   s=S(db);x=await s.create(project_id=97,context=ctx(),actor="author",experiment_key="landing-a",hypothesis="Variant A improves qualified inquiry intent",evidence_reference="evidence:landing-a")
   with pytest.raises(ValueError,match="independent"):await s.review(x["id"],project_id=97,actor="author",expected_revision=1,reference="REVIEW")
   x=await s.review(x["id"],project_id=97,actor="reviewer",expected_revision=1,reference="REVIEW")
   with pytest.raises(ValueError,match="separate"):await s.decide(x["id"],project_id=97,context=ctx(),actor="reviewer",expected_revision=2,destination="marketing-owner")
   d=(await s.decide(x["id"],project_id=97,context=ctx(),actor="owner",expected_revision=2,destination="marketing-owner"))["decision"]
   with pytest.raises(ValueError,match="independent"):await s.acknowledge(d["id"],project_id=97,actor="owner",expected_revision=1,reference="ACK")
   assert (await s.acknowledge(d["id"],project_id=97,actor="receiver",expected_revision=1,reference="ACK"))["status"]=="acknowledged"
  await e.dispose()
 asyncio.run(run())
