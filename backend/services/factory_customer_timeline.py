"""Governed customer behavior timelines projected from authoritative events."""
from __future__ import annotations
from datetime import datetime,timezone
import hashlib,json,secrets
from core.tenant_context import TenantContext
from models.factory_cpq import FactoryCpqQuote
from models.factory_customer_asset import FactoryAssetServiceTicket,FactoryCustomerAsset
from models.factory_customer_timeline import FactoryCustomerTimeline,FactoryCustomerTimelineCheckpoint,FactoryCustomerTimelineEvidence,FactoryCustomerTimelineEvent,FactoryCustomerTimelinePublication,FactoryCustomerTimelineVersion
from models.factory_fulfillment import FactoryFulfillmentOrder
from models.factory_revenue import FactoryRevenueFlowRun
from models.factory_revenue_profit import FactoryAttributionTouchpoint
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

SOURCE_TYPES={"marketing-touchpoint","inquiry-flow","cpq-quote","fulfillment-order","service-ticket"};CONSUMERS={"crm","cdp","sales","service"}
TIMELINE=("id","timeline_number","timeline_name","account_reference","scope","status","authored_by","published_by","revision");EVENT=("id","event_number","timeline_id","timeline_number","account_reference","event_type","occurred_at","intent_level","source_type","source_id","source_number","source_revision","source_status","source_fingerprint","status","created_by","verified_by","revision");VERSION=("id","version_reference","timeline_id","timeline_number","version_number","manifest_hash","event_count","source_type_count","high_intent_event_count","status","published_by");PUBLICATION=("id","publication_number","timeline_id","version_id","version_reference","consumer","manifest_hash","delivery_reference","consumer_mutated","status","created_by","acknowledged_by","revision");CHECKPOINT=("id","checkpoint_number","timeline_id","checkpoint_code","event_id","event_number","occurred_at","note","created_by")
def _id(kind):return f"{kind}-{secrets.token_urlsafe(18)}"
def _number(prefix,pid):return f"{prefix}-{pid}-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S%f')}-{secrets.token_hex(3).upper()}"
def _context(context,pid):return {"project_id":pid,"agent_path":context.agent_path,"tenant_id":context.tenant_id,"client_id":context.client_id,"plan_id":context.plan_id or f"plan-{pid}"}
def _same(x):return {k:getattr(x,k) for k in ("project_id","agent_path","tenant_id","client_id","plan_id")}
def _hash(x):return hashlib.sha256(json.dumps(x,ensure_ascii=False,sort_keys=True,separators=(",",":"),default=str).encode()).hexdigest()
def _serialize(x,fields):return {k:getattr(x,k) for k in fields}
def _aware(x):return x if x.tzinfo else x.replace(tzinfo=timezone.utc)

class FactoryCustomerTimelineService:
    def __init__(self,db:AsyncSession):self.db=db
    async def list_workspace(self,*,project_id:int):
        async def rows(model,order):return (await self.db.execute(select(model).where(model.project_id==project_id).order_by(order.desc()).limit(500))).scalars().all()
        timelines=await rows(FactoryCustomerTimeline,FactoryCustomerTimeline.created_at);events=await rows(FactoryCustomerTimelineEvent,FactoryCustomerTimelineEvent.occurred_at);versions=await rows(FactoryCustomerTimelineVersion,FactoryCustomerTimelineVersion.published_at);publications=await rows(FactoryCustomerTimelinePublication,FactoryCustomerTimelinePublication.created_at);checkpoints=await rows(FactoryCustomerTimelineCheckpoint,FactoryCustomerTimelineCheckpoint.created_at);evidence=await rows(FactoryCustomerTimelineEvidence,FactoryCustomerTimelineEvidence.recorded_at);verified=[x for x in events if x.status=="verified"];ack=[x for x in publications if x.status=="acknowledged"]
        coverage=max((len({x.source_type for x in verified if x.timeline_id==t.id})*100/len(SOURCE_TYPES) for t in timelines),default=0)
        return {"timelines":[_serialize(x,TIMELINE) for x in timelines],"events":[_serialize(x,EVENT) for x in events],"versions":[_serialize(x,VERSION) for x in versions],"publications":[_serialize(x,PUBLICATION) for x in publications],"checkpoints":[_serialize(x,CHECKPOINT) for x in checkpoints],"evidence":[{"id":x.id,"subject_type":x.subject_type,"subject_id":x.subject_id,"evidence_type":x.evidence_type,"evidence_reference":x.evidence_reference,"recorded_by":x.recorded_by} for x in evidence],"sources":await self._source_options(project_id),"metrics":{"verified_events":len(verified),"source_coverage_percent":round(coverage,2),"high_intent_events":len([x for x in verified if x.intent_level=="high"]),"journey_checkpoints":len(checkpoints),"published_versions":len(versions),"handoff_acknowledgement_percent":round(len(ack)*100/max(1,len(publications)),2)},"contract":{"source_records_copied":False,"source_revision_pinned":True,"source_fingerprint_pinned":True,"raw_tracking_identifier_stored":False,"event_self_verification":False,"incomplete_timeline_publishable":False,"timeline_author_self_publish":False,"published_versions_mutable":False,"consumer_system_mutated":False,"acknowledgement_required":True}}
    async def create_timeline(self,*,project_id:int,context:TenantContext,actor:str,timeline_name:str,account_reference:str):
        if not timeline_name.strip() or not account_reference.strip():raise ValueError("Timeline name and account reference are required")
        sources=await self._sources_for_account(project_id,account_reference.strip())
        if not sources:raise ValueError("Timeline requires authoritative customer events")
        now=datetime.now(timezone.utc);item=FactoryCustomerTimeline(id=_id("timeline"),**_context(context,project_id),timeline_number=_number("CTL",project_id),timeline_name=timeline_name.strip()[:180],account_reference=account_reference.strip()[:180],scope="customer-360",status="draft",authored_by=str(actor),revision=1,created_at=now,updated_at=now);self.db.add(item);await self._event(item,"timeline","timeline-created",account_reference,"Created empty projection without copying authority records",actor);await self.db.flush();return _serialize(item,TIMELINE)
    async def add_event(self,timeline_id:str,*,project_id:int,context:TenantContext,actor:str,source_type:str,source_id:str):
        timeline=await self._get(FactoryCustomerTimeline,timeline_id,project_id,"Customer timeline")
        if timeline.status!="draft" or source_type not in SOURCE_TYPES:raise ValueError("Only supported authority events can be added to a draft timeline")
        source=await self._source(source_type,source_id,project_id)
        if source["account_reference"]!=timeline.account_reference:raise ValueError("Timeline event account must match timeline account")
        now=datetime.now(timezone.utc);item=FactoryCustomerTimelineEvent(id=_id("timeline-event"),**_context(context,project_id),event_number=_number("CTE",project_id),timeline_id=timeline.id,timeline_number=timeline.timeline_number,account_reference=timeline.account_reference,event_type=source["event_type"],occurred_at=source["occurred_at"],intent_level=source["intent_level"],source_type=source_type,source_id=source_id,source_number=source["source_number"],source_revision=source["revision"],source_status=source["status"],source_fingerprint=source["fingerprint"],source_snapshot_json=source["snapshot"],status="pending",created_by=str(actor),revision=1,created_at=now);self.db.add(item);await self._event(item,"event","event-added",source["source_number"],"Pinned authority event revision and fingerprint",actor);await self.db.flush();return _serialize(item,EVENT)
    async def verify_event(self,event_id:str,*,project_id:int,actor:str,expected_revision:int,reference:str):
        item=await self._get(FactoryCustomerTimelineEvent,event_id,project_id,"Timeline event");self._revision(item,expected_revision)
        if item.status!="pending" or item.created_by==str(actor) or not reference.strip():raise ValueError("Timeline event requires independent verification evidence")
        await self._validate_event(item);item.status="verified";item.verified_by=str(actor);item.verified_at=datetime.now(timezone.utc);item.verification_reference=reference.strip()[:255];item.revision+=1;await self._event(item,"event","event-verified",reference,"Independently verified current authority source",actor);await self.db.flush();return _serialize(item,EVENT)
    async def add_checkpoint(self,timeline_id:str,*,project_id:int,context:TenantContext,actor:str,event_id:str,checkpoint_code:str,note:str|None=None):
        timeline=await self._get(FactoryCustomerTimeline,timeline_id,project_id,"Customer timeline");event=await self._get(FactoryCustomerTimelineEvent,event_id,project_id,"Timeline event")
        if timeline.status!="draft" or event.timeline_id!=timeline.id or event.status!="verified" or not checkpoint_code.strip():raise ValueError("Checkpoint requires a verified event in the draft timeline")
        await self._validate_event(event);now=datetime.now(timezone.utc);item=FactoryCustomerTimelineCheckpoint(id=_id("timeline-checkpoint"),**_context(context,project_id),checkpoint_number=_number("CTC",project_id),timeline_id=timeline.id,checkpoint_code=checkpoint_code.strip()[:48],event_id=event.id,event_number=event.event_number,occurred_at=event.occurred_at,note=(note or "")[:1000],created_by=str(actor),created_at=now);self.db.add(item);await self._event(item,"checkpoint","checkpoint-created",event.event_number,"Marked governed customer journey checkpoint",actor);await self.db.flush();return _serialize(item,CHECKPOINT)
    async def publish_timeline(self,timeline_id:str,*,project_id:int,context:TenantContext,actor:str,expected_revision:int,consumers:list[str],delivery_reference_prefix:str):
        timeline=await self._get(FactoryCustomerTimeline,timeline_id,project_id,"Customer timeline");self._revision(timeline,expected_revision);requested=sorted(set(consumers))
        if timeline.status!="draft" or timeline.authored_by==str(actor) or not requested or any(x not in CONSUMERS for x in requested) or not delivery_reference_prefix.strip():raise ValueError("Timeline requires independent publisher, consumers and delivery reference")
        events=(await self.db.execute(select(FactoryCustomerTimelineEvent).where(FactoryCustomerTimelineEvent.timeline_id==timeline.id).order_by(FactoryCustomerTimelineEvent.occurred_at.asc()))).scalars().all()
        if {x.source_type for x in events}!=SOURCE_TYPES or any(x.status!="verified" for x in events):raise ValueError("All five authority event types must be independently verified")
        for event in events:await self._validate_event(event)
        manifest={"timeline_number":timeline.timeline_number,"account_reference":timeline.account_reference,"events":[{"event_number":x.event_number,"event_type":x.event_type,"occurred_at":_aware(x.occurred_at).isoformat(),"intent_level":x.intent_level,"source_type":x.source_type,"source_number":x.source_number,"source_revision":x.source_revision,"source_fingerprint":x.source_fingerprint} for x in events]};manifest_hash=_hash(manifest);current=await self.db.scalar(select(FactoryCustomerTimelineVersion.version_number).where(FactoryCustomerTimelineVersion.timeline_id==timeline.id).order_by(FactoryCustomerTimelineVersion.version_number.desc()).limit(1)) or 0;now=datetime.now(timezone.utc);version=FactoryCustomerTimelineVersion(id=_id("timeline-version"),**_context(context,project_id),version_reference=_number("CTV",project_id),timeline_id=timeline.id,timeline_number=timeline.timeline_number,version_number=int(current)+1,manifest_json=manifest,manifest_hash=manifest_hash,event_count=len(events),source_type_count=len(SOURCE_TYPES),high_intent_event_count=len([x for x in events if x.intent_level=="high"]),status="published",published_by=str(actor),published_at=now);self.db.add(version);publications=[]
        for consumer in requested:
            publication=FactoryCustomerTimelinePublication(id=_id("timeline-publication"),**_context(context,project_id),publication_number=_number("CTP",project_id),timeline_id=timeline.id,version_id=version.id,version_reference=version.version_reference,consumer=consumer,manifest_hash=manifest_hash,delivery_reference=f"{delivery_reference_prefix.strip()[:180]}:{consumer}",consumer_mutated=False,status="pending",created_by=str(actor),created_at=now,revision=1);self.db.add(publication);publications.append(publication);await self._event(publication,"publication","handoff-created",publication.delivery_reference,"Created explicit acknowledgement for exact timeline hash",actor)
        timeline.status="published";timeline.published_by=str(actor);timeline.published_at=now;timeline.revision+=1;timeline.updated_at=now;await self._event(timeline,"timeline","timeline-published",version.version_reference,"Published immutable complete customer timeline",actor);await self.db.flush();return {"timeline":_serialize(timeline,TIMELINE),"version":_serialize(version,VERSION),"publications":[_serialize(x,PUBLICATION) for x in publications]}
    async def acknowledge_publication(self,publication_id:str,*,project_id:int,actor:str,expected_revision:int,reference:str):
        item=await self._get(FactoryCustomerTimelinePublication,publication_id,project_id,"Timeline publication");self._revision(item,expected_revision)
        if item.status!="pending" or item.created_by==str(actor) or not reference.strip():raise ValueError("Timeline handoff acknowledgement must be independent and evidenced")
        version=await self._get(FactoryCustomerTimelineVersion,item.version_id,project_id,"Timeline version")
        if version.status!="published" or version.manifest_hash!=item.manifest_hash or _hash(version.manifest_json)!=item.manifest_hash:raise ValueError("Published customer timeline changed")
        item.status="acknowledged";item.acknowledged_by=str(actor);item.acknowledged_at=datetime.now(timezone.utc);item.acknowledgement_reference=reference.strip()[:255];item.revision+=1;await self._event(item,"publication","handoff-acknowledged",reference,"Consumer acknowledged exact immutable timeline hash",actor);await self.db.flush();return _serialize(item,PUBLICATION)
    async def _source_options(self,pid):
        options=[]
        for account in sorted({x.account_reference for model in (FactoryAttributionTouchpoint,FactoryRevenueFlowRun,FactoryCpqQuote,FactoryFulfillmentOrder,FactoryCustomerAsset) for x in (await self.db.execute(select(model).where(model.project_id==pid))).scalars().all()}):options.extend(await self._sources_for_account(pid,account))
        return options
    async def _sources_for_account(self,pid,account):
        options=[]
        for source_type,model in (("marketing-touchpoint",FactoryAttributionTouchpoint),("inquiry-flow",FactoryRevenueFlowRun),("cpq-quote",FactoryCpqQuote),("fulfillment-order",FactoryFulfillmentOrder)):
            for item in (await self.db.execute(select(model).where(model.project_id==pid,model.account_reference==account))).scalars().all():
                try:options.append(await self._source(source_type,item.id,pid))
                except ValueError:pass
        assets=(await self.db.execute(select(FactoryCustomerAsset).where(FactoryCustomerAsset.project_id==pid,FactoryCustomerAsset.account_reference==account))).scalars().all()
        for asset in assets:
            for ticket in (await self.db.execute(select(FactoryAssetServiceTicket).where(FactoryAssetServiceTicket.project_id==pid,FactoryAssetServiceTicket.asset_id==asset.id))).scalars().all():options.append(await self._source("service-ticket",ticket.id,pid))
        return options
    async def _source(self,kind,item_id,pid):
        if kind=="marketing-touchpoint":
            x=await self._get(FactoryAttributionTouchpoint,item_id,pid,"Marketing touchpoint");snap={"external_event_reference":x.external_event_reference,"account_reference":x.account_reference,"channel":x.channel,"campaign_reference":x.campaign_reference,"content_reference":x.content_reference,"occurred_at":_aware(x.occurred_at).isoformat(),"consent_reference":x.consent_reference,"evidence_fingerprint":x.evidence_fingerprint};return self._source_data(x.touchpoint_number,x.account_reference,"content-engagement",x.occurred_at,"medium",1,"recorded",snap,kind,x.id)
        if kind=="inquiry-flow":
            x=await self._get(FactoryRevenueFlowRun,item_id,pid,"Inquiry flow");snap={"correlation_id":x.correlation_id,"account_reference":x.account_reference,"product_reference":x.product_reference,"current_stage":x.current_stage,"revision":x.revision};return self._source_data(x.correlation_id,x.account_reference,"inquiry-progress",x.updated_at or x.created_at,"high",x.revision,x.current_stage,snap,kind,x.id)
        if kind=="cpq-quote":
            x=await self._get(FactoryCpqQuote,item_id,pid,"CPQ quote");snap={"quote_number":x.quote_number,"account_reference":x.account_reference,"currency":x.currency,"subtotal":str(x.subtotal),"status":x.status,"revision":x.revision};return self._source_data(x.quote_number,x.account_reference,"quote-activity",x.updated_at or x.created_at,"high",x.revision,x.status,snap,kind,x.id)
        if kind=="fulfillment-order":
            x=await self._get(FactoryFulfillmentOrder,item_id,pid,"Fulfillment order");snap={"order_number":x.order_number,"quote_id":x.quote_id,"account_reference":x.account_reference,"order_total":str(x.order_total),"status":x.status,"revision":x.revision};return self._source_data(x.order_number,x.account_reference,"order-activity",x.updated_at or x.created_at,"high",x.revision,x.status,snap,kind,x.id)
        if kind=="service-ticket":
            x=await self._get(FactoryAssetServiceTicket,item_id,pid,"Service ticket");asset=await self._get(FactoryCustomerAsset,x.asset_id,pid,"Customer asset");snap={"ticket_number":x.ticket_number,"asset_id":asset.id,"asset_number":asset.asset_number,"account_reference":asset.account_reference,"severity":x.severity,"status":x.status,"revision":x.revision};return self._source_data(x.ticket_number,asset.account_reference,"service-activity",x.updated_at or x.created_at,"medium",x.revision,x.status,snap,kind,x.id)
        raise ValueError("Unsupported timeline source type")
    @staticmethod
    def _source_data(number,account,event_type,occurred,intent,revision,status,snapshot,kind,item_id):return {"source_type":kind,"source_id":item_id,"source_number":number,"account_reference":account,"event_type":event_type,"occurred_at":_aware(occurred),"intent_level":intent,"revision":revision,"status":status,"snapshot":snapshot,"fingerprint":_hash(snapshot)}
    async def _validate_event(self,item):
        source=await self._source(item.source_type,item.source_id,item.project_id)
        if source["source_number"]!=item.source_number or source["account_reference"]!=item.account_reference or source["revision"]!=item.source_revision or source["status"]!=item.source_status or source["fingerprint"]!=item.source_fingerprint or source["snapshot"]!=item.source_snapshot_json:raise ValueError("Timeline authority source drifted")
    async def _get(self,model,item_id,pid,label):
        x=await self.db.scalar(select(model).where(model.id==item_id,model.project_id==pid))
        if not x:raise KeyError(f"{label} not found")
        return x
    @staticmethod
    def _revision(x,e):
        if int(x.revision)!=int(e):raise ValueError("Revision conflict")
    async def _event(self,x,subject_type,evidence_type,reference,note,actor):
        number=next((getattr(x,k,None) for k in ("timeline_number","event_number","checkpoint_number","version_reference","publication_number") if getattr(x,k,None)),str(x.id));self.db.add(FactoryCustomerTimelineEvidence(id=_id("timeline-evidence"),**_same(x),evidence_number=_number("CTX",x.project_id),subject_type=subject_type,subject_id=x.id,subject_number=number,evidence_type=evidence_type,evidence_reference=str(reference)[:255],note=note,recorded_by=str(actor),recorded_at=datetime.now(timezone.utc)))
