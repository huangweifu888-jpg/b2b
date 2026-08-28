"""GEO answer versions are source-bound observations, never AI-ranking promises."""
from datetime import datetime,timezone
import hashlib,json,secrets
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from models.factory_contract import FactoryCoreEventContract,FactoryCoreObjectContract
from models.factory_geo_aeo import FactoryGeoAeoQuestion,FactoryGeoAeoAnswerVersion,FactoryGeoAeoRelease,FactoryGeoAeoEvidence
APPLICATION_ID="recommend.geo-aeo";F={"password","secret","token","api_key","credential","customer_email","customer_phone"};QUESTION=("id","question_number","question_reference","market","locale","status","revision");ANSWER=("id","version_number","question_id","question_number","manifest_hash","status","authored_by","verified_by","verification_reference","revision");RELEASE=("id","release_number","version_id","version_number","target","status","available","consumer_receipt_reference","revision")
def _id(x):return f"{x}-{secrets.token_urlsafe(18)}"
def _no(x,p):return f"{x}-{p}-{datetime.now(timezone.utc):%Y%m%d%H%M%S%f}-{secrets.token_hex(3).upper()}"
def _hash(x):return hashlib.sha256(json.dumps(x,ensure_ascii=False,sort_keys=True,separators=(",",":"),default=str).encode()).hexdigest()
def _ctx(c,p):return {"project_id":p,"agent_path":c.agent_path,"tenant_id":c.tenant_id,"client_id":c.client_id,"plan_id":c.plan_id or f"plan-{p}"}
def _same(x):return {n:getattr(x,n)for n in("project_id","agent_path","tenant_id","client_id","plan_id")}
def _pick(x,n):return {k:getattr(x,k)for k in n}
def _unsafe(v):return any(str(k).casefold()in F or _unsafe(x)for k,x in v.items())if isinstance(v,dict)else any(_unsafe(x)for x in v)if isinstance(v,list)else isinstance(v,str)and("<script"in v.casefold()or"javascript:"in v.casefold())
class FactoryGeoAeoService:
 def __init__(self,db:AsyncSession):self.db=db
 async def workspace(self,*,project_id):
  async def rows(m,o):return list((await self.db.execute(select(m).where(m.project_id==project_id).order_by(o.desc()).limit(500))).scalars().all())
  questions=await rows(FactoryGeoAeoQuestion,FactoryGeoAeoQuestion.created_at);answers=await rows(FactoryGeoAeoAnswerVersion,FactoryGeoAeoAnswerVersion.created_at);releases=await rows(FactoryGeoAeoRelease,FactoryGeoAeoRelease.prepared_at);evidence=await rows(FactoryGeoAeoEvidence,FactoryGeoAeoEvidence.recorded_at);ready=[x for x in releases if x.status=="available" and x.available]
  return {"questions":[_pick(x,QUESTION)for x in questions],"answers":[_pick(x,ANSWER)for x in answers],"releases":[_pick(x,RELEASE)for x in releases],"evidence":[{"id":x.id,"subject_id":x.subject_id,"evidence_type":x.evidence_type,"evidence_reference":x.evidence_reference}for x in evidence],"metrics":{"buyer_questions":len(questions),"verified_answers":sum(x.status=="verified"for x in answers),"acknowledged_handoffs":len(ready),"evidence_records":len(evidence)},"availability":{"application_id":APPLICATION_ID,"status":"available"if ready else"pilot","release_version":ready[0].version_number if ready else None},"contract":{"source_question_mutated_directly":False,"automatic_site_publish":False,"ai_appearance_guaranteed":False,"answer_self_verification":False,"release_self_approval":False,"consumer_handoff_required":True}}
 async def create_question(self,*,project_id,context,actor,question_reference,market,locale):
  if not all(str(x).strip()for x in(question_reference,market,locale)):raise ValueError("Question requires reference, market and locale")
  x=FactoryGeoAeoQuestion(id=_id("geo-question"),**_ctx(context,project_id),question_number=_no("GQ",project_id),question_reference=question_reference.strip()[:255],market=market.strip()[:80],locale=locale.strip()[:32],status="registered",created_by=str(actor),created_at=datetime.now(timezone.utc),revision=1);self.db.add(x);await self._event(x,"geo-question-registered",x.question_reference,"Question reference does not promise AI visibility",actor);await self.db.flush();return {"id":x.id,"question_number":x.question_number,"status":x.status,"revision":x.revision}
 async def draft_answer(self,qid,*,project_id,context,actor,answer_manifest):
  q=await self.db.scalar(select(FactoryGeoAeoQuestion).where(FactoryGeoAeoQuestion.id==qid,FactoryGeoAeoQuestion.project_id==project_id))
  if not q:raise KeyError("Question not found in this tenant plan")
  if not answer_manifest or _unsafe(answer_manifest):raise ValueError("Answer requires safe source-bound manifest")
  p={"question_number":q.question_number,"question_reference":q.question_reference,"market":q.market,"locale":q.locale,"answer_manifest":answer_manifest};x=FactoryGeoAeoAnswerVersion(id=_id("geo-answer"),**_same(q),version_number=_no("GAV",project_id),question_id=q.id,question_number=q.question_number,answer_manifest_json=answer_manifest,manifest_hash=_hash(p),status="draft",authored_by=str(actor),created_at=datetime.now(timezone.utc),revision=1);self.db.add(x);await self._event(x,"geo-answer-drafted",x.manifest_hash,"Answer is not automatically published or model-recommended",actor);await self.db.flush();return {"id":x.id,"version_number":x.version_number,"status":x.status,"revision":x.revision}
 async def verify_answer(self,vid,*,project_id,actor,expected_revision,verification_reference):
  x=await self.db.scalar(select(FactoryGeoAeoAnswerVersion).where(FactoryGeoAeoAnswerVersion.id==vid,FactoryGeoAeoAnswerVersion.project_id==project_id))
  if not x:raise KeyError("Answer not found in this tenant plan")
  q=await self.db.scalar(select(FactoryGeoAeoQuestion).where(FactoryGeoAeoQuestion.id==x.question_id,FactoryGeoAeoQuestion.project_id==project_id));p={"question_number":q.question_number,"question_reference":q.question_reference,"market":q.market,"locale":q.locale,"answer_manifest":x.answer_manifest_json}
  if x.revision!=expected_revision or x.status!="draft" or x.authored_by==str(actor) or not verification_reference.strip() or x.manifest_hash!=_hash(p):raise ValueError("Answer requires independent verification of unchanged source-bound facts")
  x.status="verified";x.verified_by=str(actor);x.verified_at=datetime.now(timezone.utc);x.verification_reference=verification_reference.strip()[:255];x.revision+=1;await self._event(x,"geo-answer-verified",x.verification_reference,"No AI answer appearance or recommendation is guaranteed",actor);await self.db.flush();return {"id":x.id,"version_number":x.version_number,"status":x.status,"revision":x.revision}
 async def prepare_release(self,vid,*,project_id,context,actor,target,handoff_manifest):
  v=await self.db.scalar(select(FactoryGeoAeoAnswerVersion).where(FactoryGeoAeoAnswerVersion.id==vid,FactoryGeoAeoAnswerVersion.project_id==project_id))
  if not v:raise KeyError("Answer not found in this tenant plan")
  if v.status!="verified" or target not in {"content-owner","geo-owner","marketing-owner"} or not handoff_manifest or _unsafe(handoff_manifest):raise ValueError("GEO handoff requires verified answer, allowed target and safe manifest")
  p={"application_id":"recommend.geo-aeo","version_number":v.version_number,"source_manifest_hash":v.manifest_hash,"target":target,"handoff_manifest":handoff_manifest,"automatic_site_publish":False,"ai_appearance_guaranteed":False};x=FactoryGeoAeoRelease(id=_id("geo-release"),**_ctx(context,project_id),release_number=_no("GAR",project_id),version_id=v.id,version_number=v.version_number,target=target,handoff_manifest_json=p,manifest_hash=_hash(p),status="pending-approval",prepared_by=str(actor),available=False,prepared_at=datetime.now(timezone.utc),revision=1);self.db.add(x);await self._event(x,"geo-handoff-prepared",x.manifest_hash,"No external model or website is updated",actor);await self.db.flush();return {"id":x.id,"status":x.status,"revision":x.revision}
 async def approve_release(self,rid,*,project_id,actor,expected_revision,reference):
  x=await self.db.scalar(select(FactoryGeoAeoRelease).where(FactoryGeoAeoRelease.id==rid,FactoryGeoAeoRelease.project_id==project_id))
  if not x:raise KeyError("GEO handoff not found in this tenant plan")
  v=await self.db.scalar(select(FactoryGeoAeoAnswerVersion).where(FactoryGeoAeoAnswerVersion.id==x.version_id,FactoryGeoAeoAnswerVersion.project_id==project_id));o=await self.db.scalar(select(FactoryCoreObjectContract).where(FactoryCoreObjectContract.id=="geo-aeo-answer-version",FactoryCoreObjectContract.lifecycle_status=="frozen"));e=await self.db.scalar(select(FactoryCoreEventContract).where(FactoryCoreEventContract.id=="geo-aeo-handoff-released",FactoryCoreEventContract.lifecycle_status=="frozen"))
  if x.revision!=expected_revision or x.status!="pending-approval" or x.prepared_by==str(actor) or not reference.strip() or x.manifest_hash!=_hash(x.handoff_manifest_json) or not v or v.status!="verified" or not o or not e:raise ValueError("GEO handoff requires independent approval, frozen contracts and unchanged verified answer")
  x.status="approved";x.approved_by=str(actor);x.revision+=1;await self._event(x,"geo-handoff-approved",reference,"Awaiting consumer receipt",actor);await self.db.flush();return {"id":x.id,"status":x.status,"revision":x.revision}
 async def acknowledge_release(self,rid,*,project_id,actor,expected_revision,reference):
  x=await self.db.scalar(select(FactoryGeoAeoRelease).where(FactoryGeoAeoRelease.id==rid,FactoryGeoAeoRelease.project_id==project_id))
  if not x:raise KeyError("GEO handoff not found in this tenant plan")
  if x.revision!=expected_revision or x.status!="approved" or x.approved_by==str(actor) or not reference.strip():raise ValueError("GEO handoff requires independent consumer receipt")
  x.status="available";x.available=True;x.consumer_receipt_reference=reference.strip()[:255];x.revision+=1;await self._event(x,"geo-handoff-released",reference,"Consumer accepted source-bound answer handoff",actor);await self.db.flush();return {"id":x.id,"status":x.status,"available":x.available,"revision":x.revision}
 async def _event(self,x,t,r,n,a):self.db.add(FactoryGeoAeoEvidence(id=_id("geo-evidence"),**_same(x),evidence_number=_no("GE",x.project_id),subject_id=x.id,evidence_type=t,evidence_reference=str(r)[:255],note=n,recorded_by=str(a),recorded_at=datetime.now(timezone.utc)))
