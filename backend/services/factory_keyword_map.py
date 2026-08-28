"""Search-demand evidence to approved topic-map handoffs; no ranking promise."""
from datetime import datetime,timezone
import hashlib,json,secrets
from typing import Any
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from core.tenant_context import TenantContext
from models.factory_contract import FactoryCoreEventContract,FactoryCoreObjectContract
from models.factory_keyword_map import FactoryKeywordMapStudy,FactoryKeywordMapVersion,FactoryKeywordMapRelease,FactoryKeywordMapEvidence
APPLICATION_ID="trust.keyword-map";FORBIDDEN={"password","secret","token","api_key","credential","customer_email","customer_phone"};STUDY=("id","study_number","market","source_reference","observed_on","status","revision");VERSION=("id","version_number","study_id","study_number","manifest_hash","status","authored_by","verified_by","revision");RELEASE=("id","release_number","study_id","version_id","version_number","target","status","available","consumer_receipt_reference","revision")
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
class FactoryKeywordMapService:
 def __init__(self,db:AsyncSession):self.db=db
 async def workspace(self,*,project_id):
  async def rows(m,o):return list((await self.db.execute(select(m).where(m.project_id==project_id).order_by(o.desc()).limit(500))).scalars().all())
  studies=await rows(FactoryKeywordMapStudy,FactoryKeywordMapStudy.created_at);versions=await rows(FactoryKeywordMapVersion,FactoryKeywordMapVersion.created_at);releases=await rows(FactoryKeywordMapRelease,FactoryKeywordMapRelease.prepared_at);evidence=await rows(FactoryKeywordMapEvidence,FactoryKeywordMapEvidence.recorded_at);ready=[x for x in releases if x.status=="available" and x.available]
  return {"studies":[_pick(x,STUDY) for x in studies],"versions":[_pick(x,VERSION) for x in versions],"releases":[_pick(x,RELEASE) for x in releases],"evidence":[{"id":x.id,"evidence_type":x.evidence_type,"evidence_reference":x.evidence_reference} for x in evidence],"metrics":{"source_studies":len(studies),"verified_topic_maps":sum(x.status=="verified" for x in versions),"acknowledged_activations":len(ready),"evidence_records":len(evidence)},"availability":{"application_id":APPLICATION_ID,"status":"available" if ready else "pilot","release_version":ready[0].version_number if ready else None},"contract":{"search_data_source_recorded":True,"search_volume_or_difficulty_guaranteed":False,"ranking_guaranteed":False,"version_self_verification":False,"release_self_approval":False,"consumer_handoff_required":True}}
 async def create_study(self,*,project_id,context,actor,market,source_reference,observed_on):
  if not all(str(v).strip() for v in(market,source_reference,observed_on)):raise ValueError("Keyword study requires market, search-data source and observed date")
  x=FactoryKeywordMapStudy(id=_id("keyword-study"),**_ctx(context,project_id),study_number=_no("KMS",project_id),market=market.strip()[:80],source_reference=source_reference.strip()[:255],observed_on=observed_on.strip()[:32],status="active",created_by=str(actor),created_at=datetime.now(timezone.utc),revision=1);self.db.add(x);await self._event(x,"study","keyword-source-registered",x.source_reference,"Search source and observed date are referenced, never asserted as a ranking guarantee",actor);await self.db.flush();return _pick(x,STUDY)
 async def draft_version(self,study_id,*,project_id,context,actor,topic_manifest):
  s=await self._get(FactoryKeywordMapStudy,study_id,project_id,"Keyword study")
  if s.status!="active" or not topic_manifest or _unsafe(topic_manifest):raise ValueError("Topic map requires active study and safe source-dated topic manifest")
  payload={"study_number":s.study_number,"market":s.market,"source_reference":s.source_reference,"observed_on":s.observed_on,"topic_manifest":topic_manifest};x=FactoryKeywordMapVersion(id=_id("keyword-version"),**_same(s),version_number=_no("KMV",project_id),study_id=s.id,study_number=s.study_number,topic_manifest_json=topic_manifest,manifest_hash=_hash(payload),status="draft",authored_by=str(actor),created_at=datetime.now(timezone.utc),revision=1);self.db.add(x);await self._event(x,"version","keyword-topic-map-drafted",x.manifest_hash,"Topic map keeps market, source and observed-date provenance",actor);await self.db.flush();return _pick(x,VERSION)
 async def verify_version(self,version_id,*,project_id,actor,expected_revision,verification_reference):
  x=await self._get(FactoryKeywordMapVersion,version_id,project_id,"Keyword map version");self._rev(x,expected_revision);s=await self._get(FactoryKeywordMapStudy,x.study_id,project_id,"Keyword study");expected=_hash({"study_number":s.study_number,"market":s.market,"source_reference":s.source_reference,"observed_on":s.observed_on,"topic_manifest":x.topic_manifest_json})
  if x.status!="draft" or x.authored_by==str(actor) or not verification_reference.strip() or x.manifest_hash!=expected:raise ValueError("Topic map requires independent verification of unchanged source-dated evidence")
  x.status="verified";x.verified_by=str(actor);x.verified_at=datetime.now(timezone.utc);x.verification_reference=verification_reference.strip()[:255];x.revision+=1;await self._event(x,"version","keyword-topic-map-verified",x.verification_reference,"Independent verifier accepted source provenance and map hash",actor);await self.db.flush();return _pick(x,VERSION)
 async def prepare_release(self,version_id,*,project_id,context,actor,target,activation_manifest,rollback_reference):
  v=await self._get(FactoryKeywordMapVersion,version_id,project_id,"Keyword map version");s=await self._get(FactoryKeywordMapStudy,v.study_id,project_id,"Keyword study")
  if v.status!="verified" or target not in {"content-team","seo-operations","sales-enablement"} or not activation_manifest or _unsafe(activation_manifest) or not rollback_reference.strip():raise ValueError("Activation requires verified map, safe plan, allowed target and rollback reference")
  m={"application_id":APPLICATION_ID,"study_number":s.study_number,"version_number":v.version_number,"source_manifest_hash":v.manifest_hash,"market":s.market,"source_reference":s.source_reference,"observed_on":s.observed_on,"target":target,"activation_manifest":activation_manifest,"ranking_guaranteed":False,"consumer_receipt_required":True,"rollback_reference":rollback_reference.strip()};x=FactoryKeywordMapRelease(id=_id("keyword-release"),**_ctx(context,project_id),release_number=_no("KMR",project_id),study_id=s.id,version_id=v.id,version_number=v.version_number,target=target,activation_manifest_json=m,manifest_hash=_hash(m),rollback_reference=rollback_reference.strip()[:255],status="pending-approval",prepared_by=str(actor),available=False,prepared_at=datetime.now(timezone.utc),revision=1);self.db.add(x);await self._event(x,"release","keyword-topic-map-prepared",x.manifest_hash,"Handoff does not create content, buy traffic or guarantee ranking",actor);await self.db.flush();return _pick(x,RELEASE)
 async def approve_release(self,release_id,*,project_id,actor,expected_revision,approval_reference):
  x=await self._get(FactoryKeywordMapRelease,release_id,project_id,"Keyword map activation");self._rev(x,expected_revision);v=await self._get(FactoryKeywordMapVersion,x.version_id,project_id,"Keyword map version");o=await self.db.scalar(select(FactoryCoreObjectContract).where(FactoryCoreObjectContract.id=="keyword-topic-map-version",FactoryCoreObjectContract.lifecycle_status=="frozen"));e=await self.db.scalar(select(FactoryCoreEventContract).where(FactoryCoreEventContract.id=="keyword-topic-map-released",FactoryCoreEventContract.lifecycle_status=="frozen"))
  if x.status!="pending-approval" or x.prepared_by==str(actor) or not approval_reference.strip() or x.manifest_hash!=_hash(x.activation_manifest_json) or v.status!="verified" or not o or not e:raise ValueError("Activation requires independent approval, frozen contracts and unchanged verified topic map")
  x.status="approved";x.approved_by=str(actor);x.approval_reference=approval_reference.strip()[:255];x.revision+=1;await self._event(x,"release","keyword-topic-map-approved",x.approval_reference,"Awaiting consumer acknowledgement; no downstream content is changed",actor);await self.db.flush();return _pick(x,RELEASE)
 async def acknowledge_release(self,release_id,*,project_id,actor,expected_revision,consumer_receipt_reference):
  x=await self._get(FactoryKeywordMapRelease,release_id,project_id,"Keyword map activation");self._rev(x,expected_revision)
  if x.status!="approved" or x.approved_by==str(actor) or not consumer_receipt_reference.strip():raise ValueError("Consumer acknowledgement requires independently approved keyword-map handoff")
  x.status="available";x.available=True;x.consumer_receipt_reference=consumer_receipt_reference.strip()[:255];x.acknowledged_at=datetime.now(timezone.utc);x.revision+=1;await self._event(x,"release","keyword-topic-map-released",x.consumer_receipt_reference,"Consumer accepted the bounded topic-map handoff",actor);await self.db.flush();return _pick(x,RELEASE)
 async def _get(self,m,item_id,project_id,label):
  x=await self.db.scalar(select(m).where(m.id==item_id,m.project_id==project_id))
  if not x:raise KeyError(f"{label} not found in this tenant plan")
  return x
 @staticmethod
 def _rev(x,e):
  if int(x.revision)!=int(e):raise ValueError("Revision conflict")
 async def _event(self,x,subject_type,evidence_type,reference,note,actor):
  n=next((getattr(x,k,None) for k in("study_number","version_number","release_number") if getattr(x,k,None)),str(x.id));self.db.add(FactoryKeywordMapEvidence(id=_id("keyword-evidence"),**_same(x),evidence_number=_no("KME",x.project_id),subject_type=subject_type,subject_id=x.id,subject_number=n,evidence_type=evidence_type,evidence_reference=str(reference)[:255],note=note,recorded_by=str(actor),recorded_at=datetime.now(timezone.utc)))
