import asyncio
from datetime import datetime,timezone
import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker,create_async_engine
import models
from core.database import Base
from core.tenant_context import build_tenant_context
from models.factory_dam_localization import FactoryCountryContentPack
from models.social_content_review import SocialContentReview
from services.factory_localized_distribution import FactoryLocalizedDistributionService as S
def ctx():return build_tenant_context(agent_path="hq/social",tenant_id="tenant-l",client_id="client-l",plan_id="plan-91")
def scope():return dict(project_id=91,agent_path="hq/social",tenant_id="tenant-l",client_id="client-l",plan_id="plan-91")
def test_localized_distribution_pins_approved_content_and_published_pack():
 async def run():
  e=create_async_engine("sqlite+aiosqlite:///:memory:")
  async with e.begin()as c:await c.run_sync(Base.metadata.create_all)
  async with async_sessionmaker(e,expire_on_commit=False)()as db:
   review=SocialContentReview(id="review-approved",**scope(),title="Factory localized post",content_text="Controlled message",channels_json='["linkedin"]',status="approved_for_authorized_publish",submitted_by="client",headquarters_reviewed_at=datetime.now(timezone.utc));pack=FactoryCountryContentPack(id="pack-published",**scope(),pack_number="PACK-91",pack_code="US-91",pack_name="US pack",version_number=1,target_market="US",target_locale="en-US",rendition_ids_json=[],manifest_hash="a"*64,compliance_assessment_reference="US-COMP",tax_reviewed=True,privacy_reviewed=True,market_access_reviewed=True,status="published",created_by="owner",revision=1,created_at=datetime.now(timezone.utc));db.add_all([review,pack]);await db.flush();s=S(db);x=await s.create(project_id=91,context=ctx(),actor="author",distribution_key="us-linkedin",review_id=review.id,pack_id=pack.id,channel="linkedin");assert x["review_fingerprint"] and x["pack_manifest_hash"]=="a"*64
   with pytest.raises(ValueError,match="independent"):await s.verify(x["id"],project_id=91,actor="author",expected_revision=1)
   x=await s.verify(x["id"],project_id=91,actor="reviewer",expected_revision=1)
   with pytest.raises(ValueError,match="independent"):await s.release(x["id"],project_id=91,context=ctx(),actor="reviewer",expected_revision=2,reference="REL")
   r=await s.release(x["id"],project_id=91,context=ctx(),actor="publisher",expected_revision=2,reference="REL")
   with pytest.raises(ValueError,match="independent"):await s.acknowledge(r["release"]["id"],project_id=91,actor="publisher",expected_revision=1,reference="ACK")
   assert (await s.acknowledge(r["release"]["id"],project_id=91,actor="client",expected_revision=1,reference="ACK"))["status"]=="acknowledged"
  await e.dispose()
 asyncio.run(run())
