import asyncio
from datetime import datetime, timezone
import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
import models  # noqa: F401
from core.database import Base
from core.tenant_context import build_tenant_context
from models.social_credential_reference import SocialCredentialReference
from models.social_page_asset import SocialPageAsset, SocialPageMetricSnapshot
from services.factory_social_matrix import FactorySocialMatrixService

def ctx(project_id=81): return build_tenant_context(agent_path="hq/social",tenant_id="tenant-social",client_id="client-social",plan_id=f"plan-{project_id}")
def scope(project_id): return dict(project_id=project_id,agent_path="hq/social",tenant_id="tenant-social",client_id="client-social",plan_id=f"plan-{project_id}")
def test_social_matrix_pins_safe_sources_and_requires_independent_lifecycle():
 async def scenario():
  engine=create_async_engine("sqlite+aiosqlite:///:memory:")
  async with engine.begin() as c:await c.run_sync(Base.metadata.create_all)
  async with async_sessionmaker(engine,expire_on_commit=False)() as db:
   now=datetime.now(timezone.utc);pid=81
   credential=SocialCredentialReference(id="credential-1",**scope(pid),provider="linkedin",secret_reference="vault://social/linkedin/client-81",scopes_json='["read"]',status="active",verified_at=now,created_by="hq")
   page=SocialPageAsset(id="page-1",**scope(pid),provider="linkedin",display_name="Factory LinkedIn",page_url="https://www.linkedin.com/company/factory",asset_reference="linkedin-page-81",status="ready_for_sync",created_by="client")
   snapshot=SocialPageMetricSnapshot(id="snapshot-1",**scope(pid),page_asset_id=page.id,source="verified_manual",captured_at=now,followers=1200,impressions=5000,engagements=250,views=None,clicks=40,recorded_by="agency")
   db.add_all([credential,page,snapshot]);await db.flush();service=FactorySocialMatrixService(db)
   matrix=await service.create(project_id=pid,context=ctx(pid),actor="author",matrix_key="global-social",matrix_name="Global social matrix",market_scope="dual")
   binding=await service.bind_page(matrix["id"],project_id=pid,context=ctx(pid),actor="author",page_asset_id=page.id,credential_reference_id=credential.id)
   assert binding["credential_fingerprint"] and binding["page_fingerprint"] and binding["latest_snapshot_fingerprint"]
   with pytest.raises(ValueError,match="independent"):await service.verify(matrix["id"],project_id=pid,actor="author",expected_revision=1,verification_reference="SELF")
   matrix=await service.verify(matrix["id"],project_id=pid,actor="reviewer",expected_revision=1,verification_reference="VERIFY-81")
   with pytest.raises(ValueError,match="independent"):await service.publish(matrix["id"],project_id=pid,context=ctx(pid),actor="reviewer",expected_revision=2,delivery_reference="SELF")
   result=await service.publish(matrix["id"],project_id=pid,context=ctx(pid),actor="publisher",expected_revision=2,delivery_reference="SOCIAL-MATRIX-81")
   with pytest.raises(ValueError,match="independent"):await service.acknowledge(result["publication"]["id"],project_id=pid,actor="publisher",expected_revision=1,acknowledgement_reference="SELF")
   publication=await service.acknowledge(result["publication"]["id"],project_id=pid,actor="client-owner",expected_revision=1,acknowledgement_reference="ACK-81")
   assert publication["status"]=="acknowledged" and (await service.list_workspace(project_id=82))["matrices"]==[]
  await engine.dispose()
 asyncio.run(scenario())
