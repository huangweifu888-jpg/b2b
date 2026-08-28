import asyncio
import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker,create_async_engine
import models
from core.database import Base
from core.tenant_context import build_tenant_context
from services.factory_ad_account import FactoryAdAccountService as S
def ctx():return build_tenant_context(agent_path="hq/ads",tenant_id="tenant-a",client_id="client-a",plan_id="plan-95")
def test_ad_account_uses_vault_reference_and_separates_controls():
 async def run():
  e=create_async_engine("sqlite+aiosqlite:///:memory:")
  async with e.begin()as c:await c.run_sync(Base.metadata.create_all)
  async with async_sessionmaker(e,expire_on_commit=False)()as db:
   s=S(db);a=await s.create(project_id=95,context=ctx(),actor="author",platform="google",account_reference="GOOGLE-ADS-1",vault_reference="vault://ads/google-1",market_scope="overseas")
   with pytest.raises(ValueError,match="independent"):await s.verify(a["id"],project_id=95,actor="author",expected_revision=1,reference="VERIFY")
   a=await s.verify(a["id"],project_id=95,actor="reviewer",expected_revision=1,reference="VERIFY")
   with pytest.raises(ValueError,match="separate"):await s.route(a["id"],project_id=95,context=ctx(),actor="reviewer",expected_revision=2,destination="marketing-owner")
   h=(await s.route(a["id"],project_id=95,context=ctx(),actor="owner",expected_revision=2,destination="marketing-owner"))["handoff"]
   with pytest.raises(ValueError,match="independent"):await s.acknowledge(h["id"],project_id=95,actor="owner",expected_revision=1,reference="ACK")
   assert (await s.acknowledge(h["id"],project_id=95,actor="receiver",expected_revision=1,reference="ACK"))["status"]=="acknowledged";assert (await s.workspace(95))["contract"]["platform_credentials_stored"] is False
  await e.dispose()
 asyncio.run(run())
