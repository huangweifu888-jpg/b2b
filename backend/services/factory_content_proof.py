"""Authorized proof-content lifecycle without direct publishing or source mutation."""
from datetime import datetime, timezone
import hashlib, json, secrets
from typing import Any
from core.tenant_context import TenantContext
from models.factory_contract import FactoryCoreEventContract, FactoryCoreObjectContract
from models.factory_content_proof import FactoryContentProofAsset, FactoryContentProofEvidence, FactoryContentProofPublication, FactoryContentProofVersion
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

APPLICATION_ID="content.proof"; TYPES={"cases","news","videos","blog"}; TARGETS={"website-case","website-news","website-video","website-blog","sales-proof"}; FORBIDDEN={"password","secret","token","private_key","api_key","credential","customer_phone","customer_email"}
ASSET=("id","asset_number","content_type","content_reference","display_name","source_reference","authorization_reference","public_scope","status","revision"); VERSION=("id","version_number","asset_id","asset_number","locale","manifest_hash","status","authored_by","verified_by","revision"); PUBLICATION=("id","publication_number","asset_id","proof_version_id","version_number","target","status","available","consumer_receipt_reference","revision")
def _id(x): return f"{x}-{secrets.token_urlsafe(18)}"
def _number(x,p): return f"{x}-{p}-{datetime.now(timezone.utc):%Y%m%d%H%M%S%f}-{secrets.token_hex(3).upper()}"
def _hash(x): return hashlib.sha256(json.dumps(x,ensure_ascii=False,sort_keys=True,separators=(",",":"),default=str).encode()).hexdigest()
def _context(c,p): return {"project_id":p,"agent_path":c.agent_path,"tenant_id":c.tenant_id,"client_id":c.client_id,"plan_id":c.plan_id or f"plan-{p}"}
def _same(x): return {n:getattr(x,n) for n in ("project_id","agent_path","tenant_id","client_id","plan_id")}
def _pick(x,n): return {k:getattr(x,k) for k in n}
def _unsafe(v):
    if isinstance(v,dict): return any(str(k).casefold() in FORBIDDEN or _unsafe(i) for k,i in v.items())
    if isinstance(v,list): return any(_unsafe(i) for i in v)
    return isinstance(v,str) and ("javascript:" in v.casefold() or "<script" in v.casefold())
class FactoryContentProofService:
    def __init__(self,db:AsyncSession): self.db=db
    async def workspace(self,*,project_id:int):
        async def rows(m,o): return list((await self.db.execute(select(m).where(m.project_id==project_id).order_by(o.desc()).limit(500))).scalars().all())
        a=await rows(FactoryContentProofAsset,FactoryContentProofAsset.created_at);v=await rows(FactoryContentProofVersion,FactoryContentProofVersion.created_at);p=await rows(FactoryContentProofPublication,FactoryContentProofPublication.prepared_at);e=await rows(FactoryContentProofEvidence,FactoryContentProofEvidence.recorded_at); ready=[x for x in p if x.status=="available" and x.available]
        return {"assets":[_pick(x,ASSET) for x in a],"versions":[_pick(x,VERSION) for x in v],"publications":[_pick(x,PUBLICATION) for x in p],"evidence":[{"id":x.id,"evidence_type":x.evidence_type,"evidence_reference":x.evidence_reference} for x in e],"metrics":{"authorized_assets":len(a),"verified_versions":sum(x.status=="verified" for x in v),"acknowledged_releases":len(ready),"evidence_records":len(e)},"availability":{"application_id":APPLICATION_ID,"status":"available" if ready else "pilot","release_version":ready[0].version_number if ready else None},"contract":{"source_content_mutated_directly":False,"authorization_bypassed":False,"customer_personal_data_stored":False,"version_self_verification":False,"publication_self_approval":False,"consumer_handoff_required":True}}
    async def create_asset(self,*,project_id,context,actor,content_type,content_reference,display_name,source_reference,authorization_reference,public_scope):
        if content_type not in TYPES or not all(str(x).strip() for x in (content_reference,display_name,source_reference,authorization_reference,public_scope)): raise ValueError("Proof asset requires supported content type, source, authorization and public scope")
        now=datetime.now(timezone.utc);x=FactoryContentProofAsset(id=_id("proof"),**_context(context,project_id),asset_number=_number("PFA",project_id),content_type=content_type,content_reference=content_reference.strip()[:160],display_name=display_name.strip()[:200],source_reference=source_reference.strip()[:255],authorization_reference=authorization_reference.strip()[:255],public_scope=public_scope.strip()[:255],status="active",created_by=str(actor),created_at=now,revision=1);self.db.add(x);await self._event(x,"asset","proof-authorization-registered",x.authorization_reference,"Source, authorization and public scope are referenced; source editor is unchanged",actor);await self.db.flush();return _pick(x,ASSET)
    async def draft_version(self,asset_id,*,project_id,context,actor,locale,content_manifest):
        a=await self._get(FactoryContentProofAsset,asset_id,project_id,"Proof asset")
        if a.status!="active" or not locale.strip() or not content_manifest or _unsafe(content_manifest): raise ValueError("Version requires active authorized asset and safe content manifest")
        payload={"asset_number":a.asset_number,"content_type":a.content_type,"locale":locale.strip(),"content_manifest":content_manifest,"source_reference":a.source_reference,"authorization_reference":a.authorization_reference,"public_scope":a.public_scope};v=FactoryContentProofVersion(id=_id("proof-version"),**_same(a),version_number=_number("PFV",project_id),asset_id=a.id,asset_number=a.asset_number,locale=locale.strip(),content_manifest_json=content_manifest,manifest_hash=_hash(payload),status="draft",authored_by=str(actor),created_at=datetime.now(timezone.utc),revision=1);self.db.add(v);await self._event(v,"version","proof-content-drafted",v.manifest_hash,"Pinned content retains authorized source and scope references",actor);await self.db.flush();return _pick(v,VERSION)
    async def verify_version(self,version_id,*,project_id,actor,expected_revision,verification_reference):
        v=await self._get(FactoryContentProofVersion,version_id,project_id,"Proof version");self._revision(v,expected_revision);a=await self._get(FactoryContentProofAsset,v.asset_id,project_id,"Proof asset");expected=_hash({"asset_number":a.asset_number,"content_type":a.content_type,"locale":v.locale,"content_manifest":v.content_manifest_json,"source_reference":a.source_reference,"authorization_reference":a.authorization_reference,"public_scope":a.public_scope})
        if v.status!="draft" or v.authored_by==str(actor) or not verification_reference.strip() or v.manifest_hash!=expected: raise ValueError("Version requires independent verification of unchanged authorized content")
        v.status="verified";v.verified_by=str(actor);v.verified_at=datetime.now(timezone.utc);v.verification_reference=verification_reference.strip()[:255];v.revision+=1;await self._event(v,"version","proof-content-verified",v.verification_reference,"Independent verifier accepted source, authorization, scope and content hash",actor);await self.db.flush();return _pick(v,VERSION)
    async def prepare_publication(self,version_id,*,project_id,context,actor,target,rollback_reference):
        v=await self._get(FactoryContentProofVersion,version_id,project_id,"Proof version");a=await self._get(FactoryContentProofAsset,v.asset_id,project_id,"Proof asset");expected_target={"cases":"website-case","news":"website-news","videos":"website-video","blog":"website-blog"}[a.content_type]
        if v.status!="verified" or target not in {expected_target,"sales-proof"} or not rollback_reference.strip(): raise ValueError("Release requires verified content, matching target and rollback reference")
        m={"application_id":APPLICATION_ID,"asset_number":a.asset_number,"version_number":v.version_number,"source_manifest_hash":v.manifest_hash,"source_reference":a.source_reference,"authorization_reference":a.authorization_reference,"public_scope":a.public_scope,"target":target,"source_content_mutated_directly":False,"consumer_receipt_required":True,"rollback_reference":rollback_reference.strip()};p=FactoryContentProofPublication(id=_id("proof-release"),**_context(context,project_id),publication_number=_number("PFP",project_id),asset_id=a.id,proof_version_id=v.id,version_number=v.version_number,target=target,release_manifest_json=m,manifest_hash=_hash(m),rollback_reference=rollback_reference.strip()[:255],status="pending-approval",prepared_by=str(actor),available=False,prepared_at=datetime.now(timezone.utc),revision=1);self.db.add(p);await self._event(p,"publication","proof-release-prepared",p.manifest_hash,"Controlled handoff does not publish, edit source content or broaden authorization",actor);await self.db.flush();return _pick(p,PUBLICATION)
    async def approve_publication(self,publication_id,*,project_id,actor,expected_revision,approval_reference):
        p=await self._get(FactoryContentProofPublication,publication_id,project_id,"Proof publication");self._revision(p,expected_revision);v=await self._get(FactoryContentProofVersion,p.proof_version_id,project_id,"Proof version");o=await self.db.scalar(select(FactoryCoreObjectContract).where(FactoryCoreObjectContract.id=="authorized-proof-content-version",FactoryCoreObjectContract.lifecycle_status=="frozen"));e=await self.db.scalar(select(FactoryCoreEventContract).where(FactoryCoreEventContract.id=="authorized-proof-content-released",FactoryCoreEventContract.lifecycle_status=="frozen"))
        if p.status!="pending-approval" or p.prepared_by==str(actor) or not approval_reference.strip() or p.manifest_hash!=_hash(p.release_manifest_json) or v.status!="verified" or not o or not e: raise ValueError("Release requires independent approval, frozen contracts and unchanged verified content")
        p.status="approved";p.approved_by=str(actor);p.approval_reference=approval_reference.strip()[:255];p.revision+=1;await self._event(p,"publication","proof-release-approved",p.approval_reference,"Awaiting consumer acknowledgement; no direct public release occurred",actor);await self.db.flush();return _pick(p,PUBLICATION)
    async def acknowledge_publication(self,publication_id,*,project_id,actor,expected_revision,consumer_receipt_reference):
        p=await self._get(FactoryContentProofPublication,publication_id,project_id,"Proof publication");self._revision(p,expected_revision)
        if p.status!="approved" or p.approved_by==str(actor) or not consumer_receipt_reference.strip(): raise ValueError("Consumer acknowledgement requires an approved release and separate handoff actor")
        p.status="available";p.available=True;p.consumer_receipt_reference=consumer_receipt_reference.strip()[:255];p.acknowledged_at=datetime.now(timezone.utc);p.revision+=1;await self._event(p,"publication","authorized-proof-content-released",p.consumer_receipt_reference,"Consumer receipt accepted authorized proof-content handoff",actor);await self.db.flush();return _pick(p,PUBLICATION)
    async def _get(self,m,item_id,project_id,label):
        x=await self.db.scalar(select(m).where(m.id==item_id,m.project_id==project_id))
        if not x: raise KeyError(f"{label} not found in this tenant plan")
        return x
    @staticmethod
    def _revision(x,expected):
        if int(getattr(x,"revision"))!=int(expected): raise ValueError("Revision conflict")
    async def _event(self,x,subject_type,evidence_type,reference,note,actor):
        n=next((getattr(x,k,None) for k in ("asset_number","version_number","publication_number") if getattr(x,k,None)),str(x.id));self.db.add(FactoryContentProofEvidence(id=_id("proof-evidence"),**_same(x),evidence_number=_number("PFE",x.project_id),subject_type=subject_type,subject_id=x.id,subject_number=n,evidence_type=evidence_type,evidence_reference=str(reference)[:255],note=note,recorded_by=str(actor),recorded_at=datetime.now(timezone.utc)))
