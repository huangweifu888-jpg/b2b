from datetime import datetime,timezone
import hashlib,json,secrets
from sqlalchemy import select
from models.factory_ad_account import FactoryAdAccount as A,FactoryAdAccountHandoff as H
def h(x):return hashlib.sha256(json.dumps(x,ensure_ascii=False,sort_keys=True,separators=(",",":" )).encode()).hexdigest()
def i(p):return f"{p}-{secrets.token_urlsafe(16)}"
def n(p,x):return f"{p}-{x}-{datetime.now(timezone.utc):%Y%m%d%H%M%S}-{secrets.token_hex(3).upper()}"
def c(ctx,p):return dict(project_id=p,agent_path=ctx.agent_path,tenant_id=ctx.tenant_id,client_id=ctx.client_id,plan_id=ctx.plan_id or f"plan-{p}")
def av(x):return {k:getattr(x,k)for k in("id","account_number","platform","account_reference","vault_reference","market_scope","status","created_by","verified_by","verification_reference","revision","created_at","updated_at")}
def hv(x):return {k:getattr(x,k)for k in("id","handoff_number","account_id","account_number","destination","manifest_fingerprint","status","routed_by","acknowledged_by","acknowledgement_reference","revision","created_at","acknowledged_at")}
class FactoryAdAccountService:
 def __init__(self,db):self.db=db
 async def workspace(self,p):
  aa=(await self.db.execute(select(A).where(A.project_id==p).order_by(A.created_at.desc()))).scalars().all();hh=(await self.db.execute(select(H).where(H.project_id==p).order_by(H.created_at.desc()))).scalars().all();return {"accounts":[av(x)for x in aa],"handoffs":[hv(x)for x in hh],"contract":{"platform_credentials_stored":False,"vault_reference_only":True,"external_account_enabled":False,"external_ad_spend_dispatched":False}}
 async def create(self,*,project_id,context,actor,platform,account_reference,vault_reference,market_scope):
  ref=account_reference.strip();vault=vault_reference.strip()
  if platform not in {"google","meta","linkedin","tiktok","baidu"} or len(ref)<2 or len(vault)<3 or market_scope not in {"domestic","overseas","dual"}:raise ValueError("Ad account requires platform, business reference, vault reference and market scope")
  if await self.db.scalar(select(A.id).where(A.project_id==project_id,A.platform==platform,A.account_reference==ref)):raise ValueError("Ad account reference already exists in this tenant plan")
  x=A(id=i("ad-account"),**c(context,project_id),account_number=n("ADC",project_id),platform=platform,account_reference=ref[:255],vault_reference=vault[:255],market_scope=market_scope,created_by=actor);self.db.add(x);await self.db.flush();return av(x)
 async def verify(self,id,*,project_id,actor,expected_revision,reference):
  x=await self.account(id,project_id)
  if x.revision!=expected_revision or x.status!="draft":raise ValueError("Ad account changed; refresh before verification")
  if x.created_by==actor:raise ValueError("Ad account verification must be independent")
  x.status="verified";x.verified_by=actor;x.verification_reference=reference.strip()[:255];x.revision+=1;await self.db.flush();return av(x)
 async def route(self,id,*,project_id,context,actor,expected_revision,destination):
  x=await self.account(id,project_id)
  if x.revision!=expected_revision or x.status!="verified" or actor in {x.created_by,x.verified_by} or destination not in {"marketing-owner","agency-operator"}:raise ValueError("Ad account routing requires verified account and separate owner")
  m={"account_number":x.account_number,"platform":x.platform,"market_scope":x.market_scope,"vault_reference_only":True,"external_account_enabled":False,"external_ad_spend_dispatched":False};r=H(id=i("ad-handoff"),**c(context,project_id),handoff_number=n("ADH",project_id),account_id=x.id,account_number=x.account_number,destination=destination,scope_manifest_json=json.dumps(m,ensure_ascii=False,sort_keys=True),manifest_fingerprint=h(m),routed_by=actor);self.db.add(r);x.status="routed";x.revision+=1;await self.db.flush();return {"account":av(x),"handoff":hv(r)}
 async def acknowledge(self,id,*,project_id,actor,expected_revision,reference):
  x=await self.db.scalar(select(H).where(H.id==id,H.project_id==project_id))
  if not x:raise KeyError("Ad account handoff not found in this tenant plan")
  if x.revision!=expected_revision or x.status!="pending" or x.routed_by==actor:raise ValueError("Ad account acknowledgement must be independent")
  x.status="acknowledged";x.acknowledged_by=actor;x.acknowledgement_reference=reference.strip()[:255];x.acknowledged_at=datetime.now(timezone.utc);x.revision+=1;await self.db.flush();return hv(x)
 async def account(self,id,p):
  x=await self.db.scalar(select(A).where(A.id==id,A.project_id==p))
  if not x:raise KeyError("Ad account not found in this tenant plan")
  return x
