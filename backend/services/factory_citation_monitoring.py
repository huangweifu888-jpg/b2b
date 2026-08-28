"""Bounded citation observations; no model visibility or ranking promise."""
from datetime import datetime,timezone
import hashlib,json,secrets
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from models.factory_citation_monitoring import FactoryCitationEvidence as E,FactoryCitationMonitor as M,FactoryCitationObservation as O,FactoryCitationRelease as R
from models.factory_contract import FactoryCoreEventContract,FactoryCoreObjectContract
def I(x):return f"{x}-{secrets.token_urlsafe(18)}"
def N(x,p):return f"{x}-{p}-{datetime.now(timezone.utc):%Y%m%d%H%M%S%f}-{secrets.token_hex(3).upper()}"
def H(x):return hashlib.sha256(json.dumps(x,sort_keys=True,separators=(",",":"),default=str).encode()).hexdigest()
def C(c,p):return {"project_id":p,"agent_path":c.agent_path,"tenant_id":c.tenant_id,"client_id":c.client_id,"plan_id":c.plan_id or f"plan-{p}"}
def S(x):return {n:getattr(x,n)for n in("project_id","agent_path","tenant_id","client_id","plan_id")}
def U(v):return any(str(k).casefold()in{"password","secret","token","api_key","credential"}or U(x)for k,x in v.items())if isinstance(v,dict)else any(U(x)for x in v)if isinstance(v,list)else isinstance(v,str)and("<script"in v.casefold()or"javascript:"in v.casefold())
class FactoryCitationMonitoringService:
 def __init__(self,db):self.db=db
 async def workspace(self,*,project_id):
  async def rows(m,o):return list((await self.db.execute(select(m).where(m.project_id==project_id).order_by(o.desc()).limit(500))).scalars().all())
  monitors=await rows(M,M.created_at);observations=await rows(O,O.observed_at);releases=await rows(R,R.prepared_at);ready=[x for x in releases if x.available and x.status=="available"]
  return {"monitors":[{"id":x.id,"monitor_number":x.monitor_number,"monitor_key":x.monitor_key,"market":x.market,"locale":x.locale,"model_provider":x.model_provider,"question_reference":x.question_reference,"status":x.status,"revision":x.revision}for x in monitors],"observations":[{"id":x.id,"observation_number":x.observation_number,"monitor_id":x.monitor_id,"status":x.status,"revision":x.revision}for x in observations],"releases":[{"id":x.id,"release_number":x.release_number,"observation_id":x.observation_id,"status":x.status,"available":x.available,"revision":x.revision}for x in releases],"metrics":{"monitors":len(monitors),"verified_observations":sum(x.status=="verified"for x in observations),"acknowledged_analyses":len(ready)},"availability":{"application_id":"recommend.citation","status":"available"if ready else"pilot"},"contract":{"automatic_content_change":False,"citation_or_ranking_guaranteed":False,"observation_self_verification":False,"release_self_approval":False,"consumer_handoff_required":True}}
 async def create_monitor(self,*,project_id,context,actor,monitor_key,market,locale,model_provider,question_reference):
  if not all(str(x).strip()for x in(monitor_key,market,locale,model_provider,question_reference)):raise ValueError("Monitor requires scope and question reference")
  x=M(id=I("citation-monitor"),**C(context,project_id),monitor_number=N("CIT",project_id),monitor_key=monitor_key.strip()[:160],market=market.strip()[:80],locale=locale.strip()[:32],model_provider=model_provider.strip()[:80],question_reference=question_reference.strip()[:255],status="registered",created_by=str(actor),created_at=datetime.now(timezone.utc),revision=1);self.db.add(x);await self.ev(x,"citation-monitor-registered",x.question_reference,"Observation scope only; no model result is promised",actor);await self.db.flush();return {"id":x.id,"status":x.status,"revision":x.revision}
 async def capture(self,mid,*,project_id,context,actor,observation_manifest):
  m=await self.get(M,mid,project_id,"Monitor")
  if not observation_manifest or U(observation_manifest):raise ValueError("Observation requires safe captured manifest")
  p={"monitor":m.monitor_number,"market":m.market,"locale":m.locale,"model":m.model_provider,"question":m.question_reference,"observation":observation_manifest};x=O(id=I("citation-observation"),**S(m),observation_number=N("CIO",project_id),monitor_id=m.id,monitor_number=m.monitor_number,observation_manifest_json=observation_manifest,manifest_hash=H(p),status="captured",captured_by=str(actor),observed_at=datetime.now(timezone.utc),revision=1);self.db.add(x);await self.ev(x,"citation-observation-captured",x.manifest_hash,"Immutable observation, not a citation or ranking claim",actor);await self.db.flush();return {"id":x.id,"status":x.status,"revision":x.revision}
 async def verify(self,oid,*,project_id,actor,expected_revision,reference):
  x=await self.get(O,oid,project_id,"Observation");m=await self.get(M,x.monitor_id,project_id,"Monitor");p={"monitor":m.monitor_number,"market":m.market,"locale":m.locale,"model":m.model_provider,"question":m.question_reference,"observation":x.observation_manifest_json}
  if x.revision!=expected_revision or x.status!="captured"or x.captured_by==str(actor)or not reference.strip()or x.manifest_hash!=H(p):raise ValueError("Observation requires independent verification of unchanged data")
  x.status="verified";x.verified_by=str(actor);x.verification_reference=reference.strip()[:255];x.verified_at=datetime.now(timezone.utc);x.revision+=1;await self.ev(x,"citation-observation-verified",x.verification_reference,"Verified bounded observation",actor);await self.db.flush();return {"id":x.id,"status":x.status,"revision":x.revision}
 async def prepare_release(self,oid,*,project_id,context,actor,target,analysis_manifest):
  o=await self.get(O,oid,project_id,"Observation")
  if o.status!="verified"or target not in{"marketing-owner","executive-owner","geo-owner"}or not analysis_manifest or U(analysis_manifest):raise ValueError("Analysis handoff requires verified observation and safe allowed target")
  p={"observation_number":o.observation_number,"source_manifest_hash":o.manifest_hash,"target":target,"analysis_manifest":analysis_manifest,"automatic_content_change":False,"citation_or_ranking_guaranteed":False};x=R(id=I("citation-release"),**C(context,project_id),release_number=N("CIR",project_id),observation_id=o.id,observation_number=o.observation_number,target=target,analysis_manifest_json=p,manifest_hash=H(p),status="pending-approval",prepared_by=str(actor),available=False,prepared_at=datetime.now(timezone.utc),revision=1);self.db.add(x);await self.ev(x,"citation-analysis-prepared",x.manifest_hash,"No content or external model is updated",actor);await self.db.flush();return {"id":x.id,"status":x.status,"revision":x.revision}
 async def approve_release(self,rid,*,project_id,actor,expected_revision,reference):
  x=await self.get(R,rid,project_id,"Analysis handoff");o=await self.get(O,x.observation_id,project_id,"Observation");obj=await self.db.scalar(select(FactoryCoreObjectContract).where(FactoryCoreObjectContract.id=="citation-observation",FactoryCoreObjectContract.lifecycle_status=="frozen"));evt=await self.db.scalar(select(FactoryCoreEventContract).where(FactoryCoreEventContract.id=="citation-analysis-released",FactoryCoreEventContract.lifecycle_status=="frozen"))
  if x.revision!=expected_revision or x.status!="pending-approval"or x.prepared_by==str(actor)or not reference.strip()or x.manifest_hash!=H(x.analysis_manifest_json)or o.status!="verified"or not obj or not evt:raise ValueError("Analysis requires independent approval, frozen contracts and unchanged observation")
  x.status="approved";x.approved_by=str(actor);x.revision+=1;await self.ev(x,"citation-analysis-approved",reference,"Awaiting consumer receipt",actor);await self.db.flush();return {"id":x.id,"status":x.status,"revision":x.revision}
 async def acknowledge_release(self,rid,*,project_id,actor,expected_revision,reference):
  x=await self.get(R,rid,project_id,"Analysis handoff")
  if x.revision!=expected_revision or x.status!="approved"or x.approved_by==str(actor)or not reference.strip():raise ValueError("Analysis requires independent consumer receipt")
  x.status="available";x.available=True;x.consumer_receipt_reference=reference.strip()[:255];x.revision+=1;await self.ev(x,"citation-analysis-released",x.consumer_receipt_reference,"Consumer accepted bounded citation observation",actor);await self.db.flush();return {"id":x.id,"status":x.status,"available":x.available,"revision":x.revision}
 async def get(self,m,i,p,label):
  x=await self.db.scalar(select(m).where(m.id==i,m.project_id==p))
  if not x:raise KeyError(f"{label} not found in this tenant plan")
  return x
 async def ev(self,x,t,r,n,a):self.db.add(E(id=I("citation-evidence"),**S(x),evidence_number=N("CIE",x.project_id),subject_id=x.id,evidence_type=t,evidence_reference=str(r)[:255],note=n,recorded_by=str(a),recorded_at=datetime.now(timezone.utc)))
