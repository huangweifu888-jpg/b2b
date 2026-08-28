from datetime import datetime,timezone
import hashlib,json,secrets
from sqlalchemy import select
from models.factory_social_listening import FactorySocialListeningSignal as S,FactorySocialListeningHandoff as H
from models.factory_reputation import FactoryReputationAssessment,FactoryReputationMention
def h(x):return hashlib.sha256(json.dumps(x,ensure_ascii=False,sort_keys=True,default=str,separators=(",",":")).encode()).hexdigest()
def i(p):return f"{p}-{secrets.token_urlsafe(16)}"
def n(p,x):return f"{p}-{x}-{datetime.now(timezone.utc):%Y%m%d%H%M%S}-{secrets.token_hex(3).upper()}"
def c(ctx,p):return dict(project_id=p,agent_path=ctx.agent_path,tenant_id=ctx.tenant_id,client_id=ctx.client_id,plan_id=ctx.plan_id or f"plan-{p}")
def sv(x):return {k:getattr(x,k)for k in("id","signal_number","signal_key","assessment_id","assessment_number","assessment_fingerprint","public_reference","channel","sentiment","signal_type","priority","status","created_by","verified_by","routed_by","revision","created_at","updated_at")}
def hv(x):return {k:getattr(x,k)for k in("id","handoff_number","signal_id","signal_number","destination","manifest_fingerprint","status","routed_by","delivery_reference","acknowledged_by","acknowledgement_reference","revision","created_at","acknowledged_at")}
class FactorySocialListeningService:
 def __init__(self,db):self.db=db
 async def workspace(self,p):
  ss=(await self.db.execute(select(S).where(S.project_id==p).order_by(S.created_at.desc()))).scalars().all();hs=(await self.db.execute(select(H).where(H.project_id==p).order_by(H.created_at.desc()))).scalars().all();return {"signals":[sv(x)for x in ss],"handoffs":[hv(x)for x in hs],"contract":{"public_reputation_assessment_required":True,"private_messages_collected":False,"source_fingerprint_pinned":True,"automatic_public_reply":False,"external_social_action_dispatched":False}}
 async def capture(self,*,project_id,context,actor,signal_key,assessment_id,signal_type,priority):
  a=await self.db.scalar(select(FactoryReputationAssessment).where(FactoryReputationAssessment.id==assessment_id,FactoryReputationAssessment.project_id==project_id))
  if not a:raise ValueError("Listening signal requires verified public assessment, type and priority")
  m=await self.db.scalar(select(FactoryReputationMention).where(FactoryReputationMention.id==a.mention_id,FactoryReputationMention.project_id==project_id))
  if not m or a.status!="verified" or signal_type not in {"brand","competitor","demand","issue"} or priority not in {"low","medium","high"}:raise ValueError("Listening signal requires verified public assessment, type and priority")
  key=signal_key.strip().lower()
  if not key or await self.db.scalar(select(S.id).where(S.project_id==project_id,S.signal_key==key)):raise ValueError("Listening signal key already exists in this tenant plan")
  fp=h({"assessment_number":a.assessment_number,"manifest_hash":a.manifest_hash,"mention":m.public_reference,"channel":m.channel,"sentiment":m.sentiment});x=S(id=i("listening-signal"),**c(context,project_id),signal_number=n("SLS",project_id),signal_key=key[:100],assessment_id=a.id,assessment_number=a.assessment_number,assessment_fingerprint=fp,public_reference=m.public_reference,channel=m.channel,sentiment=m.sentiment,signal_type=signal_type,priority=priority,created_by=actor);self.db.add(x);await self.db.flush();return sv(x)
 async def verify(self,id,*,project_id,actor,expected_revision):
  x=await self.get(id,project_id)
  if x.revision!=expected_revision or x.status!="captured":raise ValueError("Listening signal changed; refresh before verification")
  if x.created_by==actor:raise ValueError("Listening signal verification must be independent")
  x.status="verified";x.verified_by=actor;x.revision+=1;await self.db.flush();return sv(x)
 async def route(self,id,*,project_id,context,actor,expected_revision,destination,reference):
  x=await self.get(id,project_id)
  if x.revision!=expected_revision or x.status!="verified" or actor in {x.created_by,x.verified_by} or destination not in {"marketing-owner","sales-owner","service-owner"}:raise ValueError("Listening triage requires verified signal, separate router and allowed destination")
  manifest={"signal_number":x.signal_number,"assessment_fingerprint":x.assessment_fingerprint,"public_reference":x.public_reference,"signal_type":x.signal_type,"priority":x.priority,"destination":destination,"automatic_public_reply":False,"external_social_action_dispatched":False};r=H(id=i("listening-handoff"),**c(context,project_id),handoff_number=n("SLH",project_id),signal_id=x.id,signal_number=x.signal_number,destination=destination,triage_manifest_json=json.dumps(manifest,ensure_ascii=False,sort_keys=True),manifest_fingerprint=h(manifest),routed_by=actor,delivery_reference=reference.strip()[:255]);self.db.add(r);x.status="routed";x.routed_by=actor;x.revision+=1;await self.db.flush();return {"signal":sv(x),"handoff":hv(r)}
 async def acknowledge(self,id,*,project_id,actor,expected_revision,reference):
  x=await self.db.scalar(select(H).where(H.id==id,H.project_id==project_id))
  if not x:raise KeyError("Listening handoff not found in this tenant plan")
  if x.revision!=expected_revision or x.status!="pending" or x.routed_by==actor:raise ValueError("Listening acknowledgement must be independent")
  x.status="acknowledged";x.acknowledged_by=actor;x.acknowledgement_reference=reference.strip()[:255];x.acknowledged_at=datetime.now(timezone.utc);x.revision+=1;await self.db.flush();return hv(x)
 async def get(self,id,p):
  x=await self.db.scalar(select(S).where(S.id==id,S.project_id==p))
  if not x:raise KeyError("Listening signal not found in this tenant plan")
  return x
