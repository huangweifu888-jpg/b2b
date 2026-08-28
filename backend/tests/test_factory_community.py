import asyncio
import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker,create_async_engine
import models
from core.database import Base
from core.tenant_context import build_tenant_context
from models.factory_crm import FactoryCrmAccount
from services.factory_community import FactoryCommunityService as S
def ctx():return build_tenant_context(agent_path="hq/community",tenant_id="tenant-c",client_id="client-c",plan_id="plan-93")
def scope():return dict(project_id=93,agent_path="hq/community",tenant_id="tenant-c",client_id="client-c",plan_id="plan-93")
def test_community_requires_verified_b2b_account_and_independent_activation_controls():
 async def run():
  e=create_async_engine("sqlite+aiosqlite:///:memory:")
  async with e.begin()as c:await c.run_sync(Base.metadata.create_all)
  async with async_sessionmaker(e,expire_on_commit=False)()as db:
   account=FactoryCrmAccount(id="account-verified",**scope(),account_number="CRM-93",account_reference="B2B-ACCOUNT",account_name="Verified dealer",market="global",status="verified",created_by="author",verified_by="reviewer",verification_reference="CRM-VERIFY",revision=2);db.add(account);await db.flush();s=S(db)
   community=await s.create_community(project_id=93,context=ctx(),actor="author",community_key="dealer-circle",account_id=account.id,community_name="Dealer Circle",audience_kind="dealer")
   with pytest.raises(ValueError,match="independent"):await s.verify_community(community["id"],project_id=93,actor="author",expected_revision=1,reference="COMMUNITY-VERIFY")
   community=await s.verify_community(community["id"],project_id=93,actor="reviewer",expected_revision=1,reference="COMMUNITY-VERIFY")
   activation=await s.plan_activation(community["id"],project_id=93,context=ctx(),actor="planner",activation_key="dealer-demo",event_title="Product training",event_type="education",scheduled_on="2026-09-01")
   with pytest.raises(ValueError,match="independent"):await s.approve_activation(activation["id"],project_id=93,actor="planner",expected_revision=1,reference="ACT-APPROVE")
   activation=await s.approve_activation(activation["id"],project_id=93,actor="reviewer",expected_revision=1,reference="ACT-APPROVE")
   with pytest.raises(ValueError,match="independent"):await s.acknowledge_activation(activation["id"],project_id=93,actor="reviewer",expected_revision=2,reference="ACT-ACK")
   assert (await s.acknowledge_activation(activation["id"],project_id=93,actor="owner",expected_revision=2,reference="ACT-ACK"))["status"]=="acknowledged"
   assert (await s.workspace(93))["contract"]["member_personal_data_stored"] is False
  await e.dispose()
 asyncio.run(run())
