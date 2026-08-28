"""Controlled calendar lifecycle which pins approved review revisions, never publisher secrets."""
from __future__ import annotations
from datetime import datetime, timezone
import hashlib, json, secrets
from core.tenant_context import TenantContext
from models.factory_content_calendar import FactoryContentCalendar, FactoryContentCalendarEntry, FactoryContentCalendarPublication
from models.social_content_review import SocialContentReview
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
def _id(p): return f"{p}-{secrets.token_urlsafe(16)}"
def _num(p, project): return f"{p}-{project}-{datetime.now(timezone.utc):%Y%m%d%H%M%S}-{secrets.token_hex(3).upper()}"
def _hash(v): return hashlib.sha256(json.dumps(v,ensure_ascii=False,sort_keys=True,default=str,separators=(",",":")).encode()).hexdigest()
def _scope(c, p): return dict(project_id=p,agent_path=c.agent_path,tenant_id=c.tenant_id,client_id=c.client_id,plan_id=c.plan_id or f"plan-{p}")
def _view(x): return {k:getattr(x,k) for k in ("id","calendar_number","calendar_key","calendar_name","market_scope","status","created_by","verified_by","verification_reference","published_by","revision","created_at","updated_at")}
def _entry(x): return {k:getattr(x,k) for k in ("id","entry_number","calendar_id","review_id","review_fingerprint","channel","scheduled_for","created_by","created_at")}
def _pub(x): return {k:getattr(x,k) for k in ("id","publication_number","calendar_id","calendar_number","version_number","manifest_fingerprint","status","published_by","delivery_reference","acknowledged_by","acknowledgement_reference","revision","created_at","acknowledged_at")}
class FactoryContentCalendarService:
 def __init__(self,db): self.db=db
 async def workspace(self,project_id):
  q=lambda model: select(model).where(model.project_id==project_id).order_by(model.created_at.desc())
  calendars=(await self.db.execute(q(FactoryContentCalendar))).scalars().all(); entries=(await self.db.execute(q(FactoryContentCalendarEntry))).scalars().all(); pubs=(await self.db.execute(q(FactoryContentCalendarPublication))).scalars().all()
  return {"calendars":[_view(x) for x in calendars],"entries":[_entry(x) for x in entries],"publications":[_pub(x) for x in pubs],"contract":{"approved_reviews_only":True,"review_revision_pinned":True,"external_publish_dispatched":False,"raw_oauth_credentials_stored":False}}
 async def create(self,*,project_id,context,actor,calendar_key,calendar_name,market_scope):
  key=calendar_key.strip().lower(); name=calendar_name.strip(); scope=market_scope.strip().lower()
  if not key or len(name)<2 or scope not in {"china","overseas","dual"}: raise ValueError("Calendar requires key, name and china, overseas or dual market scope")
  if await self.db.scalar(select(FactoryContentCalendar.id).where(FactoryContentCalendar.project_id==project_id,FactoryContentCalendar.calendar_key==key)): raise ValueError("Content calendar key already exists in this tenant plan")
  x=FactoryContentCalendar(id=_id("content-calendar"),**_scope(context,project_id),calendar_number=_num("CAL",project_id),calendar_key=key[:100],calendar_name=name[:255],market_scope=scope,created_by=actor);self.db.add(x);await self.db.flush();return _view(x)
 async def add_entry(self,calendar_id,*,project_id,context,actor,review_id,channel,scheduled_for):
  calendar=await self._calendar(calendar_id,project_id)
  if calendar.status!="draft": raise ValueError("Content calendar entries can only change while draft")
  review=await self.db.scalar(select(SocialContentReview).where(SocialContentReview.id==review_id,SocialContentReview.project_id==project_id))
  channel=channel.strip().lower()
  if not review or review.status!="approved_for_authorized_publish": raise ValueError("Content calendar requires an approved social content review")
  channels={str(v).strip().lower() for v in json.loads(review.channels_json or "[]")}
  if channel not in channels: raise ValueError("Calendar channel is not approved on the source review")
  fingerprint=_hash({"review_id":review.id,"title":review.title,"content":review.content_text,"channels":sorted(channels),"approved_at":review.headquarters_reviewed_at})
  x=FactoryContentCalendarEntry(id=_id("calendar-entry"),**_scope(context,project_id),entry_number=_num("CALE",project_id),calendar_id=calendar.id,calendar_number=calendar.calendar_number,review_id=review.id,review_fingerprint=fingerprint,channel=channel[:80],scheduled_for=scheduled_for,created_by=actor);self.db.add(x);await self.db.flush();return _entry(x)
 async def verify(self,calendar_id,*,project_id,actor,expected_revision,reference):
  x=await self._calendar(calendar_id,project_id)
  if x.revision!=expected_revision or x.status!="draft": raise ValueError("Content calendar changed; refresh before verification")
  if x.created_by==actor: raise ValueError("Content calendar verification must be independent from creation")
  if not (await self.db.scalar(select(FactoryContentCalendarEntry.id).where(FactoryContentCalendarEntry.calendar_id==x.id))): raise ValueError("Content calendar needs at least one approved review entry")
  x.status="verified";x.verified_by=actor;x.verification_reference=reference.strip()[:255];x.revision+=1;await self.db.flush();return _view(x)
 async def publish(self,calendar_id,*,project_id,context,actor,expected_revision,reference):
  x=await self._calendar(calendar_id,project_id)
  if x.revision!=expected_revision or x.status!="verified": raise ValueError("Content calendar changed; refresh before publication")
  if actor in {x.created_by,x.verified_by}: raise ValueError("Content calendar publication must be independent from author and verifier")
  entries=(await self.db.execute(select(FactoryContentCalendarEntry).where(FactoryContentCalendarEntry.calendar_id==x.id).order_by(FactoryContentCalendarEntry.scheduled_for))).scalars().all()
  manifest={"calendar_number":x.calendar_number,"entries":[{"entry_number":e.entry_number,"review_id":e.review_id,"review_fingerprint":e.review_fingerprint,"channel":e.channel,"scheduled_for":e.scheduled_for.isoformat()} for e in entries],"external_publish_dispatched":False}
  p=FactoryContentCalendarPublication(id=_id("calendar-publication"),**_scope(context,project_id),publication_number=_num("CALP",project_id),calendar_id=x.id,calendar_number=x.calendar_number,version_number=x.revision,manifest_json=json.dumps(manifest,ensure_ascii=False,sort_keys=True),manifest_fingerprint=_hash(manifest),published_by=actor,delivery_reference=reference.strip()[:255]);self.db.add(p);x.status="published";x.published_by=actor;x.revision+=1;await self.db.flush();return {"calendar":_view(x),"publication":_pub(p)}
 async def acknowledge(self,publication_id,*,project_id,actor,expected_revision,reference):
  p=await self.db.scalar(select(FactoryContentCalendarPublication).where(FactoryContentCalendarPublication.id==publication_id,FactoryContentCalendarPublication.project_id==project_id))
  if not p: raise KeyError("Content calendar publication not found in this tenant plan")
  if p.revision!=expected_revision or p.status!="pending": raise ValueError("Content calendar publication changed; refresh before acknowledgement")
  if p.published_by==actor: raise ValueError("Content calendar acknowledgement must be independent from publication")
  p.status="acknowledged";p.acknowledged_by=actor;p.acknowledgement_reference=reference.strip()[:255];p.acknowledged_at=datetime.now(timezone.utc);p.revision+=1;await self.db.flush();return _pub(p)
 async def _calendar(self,id,project):
  x=await self.db.scalar(select(FactoryContentCalendar).where(FactoryContentCalendar.id==id,FactoryContentCalendar.project_id==project))
  if not x: raise KeyError("Content calendar not found in this tenant plan")
  return x
