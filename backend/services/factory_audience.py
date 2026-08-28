from datetime import datetime,timezone
import hashlib,json,secrets
from sqlalchemy import select
from models.factory_audience import FactoryMarketingAudience as A,FactoryMarketingAudienceActivation as H
def h(x):return hashlib.sha256(json.dumps(x,ensure_ascii=False,sort_keys=True,separators=(",",":")).encode()).hexdigest()
def i(p):return f"{p}-{secrets.token_urlsafe(16)}"
def n(p,x):return f"{p}-{x}-{datetime.now(timezone.utc):%Y%m%d%H%M%S}-{secrets.token_hex(3).upper()}"
def c(ctx,p):return dict(project_id=p,agent_path=ctx.agent_path,tenant_id=ctx.tenant_id,client_id=ctx.client_id,plan_id=ctx.plan_id or f"plan-{p}")
def av(x):return {k:getattr(x,k)for k in("id","audience_number","audience_key","source_reference","consent_receipt","market_scope","status","created_by","verified_by","verification_reference","revision","created_at","updated_at")}
def hv(x):return {k:getattr(x,k)for k in("id","activation_number","audience_id","audience_number","destination","manifest_fingerprint","status","activated_by","acknowledged_by","acknowledgement_reference","revision","created_at","acknowledged_at")}
class FactoryAudienceService:
 def __init__(self,db):self.db=db
 async def workspace(self,p):
  aa=(await self.db.execute(select(A).where(A.project_id==p).order_by(A.created_at.desc()))).scalars().all();hh=(await self.db.execute(select(H).where(H.project_id==p).order_by(H.created_at.desc()))).scalars().all();return {"audiences":[av(x)for x in aa],"activations":[hv(x)for x in hh],"contract":{"raw_personal_data_stored":False,"consent_receipt_required":True,"external_audience_synced":False,"external_ad_spend_dispatched":False}}
 async def create(self,*,project_id,context,actor,audience_key,source_reference,consent_receipt,market_scope):
  key=audience_key.strip();source=source_reference.strip();receipt=consent_receipt.strip()
  if len(key)<2 or len(source)<2 or len(receipt)<4 or market_scope not in {"domestic","overseas","dual"}:raise ValueError("Audience requires key, source reference, consent receipt and market scope")
  if await self.db.scalar(select(A.id).where(A.project_id==project_id,A.audience_key==key)):raise ValueError("Audience key already exists in this tenant plan")
  x=A(id=i("audience"),**c(context,project_id),audience_number=n("AUD",project_id),audience_key=key[:120],source_reference=source[:255],consent_receipt=receipt[:255],market_scope=market_scope,created_by=actor);self.db.add(x);await self.db.flush();return av(x)
 async def verify(self,id,*,project_id,actor,expected_revision,reference):
  x=await self.audience(id,project_id)
  if x.revision!=expected_revision or x.status!="draft":raise ValueError("Audience changed; refresh before verification")
  if x.created_by==actor:raise ValueError("Audience verification must be independent")
  x.status="verified";x.verified_by=actor;x.verification_reference=reference.strip()[:255];x.revision+=1;await self.db.flush();return av(x)
 async def activate(self,id,*,project_id,context,actor,expected_revision,destination):
  x=await self.audience(id,project_id)
  if x.revision!=expected_revision or x.status!="verified" or actor in {x.created_by,x.verified_by} or destination not in {"marketing-owner","agency-operator"}:raise ValueError("Audience activation requires verified audience and separate owner")
  m={"audience_number":x.audience_number,"market_scope":x.market_scope,"consent_receipt_required":True,"raw_personal_data_stored":False,"external_audience_synced":False,"external_ad_spend_dispatched":False};r=H(id=i("audience-activation"),**c(context,project_id),activation_number=n("AUA",project_id),audience_id=x.id,audience_number=x.audience_number,destination=destination,scope_manifest_json=json.dumps(m,ensure_ascii=False,sort_keys=True),manifest_fingerprint=h(m),activated_by=actor);self.db.add(r);x.status="activated";x.revision+=1;await self.db.flush();return {"audience":av(x),"activation":hv(r)}
 async def acknowledge(self,id,*,project_id,actor,expected_revision,reference):
  x=await self.db.scalar(select(H).where(H.id==id,H.project_id==project_id))
  if not x:raise KeyError("Audience activation not found in this tenant plan")
  if x.revision!=expected_revision or x.status!="pending" or x.activated_by==actor:raise ValueError("Audience acknowledgement must be independent")
  x.status="acknowledged";x.acknowledged_by=actor;x.acknowledgement_reference=reference.strip()[:255];x.acknowledged_at=datetime.now(timezone.utc);x.revision+=1;await self.db.flush();return hv(x)
 async def audience(self,id,p):
  x=await self.db.scalar(select(A).where(A.id==id,A.project_id==p))
  if not x:raise KeyError("Audience not found in this tenant plan")
  return x
