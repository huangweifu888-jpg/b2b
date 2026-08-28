"""AI-readable fact service: source evidence first, never generated truth."""
from datetime import datetime,timezone
import hashlib,json,secrets
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from models.factory_contract import FactoryCoreEventContract,FactoryCoreObjectContract
from models.factory_fact_library import FactoryFactLibraryEvidence,FactoryFactLibraryFact,FactoryFactLibraryRelease,FactoryFactLibraryVersion
APPLICATION_ID="recommend.fact-library";FORBIDDEN={"password","secret","token","api_key","credential","customer_email","customer_phone"};FACT=("id","fact_number","fact_key","fact_type","source_reference","authority_reference","status","revision");VERSION=("id","version_number","fact_id","fact_number","manifest_hash","status","authored_by","verified_by","verification_reference","revision");RELEASE=("id","release_number","version_id","version_number","target","status","available","consumer_receipt_reference","revision")
def _id(x):return f"{x}-{secrets.token_urlsafe(18)}"
def _no(x,p):return f"{x}-{p}-{datetime.now(timezone.utc):%Y%m%d%H%M%S%f}-{secrets.token_hex(3).upper()}"
def _hash(x):return hashlib.sha256(json.dumps(x,ensure_ascii=False,sort_keys=True,separators=(",",":"),default=str).encode()).hexdigest()
def _ctx(c,p):return {"project_id":p,"agent_path":c.agent_path,"tenant_id":c.tenant_id,"client_id":c.client_id,"plan_id":c.plan_id or f"plan-{p}"}
def _same(x):return {n:getattr(x,n)for n in("project_id","agent_path","tenant_id","client_id","plan_id")}
def _pick(x,n):return {k:getattr(x,k)for k in n}
def _unsafe(v):return any(str(k).casefold()in FORBIDDEN or _unsafe(x)for k,x in v.items())if isinstance(v,dict)else any(_unsafe(x)for x in v)if isinstance(v,list)else isinstance(v,str)and("<script"in v.casefold()or"javascript:"in v.casefold())
class FactoryFactLibraryService:
 def __init__(self,db:AsyncSession):self.db=db
 async def workspace(self,*,project_id):
  async def rows(m,o):return list((await self.db.execute(select(m).where(m.project_id==project_id).order_by(o.desc()).limit(500))).scalars().all())
  facts=await rows(FactoryFactLibraryFact,FactoryFactLibraryFact.created_at);versions=await rows(FactoryFactLibraryVersion,FactoryFactLibraryVersion.created_at);releases=await rows(FactoryFactLibraryRelease,FactoryFactLibraryRelease.prepared_at);evidence=await rows(FactoryFactLibraryEvidence,FactoryFactLibraryEvidence.recorded_at);ready=[x for x in releases if x.status=="available"and x.available]
  return {"facts":[_pick(x,FACT)for x in facts],"versions":[_pick(x,VERSION)for x in versions],"releases":[_pick(x,RELEASE)for x in releases],"evidence":[{"id":x.id,"subject_id":x.subject_id,"evidence_type":x.evidence_type,"evidence_reference":x.evidence_reference}for x in evidence],"metrics":{"registered_facts":len(facts),"verified_fact_versions":sum(x.status=="verified"for x in versions),"acknowledged_fact_handoffs":len(ready),"evidence_records":len(evidence)},"availability":{"application_id":APPLICATION_ID,"status":"available"if ready else"pilot","release_version":ready[0].version_number if ready else None},"contract":{"source_fact_mutated_directly":False,"automatic_content_publish":False,"model_generated_fact_accepted":False,"version_self_verification":False,"release_self_approval":False,"consumer_handoff_required":True}}
 async def create_fact(self,*,project_id,context,actor,fact_key,fact_type,source_reference,authority_reference):
  if not all(str(x).strip()for x in(fact_key,fact_type,source_reference,authority_reference))or fact_type not in{"product","company","capability","proof","service"}:raise ValueError("Fact requires key, allowed type, source and authority reference")
  x=FactoryFactLibraryFact(id=_id("fact"),**_ctx(context,project_id),fact_number=_no("FACT",project_id),fact_key=fact_key.strip()[:160],fact_type=fact_type,source_reference=source_reference.strip()[:255],authority_reference=authority_reference.strip()[:255],status="registered",created_by=str(actor),created_at=datetime.now(timezone.utc),revision=1);self.db.add(x);await self._event(x,"fact-registered",x.source_reference,"Source and authority are referenced; no generated claim becomes a fact",actor);await self.db.flush();return _pick(x,FACT)
 async def draft_version(self,fid,*,project_id,context,actor,fact_manifest):
  f=await self._get(FactoryFactLibraryFact,fid,project_id,"Fact")
  if f.status!="registered"or not fact_manifest or _unsafe(fact_manifest):raise ValueError("Fact version requires registered fact and safe source-bound manifest")
  p={"fact_number":f.fact_number,"fact_key":f.fact_key,"fact_type":f.fact_type,"source_reference":f.source_reference,"authority_reference":f.authority_reference,"fact_manifest":fact_manifest};x=FactoryFactLibraryVersion(id=_id("fact-version"),**_same(f),version_number=_no("FAV",project_id),fact_id=f.id,fact_number=f.fact_number,fact_manifest_json=fact_manifest,manifest_hash=_hash(p),status="draft",authored_by=str(actor),created_at=datetime.now(timezone.utc),revision=1);self.db.add(x);await self._event(x,"fact-version-drafted",x.manifest_hash,"Version is source-bound and not automatically written to content or models",actor);await self.db.flush();return _pick(x,VERSION)
 async def verify_version(self,vid,*,project_id,actor,expected_revision,verification_reference):
  x=await self._get(FactoryFactLibraryVersion,vid,project_id,"Fact version");f=await self._get(FactoryFactLibraryFact,x.fact_id,project_id,"Fact");p={"fact_number":f.fact_number,"fact_key":f.fact_key,"fact_type":f.fact_type,"source_reference":f.source_reference,"authority_reference":f.authority_reference,"fact_manifest":x.fact_manifest_json}
  if x.revision!=expected_revision or x.status!="draft"or x.authored_by==str(actor)or not verification_reference.strip()or x.manifest_hash!=_hash(p):raise ValueError("Fact version requires independent verification of unchanged source-bound evidence")
  x.status="verified";x.verified_by=str(actor);x.verification_reference=verification_reference.strip()[:255];x.verified_at=datetime.now(timezone.utc);x.revision+=1;await self._event(x,"fact-version-verified",x.verification_reference,"Verifier confirmed source and authority evidence",actor);await self.db.flush();return _pick(x,VERSION)
 async def prepare_release(self,vid,*,project_id,context,actor,target,handoff_manifest):
  v=await self._get(FactoryFactLibraryVersion,vid,project_id,"Fact version")
  if v.status!="verified"or target not in{"geo-owner","content-owner","structured-data-owner"}or not handoff_manifest or _unsafe(handoff_manifest):raise ValueError("Fact handoff requires verified version, allowed target and safe manifest")
  p={"application_id":APPLICATION_ID,"version_number":v.version_number,"source_manifest_hash":v.manifest_hash,"target":target,"handoff_manifest":handoff_manifest,"automatic_content_publish":False,"model_generated_fact_accepted":False};x=FactoryFactLibraryRelease(id=_id("fact-release"),**_ctx(context,project_id),release_number=_no("FAR",project_id),version_id=v.id,version_number=v.version_number,target=target,handoff_manifest_json=p,manifest_hash=_hash(p),status="pending-approval",prepared_by=str(actor),available=False,prepared_at=datetime.now(timezone.utc),revision=1);self.db.add(x);await self._event(x,"fact-handoff-prepared",x.manifest_hash,"No content or model is automatically updated",actor);await self.db.flush();return _pick(x,RELEASE)
 async def approve_release(self,rid,*,project_id,actor,expected_revision,approval_reference):
  x=await self._get(FactoryFactLibraryRelease,rid,project_id,"Fact handoff");v=await self._get(FactoryFactLibraryVersion,x.version_id,project_id,"Fact version");o=await self.db.scalar(select(FactoryCoreObjectContract).where(FactoryCoreObjectContract.id=="ai-readable-fact-version",FactoryCoreObjectContract.lifecycle_status=="frozen"));e=await self.db.scalar(select(FactoryCoreEventContract).where(FactoryCoreEventContract.id=="ai-readable-fact-released",FactoryCoreEventContract.lifecycle_status=="frozen"))
  if x.revision!=expected_revision or x.status!="pending-approval"or x.prepared_by==str(actor)or not approval_reference.strip()or x.manifest_hash!=_hash(x.handoff_manifest_json)or v.status!="verified"or not o or not e:raise ValueError("Fact handoff requires independent approval, frozen contracts and unchanged verified version")
  x.status="approved";x.approved_by=str(actor);x.revision+=1;await self._event(x,"fact-handoff-approved",approval_reference,"Awaiting consumer receipt",actor);await self.db.flush();return _pick(x,RELEASE)
 async def acknowledge_release(self,rid,*,project_id,actor,expected_revision,consumer_receipt_reference):
  x=await self._get(FactoryFactLibraryRelease,rid,project_id,"Fact handoff")
  if x.revision!=expected_revision or x.status!="approved"or x.approved_by==str(actor)or not consumer_receipt_reference.strip():raise ValueError("Fact handoff requires independent consumer receipt")
  x.status="available";x.available=True;x.consumer_receipt_reference=consumer_receipt_reference.strip()[:255];x.revision+=1;await self._event(x,"ai-readable-fact-released",x.consumer_receipt_reference,"Consumer accepted source-bound fact handoff",actor);await self.db.flush();return _pick(x,RELEASE)
 async def _get(self,m,i,p,label):
  x=await self.db.scalar(select(m).where(m.id==i,m.project_id==p))
  if not x:raise KeyError(f"{label} not found in this tenant plan")
  return x
 async def _event(self,x,t,r,n,a):self.db.add(FactoryFactLibraryEvidence(id=_id("fact-evidence"),**_same(x),evidence_number=_no("FAE",x.project_id),subject_id=x.id,evidence_type=t,evidence_reference=str(r)[:255],note=n,recorded_by=str(a),recorded_at=datetime.now(timezone.utc)))
