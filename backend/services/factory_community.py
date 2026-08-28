from datetime import datetime,timezone
import hashlib,json,secrets
from sqlalchemy import select
from models.factory_community import FactoryCommunityActivation as A,FactoryCommunitySpace as C
from models.factory_crm import FactoryCrmAccount
def h(x):return hashlib.sha256(json.dumps(x,ensure_ascii=False,sort_keys=True,default=str,separators=(",",":" )).encode()).hexdigest()
def i(p):return f"{p}-{secrets.token_urlsafe(16)}"
def n(p,x):return f"{p}-{x}-{datetime.now(timezone.utc):%Y%m%d%H%M%S}-{secrets.token_hex(3).upper()}"
def sc(ctx,p):return dict(project_id=p,agent_path=ctx.agent_path,tenant_id=ctx.tenant_id,client_id=ctx.client_id,plan_id=ctx.plan_id or f"plan-{p}")
def cv(x):return {k:getattr(x,k) for k in ("id","community_number","community_key","account_id","account_number","account_fingerprint","community_name","audience_kind","status","created_by","verified_by","verification_reference","revision","created_at","updated_at")}
def av(x):return {k:getattr(x,k) for k in ("id","activation_number","activation_key","community_id","community_number","event_title","event_type","scheduled_on","manifest_fingerprint","status","planned_by","approved_by","approval_reference","acknowledged_by","acknowledgement_reference","revision","created_at","acknowledged_at")}
class FactoryCommunityService:
 def __init__(self,db):self.db=db
 async def workspace(self,p):
  cs=(await self.db.execute(select(C).where(C.project_id==p).order_by(C.created_at.desc()))).scalars().all();aa=(await self.db.execute(select(A).where(A.project_id==p).order_by(A.created_at.desc()))).scalars().all();return {"communities":[cv(x) for x in cs],"activations":[av(x) for x in aa],"contract":{"verified_b2b_account_required":True,"member_personal_data_stored":False,"private_messages_collected":False,"automatic_member_contact_dispatched":False,"external_community_action_dispatched":False}}
 async def create_community(self,*,project_id,context,actor,community_key,account_id,community_name,audience_kind):
  a=await self.db.scalar(select(FactoryCrmAccount).where(FactoryCrmAccount.id==account_id,FactoryCrmAccount.project_id==project_id));k=community_key.strip().lower();name=community_name.strip()
  if not a or a.status!="verified" or not k or len(name)<2 or audience_kind not in {"customer","dealer","partner"}:raise ValueError("Community requires verified B2B account, key, name and allowed audience")
  if await self.db.scalar(select(C.id).where(C.project_id==project_id,C.community_key==k)):raise ValueError("Community key already exists in this tenant plan")
  fp=h({"account_number":a.account_number,"reference":a.account_reference,"verification_reference":a.verification_reference});x=C(id=i("community"),**sc(context,project_id),community_number=n("COM",project_id),community_key=k[:100],account_id=a.id,account_number=a.account_number,account_fingerprint=fp,community_name=name[:255],audience_kind=audience_kind,created_by=actor);self.db.add(x);await self.db.flush();return cv(x)
 async def verify_community(self,id,*,project_id,actor,expected_revision,reference):
  x=await self.community(id,project_id)
  if x.revision!=expected_revision or x.status!="draft":raise ValueError("Community changed; refresh before verification")
  if x.created_by==actor:raise ValueError("Community verification must be independent")
  x.status="verified";x.verified_by=actor;x.verification_reference=reference.strip()[:255];x.revision+=1;await self.db.flush();return cv(x)
 async def plan_activation(self,id,*,project_id,context,actor,activation_key,event_title,event_type,scheduled_on):
  x=await self.community(id,project_id);k=activation_key.strip().lower();title=event_title.strip()
  if x.status!="verified" or not k or len(title)<2 or event_type not in {"education","product","service"} or len(scheduled_on.strip())<8:raise ValueError("Activation requires verified community, event evidence and schedule")
  if await self.db.scalar(select(A.id).where(A.project_id==project_id,A.activation_key==k)):raise ValueError("Activation key already exists in this tenant plan")
  manifest={"community_number":x.community_number,"account_fingerprint":x.account_fingerprint,"event_title":title,"event_type":event_type,"scheduled_on":scheduled_on,"automatic_member_contact_dispatched":False,"external_community_action_dispatched":False};a=A(id=i("community-activation"),**sc(context,project_id),activation_number=n("ACT",project_id),activation_key=k[:100],community_id=x.id,community_number=x.community_number,event_title=title[:255],event_type=event_type,scheduled_on=scheduled_on[:32],activation_manifest_json=json.dumps(manifest,ensure_ascii=False,sort_keys=True),manifest_fingerprint=h(manifest),planned_by=actor);self.db.add(a);await self.db.flush();return av(a)
 async def approve_activation(self,id,*,project_id,actor,expected_revision,reference):
  x=await self.activation(id,project_id)
  if x.revision!=expected_revision or x.status!="planned" or x.planned_by==actor:raise ValueError("Community activation approval must be independent")
  x.status="approved";x.approved_by=actor;x.approval_reference=reference.strip()[:255];x.revision+=1;await self.db.flush();return av(x)
 async def acknowledge_activation(self,id,*,project_id,actor,expected_revision,reference):
  x=await self.activation(id,project_id)
  if x.revision!=expected_revision or x.status!="approved" or x.approved_by==actor:raise ValueError("Community activation acknowledgement must be independent")
  x.status="acknowledged";x.acknowledged_by=actor;x.acknowledgement_reference=reference.strip()[:255];x.acknowledged_at=datetime.now(timezone.utc);x.revision+=1;await self.db.flush();return av(x)
 async def community(self,id,p):
  x=await self.db.scalar(select(C).where(C.id==id,C.project_id==p))
  if not x:raise KeyError("Community not found in this tenant plan")
  return x
 async def activation(self,id,p):
  x=await self.db.scalar(select(A).where(A.id==id,A.project_id==p))
  if not x:raise KeyError("Community activation not found in this tenant plan")
  return x
