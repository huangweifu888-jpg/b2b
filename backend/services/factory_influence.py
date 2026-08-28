from datetime import datetime,timezone
import hashlib,json,secrets
from sqlalchemy import select
from models.factory_community import FactoryCommunityActivation
from models.factory_influence import FactoryInfluenceBrief as B,FactoryInfluenceRelease as R
def h(x):return hashlib.sha256(json.dumps(x,ensure_ascii=False,sort_keys=True,default=str,separators=(",",":" )).encode()).hexdigest()
def i(p):return f"{p}-{secrets.token_urlsafe(16)}"
def n(p,x):return f"{p}-{x}-{datetime.now(timezone.utc):%Y%m%d%H%M%S}-{secrets.token_hex(3).upper()}"
def sc(ctx,p):return dict(project_id=p,agent_path=ctx.agent_path,tenant_id=ctx.tenant_id,client_id=ctx.client_id,plan_id=ctx.plan_id or f"plan-{p}")
def bv(x):return {k:getattr(x,k) for k in ("id","brief_number","brief_key","activation_id","activation_number","activation_fingerprint","advocate_role","topic","status","created_by","verified_by","verification_reference","revision","created_at","updated_at")}
def rv(x):return {k:getattr(x,k) for k in ("id","release_number","brief_id","brief_number","destination","manifest_fingerprint","status","authorized_by","authorization_reference","acknowledged_by","acknowledgement_reference","revision","created_at","acknowledged_at")}
class FactoryInfluenceService:
 def __init__(self,db):self.db=db
 async def workspace(self,p):
  bs=(await self.db.execute(select(B).where(B.project_id==p).order_by(B.created_at.desc()))).scalars().all();rs=(await self.db.execute(select(R).where(R.project_id==p).order_by(R.created_at.desc()))).scalars().all();return {"briefs":[bv(x)for x in bs],"releases":[rv(x)for x in rs],"contract":{"acknowledged_community_activation_required":True,"advocate_personal_data_stored":False,"testimonial_or_endorsement_fabricated":False,"external_livestream_started":False,"external_publish_dispatched":False}}
 async def create(self,*,project_id,context,actor,brief_key,activation_id,advocate_role,topic):
  a=await self.db.scalar(select(FactoryCommunityActivation).where(FactoryCommunityActivation.id==activation_id,FactoryCommunityActivation.project_id==project_id));k=brief_key.strip().lower();t=topic.strip()
  if not a or a.status!="acknowledged" or not k or len(t)<2 or advocate_role not in {"expert","customer","employee"}:raise ValueError("Advocacy brief requires acknowledged community activation, role and topic")
  if await self.db.scalar(select(B.id).where(B.project_id==project_id,B.brief_key==k)):raise ValueError("Advocacy brief key already exists in this tenant plan")
  fp=h({"activation_number":a.activation_number,"manifest_fingerprint":a.manifest_fingerprint,"event_type":a.event_type,"scheduled_on":a.scheduled_on});x=B(id=i("influence-brief"),**sc(context,project_id),brief_number=n("INF",project_id),brief_key=k[:100],activation_id=a.id,activation_number=a.activation_number,activation_fingerprint=fp,advocate_role=advocate_role,topic=t[:255],created_by=actor);self.db.add(x);await self.db.flush();return bv(x)
 async def verify(self,id,*,project_id,actor,expected_revision,reference):
  x=await self.brief(id,project_id)
  if x.revision!=expected_revision or x.status!="draft":raise ValueError("Advocacy brief changed; refresh before verification")
  if x.created_by==actor:raise ValueError("Advocacy brief verification must be independent")
  x.status="verified";x.verified_by=actor;x.verification_reference=reference.strip()[:255];x.revision+=1;await self.db.flush();return bv(x)
 async def authorize(self,id,*,project_id,context,actor,expected_revision,destination,reference):
  x=await self.brief(id,project_id)
  if x.revision!=expected_revision or x.status!="verified" or actor in {x.created_by,x.verified_by} or destination not in {"marketing-owner","event-owner","service-owner"}:raise ValueError("Advocacy authorization requires verified brief, separate owner and allowed destination")
  m={"brief_number":x.brief_number,"activation_fingerprint":x.activation_fingerprint,"advocate_role":x.advocate_role,"topic":x.topic,"destination":destination,"testimonial_or_endorsement_fabricated":False,"external_livestream_started":False,"external_publish_dispatched":False};r=R(id=i("influence-release"),**sc(context,project_id),release_number=n("INR",project_id),brief_id=x.id,brief_number=x.brief_number,destination=destination,release_manifest_json=json.dumps(m,ensure_ascii=False,sort_keys=True),manifest_fingerprint=h(m),authorized_by=actor,authorization_reference=reference.strip()[:255]);self.db.add(r);x.status="authorized";x.revision+=1;await self.db.flush();return {"brief":bv(x),"release":rv(r)}
 async def acknowledge(self,id,*,project_id,actor,expected_revision,reference):
  x=await self.db.scalar(select(R).where(R.id==id,R.project_id==project_id))
  if not x:raise KeyError("Advocacy release not found in this tenant plan")
  if x.revision!=expected_revision or x.status!="authorized" or x.authorized_by==actor:raise ValueError("Advocacy release acknowledgement must be independent")
  x.status="acknowledged";x.acknowledged_by=actor;x.acknowledgement_reference=reference.strip()[:255];x.acknowledged_at=datetime.now(timezone.utc);x.revision+=1;await self.db.flush();return rv(x)
 async def brief(self,id,p):
  x=await self.db.scalar(select(B).where(B.id==id,B.project_id==p))
  if not x:raise KeyError("Advocacy brief not found in this tenant plan")
  return x
