"""CDP publishes immutable pointers to approved identity, journey and consent facts."""
from __future__ import annotations
from datetime import datetime,timezone
import hashlib,json,secrets
from core.tenant_context import TenantContext
from models.factory_cdp import FactoryCdpDataProduct,FactoryCdpPublication,FactoryCdpEvidence
from models.factory_identity_resolution import FactoryGoldenProfile,FactoryGoldenProfileVersion
from models.factory_customer_timeline import FactoryCustomerTimeline,FactoryCustomerTimelineVersion
from models.factory_segments_consent import FactoryAudienceSegmentVersion
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
def _id(x):return f"{x}-{secrets.token_urlsafe(18)}"
def _num(x,p):return f"{x}-{p}-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S%f')}-{secrets.token_hex(3).upper()}"
def _hash(x):return hashlib.sha256(json.dumps(x,sort_keys=True,separators=(',',':'),default=str).encode()).hexdigest()
def _ctx(c,p):return dict(project_id=p,agent_path=c.agent_path,tenant_id=c.tenant_id,client_id=c.client_id,plan_id=c.plan_id or f"plan-{p}")
def _view(x):return {k:getattr(x,k) for k in ("id","product_number","product_key","account_reference","profile_version_id","timeline_version_id","segment_version_id","source_manifest_hash","status","created_by","approved_by","approval_reference","revision")}
def _segment_matches_account(version,account):
 manifest=version.manifest_json if isinstance(version.manifest_json,dict) else {}
 return any(str(item.get("account_reference","")).strip()==account for item in manifest.get("members",[]) if isinstance(item,dict))
class FactoryCdpService:
 def __init__(self,db:AsyncSession):self.db=db
 async def list_workspace(self,*,project_id:int):
  q=lambda m,order:select(m).where(m.project_id==project_id).order_by(order.desc())
  products=(await self.db.execute(q(FactoryCdpDataProduct,FactoryCdpDataProduct.created_at))).scalars().all();publications=(await self.db.execute(q(FactoryCdpPublication,FactoryCdpPublication.created_at))).scalars().all();evidence=(await self.db.execute(q(FactoryCdpEvidence,FactoryCdpEvidence.recorded_at))).scalars().all();acks=[x for x in publications if x.status=="acknowledged"]
  profiles=(await self.db.execute(select(FactoryGoldenProfileVersion).where(FactoryGoldenProfileVersion.project_id==project_id,FactoryGoldenProfileVersion.status=="published"))).scalars().all();timelines=(await self.db.execute(select(FactoryCustomerTimelineVersion).where(FactoryCustomerTimelineVersion.project_id==project_id,FactoryCustomerTimelineVersion.status=="published"))).scalars().all();segments=(await self.db.execute(select(FactoryAudienceSegmentVersion).where(FactoryAudienceSegmentVersion.project_id==project_id,FactoryAudienceSegmentVersion.status=="published"))).scalars().all();parents={x.id:x for x in (await self.db.execute(select(FactoryGoldenProfile).where(FactoryGoldenProfile.project_id==project_id,FactoryGoldenProfile.status=="published"))).scalars().all()};journeys={x.id:x for x in (await self.db.execute(select(FactoryCustomerTimeline).where(FactoryCustomerTimeline.project_id==project_id,FactoryCustomerTimeline.status=="published"))).scalars().all()};sources=[]
  for p in profiles:
   parent=parents.get(p.profile_id)
   t=next((item for item in timelines if journeys.get(item.timeline_id) and parent and journeys[item.timeline_id].account_reference==parent.account_reference),None)
   if parent and t:
    for segment in segments:
     if _segment_matches_account(segment,parent.account_reference):sources.append({"account_reference":parent.account_reference,"profile_version_id":p.id,"profile_version_reference":p.version_number_ref,"timeline_version_id":t.id,"timeline_version_reference":t.version_reference,"segment_version_id":segment.id,"segment_version_reference":segment.version_reference})
  return {"products":[_view(x) for x in products],"publications":[{"id":x.id,"publication_number":x.publication_number,"product_id":x.product_id,"consumer":x.consumer,"manifest_hash":x.manifest_hash,"status":x.status,"consumer_mutated":x.consumer_mutated,"revision":x.revision} for x in publications],"evidence":[{"id":x.id,"event_type":x.event_type,"reference":x.reference} for x in evidence],"sources":sources,"metrics":{"released_products":len([x for x in products if x.status=="available"]),"consumer_receipt_percent":round(len(acks)*100/max(1,len(publications)),2)},"contract":{"source_records_copied":False,"raw_identifiers_stored":False,"source_versions_pinned":True,"approval_self_service":False,"consumer_mutated":False,"receipt_required":True}}
 async def create_product(self,*,project_id:int,context:TenantContext,actor:str,product_key:str,profile_version_id:str,timeline_version_id:str,segment_version_id:str):
  profile=await self._get(FactoryGoldenProfileVersion,profile_version_id,project_id,"Profile version");timeline=await self._get(FactoryCustomerTimelineVersion,timeline_version_id,project_id,"Timeline version");segment=await self._get(FactoryAudienceSegmentVersion,segment_version_id,project_id,"Segment version");parent=await self._get(FactoryGoldenProfile,profile.profile_id,project_id,"Profile");journey=await self._get(FactoryCustomerTimeline,timeline.timeline_id,project_id,"Timeline")
  if profile.status!="published" or timeline.status!="published" or segment.status!="published" or parent.status!="published" or journey.status!="published" or parent.account_reference!=journey.account_reference or not _segment_matches_account(segment,parent.account_reference):raise ValueError("CDP requires matching published identity, journey and account-consented segment versions")
  manifest={"profile":{"id":profile.id,"hash":profile.manifest_hash},"timeline":{"id":timeline.id,"hash":timeline.manifest_hash},"segment":{"id":segment.id,"hash":segment.manifest_hash}};now=datetime.now(timezone.utc);x=FactoryCdpDataProduct(id=_id("cdp-product"),**_ctx(context,project_id),product_number=_num("CDP",project_id),product_key=product_key.strip()[:96],account_reference=parent.account_reference,profile_version_id=profile.id,timeline_version_id=timeline.id,segment_version_id=segment.id,source_manifest_json=manifest,source_manifest_hash=_hash(manifest),status="draft",created_by=str(actor),revision=1,created_at=now);self.db.add(x);await self._event(x,"cdp-product-created",product_key,"Pinned published source pointers",actor);await self.db.flush();return _view(x)
 async def approve_product(self,product_id:str,*,project_id:int,actor:str,expected_revision:int,reference:str):
  x=await self._get(FactoryCdpDataProduct,product_id,project_id,"CDP product")
  if x.revision!=expected_revision or x.status!="draft" or x.created_by==str(actor) or not reference.strip() or _hash(x.source_manifest_json)!=x.source_manifest_hash:raise ValueError("CDP product requires unchanged source manifest and independent approval")
  x.status="approved";x.approved_by=str(actor);x.approval_reference=reference[:255];x.approved_at=datetime.now(timezone.utc);x.revision+=1;await self._event(x,"cdp-product-approved",reference,"Independently approved immutable data product",actor);await self.db.flush();return _view(x)
 async def publish_product(self,product_id:str,*,project_id:int,context:TenantContext,actor:str,expected_revision:int,consumers:list[str]):
  x=await self._get(FactoryCdpDataProduct,product_id,project_id,"CDP product");allowed={"crm","marketing","sales","service"};requested=sorted(set(consumers))
  if x.revision!=expected_revision or x.status!="approved" or x.approved_by==str(actor) or not requested or not set(requested)<=allowed:raise ValueError("CDP requires independent release and supported consumers")
  await self._validate_sources(x)
  now=datetime.now(timezone.utc);out=[]
  for consumer in requested:
   p=FactoryCdpPublication(id=_id("cdp-publication"),**_ctx(context,project_id),publication_number=_num("CDP-PUB",project_id),product_id=x.id,product_number=x.product_number,consumer=consumer,manifest_hash=x.source_manifest_hash,status="pending",consumer_mutated=False,created_by=str(actor),revision=1,created_at=now);self.db.add(p);out.append(p);await self._event(p,"cdp-publication-created",consumer,"Consumer receipt required; no source mutation",actor)
  x.status="available";x.revision+=1;await self._event(x,"cdp-product-released",x.product_number,"Released frozen pointer manifest",actor);await self.db.flush();return {"product":_view(x),"publications":[{"id":p.id,"publication_number":p.publication_number,"status":p.status,"revision":p.revision} for p in out]}
 async def acknowledge_publication(self,publication_id:str,*,project_id:int,actor:str,expected_revision:int,reference:str):
  x=await self._get(FactoryCdpPublication,publication_id,project_id,"CDP publication")
  if x.revision!=expected_revision or x.status!="pending" or x.created_by==str(actor) or not reference.strip():raise ValueError("CDP consumer receipt must be independent")
  x.status="acknowledged";x.acknowledged_by=str(actor);x.receipt_reference=reference[:255];x.acknowledged_at=datetime.now(timezone.utc);x.revision+=1;await self._event(x,"cdp-consumer-acknowledged",reference,"Consumer acknowledged exact frozen manifest",actor);await self.db.flush();return {"id":x.id,"status":x.status,"revision":x.revision}
 async def _get(self,m,i,p,label):
  x=await self.db.scalar(select(m).where(m.id==i,m.project_id==p))
  if not x:raise KeyError(f"{label} not found")
  return x
 async def _validate_sources(self,x):
  profile=await self._get(FactoryGoldenProfileVersion,x.profile_version_id,x.project_id,"Profile version");timeline=await self._get(FactoryCustomerTimelineVersion,x.timeline_version_id,x.project_id,"Timeline version");segment=await self._get(FactoryAudienceSegmentVersion,x.segment_version_id,x.project_id,"Segment version");parent=await self._get(FactoryGoldenProfile,profile.profile_id,x.project_id,"Profile");journey=await self._get(FactoryCustomerTimeline,timeline.timeline_id,x.project_id,"Timeline");manifest={"profile":{"id":profile.id,"hash":profile.manifest_hash},"timeline":{"id":timeline.id,"hash":timeline.manifest_hash},"segment":{"id":segment.id,"hash":segment.manifest_hash}}
  if profile.status!="published" or timeline.status!="published" or segment.status!="published" or parent.status!="published" or journey.status!="published" or parent.account_reference!=x.account_reference or journey.account_reference!=x.account_reference or not _segment_matches_account(segment,x.account_reference) or _hash(manifest)!=x.source_manifest_hash or manifest!=x.source_manifest_json:raise ValueError("CDP source versions drifted, changed account, or are no longer published")
 async def _event(self,x,event,reference,note,actor):
  num=getattr(x,"product_number",getattr(x,"publication_number",x.id));self.db.add(FactoryCdpEvidence(id=_id("cdp-evidence"),project_id=x.project_id,agent_path=x.agent_path,tenant_id=x.tenant_id,client_id=x.client_id,plan_id=x.plan_id,evidence_number=_num("CDP-EV",x.project_id),subject_id=x.id,event_type=event,reference=str(reference)[:255],note=note,recorded_by=str(actor),recorded_at=datetime.now(timezone.utc)))
