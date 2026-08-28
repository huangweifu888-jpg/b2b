from __future__ import annotations
from datetime import datetime,timezone
import hashlib,json,secrets
from core.tenant_context import TenantContext
from models.factory_localized_distribution import FactoryLocalizedDistribution as D,FactoryLocalizedDistributionRelease as R
from models.factory_dam_localization import FactoryCountryContentPack
from models.social_content_review import SocialContentReview
from sqlalchemy import select
def hid(x):return hashlib.sha256(json.dumps(x,ensure_ascii=False,sort_keys=True,default=str,separators=(",",":")).encode()).hexdigest()
def iid(p):return f"{p}-{secrets.token_urlsafe(16)}"
def num(p,i):return f"{p}-{i}-{datetime.now(timezone.utc):%Y%m%d%H%M%S}-{secrets.token_hex(3).upper()}"
def scope(c,p):return dict(project_id=p,agent_path=c.agent_path,tenant_id=c.tenant_id,client_id=c.client_id,plan_id=c.plan_id or f"plan-{p}")
def view(x):return {k:getattr(x,k) for k in ("id","distribution_number","distribution_key","review_id","review_fingerprint","pack_id","pack_number","pack_manifest_hash","target_market","target_locale","channel","status","created_by","verified_by","released_by","revision","created_at","updated_at")}
def rel(x):return {k:getattr(x,k) for k in ("id","release_number","distribution_id","version_number","manifest_fingerprint","status","released_by","delivery_reference","acknowledged_by","acknowledgement_reference","revision","created_at","acknowledged_at")}
class FactoryLocalizedDistributionService:
 def __init__(self,db):self.db=db
 async def workspace(self,p):
  ds=(await self.db.execute(select(D).where(D.project_id==p).order_by(D.created_at.desc()))).scalars().all();rs=(await self.db.execute(select(R).where(R.project_id==p).order_by(R.created_at.desc()))).scalars().all();return {"distributions":[view(x) for x in ds],"releases":[rel(x) for x in rs],"contract":{"approved_social_review_required":True,"published_country_pack_required":True,"source_fingerprints_pinned":True,"external_publish_dispatched":False,"raw_oauth_credentials_stored":False}}
 async def create(self,*,project_id,context,actor,distribution_key,review_id,pack_id,channel):
  key=distribution_key.strip().lower();ch=channel.strip().lower();review=await self.db.scalar(select(SocialContentReview).where(SocialContentReview.id==review_id,SocialContentReview.project_id==project_id));pack=await self.db.scalar(select(FactoryCountryContentPack).where(FactoryCountryContentPack.id==pack_id,FactoryCountryContentPack.project_id==project_id))
  if not key or not review or review.status!="approved_for_authorized_publish" or not pack or pack.status!="published":raise ValueError("Distribution requires approved social content and a published country content pack")
  if ch not in {str(x).strip().lower() for x in json.loads(review.channels_json or "[]")}:raise ValueError("Distribution channel is not approved on the source content")
  if await self.db.scalar(select(D.id).where(D.project_id==project_id,D.distribution_key==key)):raise ValueError("Distribution key already exists in this tenant plan")
  fp=hid({"id":review.id,"title":review.title,"content":review.content_text,"channels":json.loads(review.channels_json or "[]"),"approved_at":review.headquarters_reviewed_at});x=D(id=iid("localized-distribution"),**scope(context,project_id),distribution_number=num("LDS",project_id),distribution_key=key[:100],review_id=review.id,review_fingerprint=fp,pack_id=pack.id,pack_number=pack.pack_number,pack_manifest_hash=pack.manifest_hash,target_market=pack.target_market,target_locale=pack.target_locale,channel=ch[:80],created_by=actor);self.db.add(x);await self.db.flush();return view(x)
 async def verify(self,id,*,project_id,actor,expected_revision):
  x=await self.get(id,project_id)
  if x.revision!=expected_revision or x.status!="draft":raise ValueError("Localized distribution changed; refresh before verification")
  if x.created_by==actor:raise ValueError("Localized distribution verification must be independent")
  x.status="verified";x.verified_by=actor;x.revision+=1;await self.db.flush();return view(x)
 async def release(self,id,*,project_id,context,actor,expected_revision,reference):
  x=await self.get(id,project_id)
  if x.revision!=expected_revision or x.status!="verified":raise ValueError("Localized distribution changed; refresh before release")
  if actor in {x.created_by,x.verified_by}:raise ValueError("Localized distribution release must be independent")
  manifest={"distribution_number":x.distribution_number,"review_fingerprint":x.review_fingerprint,"pack_manifest_hash":x.pack_manifest_hash,"market":x.target_market,"locale":x.target_locale,"channel":x.channel,"external_publish_dispatched":False};r=R(id=iid("localized-distribution-release"),**scope(context,project_id),release_number=num("LDR",project_id),distribution_id=x.id,version_number=x.revision,manifest_json=json.dumps(manifest,ensure_ascii=False,sort_keys=True),manifest_fingerprint=hid(manifest),released_by=actor,delivery_reference=reference.strip()[:255]);self.db.add(r);x.status="released";x.released_by=actor;x.revision+=1;await self.db.flush();return {"distribution":view(x),"release":rel(r)}
 async def acknowledge(self,id,*,project_id,actor,expected_revision,reference):
  r=await self.db.scalar(select(R).where(R.id==id,R.project_id==project_id))
  if not r:raise KeyError("Localized distribution release not found in this tenant plan")
  if r.revision!=expected_revision or r.status!="pending":raise ValueError("Localized distribution release changed; refresh before acknowledgement")
  if r.released_by==actor:raise ValueError("Localized distribution acknowledgement must be independent")
  r.status="acknowledged";r.acknowledged_by=actor;r.acknowledgement_reference=reference.strip()[:255];r.acknowledged_at=datetime.now(timezone.utc);r.revision+=1;await self.db.flush();return rel(r)
 async def get(self,id,p):
  x=await self.db.scalar(select(D).where(D.id==id,D.project_id==p))
  if not x:raise KeyError("Localized distribution not found in this tenant plan")
  return x
