from datetime import datetime,timezone
import hashlib,json,secrets
from sqlalchemy import select
from models.factory_experiment import FactoryMarketingExperiment as E,FactoryExperimentDecision as D
def h(x):return hashlib.sha256(json.dumps(x,sort_keys=True,separators=(",",":")).encode()).hexdigest()
def i(p):return f"{p}-{secrets.token_urlsafe(16)}"
def n(p,x):return f"{p}-{x}-{datetime.now(timezone.utc):%Y%m%d%H%M%S}-{secrets.token_hex(3).upper()}"
def c(ctx,p):return dict(project_id=p,agent_path=ctx.agent_path,tenant_id=ctx.tenant_id,client_id=ctx.client_id,plan_id=ctx.plan_id or f"plan-{p}")
def ev(x):return {k:getattr(x,k)for k in("id","experiment_number","experiment_key","hypothesis","evidence_reference","status","created_by","reviewed_by","review_reference","revision")}
def dv(x):return {k:getattr(x,k)for k in("id","decision_number","experiment_id","destination","status","manifest_fingerprint","revision")}
class FactoryExperimentService:
 def __init__(self,db):self.db=db
 async def workspace(self,p):
  a=(await self.db.execute(select(E).where(E.project_id==p).order_by(E.created_at.desc()))).scalars().all();d=(await self.db.execute(select(D).where(D.project_id==p).order_by(D.created_at.desc()))).scalars().all();return {"experiments":[ev(x)for x in a],"decisions":[dv(x)for x in d],"contract":{"raw_campaign_data_copied":False,"external_campaign_changed":False,"incrementality_guaranteed":False}}
 async def create(self,*,project_id,context,actor,experiment_key,hypothesis,evidence_reference):
  if len(experiment_key.strip())<2 or len(hypothesis.strip())<8 or len(evidence_reference.strip())<3:raise ValueError("Experiment requires key, hypothesis and evidence reference")
  if await self.db.scalar(select(E.id).where(E.project_id==project_id,E.experiment_key==experiment_key.strip())):raise ValueError("Experiment key already exists in this tenant plan")
  x=E(id=i("experiment"),**c(context,project_id),experiment_number=n("EXP",project_id),experiment_key=experiment_key.strip()[:120],hypothesis=hypothesis.strip(),evidence_reference=evidence_reference.strip()[:255],created_by=actor);self.db.add(x);await self.db.flush();return ev(x)
 async def review(self,id,*,project_id,actor,expected_revision,reference):
  x=await self.exp(id,project_id)
  if x.status!="draft" or x.revision!=expected_revision:raise ValueError("Experiment changed; refresh before review")
  if x.created_by==actor:raise ValueError("Experiment review must be independent")
  x.status="reviewed";x.reviewed_by=actor;x.review_reference=reference.strip()[:255];x.revision+=1;await self.db.flush();return ev(x)
 async def decide(self,id,*,project_id,context,actor,expected_revision,destination):
  x=await self.exp(id,project_id)
  if x.status!="reviewed" or x.revision!=expected_revision or actor in {x.created_by,x.reviewed_by}:raise ValueError("Experiment decision requires independently reviewed evidence and separate owner")
  m={"experiment_number":x.experiment_number,"evidence_reference":x.evidence_reference,"external_campaign_changed":False,"incrementality_guaranteed":False};d=D(id=i("experiment-decision"),**c(context,project_id),decision_number=n("EXD",project_id),experiment_id=x.id,experiment_number=x.experiment_number,destination=destination,manifest_json=json.dumps(m,sort_keys=True),manifest_fingerprint=h(m),decided_by=actor);self.db.add(d);x.status="decided";x.revision+=1;await self.db.flush();return {"experiment":ev(x),"decision":dv(d)}
 async def acknowledge(self,id,*,project_id,actor,expected_revision,reference):
  x=await self.db.scalar(select(D).where(D.id==id,D.project_id==project_id))
  if not x:raise KeyError("Experiment decision not found in this tenant plan")
  if x.status!="pending" or x.revision!=expected_revision or x.decided_by==actor:raise ValueError("Experiment acknowledgement must be independent")
  x.status="acknowledged";x.acknowledged_by=actor;x.acknowledgement_reference=reference.strip()[:255];x.acknowledged_at=datetime.now(timezone.utc);x.revision+=1;await self.db.flush();return dv(x)
 async def exp(self,id,p):
  x=await self.db.scalar(select(E).where(E.id==id,E.project_id==p))
  if not x:raise KeyError("Experiment not found in this tenant plan")
  return x
