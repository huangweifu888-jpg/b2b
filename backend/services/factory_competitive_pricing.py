"""Governed competitor-price intelligence; outputs recommendations, never formal quotes."""

from datetime import datetime, timezone
from decimal import Decimal
import hashlib, json, secrets

from core.tenant_context import TenantContext
from models.factory_competitive_pricing import FactoryCompetitiveOfferSnapshot, FactoryCompetitivePriceDecision, FactoryCompetitivePriceWatch, FactoryCompetitivePricingEvidence, FactoryCompetitivePricingRelease
from models.factory_contract import FactoryCoreEventContract, FactoryCoreObjectContract
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

APPLICATION_ID = "identity.competitive-pricing"
RELEASE_EVIDENCE_FIELDS = ("customer_trial_reference", "role_training_reference", "issue_closure_reference", "monitoring_reference", "rollback_reference")
OFFER_TYPES = {"list", "quote", "promotion"}

def _id(prefix): return f"{prefix}-{secrets.token_urlsafe(18)}"
def _number(prefix, project): return f"{prefix}-{project}-{datetime.now(timezone.utc):%Y%m%d%H%M%S%f}-{secrets.token_hex(3).upper()}"
def _hash(value): return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str).encode()).hexdigest()
def _context(context, project): return {"project_id": project, "agent_path": context.agent_path, "tenant_id": context.tenant_id, "client_id": context.client_id, "plan_id": context.plan_id or f"plan-{project}"}
def _same(item): return {key: getattr(item, key) for key in ("project_id", "agent_path", "tenant_id", "client_id", "plan_id")}
def _serialize(item, fields):
    data = {field: getattr(item, field) for field in fields}
    for key, value in list(data.items()):
        if isinstance(value, Decimal): data[key] = str(value)
    return data

WATCH_FIELDS = ("id", "watch_number", "product_reference", "product_name", "market_country", "channel", "currency", "own_reference_price", "scope_note", "status", "created_by", "revision")
OFFER_FIELDS = ("id", "snapshot_number", "watch_id", "watch_number", "competitor_name", "competitor_offer_reference", "offer_type", "offer_price", "freight_price", "landed_price", "feature_summary", "source_system", "source_reference", "source_revision", "source_observed_at", "source_hash", "status", "recorded_by", "verified_by", "verification_reference", "revision")
DECISION_FIELDS = ("id", "decision_number", "watch_id", "watch_number", "input_hash", "low_landed_price", "median_landed_price", "high_landed_price", "price_index", "recommendation", "boundary_note", "status", "authored_by", "reviewed_by", "review_reference", "revision")
RELEASE_FIELDS = ("id", "release_number", "application_id", "release_version", "watch_id", "decision_id", "manifest_hash", "support_owner", "support_until", *RELEASE_EVIDENCE_FIELDS, "status", "available", "prepared_by", "approved_by", "approval_reference", "revision")

class FactoryCompetitivePricingService:
    def __init__(self, db: AsyncSession): self.db = db
    async def workspace(self, *, project_id: int):
        async def rows(model, order): return (await self.db.execute(select(model).where(model.project_id == project_id).order_by(order.desc()).limit(500))).scalars().all()
        watches = await rows(FactoryCompetitivePriceWatch, FactoryCompetitivePriceWatch.created_at); offers = await rows(FactoryCompetitiveOfferSnapshot, FactoryCompetitiveOfferSnapshot.recorded_at); decisions = await rows(FactoryCompetitivePriceDecision, FactoryCompetitivePriceDecision.authored_at); releases = await rows(FactoryCompetitivePricingRelease, FactoryCompetitivePricingRelease.prepared_at); evidence = await rows(FactoryCompetitivePricingEvidence, FactoryCompetitivePricingEvidence.recorded_at)
        active = [item for item in releases if item.available and item.status == "available" and self._utc(item.support_until) > datetime.now(timezone.utc)]
        return {"watches": [_serialize(x, WATCH_FIELDS) for x in watches], "offers": [_serialize(x, OFFER_FIELDS) for x in offers], "decisions": [_serialize(x, DECISION_FIELDS) for x in decisions], "releases": [_serialize(x, RELEASE_FIELDS) for x in releases], "evidence": [{"id": x.id, "subject_type": x.subject_type, "evidence_type": x.evidence_type, "evidence_reference": x.evidence_reference, "recorded_by": x.recorded_by} for x in evidence], "metrics": {"price_watches": len(watches), "verified_offer_percent": round(len([x for x in offers if x.status == "verified"]) * 100 / max(1, len(offers)), 2), "approved_decisions": len([x for x in decisions if x.status == "approved"]), "available_releases": len(active), "latest_price_index": str(decisions[0].price_index) if decisions else None}, "availability": {"application_id": APPLICATION_ID, "status": "available" if active else "pilot", "release_version": active[0].release_version if active else None, "support_until": active[0].support_until if active else None}, "contract": {"source_records_copied": False, "formal_quote_created": False, "finance_price_master_mutated": False, "offer_self_verification": False, "decision_self_review": False, "release_self_approval": False, "minimum_verified_offers": 3, "availability_requires_current_customer_trial": True}}
    async def create_watch(self, *, project_id: int, context: TenantContext, actor: str, product_reference: str, product_name: str, market_country: str, channel: str, currency: str, own_reference_price: Decimal, scope_note: str):
        values = [product_reference.strip(), product_name.strip(), market_country.strip().upper(), channel.strip(), currency.strip().upper(), scope_note.strip()]; price = Decimal(own_reference_price)
        if not all(values) or len(values[2]) not in (2,3) or len(values[4]) != 3 or price <= 0: raise ValueError("Price watch requires product, ISO country, channel, currency, positive reference price and scope")
        now=datetime.now(timezone.utc); item=FactoryCompetitivePriceWatch(id=_id("price-watch"), **_context(context, project_id), watch_number=_number("CPW",project_id), product_reference=values[0], product_name=values[1], market_country=values[2], channel=values[3], currency=values[4], own_reference_price=price, scope_note=values[5], status="gathering", created_by=str(actor), created_at=now, updated_at=now, revision=1)
        self.db.add(item); await self._event(item,"watch","watch-created",item.product_reference,"Competitor price observation scope opened; no quote created",actor); await self.db.flush(); return _serialize(item,WATCH_FIELDS)
    async def add_offer(self, watch_id: str, *, project_id: int, context: TenantContext, actor: str, competitor_name: str, competitor_offer_reference: str, offer_type: str, offer_price: Decimal, freight_price: Decimal, feature_summary: str, source_system: str, source_reference: str, source_revision: str, source_observed_at: datetime):
        watch=await self._get(FactoryCompetitivePriceWatch,watch_id,project_id,"Price watch"); offer=Decimal(offer_price).quantize(Decimal("0.0001")); freight=Decimal(freight_price).quantize(Decimal("0.0001")); offer_type=offer_type.strip()
        required=(competitor_name,competitor_offer_reference,feature_summary,source_system,source_reference,source_revision)
        if watch.status != "gathering" or offer_type not in OFFER_TYPES or offer <= 0 or freight < 0 or not all(x.strip() for x in required): raise ValueError("Offer needs a gathering watch, supported type, non-negative landed inputs and source evidence")
        landed=(offer+freight).quantize(Decimal("0.0001")); payload={"watch_number":watch.watch_number,"competitor_name":competitor_name.strip(),"competitor_offer_reference":competitor_offer_reference.strip(),"offer_type":offer_type,"offer_price":format(offer,"f"),"freight_price":format(freight,"f"),"landed_price":format(landed,"f"),"feature_summary":feature_summary.strip(),"source_system":source_system.strip(),"source_reference":source_reference.strip(),"source_revision":source_revision.strip(),"source_observed_at":self._utc(source_observed_at).isoformat()}
        item=FactoryCompetitiveOfferSnapshot(id=_id("price-offer"), **_context(context,project_id), snapshot_number=_number("CPO",project_id), watch_id=watch.id,watch_number=watch.watch_number,competitor_name=payload["competitor_name"],competitor_offer_reference=payload["competitor_offer_reference"],offer_type=offer_type,offer_price=offer,freight_price=freight,landed_price=landed,feature_summary=payload["feature_summary"],source_system=payload["source_system"],source_reference=payload["source_reference"],source_revision=payload["source_revision"],source_observed_at=self._utc(source_observed_at),source_hash=_hash(payload),status="pending-verification",recorded_by=str(actor),recorded_at=datetime.now(timezone.utc),revision=1)
        self.db.add(item); await self._event(item,"offer","offer-recorded",item.source_hash,"Pinned competitive offer observation without source copying",actor); await self.db.flush(); return _serialize(item,OFFER_FIELDS)
    async def verify_offer(self, offer_id: str, *, project_id: int, actor: str, expected_revision: int, verification_reference: str):
        item=await self._get(FactoryCompetitiveOfferSnapshot,offer_id,project_id,"Competitive offer"); self._revision(item,expected_revision)
        if item.status != "pending-verification" or item.recorded_by == str(actor) or not verification_reference.strip() or item.source_hash != _hash(self._offer_payload(item)): raise ValueError("Competitive offer requires independent verification of unchanged source evidence")
        item.status="verified";item.verified_by=str(actor);item.verified_at=datetime.now(timezone.utc);item.verification_reference=verification_reference.strip()[:255];item.revision+=1;await self._event(item,"offer","offer-verified",verification_reference,"Independent competitor-offer verification completed",actor);await self.db.flush();return _serialize(item,OFFER_FIELDS)
    async def create_decision(self, watch_id: str, *, project_id: int, context: TenantContext, actor: str, boundary_note: str):
        watch=await self._get(FactoryCompetitivePriceWatch,watch_id,project_id,"Price watch"); offers=[x for x in await self._offers(watch.id,project_id) if x.status=="verified"]
        if watch.status != "gathering" or len(offers)<3 or not boundary_note.strip(): raise ValueError("Price decision requires at least three independently verified offers and a quote boundary note")
        snapshot=self._snapshot(offers); values=sorted(Decimal(x.landed_price) for x in offers); median=values[len(values)//2] if len(values)%2 else (values[len(values)//2-1]+values[len(values)//2])/2; index=(median/Decimal(watch.own_reference_price)*100).quantize(Decimal("0.01")); rec="premium" if index>110 else "match" if index>=90 else "under"
        item=FactoryCompetitivePriceDecision(id=_id("price-decision"),**_context(context,project_id),decision_number=_number("CPD",project_id),watch_id=watch.id,watch_number=watch.watch_number,input_snapshot_json=snapshot,input_hash=_hash(snapshot),low_landed_price=values[0],median_landed_price=median,high_landed_price=values[-1],price_index=index,recommendation=rec,boundary_note=boundary_note.strip(),status="pending-review",authored_by=str(actor),authored_at=datetime.now(timezone.utc),revision=1)
        self.db.add(item);watch.status="decision-pending";watch.updated_at=datetime.now(timezone.utc);watch.revision+=1;await self._event(item,"decision","decision-created",item.input_hash,"Price band recommendation only; formal quote remains out of scope",actor);await self.db.flush();return _serialize(item,DECISION_FIELDS)
    async def review_decision(self, decision_id: str, *, project_id: int, actor: str, expected_revision: int, decision: str, review_reference: str):
        item=await self._get(FactoryCompetitivePriceDecision,decision_id,project_id,"Price decision");self._revision(item,expected_revision);await self._validate_decision(item)
        if item.status!="pending-review" or item.authored_by==str(actor) or decision not in {"approve","reject"} or not review_reference.strip(): raise ValueError("Price decision requires independent documented review")
        item.status="approved" if decision=="approve" else "rejected";item.reviewed_by=str(actor);item.reviewed_at=datetime.now(timezone.utc);item.review_reference=review_reference.strip()[:255];item.revision+=1;watch=await self._get(FactoryCompetitivePriceWatch,item.watch_id,project_id,"Price watch");watch.status="decided" if decision=="approve" else "gathering";watch.updated_at=datetime.now(timezone.utc);watch.revision+=1;await self._event(item,"decision","decision-reviewed",review_reference,"Independent price-band review completed",actor);await self.db.flush();return _serialize(item,DECISION_FIELDS)
    async def prepare_release(self, decision_id: str, *, project_id: int, context: TenantContext, actor: str, release_version: str, support_owner: str, support_until: datetime, **evidence):
        decision=await self._get(FactoryCompetitivePriceDecision,decision_id,project_id,"Price decision");await self._validate_decision(decision);clean={x:str(evidence.get(x,"")).strip() for x in RELEASE_EVIDENCE_FIELDS};end=self._utc(support_until)
        if decision.status!="approved" or not release_version.strip() or not support_owner.strip() or not all(clean.values()) or end<=datetime.now(timezone.utc):raise ValueError("Price intelligence release requires approved decision, five evidence keys and future support")
        manifest={"application_id":APPLICATION_ID,"release_version":release_version.strip(),"decision_number":decision.decision_number,"decision_hash":decision.input_hash,"price_index":str(decision.price_index),"recommendation":decision.recommendation,"support_owner":support_owner.strip(),"support_until":end.isoformat(),"evidence":clean,"formal_quote_created":False}
        item=FactoryCompetitivePricingRelease(id=_id("price-release"),**_context(context,project_id),release_number=_number("CPR",project_id),application_id=APPLICATION_ID,release_version=manifest["release_version"],watch_id=decision.watch_id,decision_id=decision.id,manifest_json=manifest,manifest_hash=_hash(manifest),support_owner=manifest["support_owner"],support_until=end,**clean,status="pending-approval",available=False,prepared_by=str(actor),prepared_at=datetime.now(timezone.utc),revision=1);self.db.add(item);await self._event(item,"release","availability-prepared",item.manifest_hash,"Customer and operations evidence pinned for current version",actor);await self.db.flush();return _serialize(item,RELEASE_FIELDS)
    async def approve_release(self, release_id: str, *, project_id: int, actor: str, expected_revision: int, approval_reference: str):
        item=await self._get(FactoryCompetitivePricingRelease,release_id,project_id,"Price release");self._revision(item,expected_revision);decision=await self._get(FactoryCompetitivePriceDecision,item.decision_id,project_id,"Price decision");await self._validate_decision(decision)
        event=await self.db.scalar(select(FactoryCoreEventContract).where(FactoryCoreEventContract.id=="competitive-price-released",FactoryCoreEventContract.lifecycle_status=="frozen"));obj=await self.db.scalar(select(FactoryCoreObjectContract).where(FactoryCoreObjectContract.id=="competitive-price-watch",FactoryCoreObjectContract.lifecycle_status=="frozen"))
        if item.status!="pending-approval" or item.prepared_by==str(actor) or not approval_reference.strip() or item.manifest_hash!=_hash(item.manifest_json) or self._utc(item.support_until)<=datetime.now(timezone.utc) or not event or not obj:raise ValueError("Price availability requires independent approval, unchanged manifest, support and frozen contracts")
        item.status="available";item.available=True;item.approved_by=str(actor);item.approved_at=datetime.now(timezone.utc);item.approval_reference=approval_reference.strip()[:255];item.revision+=1;watch=await self._get(FactoryCompetitivePriceWatch,item.watch_id,project_id,"Price watch");watch.status="available";watch.updated_at=datetime.now(timezone.utc);watch.revision+=1;await self._event(item,"release","competitive-price-released",approval_reference,"Commercial competitive-price release approved",actor);await self.db.flush();return _serialize(item,RELEASE_FIELDS)
    async def _validate_decision(self,item):
        offers=[x for x in await self._offers(item.watch_id,item.project_id) if x.status=="verified"]
        if len(offers)<3:raise ValueError("Price decision source coverage changed")
        snapshot=self._snapshot(offers)
        if snapshot!=item.input_snapshot_json or _hash(snapshot)!=item.input_hash:raise ValueError("Competitive offer snapshots changed; release blocked")
    async def _offers(self,watch_id,project_id):return (await self.db.execute(select(FactoryCompetitiveOfferSnapshot).where(FactoryCompetitiveOfferSnapshot.watch_id==watch_id,FactoryCompetitiveOfferSnapshot.project_id==project_id))).scalars().all()
    @staticmethod
    def _offer_payload(x):return {"watch_number":x.watch_number,"competitor_name":x.competitor_name,"competitor_offer_reference":x.competitor_offer_reference,"offer_type":x.offer_type,"offer_price":format(Decimal(x.offer_price),"f"),"freight_price":format(Decimal(x.freight_price),"f"),"landed_price":format(Decimal(x.landed_price),"f"),"feature_summary":x.feature_summary,"source_system":x.source_system,"source_reference":x.source_reference,"source_revision":x.source_revision,"source_observed_at":FactoryCompetitivePricingService._utc(x.source_observed_at).isoformat()}
    def _snapshot(self,offers):return {"application_id":APPLICATION_ID,"offers":[dict(self._offer_payload(x),snapshot_number=x.snapshot_number,source_hash=x.source_hash,verified_by=x.verified_by,verification_reference=x.verification_reference,revision=x.revision) for x in sorted(offers,key=lambda item:item.snapshot_number)]}
    async def _get(self,model,item_id,project_id,label):
        item=await self.db.scalar(select(model).where(model.id==item_id,model.project_id==project_id))
        if not item:raise KeyError(f"{label} not found in this tenant plan")
        return item
    @staticmethod
    def _revision(item,expected):
        if int(item.revision)!=int(expected):raise ValueError("Revision conflict")
    @staticmethod
    def _utc(value):return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)
    async def _event(self,item,subject_type,evidence_type,reference,note,actor):
        number=next((getattr(item,key,None) for key in ("watch_number","snapshot_number","decision_number","release_number") if getattr(item,key,None)),str(item.id));self.db.add(FactoryCompetitivePricingEvidence(id=_id("price-evidence"),**_same(item),evidence_number=_number("CPE",item.project_id),subject_type=subject_type,subject_id=str(item.id),subject_number=number,evidence_type=evidence_type,evidence_reference=str(reference)[:255],note=note,recorded_by=str(actor),recorded_at=datetime.now(timezone.utc)))
