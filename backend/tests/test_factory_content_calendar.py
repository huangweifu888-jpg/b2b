import asyncio
from datetime import datetime, timezone
import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
import models  # noqa: F401
from core.database import Base
from core.tenant_context import build_tenant_context
from models.social_content_review import SocialContentReview
from services.factory_content_calendar import FactoryContentCalendarService

def ctx(): return build_tenant_context(agent_path="hq/social",tenant_id="tenant-calendar",client_id="client-calendar",plan_id="plan-89")
def scope(): return dict(project_id=89,agent_path="hq/social",tenant_id="tenant-calendar",client_id="client-calendar",plan_id="plan-89")
def test_content_calendar_pins_approved_review_and_requires_separation():
 async def scenario():
  engine=create_async_engine("sqlite+aiosqlite:///:memory:")
  async with engine.begin() as c: await c.run_sync(Base.metadata.create_all)
  async with async_sessionmaker(engine,expire_on_commit=False)() as db:
   review=SocialContentReview(id="social-content-approved",**scope(),title="Approved campaign",content_text="Governed factory content",channels_json='["linkedin"]',status="approved_for_authorized_publish",submitted_by="client",agency_reviewed_by="agency",headquarters_reviewed_by="hq",headquarters_reviewed_at=datetime.now(timezone.utc))
   db.add(review);await db.flush();s=FactoryContentCalendarService(db)
   cal=await s.create(project_id=89,context=ctx(),actor="author",calendar_key="q4-global",calendar_name="Q4 global calendar",market_scope="dual")
   item=await s.add_entry(cal["id"],project_id=89,context=ctx(),actor="author",review_id=review.id,channel="linkedin",scheduled_for=datetime.now(timezone.utc));assert item["review_fingerprint"]
   with pytest.raises(ValueError,match="independent"): await s.verify(cal["id"],project_id=89,actor="author",expected_revision=1,reference="VERIFY-89")
   cal=await s.verify(cal["id"],project_id=89,actor="reviewer",expected_revision=1,reference="VERIFY-89")
   with pytest.raises(ValueError,match="independent"): await s.publish(cal["id"],project_id=89,context=ctx(),actor="reviewer",expected_revision=2,reference="PUB-89")
   result=await s.publish(cal["id"],project_id=89,context=ctx(),actor="publisher",expected_revision=2,reference="PUB-89")
   with pytest.raises(ValueError,match="independent"): await s.acknowledge(result["publication"]["id"],project_id=89,actor="publisher",expected_revision=1,reference="ACK-89")
   pub=await s.acknowledge(result["publication"]["id"],project_id=89,actor="client-owner",expected_revision=1,reference="ACK-89")
   assert pub["status"]=="acknowledged" and (await s.workspace(90))["calendars"]==[]
  await engine.dispose()
 asyncio.run(scenario())
