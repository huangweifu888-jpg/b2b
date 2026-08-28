"""Page-SEO recommendations through independent review and consumer handoff."""
from datetime import datetime,timezone
import hashlib,json,secrets
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from models.factory_contract import FactoryCoreEventContract,FactoryCoreObjectContract
from models.factory_onpage_seo import FactoryOnPageSeoPage,FactoryOnPageSeoVersion,FactoryOnPageSeoRelease,FactoryOnPageSeoEvidence
APPLICATION_ID="trust.onpage";FORBIDDEN={"password","secret","token","api_key","credential","customer_email","customer_phone"};PAGE=("id","page_number","page_reference","source_reference","locale","status","revision");VERSION=("id","version_number","page_id","page_number","manifest_hash","status","authored_by","reviewed_by","revision");RELEASE=("id","release_number","page_id","version_id","version_number","target","status","available","consumer_receipt_reference","revision")
def _id(x):return f"{x}-{secrets.token_urlsafe(18)}"
def _no(x,p):return f"{x}-{p}-{datetime.now(timezone.utc):%Y%m%d%H%M%S%f}-{secrets.token_hex(3).upper()}"
def _hash(x):return hashlib.sha256(json.dumps(x,ensure_ascii=False,sort_keys=True,separators=(",",":"),default=str).encode()).hexdigest()
def _ctx(c,p):return {"project_id":p,"agent_path":c.agent_path,"tenant_id":c.tenant_id,"client_id":c.client_id,"plan_id":c.plan_id or f"plan-{p}"}
def _same(x):return {n:getattr(x,n) for n in("project_id","agent_path","tenant_id","client_id","plan_id")}
def _pick(x,n):return {k:getattr(x,k) for k in n}
def _unsafe(v):
 if isinstance(v,dict):return any(str(k).casefold() in FORBIDDEN or _unsafe(i) for k,i in v.items())
 if isinstance(v,list):return any(_unsafe(i) for i in v)
 return isinstance(v,str) and ("<script" in v.casefold() or "javascript:" in v.casefold())
class FactoryOnPageSeoService:
 def __init__(self,db:AsyncSession):self.db=db
 async def workspace(self,*,project_id):
  async def rows(m,o):return list((await self.db.execute(select(m).where(m.project_id==project_id).order_by(o.desc()).limit(500))).scalars().all())
  pages=await rows(FactoryOnPageSeoPage,FactoryOnPageSeoPage.created_at);versions=await rows(FactoryOnPageSeoVersion,FactoryOnPageSeoVersion.created_at);releases=await rows(FactoryOnPageSeoRelease,FactoryOnPageSeoRelease.prepared_at);evidence=await rows(FactoryOnPageSeoEvidence,FactoryOnPageSeoEvidence.recorded_at);ready=[x for x in releases if x.status=="available" and x.available]
  return {"pages":[_pick(x,PAGE) for x in pages],"versions":[_pick(x,VERSION) for x in versions],"releases":[_pick(x,RELEASE) for x in releases],"evidence":[{"id":x.id,"evidence_type":x.evidence_type,"evidence_reference":x.evidence_reference} for x in evidence],"metrics":{"source_pages":len(pages),"reviewed_suggestions":sum(x.status=="reviewed" for x in versions),"acknowledged_handoffs":len(ready),"evidence_records":len(evidence)},"availability":{"application_id":APPLICATION_ID,"status":"available" if ready else "pilot","release_version":ready[0].version_number if ready else None},"contract":{"source_page_mutated_directly":False,"meta_or_internal_links_auto_published":False,"ranking_guaranteed":False,"version_self_review":False,"release_self_approval":False,"consumer_handoff_required":True}}
 async def create_page(self,*,project_id,context,actor,page_reference,source_reference,locale):
  if not all(str(v).strip() for v in(page_reference,source_reference,locale)):raise ValueError("Page SEO record requires page, source and locale references")
  x=FactoryOnPageSeoPage(id=_id("onpage-page"),**_ctx(context,project_id),page_number=_no("OPS",project_id),page_reference=page_reference.strip()[:255],source_reference=source_reference.strip()[:255],locale=locale.strip()[:32],status="active",created_by=str(actor),created_at=datetime.now(timezone.utc),revision=1);self.db.add(x);await self._event(x,"page","onpage-source-registered",x.source_reference,"Source page remains unchanged; recommendations require review",actor);await self.db.flush();return _pick(x,PAGE)
 async def draft_version(self,page_id,*,project_id,context,actor,suggestion_manifest):
  p=await self._get(FactoryOnPageSeoPage,page_id,project_id,"Page SEO record")
  if p.status!="active" or not suggestion_manifest or _unsafe(suggestion_manifest):raise ValueError("Suggestion requires active page and safe manifest")
  payload={"page_number":p.page_number,"page_reference":p.page_reference,"source_reference":p.source_reference,"locale":p.locale,"suggestion_manifest":suggestion_manifest};x=FactoryOnPageSeoVersion(id=_id("onpage-version"),**_same(p),version_number=_no("OPV",project_id),page_id=p.id,page_number=p.page_number,suggestion_manifest_json=suggestion_manifest,manifest_hash=_hash(payload),status="draft",authored_by=str(actor),created_at=datetime.now(timezone.utc),revision=1);self.db.add(x);await self._event(x,"version","onpage-suggestion-drafted",x.manifest_hash,"Suggestion is a controlled proposal, never an automatic page change",actor);await self.db.flush();return _pick(x,VERSION)
 async def review_version(self,version_id,*,project_id,actor,expected_revision,review_reference):
  x=await self._get(FactoryOnPageSeoVersion,version_id,project_id,"Page SEO version");self._rev(x,expected_revision);p=await self._get(FactoryOnPageSeoPage,x.page_id,project_id,"Page SEO record");expected=_hash({"page_number":p.page_number,"page_reference":p.page_reference,"source_reference":p.source_reference,"locale":p.locale,"suggestion_manifest":x.suggestion_manifest_json})
  if x.status!="draft" or x.authored_by==str(actor) or not review_reference.strip() or x.manifest_hash!=expected:raise ValueError("Suggestion requires independent review of unchanged page source")
  x.status="reviewed";x.reviewed_by=str(actor);x.reviewed_at=datetime.now(timezone.utc);x.review_reference=review_reference.strip()[:255];x.revision+=1;await self._event(x,"version","onpage-suggestion-reviewed",x.review_reference,"Independent reviewer accepted the source-bound suggestion",actor);await self.db.flush();return _pick(x,VERSION)
 async def prepare_release(self,version_id,*,project_id,context,actor,target,handoff_manifest,rollback_reference):
  v=await self._get(FactoryOnPageSeoVersion,version_id,project_id,"Page SEO version");p=await self._get(FactoryOnPageSeoPage,v.page_id,project_id,"Page SEO record")
  if v.status!="reviewed" or target not in {"content-owner","seo-operations","web-editor"} or not handoff_manifest or _unsafe(handoff_manifest) or not rollback_reference.strip():raise ValueError("Handoff requires reviewed suggestion, safe plan, allowed target and rollback reference")
  m={"application_id":APPLICATION_ID,"page_number":p.page_number,"version_number":v.version_number,"source_manifest_hash":v.manifest_hash,"page_reference":p.page_reference,"source_reference":p.source_reference,"locale":p.locale,"target":target,"handoff_manifest":handoff_manifest,"automatic_page_change":False,"ranking_guaranteed":False,"consumer_receipt_required":True,"rollback_reference":rollback_reference.strip()};x=FactoryOnPageSeoRelease(id=_id("onpage-release"),**_ctx(context,project_id),release_number=_no("OPR",project_id),page_id=p.id,version_id=v.id,version_number=v.version_number,target=target,handoff_manifest_json=m,manifest_hash=_hash(m),rollback_reference=rollback_reference.strip()[:255],status="pending-approval",prepared_by=str(actor),available=False,prepared_at=datetime.now(timezone.utc),revision=1);self.db.add(x);await self._event(x,"release","onpage-handoff-prepared",x.manifest_hash,"Handoff does not publish meta, links or page content",actor);await self.db.flush();return _pick(x,RELEASE)
 async def approve_release(self,release_id,*,project_id,actor,expected_revision,approval_reference):
  x=await self._get(FactoryOnPageSeoRelease,release_id,project_id,"Page SEO handoff");self._rev(x,expected_revision);v=await self._get(FactoryOnPageSeoVersion,x.version_id,project_id,"Page SEO version");o=await self.db.scalar(select(FactoryCoreObjectContract).where(FactoryCoreObjectContract.id=="onpage-seo-suggestion-version",FactoryCoreObjectContract.lifecycle_status=="frozen"));e=await self.db.scalar(select(FactoryCoreEventContract).where(FactoryCoreEventContract.id=="onpage-seo-handoff-released",FactoryCoreEventContract.lifecycle_status=="frozen"))
  if x.status!="pending-approval" or x.prepared_by==str(actor) or not approval_reference.strip() or x.manifest_hash!=_hash(x.handoff_manifest_json) or v.status!="reviewed" or not o or not e:raise ValueError("Handoff requires independent approval, frozen contracts and unchanged reviewed suggestion")
  x.status="approved";x.approved_by=str(actor);x.approval_reference=approval_reference.strip()[:255];x.revision+=1;await self._event(x,"release","onpage-handoff-approved",x.approval_reference,"Awaiting content-owner acknowledgement; nothing is published",actor);await self.db.flush();return _pick(x,RELEASE)
 async def acknowledge_release(self,release_id,*,project_id,actor,expected_revision,consumer_receipt_reference):
  x=await self._get(FactoryOnPageSeoRelease,release_id,project_id,"Page SEO handoff");self._rev(x,expected_revision)
  if x.status!="approved" or x.approved_by==str(actor) or not consumer_receipt_reference.strip():raise ValueError("Consumer acknowledgement requires independently approved page-SEO handoff")
  x.status="available";x.available=True;x.consumer_receipt_reference=consumer_receipt_reference.strip()[:255];x.acknowledged_at=datetime.now(timezone.utc);x.revision+=1;await self._event(x,"release","onpage-seo-handoff-released",x.consumer_receipt_reference,"Consumer accepted the bounded recommendation handoff",actor);await self.db.flush();return _pick(x,RELEASE)
 async def _get(self,m,item_id,project_id,label):
  x=await self.db.scalar(select(m).where(m.id==item_id,m.project_id==project_id))
  if not x:raise KeyError(f"{label} not found in this tenant plan")
  return x
 @staticmethod
 def _rev(x,e):
  if int(x.revision)!=int(e):raise ValueError("Revision conflict")
 async def _event(self,x,subject_type,evidence_type,reference,note,actor):
  n=next((getattr(x,k,None) for k in("page_number","version_number","release_number") if getattr(x,k,None)),str(x.id));self.db.add(FactoryOnPageSeoEvidence(id=_id("onpage-evidence"),**_same(x),evidence_number=_no("OPE",x.project_id),subject_type=subject_type,subject_id=x.id,subject_number=n,evidence_type=evidence_type,evidence_reference=str(reference)[:255],note=note,recorded_by=str(actor),recorded_at=datetime.now(timezone.utc)))
