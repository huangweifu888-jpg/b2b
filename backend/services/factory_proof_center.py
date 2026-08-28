"""Verified proof assets without source mutation or automatic website publication."""
from datetime import datetime,timezone,date
import hashlib,json,secrets
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from models.factory_contract import FactoryCoreEventContract,FactoryCoreObjectContract
from models.factory_proof_center import FactoryProofCenterAsset,FactoryProofCenterVersion,FactoryProofCenterRelease,FactoryProofCenterEvidence
APPLICATION_ID="trust.proof-center";F={"password","secret","token","api_key","credential","customer_email","customer_phone"};A=("id","asset_number","asset_type","source_reference","rights_reference","market_scope","valid_until","status","revision");V=("id","version_number","asset_id","asset_number","manifest_hash","status","authored_by","verified_by","revision");R=("id","release_number","asset_id","version_id","version_number","target","status","available","consumer_receipt_reference","revision")
def _id(x):return f"{x}-{secrets.token_urlsafe(18)}"
def _no(x,p):return f"{x}-{p}-{datetime.now(timezone.utc):%Y%m%d%H%M%S%f}-{secrets.token_hex(3).upper()}"
def _hash(x):return hashlib.sha256(json.dumps(x,ensure_ascii=False,sort_keys=True,separators=(",",":"),default=str).encode()).hexdigest()
def _ctx(c,p):return {"project_id":p,"agent_path":c.agent_path,"tenant_id":c.tenant_id,"client_id":c.client_id,"plan_id":c.plan_id or f"plan-{p}"}
def _same(x):return {n:getattr(x,n) for n in("project_id","agent_path","tenant_id","client_id","plan_id")}
def _pick(x,n):return {k:getattr(x,k) for k in n}
def _unsafe(v):return any(str(k).casefold() in F or _unsafe(i) for k,i in v.items()) if isinstance(v,dict) else any(_unsafe(i) for i in v) if isinstance(v,list) else isinstance(v,str) and ("<script" in v.casefold() or "javascript:" in v.casefold())
class FactoryProofCenterService:
 def __init__(self,db:AsyncSession):self.db=db
 async def workspace(self,*,project_id):
  async def q(m,o):return list((await self.db.execute(select(m).where(m.project_id==project_id).order_by(o.desc()).limit(500))).scalars())
  a=await q(FactoryProofCenterAsset,FactoryProofCenterAsset.created_at);v=await q(FactoryProofCenterVersion,FactoryProofCenterVersion.created_at);r=await q(FactoryProofCenterRelease,FactoryProofCenterRelease.prepared_at);e=await q(FactoryProofCenterEvidence,FactoryProofCenterEvidence.recorded_at);ready=[x for x in r if x.available and x.status=="available"]
  return {"assets":[_pick(x,A)for x in a],"versions":[_pick(x,V)for x in v],"releases":[_pick(x,R)for x in r],"evidence":[{"id":x.id,"evidence_type":x.evidence_type}for x in e],"availability":{"application_id":APPLICATION_ID,"status":"available" if ready else "pilot","release_version":ready[0].version_number if ready else None},"contract":{"source_asset_mutated_directly":False,"expired_asset_published":False,"website_published_automatically":False,"consumer_handoff_required":True}}
 async def create_asset(self,*,project_id,context,actor,asset_type,source_reference,rights_reference,market_scope,valid_until):
  if asset_type not in {"certificate","test-report","capacity","delivery","service"} or not all(str(x).strip()for x in(source_reference,rights_reference,market_scope,valid_until)):raise ValueError("Proof asset requires type, source, rights, market and validity")
  x=FactoryProofCenterAsset(id=_id("proof-asset"),**_ctx(context,project_id),asset_number=_no("PCA",project_id),asset_type=asset_type,source_reference=source_reference.strip()[:255],rights_reference=rights_reference.strip()[:255],market_scope=market_scope.strip()[:80],valid_until=valid_until.strip()[:32],status="registered",created_by=str(actor),created_at=datetime.now(timezone.utc),revision=1);self.db.add(x);await self._event(x,"asset","proof-source-registered",x.source_reference,"Source asset remains unchanged",actor);await self.db.flush();return _pick(x,A)
 async def draft_version(self,asset_id,*,project_id,context,actor,claim_manifest):
  a=await self._get(FactoryProofCenterAsset,asset_id,project_id,"Proof asset")
  if not claim_manifest or _unsafe(claim_manifest):raise ValueError("Proof version requires safe claim manifest")
  p={"asset_number":a.asset_number,"source_reference":a.source_reference,"rights_reference":a.rights_reference,"market_scope":a.market_scope,"valid_until":a.valid_until,"claim_manifest":claim_manifest};x=FactoryProofCenterVersion(id=_id("proof-version"),**_same(a),version_number=_no("PCV",project_id),asset_id=a.id,asset_number=a.asset_number,claim_manifest_json=claim_manifest,manifest_hash=_hash(p),status="draft",authored_by=str(actor),created_at=datetime.now(timezone.utc),revision=1);self.db.add(x);await self._event(x,"version","proof-claim-drafted",x.manifest_hash,"Claim is controlled proposal",actor);await self.db.flush();return _pick(x,V)
 async def verify_version(self,version_id,*,project_id,actor,expected_revision,verification_reference):
  x=await self._get(FactoryProofCenterVersion,version_id,project_id,"Proof version");self._rev(x,expected_revision);a=await self._get(FactoryProofCenterAsset,x.asset_id,project_id,"Proof asset");p={"asset_number":a.asset_number,"source_reference":a.source_reference,"rights_reference":a.rights_reference,"market_scope":a.market_scope,"valid_until":a.valid_until,"claim_manifest":x.claim_manifest_json}
  if x.status!="draft" or x.authored_by==str(actor) or not verification_reference.strip() or x.manifest_hash!=_hash(p) or a.valid_until<date.today().isoformat():raise ValueError("Proof requires independent verification of unchanged, unexpired evidence")
  x.status="verified";x.verified_by=str(actor);x.verified_at=datetime.now(timezone.utc);x.verification_reference=verification_reference.strip()[:255];x.revision+=1;await self._event(x,"version","proof-claim-verified",x.verification_reference,"Independent verifier accepted evidence scope",actor);await self.db.flush();return _pick(x,V)
 async def prepare_release(self,version_id,*,project_id,context,actor,target,handoff_manifest,rollback_reference):
  v=await self._get(FactoryProofCenterVersion,version_id,project_id,"Proof version");a=await self._get(FactoryProofCenterAsset,v.asset_id,project_id,"Proof asset")
  if v.status!="verified" or target not in {"marketing-owner","sales-owner","quality-owner"} or not handoff_manifest or _unsafe(handoff_manifest) or not rollback_reference.strip():raise ValueError("Handoff requires verified proof, safe plan, allowed target and rollback reference")
  p={"application_id":APPLICATION_ID,"asset_number":a.asset_number,"version_number":v.version_number,"source_manifest_hash":v.manifest_hash,"source_reference":a.source_reference,"rights_reference":a.rights_reference,"market_scope":a.market_scope,"valid_until":a.valid_until,"target":target,"handoff_manifest":handoff_manifest,"website_published_automatically":False,"consumer_receipt_required":True,"rollback_reference":rollback_reference.strip()};x=FactoryProofCenterRelease(id=_id("proof-release"),**_ctx(context,project_id),release_number=_no("PCR",project_id),asset_id=a.id,version_id=v.id,version_number=v.version_number,target=target,handoff_manifest_json=p,manifest_hash=_hash(p),rollback_reference=rollback_reference.strip()[:255],status="pending-approval",prepared_by=str(actor),available=False,prepared_at=datetime.now(timezone.utc),revision=1);self.db.add(x);await self._event(x,"release","proof-handoff-prepared",x.manifest_hash,"Handoff never publishes website evidence automatically",actor);await self.db.flush();return _pick(x,R)
 async def approve_release(self,release_id,*,project_id,actor,expected_revision,approval_reference):
  x=await self._get(FactoryProofCenterRelease,release_id,project_id,"Proof handoff");self._rev(x,expected_revision);v=await self._get(FactoryProofCenterVersion,x.version_id,project_id,"Proof version");o=await self.db.scalar(select(FactoryCoreObjectContract).where(FactoryCoreObjectContract.id=="proof-center-verified-asset",FactoryCoreObjectContract.lifecycle_status=="frozen"));e=await self.db.scalar(select(FactoryCoreEventContract).where(FactoryCoreEventContract.id=="proof-center-handoff-released",FactoryCoreEventContract.lifecycle_status=="frozen"))
  if x.status!="pending-approval" or x.prepared_by==str(actor) or not approval_reference.strip() or x.manifest_hash!=_hash(x.handoff_manifest_json) or v.status!="verified" or not o or not e:raise ValueError("Handoff requires independent approval, frozen contracts and unchanged verified evidence")
  x.status="approved";x.approved_by=str(actor);x.approval_reference=approval_reference.strip()[:255];x.revision+=1;await self._event(x,"release","proof-handoff-approved",x.approval_reference,"Awaiting page-owner receipt",actor);await self.db.flush();return _pick(x,R)
 async def acknowledge_release(self,release_id,*,project_id,actor,expected_revision,consumer_receipt_reference):
  x=await self._get(FactoryProofCenterRelease,release_id,project_id,"Proof handoff");self._rev(x,expected_revision)
  if x.status!="approved" or x.approved_by==str(actor) or not consumer_receipt_reference.strip():raise ValueError("Consumer acknowledgement requires independently approved proof handoff")
  x.status="available";x.available=True;x.consumer_receipt_reference=consumer_receipt_reference.strip()[:255];x.acknowledged_at=datetime.now(timezone.utc);x.revision+=1;await self._event(x,"release","proof-center-handoff-released",x.consumer_receipt_reference,"Page owner accepted bounded proof handoff",actor);await self.db.flush();return _pick(x,R)
 async def _get(self,m,i,p,l):
  x=await self.db.scalar(select(m).where(m.id==i,m.project_id==p));
  if not x:raise KeyError(f"{l} not found in this tenant plan")
  return x
 @staticmethod
 def _rev(x,e):
  if x.revision!=e:raise ValueError("Revision conflict")
 async def _event(self,x,t,et,ref,note,actor):
  n=next((getattr(x,k,None)for k in("asset_number","version_number","release_number")if getattr(x,k,None)),x.id);self.db.add(FactoryProofCenterEvidence(id=_id("proof-evidence"),**_same(x),evidence_number=_no("PCE",x.project_id),subject_type=t,subject_id=x.id,subject_number=n,evidence_type=et,evidence_reference=str(ref)[:255],note=note,recorded_by=str(actor),recorded_at=datetime.now(timezone.utc)))
