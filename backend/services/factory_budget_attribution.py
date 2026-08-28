"""Finance-backed budget proposals; this service never alters an ad network bid or budget."""
from datetime import datetime,timezone
from decimal import Decimal,InvalidOperation,ROUND_HALF_UP
import hashlib,json,secrets
from sqlalchemy import select,func
from models.factory_budget_attribution import FactoryMarketingBudgetAllocation as A
from models.factory_finance import FactoryFinanceDocument as F
from models.factory_revenue_profit import FactoryRevenueProfitRun as R
M=Decimal("0.01")
def money(v):
 try:x=Decimal(str(v)).quantize(M,rounding=ROUND_HALF_UP)
 except(InvalidOperation,TypeError,ValueError)as e:raise ValueError("Budget allocation amount must be numeric")from e
 if x<=0:raise ValueError("Budget allocation amount must be positive")
 return x
def fingerprint(v):return hashlib.sha256(json.dumps(v,sort_keys=True,separators=(",",":"),default=str).encode()).hexdigest()
def number(p,project):return f"{p}-{project}-{datetime.now(timezone.utc):%Y%m%d%H%M%S}-{secrets.token_hex(3).upper()}"
def item(x):return {k:(str(getattr(x,k)) if k=="proposed_amount" else getattr(x,k)) for k in("id","allocation_number","allocation_reference","finance_document_number","finance_document_reference","finance_document_revision","attribution_run_number","attribution_run_revision","attribution_fingerprint","channel","campaign_reference","currency","proposed_amount","manifest_fingerprint","status","created_by","verified_by","verification_reference","accepted_by","acceptance_reference","revision")}
class FactoryBudgetAttributionService:
 def __init__(self,db):self.db=db
 async def workspace(self,p):
  rows=(await self.db.execute(select(A).where(A.project_id==p).order_by(A.created_at.desc()))).scalars().all()
  return {"allocations":[item(x)for x in rows],"contract":{"finance_budget_source_required":True,"published_attribution_required":True,"external_ad_budget_changed":False,"automatic_bid_changed":False,"incrementality_guaranteed":False}}
 async def create(self,*,project_id,context,actor,allocation_reference,finance_document_reference,attribution_run_id,channel,campaign_reference,proposed_amount):
  ref=allocation_reference.strip();channel=channel.strip().lower();campaign=campaign_reference.strip()
  if not ref or not channel or not campaign:raise ValueError("Budget allocation requires reference, channel and campaign reference")
  if await self.db.scalar(select(A.id).where(A.tenant_id==context.tenant_id,A.allocation_reference==ref)):raise ValueError("Budget allocation reference already exists in this tenant")
  f=await self.db.scalar(select(F).where(F.project_id==project_id,F.document_reference==finance_document_reference.strip(),F.document_type=="budget",F.status=="approved"))
  if not f:raise ValueError("Budget allocation requires an independently approved finance budget document in this project")
  r=await self.db.scalar(select(R).where(R.id==attribution_run_id,R.project_id==project_id))
  if not r or r.project_id!=project_id or r.status!="published":raise ValueError("Budget allocation requires a published attributed contribution analysis")
  amount=money(proposed_amount)
  if f.currency!=r.currency:raise ValueError("Finance budget and attribution analysis currencies must match")
  used=await self.db.scalar(select(func.coalesce(func.sum(A.proposed_amount),0)).where(A.finance_document_id==f.id,A.status.in_(("draft","verified","accepted"))))
  if Decimal(str(used))+amount>Decimal(str(f.amount)):raise ValueError("Budget allocation exceeds the posted finance budget")
  manifest={"finance_document_number":f.document_number,"finance_document_revision":f.revision,"attribution_run_number":r.run_number,"attribution_run_revision":r.revision,"attribution_fingerprint":r.policy_fingerprint,"channel":channel,"campaign_reference":campaign,"proposed_amount":str(amount),"currency":f.currency,"external_ad_budget_changed":False,"automatic_bid_changed":False}
  x=A(id=f"budget-allocation-{secrets.token_urlsafe(16)}",project_id=project_id,agent_path=context.agent_path,tenant_id=context.tenant_id,client_id=context.client_id,plan_id=context.plan_id or f"plan-{project_id}",allocation_number=number("BGT",project_id),allocation_reference=ref[:255],finance_document_id=f.id,finance_document_number=f.document_number,finance_document_reference=f.document_reference,finance_document_revision=f.revision,attribution_run_id=r.id,attribution_run_number=r.run_number,attribution_run_revision=r.revision,attribution_fingerprint=r.policy_fingerprint,channel=channel[:100],campaign_reference=campaign[:255],currency=f.currency,proposed_amount=amount,allocation_manifest=json.dumps(manifest,sort_keys=True),manifest_fingerprint=fingerprint(manifest),created_by=actor)
  self.db.add(x);await self.db.flush();return item(x)
 async def verify(self,id,*,project_id,actor,expected_revision,reference):
  x=await self.one(id,project_id)
  if x.status!="draft" or x.revision!=expected_revision:raise ValueError("Budget allocation changed; refresh before verification")
  if x.created_by==actor:raise ValueError("Budget allocation verification must be independent")
  x.status="verified";x.verified_by=actor;x.verification_reference=reference.strip()[:500];x.revision+=1;await self.db.flush();return item(x)
 async def accept(self,id,*,project_id,actor,expected_revision,reference):
  x=await self.one(id,project_id)
  if x.status!="verified" or x.revision!=expected_revision:raise ValueError("Budget allocation changed; refresh before acceptance")
  if actor in {x.created_by,x.verified_by}:raise ValueError("Budget allocation acceptance must be independent")
  x.status="accepted";x.accepted_by=actor;x.acceptance_reference=reference.strip()[:500];x.revision+=1;await self.db.flush();return item(x)
 async def one(self,id,p):
  x=await self.db.scalar(select(A).where(A.id==id,A.project_id==p))
  if not x:raise KeyError("Budget allocation not found in this tenant plan")
  return x
