"""Public-mention governance: no fabricated reviews, endorsements or automatic replies."""
from datetime import datetime,timezone
import hashlib,json,secrets
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from models.factory_contract import FactoryCoreEventContract,FactoryCoreObjectContract
from models.factory_reputation import FactoryReputationMention,FactoryReputationAssessment,FactoryReputationRelease,FactoryReputationEvidence
APPLICATION_ID="trust.reputation";FORBIDDEN={"password","secret","token","api_key","credential","customer_email","customer_phone","fake_review","fabricated_endorsement"};MENTION=("id","mention_number","public_reference","channel","sentiment","observed_on","status","revision");ASSESSMENT=("id","assessment_number","mention_id","mention_number","manifest_hash","status","authored_by","verified_by","revision");RELEASE=("id","release_number","mention_id","assessment_id","assessment_number","target","status","available","consumer_receipt_reference","revision")
def _id(x):return f"{x}-{secrets.token_urlsafe(18)}"
def _no(x,p):return f"{x}-{p}-{datetime.now(timezone.utc):%Y%m%d%H%M%S%f}-{secrets.token_hex(3).upper()}"
def _hash(x):return hashlib.sha256(json.dumps(x,ensure_ascii=False,sort_keys=True,separators=(",",":"),default=str).encode()).hexdigest()
def _ctx(c,p):return {"project_id":p,"agent_path":c.agent_path,"tenant_id":c.tenant_id,"client_id":c.client_id,"plan_id":c.plan_id or f"plan-{p}"}
def _same(x):return {n:getattr(x,n) for n in("project_id","agent_path","tenant_id","client_id","plan_id")}
def _pick(x,n):return {k:getattr(x,k) for k in n}
def _unsafe(v):
 if isinstance(v,dict):return any(str(k).casefold() in FORBIDDEN or _unsafe(i) for k,i in v.items())
 if isinstance(v,list):return any(_unsafe(i) for i in v)
 return isinstance(v,str) and ("<script" in v.casefold() or "javascript:" in v.casefold() or "fabricate" in v.casefold() or "fake review" in v.casefold())
class FactoryReputationService:
 def __init__(self,db:AsyncSession):self.db=db
 async def workspace(self,*,project_id):
  async def rows(m,o):return list((await self.db.execute(select(m).where(m.project_id==project_id).order_by(o.desc()).limit(500))).scalars().all())
  mentions=await rows(FactoryReputationMention,FactoryReputationMention.created_at);assessments=await rows(FactoryReputationAssessment,FactoryReputationAssessment.created_at);releases=await rows(FactoryReputationRelease,FactoryReputationRelease.prepared_at);evidence=await rows(FactoryReputationEvidence,FactoryReputationEvidence.recorded_at);ready=[x for x in releases if x.status=="available" and x.available]
  return {"mentions":[_pick(x,MENTION) for x in mentions],"assessments":[_pick(x,ASSESSMENT) for x in assessments],"releases":[_pick(x,RELEASE) for x in releases],"evidence":[{"id":x.id,"evidence_type":x.evidence_type,"evidence_reference":x.evidence_reference} for x in evidence],"metrics":{"public_mentions":len(mentions),"verified_assessments":sum(x.status=="verified" for x in assessments),"acknowledged_handoffs":len(ready),"evidence_records":len(evidence)},"availability":{"application_id":APPLICATION_ID,"status":"available" if ready else "pilot","release_version":ready[0].assessment_number if ready else None},"contract":{"public_mention_mutated_directly":False,"fabricated_review_or_endorsement":False,"automatic_public_reply":False,"assessment_self_verification":False,"release_self_approval":False,"consumer_handoff_required":True}}
 async def create_mention(self,*,project_id,context,actor,public_reference,channel,sentiment,observed_on):
  if not all(str(v).strip() for v in(public_reference,channel,sentiment,observed_on)) or sentiment not in {"positive","neutral","negative"}:raise ValueError("Mention requires public reference, channel, valid sentiment and observed date")
  x=FactoryReputationMention(id=_id("reputation-mention"),**_ctx(context,project_id),mention_number=_no("RPM",project_id),public_reference=public_reference.strip()[:255],channel=channel.strip()[:48],sentiment=sentiment,status="registered",observed_on=observed_on.strip()[:32],created_by=str(actor),created_at=datetime.now(timezone.utc),revision=1);self.db.add(x);await self._event(x,"mention","public-mention-registered",x.public_reference,"Public mention is referenced, never created or edited by this platform",actor);await self.db.flush();return _pick(x,MENTION)
 async def draft_assessment(self,mention_id,*,project_id,context,actor,assessment_manifest):
  m=await self._get(FactoryReputationMention,mention_id,project_id,"Public mention")
  if m.status!="registered" or not assessment_manifest or _unsafe(assessment_manifest):raise ValueError("Assessment requires registered mention and safe factual manifest")
  payload={"mention_number":m.mention_number,"public_reference":m.public_reference,"channel":m.channel,"sentiment":m.sentiment,"observed_on":m.observed_on,"assessment_manifest":assessment_manifest};x=FactoryReputationAssessment(id=_id("reputation-assessment"),**_same(m),assessment_number=_no("RPA",project_id),mention_id=m.id,mention_number=m.mention_number,assessment_manifest_json=assessment_manifest,manifest_hash=_hash(payload),status="draft",authored_by=str(actor),created_at=datetime.now(timezone.utc),revision=1);self.db.add(x);await self._event(x,"assessment","reputation-assessment-drafted",x.manifest_hash,"Assessment does not alter public review, media mention or backlink",actor);await self.db.flush();return _pick(x,ASSESSMENT)
 async def verify_assessment(self,assessment_id,*,project_id,actor,expected_revision,verification_reference):
  x=await self._get(FactoryReputationAssessment,assessment_id,project_id,"Reputation assessment");self._rev(x,expected_revision);m=await self._get(FactoryReputationMention,x.mention_id,project_id,"Public mention");expected=_hash({"mention_number":m.mention_number,"public_reference":m.public_reference,"channel":m.channel,"sentiment":m.sentiment,"observed_on":m.observed_on,"assessment_manifest":x.assessment_manifest_json})
  if x.status!="draft" or x.authored_by==str(actor) or not verification_reference.strip() or x.manifest_hash!=expected:raise ValueError("Assessment requires independent verification of unchanged public reference")
  x.status="verified";x.verified_by=str(actor);x.verified_at=datetime.now(timezone.utc);x.verification_reference=verification_reference.strip()[:255];x.revision+=1;await self._event(x,"assessment","reputation-assessment-verified",x.verification_reference,"Independent verifier accepted provenance and factual scope",actor);await self.db.flush();return _pick(x,ASSESSMENT)
 async def prepare_release(self,assessment_id,*,project_id,context,actor,target,response_manifest,rollback_reference):
  a=await self._get(FactoryReputationAssessment,assessment_id,project_id,"Reputation assessment");m=await self._get(FactoryReputationMention,a.mention_id,project_id,"Public mention")
  if a.status!="verified" or target not in {"marketing-owner","service-owner","pr-owner"} or not response_manifest or _unsafe(response_manifest) or not rollback_reference.strip():raise ValueError("Handoff requires verified assessment, safe response plan, allowed target and rollback reference")
  p={"application_id":APPLICATION_ID,"mention_number":m.mention_number,"assessment_number":a.assessment_number,"source_manifest_hash":a.manifest_hash,"public_reference":m.public_reference,"channel":m.channel,"sentiment":m.sentiment,"target":target,"response_manifest":response_manifest,"automatic_public_reply":False,"fabricated_review_or_endorsement":False,"consumer_receipt_required":True,"rollback_reference":rollback_reference.strip()};x=FactoryReputationRelease(id=_id("reputation-release"),**_ctx(context,project_id),release_number=_no("RPR",project_id),mention_id=m.id,assessment_id=a.id,assessment_number=a.assessment_number,target=target,response_manifest_json=p,manifest_hash=_hash(p),rollback_reference=rollback_reference.strip()[:255],status="pending-approval",prepared_by=str(actor),available=False,prepared_at=datetime.now(timezone.utc),revision=1);self.db.add(x);await self._event(x,"release","reputation-response-prepared",x.manifest_hash,"Handoff never posts a reply or fabricates third-party endorsement",actor);await self.db.flush();return _pick(x,RELEASE)
 async def approve_release(self,release_id,*,project_id,actor,expected_revision,approval_reference):
  x=await self._get(FactoryReputationRelease,release_id,project_id,"Reputation response handoff");self._rev(x,expected_revision);a=await self._get(FactoryReputationAssessment,x.assessment_id,project_id,"Reputation assessment");o=await self.db.scalar(select(FactoryCoreObjectContract).where(FactoryCoreObjectContract.id=="reputation-public-mention",FactoryCoreObjectContract.lifecycle_status=="frozen"));e=await self.db.scalar(select(FactoryCoreEventContract).where(FactoryCoreEventContract.id=="reputation-response-released",FactoryCoreEventContract.lifecycle_status=="frozen"))
  if x.status!="pending-approval" or x.prepared_by==str(actor) or not approval_reference.strip() or x.manifest_hash!=_hash(x.response_manifest_json) or a.status!="verified" or not o or not e:raise ValueError("Handoff requires independent approval, frozen contracts and unchanged verified assessment")
  x.status="approved";x.approved_by=str(actor);x.approval_reference=approval_reference.strip()[:255];x.revision+=1;await self._event(x,"release","reputation-response-approved",x.approval_reference,"Awaiting owner receipt; no public reply is posted",actor);await self.db.flush();return _pick(x,RELEASE)
 async def acknowledge_release(self,release_id,*,project_id,actor,expected_revision,consumer_receipt_reference):
  x=await self._get(FactoryReputationRelease,release_id,project_id,"Reputation response handoff");self._rev(x,expected_revision)
  if x.status!="approved" or x.approved_by==str(actor) or not consumer_receipt_reference.strip():raise ValueError("Consumer acknowledgement requires independently approved reputation handoff")
  x.status="available";x.available=True;x.consumer_receipt_reference=consumer_receipt_reference.strip()[:255];x.acknowledged_at=datetime.now(timezone.utc);x.revision+=1;await self._event(x,"release","reputation-response-released",x.consumer_receipt_reference,"Owner accepted bounded response guidance",actor);await self.db.flush();return _pick(x,RELEASE)
 async def _get(self,m,item_id,project_id,label):
  x=await self.db.scalar(select(m).where(m.id==item_id,m.project_id==project_id))
  if not x:raise KeyError(f"{label} not found in this tenant plan")
  return x
 @staticmethod
 def _rev(x,e):
  if int(x.revision)!=int(e):raise ValueError("Revision conflict")
 async def _event(self,x,subject_type,evidence_type,reference,note,actor):
  n=next((getattr(x,k,None) for k in("mention_number","assessment_number","release_number") if getattr(x,k,None)),str(x.id));self.db.add(FactoryReputationEvidence(id=_id("reputation-evidence"),**_same(x),evidence_number=_no("RPE",x.project_id),subject_type=subject_type,subject_id=x.id,subject_number=n,evidence_type=evidence_type,evidence_reference=str(reference)[:255],note=note,recorded_by=str(actor),recorded_at=datetime.now(timezone.utc)))
