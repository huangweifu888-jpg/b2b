"""CRM source-of-record boundary with tenant, evidence and role separation."""
from __future__ import annotations
from datetime import datetime, timezone
import secrets
from core.tenant_context import TenantContext
from models.factory_crm import FactoryCrmAccount, FactoryCrmEvidence, FactoryCrmOpportunity
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

def _id(prefix: str) -> str: return f"{prefix}-{secrets.token_urlsafe(16)}"
def _num(prefix: str, project_id: int) -> str: return f"{prefix}-{project_id}-{datetime.now(timezone.utc):%Y%m%d%H%M%S}-{secrets.token_hex(3).upper()}"
def _account(x: FactoryCrmAccount) -> dict[str, object]: return {k: getattr(x, k) for k in ("id","account_number","account_reference","account_name","market","status","created_by","verified_by","verification_reference","revision","created_at","updated_at")}
def _opportunity(x: FactoryCrmOpportunity) -> dict[str, object]: return {k: getattr(x, k) for k in ("id","opportunity_number","opportunity_key","account_id","account_number","title","currency","amount_cents","stage","owner_team","created_by","last_updated_by","close_reference","revision","created_at","updated_at")}

class FactoryCrmService:
    def __init__(self, db: AsyncSession): self.db = db
    async def workspace(self, project_id: int) -> dict[str, object]:
        accounts=(await self.db.execute(select(FactoryCrmAccount).where(FactoryCrmAccount.project_id==project_id).order_by(FactoryCrmAccount.created_at.desc()))).scalars().all()
        opportunities=(await self.db.execute(select(FactoryCrmOpportunity).where(FactoryCrmOpportunity.project_id==project_id).order_by(FactoryCrmOpportunity.created_at.desc()))).scalars().all()
        evidence=(await self.db.execute(select(FactoryCrmEvidence).where(FactoryCrmEvidence.project_id==project_id).order_by(FactoryCrmEvidence.recorded_at.desc()))).scalars().all()
        return {"accounts":[_account(x) for x in accounts],"opportunities":[_opportunity(x) for x in opportunities],"evidence":[{"subject_type":x.subject_type,"subject_id":x.subject_id,"event_type":x.event_type,"reference":x.reference,"recorded_by":x.recorded_by,"recorded_at":x.recorded_at} for x in evidence],"contract":{"tenant_scoped":True,"raw_personal_contacts_stored":False,"account_verification_independent":True,"stage_transition_evidence_required":True,"crm_is_system_of_record":True}}
    async def create_account(self, *, project_id:int, context:TenantContext, actor:str, account_reference:str, account_name:str, market:str)->dict[str,object]:
        reference=account_reference.strip(); name=account_name.strip(); region=market.strip()
        if min(map(len,(reference,name,region)))<2: raise ValueError("CRM account reference, name and market are required")
        if await self.db.scalar(select(FactoryCrmAccount.id).where(FactoryCrmAccount.project_id==project_id,FactoryCrmAccount.account_reference==reference)): raise ValueError("CRM account reference already exists in this tenant plan")
        x=FactoryCrmAccount(id=_id("crm-account"),project_id=project_id,agent_path=context.agent_path,tenant_id=context.tenant_id,client_id=context.client_id,plan_id=context.plan_id or f"plan-{project_id}",account_number=_num("CRM",project_id),account_reference=reference[:255],account_name=name[:255],market=region[:80],created_by=actor)
        self.db.add(x);await self.db.flush();await self._evidence(x,"account","account-created",reference,"Account is a tenant-scoped CRM source-of-record draft",actor);return _account(x)
    async def verify_account(self, account_id:str, *, project_id:int, expected_revision:int, actor:str, reference:str, note:str)->dict[str,object]:
        x=await self._account_get(account_id,project_id)
        if x.revision!=expected_revision or x.status!="draft":raise ValueError("CRM account changed; refresh before verification")
        if x.created_by==actor:raise ValueError("CRM account verification must be independent from creation")
        if len(reference.strip())<2 or len(note.strip())<8:raise ValueError("Verification reference and meaningful note are required")
        x.status="verified";x.verified_by=actor;x.verification_reference=reference.strip()[:255];x.revision+=1;await self._evidence(x,"account","account-verified",reference,note,actor);return _account(x)
    async def create_opportunity(self, *, project_id:int, context:TenantContext, actor:str, account_id:str, opportunity_key:str, title:str, currency:str, amount_cents:int, owner_team:str)->dict[str,object]:
        account=await self._account_get(account_id,project_id)
        if account.status!="verified":raise ValueError("CRM opportunity requires an independently verified account")
        key=opportunity_key.strip(); name=title.strip(); team=owner_team.strip(); unit=currency.strip().upper()
        if min(len(key),len(name),len(team))<2 or len(unit)!=3 or amount_cents<=0:raise ValueError("Opportunity key, title, ISO currency, positive amount and owner are required")
        if await self.db.scalar(select(FactoryCrmOpportunity.id).where(FactoryCrmOpportunity.project_id==project_id,FactoryCrmOpportunity.opportunity_key==key)):raise ValueError("CRM opportunity key already exists in this tenant plan")
        x=FactoryCrmOpportunity(id=_id("crm-opportunity"),project_id=project_id,agent_path=context.agent_path,tenant_id=context.tenant_id,client_id=context.client_id,plan_id=context.plan_id or f"plan-{project_id}",opportunity_number=_num("OPP",project_id),opportunity_key=key[:100],account_id=account.id,account_number=account.account_number,title=name[:255],currency=unit,amount_cents=amount_cents,owner_team=team[:80],created_by=actor,last_updated_by=actor)
        self.db.add(x);await self.db.flush();await self._evidence(x,"opportunity","opportunity-created",account.account_number,"Verified account linked to qualified opportunity",actor);return _opportunity(x)
    async def advance_opportunity(self, opportunity_id:str, *, project_id:int, expected_revision:int, actor:str, stage:str, reference:str, note:str)->dict[str,object]:
        x=await self._opportunity_get(opportunity_id,project_id); allowed={"qualified":{"proposal","lost"},"proposal":{"won","lost"}}
        if x.revision!=expected_revision or stage not in allowed.get(x.stage,set()):raise ValueError("CRM opportunity stage changed; refresh before transition")
        if len(reference.strip())<2 or len(note.strip())<8:raise ValueError("Stage reference and meaningful evidence note are required")
        x.stage=stage;x.last_updated_by=actor;x.close_reference=reference.strip()[:255] if stage in {"won","lost"} else None;x.revision+=1;await self._evidence(x,"opportunity",f"opportunity-{stage}",reference,note,actor);return _opportunity(x)
    async def _account_get(self,id:str,project_id:int)->FactoryCrmAccount:
        x=await self.db.scalar(select(FactoryCrmAccount).where(FactoryCrmAccount.id==id,FactoryCrmAccount.project_id==project_id))
        if not x:raise KeyError("CRM account not found in this tenant plan")
        return x
    async def _opportunity_get(self,id:str,project_id:int)->FactoryCrmOpportunity:
        x=await self.db.scalar(select(FactoryCrmOpportunity).where(FactoryCrmOpportunity.id==id,FactoryCrmOpportunity.project_id==project_id))
        if not x:raise KeyError("CRM opportunity not found in this tenant plan")
        return x
    async def _evidence(self,x:object,subject_type:str,event_type:str,reference:str,note:str,actor:str)->None:
        now=datetime.now(timezone.utc);self.db.add(FactoryCrmEvidence(id=_id("crm-evidence"),project_id=x.project_id,agent_path=x.agent_path,tenant_id=x.tenant_id,client_id=x.client_id,plan_id=x.plan_id,evidence_number=_num("CRME",x.project_id),subject_type=subject_type,subject_id=x.id,event_type=event_type,reference=reference.strip()[:255],note=note.strip()[:4000],recorded_by=actor,recorded_at=now));await self.db.flush()
