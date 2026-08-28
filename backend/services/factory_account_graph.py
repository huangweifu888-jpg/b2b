"""Governed B2B account relationship graph built from authoritative records."""
from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import json
import secrets

from core.tenant_context import TenantContext
from models.factory_account_graph import FactoryAccountGraph, FactoryAccountGraphEdge, FactoryAccountGraphEvidence, FactoryAccountGraphNode, FactoryAccountGraphPublication, FactoryAccountGraphVersion
from models.factory_cpq import FactoryCpqQuote
from models.factory_fulfillment import FactoryFulfillmentOrder
from models.factory_identity_resolution import FactoryGoldenProfile, FactoryIdentityConsent, FactoryIdentitySignal
from models.factory_legal_contracts import FactoryLegalParty
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


SOURCE_TYPES={"legal-party","golden-profile","identity-signal","cpq-quote","fulfillment-order"}
RELATIONS={"parent-of","branch-of","distributor-of","contact-at","has-opportunity","fulfills","identity-of"}
CONSUMERS={"crm","cdp","sales","service"}
GRAPH=("id","graph_number","graph_code","graph_name","scope","status","authored_by","published_by","revision")
NODE=("id","node_number","graph_id","graph_number","node_type","node_key","display_name","account_reference","country_code","source_type","source_id","source_number","source_revision","source_status","source_fingerprint","source_snapshot_json","status","created_by","verified_by","revision")
EDGE=("id","edge_number","graph_id","graph_number","from_node_id","from_node_number","to_node_id","to_node_number","relation_type","strength","evidence_reference","endpoint_manifest_hash","status","created_by","verified_by","revision")
VERSION=("id","version_reference","graph_id","graph_number","version_number","manifest_json","manifest_hash","node_count","edge_count","status","published_by")
PUBLICATION=("id","publication_number","graph_id","version_id","version_reference","consumer","manifest_hash","delivery_reference","consumer_mutated","status","created_by","acknowledged_by","revision")


def _id(kind):return f"{kind}-{secrets.token_urlsafe(18)}"
def _number(prefix,project_id):return f"{prefix}-{project_id}-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S%f')}-{secrets.token_hex(3).upper()}"
def _context(context,project_id):return {"project_id":project_id,"agent_path":context.agent_path,"tenant_id":context.tenant_id,"client_id":context.client_id,"plan_id":context.plan_id or f"plan-{project_id}"}
def _same(item):return {key:getattr(item,key) for key in ("project_id","agent_path","tenant_id","client_id","plan_id")}
def _hash(payload):return hashlib.sha256(json.dumps(payload,ensure_ascii=False,sort_keys=True,separators=(",",":"),default=str).encode()).hexdigest()
def _serialize(item,fields):return {field:getattr(item,field) for field in fields}
def _aware(value):return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


class FactoryAccountGraphService:
    def __init__(self,db:AsyncSession):self.db=db

    async def list_workspace(self,*,project_id:int):
        async def rows(model,order):return (await self.db.execute(select(model).where(model.project_id==project_id).order_by(order.desc()).limit(500))).scalars().all()
        graphs=await rows(FactoryAccountGraph,FactoryAccountGraph.created_at);nodes=await rows(FactoryAccountGraphNode,FactoryAccountGraphNode.created_at);edges=await rows(FactoryAccountGraphEdge,FactoryAccountGraphEdge.created_at);versions=await rows(FactoryAccountGraphVersion,FactoryAccountGraphVersion.published_at);publications=await rows(FactoryAccountGraphPublication,FactoryAccountGraphPublication.created_at);evidence=await rows(FactoryAccountGraphEvidence,FactoryAccountGraphEvidence.recorded_at)
        verified_nodes=[x for x in nodes if x.status=="verified"];verified_edges=[x for x in edges if x.status=="verified"];ack=[x for x in publications if x.status=="acknowledged"]
        return {"graphs":[_serialize(x,GRAPH) for x in graphs],"nodes":[_serialize(x,NODE) for x in nodes],"edges":[_serialize(x,EDGE) for x in edges],"versions":[_serialize(x,VERSION) for x in versions],"publications":[_serialize(x,PUBLICATION) for x in publications],"evidence":[{"id":x.id,"subject_type":x.subject_type,"subject_id":x.subject_id,"evidence_type":x.evidence_type,"evidence_reference":x.evidence_reference,"recorded_by":x.recorded_by} for x in evidence],"sources":await self._source_options(project_id),"metrics":{"verified_nodes":len(verified_nodes),"source_type_coverage_percent":round(len({x.source_type for x in verified_nodes})*100/len(SOURCE_TYPES),2),"verified_edges":len(verified_edges),"relation_verification_percent":round(len(verified_edges)*100/max(1,len(edges)),2),"published_versions":len(versions),"handoff_acknowledgement_percent":round(len(ack)*100/max(1,len(publications)),2)},"contract":{"source_records_copied":False,"source_revision_pinned":True,"source_fingerprint_pinned":True,"node_self_verification":False,"edge_self_verification":False,"unverified_relation_publishable":False,"graph_author_self_publish":False,"published_versions_mutable":False,"consumer_system_mutated":False,"acknowledgement_required":True}}

    async def create_graph(self,*,project_id:int,context:TenantContext,actor:str,graph_code:str,graph_name:str,scope:str):
        if not graph_code.strip() or not graph_name.strip() or scope not in {"account-360","channel-network","opportunity-network"}:raise ValueError("Account graph requires code, name and supported scope")
        now=datetime.now(timezone.utc);item=FactoryAccountGraph(id=_id("account-graph"),**_context(context,project_id),graph_number=_number("AGR",project_id),graph_code=graph_code.strip()[:64],graph_name=graph_name.strip()[:180],scope=scope,status="draft",authored_by=str(actor),revision=1,created_at=now,updated_at=now);self.db.add(item);await self._event(item,"graph","graph-created",item.graph_code,"Created governed account graph shell",actor);await self.db.flush();return _serialize(item,GRAPH)

    async def add_node(self,graph_id:str,*,project_id:int,context:TenantContext,actor:str,source_type:str,source_id:str):
        graph=await self._get(FactoryAccountGraph,graph_id,project_id,"Account graph")
        if graph.status!="draft" or source_type not in SOURCE_TYPES:raise ValueError("Only supported authoritative sources can enter a draft account graph")
        source,snapshot,node_type,number,name,account,country,revision,status=await self._resolve_source(source_type,source_id,project_id);fingerprint=_hash(snapshot);now=datetime.now(timezone.utc)
        item=FactoryAccountGraphNode(id=_id("account-node"),**_context(context,project_id),node_number=_number("AGN",project_id),graph_id=graph.id,graph_number=graph.graph_number,node_type=node_type,node_key=f"{source_type}:{source_id}"[:180],display_name=name[:255],account_reference=account[:180],country_code=country,source_type=source_type,source_id=source.id,source_number=number,source_revision=revision,source_status=status,source_fingerprint=fingerprint,source_snapshot_json=snapshot,status="pending",created_by=str(actor),revision=1,created_at=now);self.db.add(item);await self._event(item,"node","node-created",number,"Pinned authoritative source without copying its master record",actor);await self.db.flush();return _serialize(item,NODE)

    async def verify_node(self,node_id:str,*,project_id:int,actor:str,expected_revision:int,reference:str):
        item=await self._get(FactoryAccountGraphNode,node_id,project_id,"Account graph node");self._revision(item,expected_revision)
        if item.status!="pending" or item.created_by==str(actor) or not reference.strip():raise ValueError("Account graph node requires independent verification evidence")
        await self._validate_node_source(item);item.status="verified";item.verified_by=str(actor);item.verified_at=datetime.now(timezone.utc);item.verification_reference=reference.strip()[:255];item.revision+=1;await self._event(item,"node","node-verified",reference,"Independently verified authoritative source pin",actor);await self.db.flush();return _serialize(item,NODE)

    async def add_edge(self,graph_id:str,*,project_id:int,context:TenantContext,actor:str,from_node_id:str,to_node_id:str,relation_type:str,strength:str,evidence_reference:str):
        graph=await self._get(FactoryAccountGraph,graph_id,project_id,"Account graph");left=await self._get(FactoryAccountGraphNode,from_node_id,project_id,"From node");right=await self._get(FactoryAccountGraphNode,to_node_id,project_id,"To node")
        if graph.status!="draft" or left.graph_id!=graph.id or right.graph_id!=graph.id or left.id==right.id or left.status!="verified" or right.status!="verified" or relation_type not in RELATIONS or strength not in {"weak","medium","strong"} or not evidence_reference.strip():raise ValueError("Graph relation requires verified distinct endpoints, supported semantics and evidence")
        await self._validate_node_source(left);await self._validate_node_source(right);self._validate_relation(left,right,relation_type);manifest=self._endpoint_manifest(left,right,relation_type);now=datetime.now(timezone.utc)
        item=FactoryAccountGraphEdge(id=_id("account-edge"),**_context(context,project_id),edge_number=_number("AGE",project_id),graph_id=graph.id,graph_number=graph.graph_number,from_node_id=left.id,from_node_number=left.node_number,to_node_id=right.id,to_node_number=right.node_number,relation_type=relation_type,strength=strength,evidence_reference=evidence_reference.strip()[:255],endpoint_manifest_hash=_hash(manifest),status="pending",created_by=str(actor),revision=1,created_at=now);self.db.add(item);await self._event(item,"edge","edge-created",evidence_reference,"Created evidenced relation proposal; no source was mutated",actor);await self.db.flush();return _serialize(item,EDGE)

    async def verify_edge(self,edge_id:str,*,project_id:int,actor:str,expected_revision:int,reference:str):
        item=await self._get(FactoryAccountGraphEdge,edge_id,project_id,"Account graph edge");self._revision(item,expected_revision)
        if item.status!="pending" or item.created_by==str(actor) or not reference.strip():raise ValueError("Account graph relation requires independent verification evidence")
        left=await self._get(FactoryAccountGraphNode,item.from_node_id,project_id,"From node");right=await self._get(FactoryAccountGraphNode,item.to_node_id,project_id,"To node");await self._validate_node_source(left);await self._validate_node_source(right);self._validate_relation(left,right,item.relation_type)
        if _hash(self._endpoint_manifest(left,right,item.relation_type))!=item.endpoint_manifest_hash:raise ValueError("Account graph relation endpoint manifest drifted")
        item.status="verified";item.verified_by=str(actor);item.verified_at=datetime.now(timezone.utc);item.verification_reference=reference.strip()[:255];item.revision+=1;await self._event(item,"edge","edge-verified",reference,"Independently verified relation semantics and endpoint pins",actor);await self.db.flush();return _serialize(item,EDGE)

    async def publish_graph(self,graph_id:str,*,project_id:int,context:TenantContext,actor:str,expected_revision:int,consumers:list[str],delivery_reference_prefix:str):
        graph=await self._get(FactoryAccountGraph,graph_id,project_id,"Account graph");self._revision(graph,expected_revision);requested=sorted(set(consumers))
        if graph.status!="draft" or graph.authored_by==str(actor) or not requested or any(x not in CONSUMERS for x in requested) or not delivery_reference_prefix.strip():raise ValueError("Account graph requires independent publisher, supported consumers and delivery reference")
        nodes=(await self.db.execute(select(FactoryAccountGraphNode).where(FactoryAccountGraphNode.graph_id==graph.id))).scalars().all();edges=(await self.db.execute(select(FactoryAccountGraphEdge).where(FactoryAccountGraphEdge.graph_id==graph.id))).scalars().all()
        if len(nodes)<2 or not edges or any(x.status!="verified" for x in nodes) or any(x.status!="verified" for x in edges):raise ValueError("Only a fully verified graph with nodes and relations can be published")
        for node in nodes:await self._validate_node_source(node)
        manifest={"graph_number":graph.graph_number,"scope":graph.scope,"nodes":sorted([{"node_number":x.node_number,"node_type":x.node_type,"source_type":x.source_type,"source_number":x.source_number,"source_revision":x.source_revision,"source_fingerprint":x.source_fingerprint} for x in nodes],key=lambda x:x["node_number"]),"edges":sorted([{"edge_number":x.edge_number,"from":x.from_node_number,"relation":x.relation_type,"to":x.to_node_number,"strength":x.strength,"endpoint_manifest_hash":x.endpoint_manifest_hash} for x in edges],key=lambda x:x["edge_number"])};manifest_hash=_hash(manifest);current=await self.db.scalar(select(FactoryAccountGraphVersion.version_number).where(FactoryAccountGraphVersion.graph_id==graph.id).order_by(FactoryAccountGraphVersion.version_number.desc()).limit(1)) or 0;now=datetime.now(timezone.utc)
        version=FactoryAccountGraphVersion(id=_id("account-version"),**_context(context,project_id),version_reference=_number("AGV",project_id),graph_id=graph.id,graph_number=graph.graph_number,version_number=int(current)+1,manifest_json=manifest,manifest_hash=manifest_hash,node_count=len(nodes),edge_count=len(edges),status="published",published_by=str(actor),published_at=now);self.db.add(version);publications=[]
        for consumer in requested:
            publication=FactoryAccountGraphPublication(id=_id("account-publication"),**_context(context,project_id),publication_number=_number("AGP",project_id),graph_id=graph.id,version_id=version.id,version_reference=version.version_reference,consumer=consumer,manifest_hash=manifest_hash,delivery_reference=f"{delivery_reference_prefix.strip()[:180]}:{consumer}",consumer_mutated=False,status="pending",created_by=str(actor),created_at=now,revision=1);self.db.add(publication);publications.append(publication);await self._event(publication,"publication","handoff-created",publication.delivery_reference,"Created explicit consumer acknowledgement for exact graph hash",actor)
        graph.status="published";graph.published_by=str(actor);graph.published_at=now;graph.revision+=1;graph.updated_at=now;await self._event(graph,"graph","graph-published",version.version_reference,"Published immutable verified account graph",actor);await self.db.flush();return {"graph":_serialize(graph,GRAPH),"version":_serialize(version,VERSION),"publications":[_serialize(x,PUBLICATION) for x in publications]}

    async def acknowledge_publication(self,publication_id:str,*,project_id:int,actor:str,expected_revision:int,reference:str):
        item=await self._get(FactoryAccountGraphPublication,publication_id,project_id,"Account graph publication");self._revision(item,expected_revision)
        if item.status!="pending" or item.created_by==str(actor) or not reference.strip():raise ValueError("Account graph handoff acknowledgement must be independent and evidenced")
        version=await self._get(FactoryAccountGraphVersion,item.version_id,project_id,"Account graph version")
        if version.status!="published" or version.manifest_hash!=item.manifest_hash or _hash(version.manifest_json)!=item.manifest_hash:raise ValueError("Published account graph changed")
        item.status="acknowledged";item.acknowledged_by=str(actor);item.acknowledged_at=datetime.now(timezone.utc);item.acknowledgement_reference=reference.strip()[:255];item.revision+=1;await self._event(item,"publication","handoff-acknowledged",reference,"Consumer acknowledged exact immutable graph hash",actor);await self.db.flush();return _serialize(item,PUBLICATION)

    async def _source_options(self,project_id):
        result=[]
        for source_type,model,order in (("legal-party",FactoryLegalParty,FactoryLegalParty.created_at),("golden-profile",FactoryGoldenProfile,FactoryGoldenProfile.created_at),("identity-signal",FactoryIdentitySignal,FactoryIdentitySignal.created_at),("cpq-quote",FactoryCpqQuote,FactoryCpqQuote.created_at),("fulfillment-order",FactoryFulfillmentOrder,FactoryFulfillmentOrder.created_at)):
            items=(await self.db.execute(select(model).where(model.project_id==project_id).order_by(order.desc()).limit(100))).scalars().all()
            for item in items:
                try:_,snapshot,node_type,number,name,account,country,revision,status=await self._resolve_source(source_type,item.id,project_id)
                except ValueError:continue
                result.append({"source_type":source_type,"source_id":item.id,"source_number":number,"node_type":node_type,"display_name":name,"account_reference":account,"country_code":country,"revision":revision,"status":status,"fingerprint":_hash(snapshot),"related_source_id":snapshot.get("quote_id")})
        return result

    async def _resolve_source(self,source_type,source_id,project_id):
        if source_type=="legal-party":
            source=await self._get(FactoryLegalParty,source_id,project_id,"Legal party");snapshot={"party_number":source.party_number,"party_reference":source.party_reference,"party_type":source.party_type,"legal_name":source.legal_name,"country_code":source.country_code,"identity_fingerprint":source.identity_fingerprint,"status":source.status,"revision":source.revision}
            if source.status!="active":raise ValueError("Legal-party graph source must be active")
            return source,snapshot,"enterprise",source.party_number,source.legal_name,source.party_reference,source.country_code,int(source.revision),source.status
        if source_type=="golden-profile":
            source=await self._get(FactoryGoldenProfile,source_id,project_id,"Golden profile");snapshot={"profile_number":source.profile_number,"account_reference":source.account_reference,"source_manifest_hash":source.source_manifest_hash,"status":source.status,"revision":source.revision}
            if source.status!="published" or _hash(source.source_manifest_json)!=source.source_manifest_hash:raise ValueError("Golden-profile graph source must be published and hash-valid")
            return source,snapshot,"account",source.profile_number,f"Golden account {source.account_reference}",source.account_reference,None,int(source.revision),source.status
        if source_type=="identity-signal":
            source=await self._get(FactoryIdentitySignal,source_id,project_id,"Identity signal");consent=await self._get(FactoryIdentityConsent,source.consent_id,project_id,"Identity consent");snapshot={"signal_number":source.signal_number,"account_reference":source.account_reference,"signal_type":source.signal_type,"identifier_hash":source.identifier_hash,"source_revision":source.source_revision,"source_fingerprint":source.source_fingerprint,"status":source.status,"revision":source.revision,"consent_number":consent.consent_number,"consent_status":consent.status,"consent_revision":consent.revision}
            if source.status!="verified" or source.signal_type not in {"contact","email","phone"} or consent.status!="active" or _aware(consent.expires_at)<=datetime.now(timezone.utc) or source.source_revision!=consent.revision or source.source_fingerprint!=consent.source_event_hash:raise ValueError("Contact graph source requires verified signal and active pinned consent")
            return source,snapshot,"contact",source.signal_number,f"Consented {source.signal_type} {source.display_hint}",source.account_reference,None,int(source.revision),source.status
        if source_type=="cpq-quote":
            source=await self._get(FactoryCpqQuote,source_id,project_id,"CPQ quote");snapshot={"quote_number":source.quote_number,"account_reference":source.account_reference,"currency":source.currency,"subtotal":str(source.subtotal),"status":source.status,"revision":source.revision}
            if source.status in {"rejected","expired","cancelled","void"}:raise ValueError("Inactive CPQ quote cannot enter account graph")
            return source,snapshot,"opportunity",source.quote_number,f"Opportunity {source.quote_number}",source.account_reference,None,int(source.revision),source.status
        if source_type=="fulfillment-order":
            source=await self._get(FactoryFulfillmentOrder,source_id,project_id,"Fulfillment order");snapshot={"order_number":source.order_number,"quote_id":source.quote_id,"quote_number":source.quote_number,"account_reference":source.account_reference,"currency":source.currency,"order_total":str(source.order_total),"status":source.status,"revision":source.revision}
            if source.status in {"cancelled","void"}:raise ValueError("Inactive fulfillment order cannot enter account graph")
            return source,snapshot,"order",source.order_number,f"Order {source.order_number}",source.account_reference,None,int(source.revision),source.status
        raise ValueError("Unsupported account graph source")

    async def _validate_node_source(self,node):
        source,snapshot,node_type,number,name,account,country,revision,status=await self._resolve_source(node.source_type,node.source_id,node.project_id)
        if node.source_number!=number or node.node_type!=node_type or node.account_reference!=account or node.source_revision!=revision or node.source_status!=status or node.source_fingerprint!=_hash(snapshot) or node.source_snapshot_json!=snapshot:raise ValueError("Account graph source revision or fingerprint drifted")
        return source

    @staticmethod
    def _validate_relation(left,right,relation):
        pair=(left.node_type,right.node_type)
        expected={"contact-at":("account","contact"),"has-opportunity":("enterprise","opportunity"),"fulfills":("opportunity","order"),"identity-of":("enterprise","account"),"parent-of":("enterprise","enterprise"),"branch-of":("enterprise","enterprise"),"distributor-of":("enterprise","enterprise")}
        if expected.get(relation)!=pair:raise ValueError("Relation endpoint types do not match semantics")
        if relation in {"contact-at","has-opportunity","fulfills","identity-of"} and left.account_reference!=right.account_reference:raise ValueError("Relation endpoints do not share the governed account reference")
        if relation=="fulfills" and right.source_snapshot_json.get("quote_id")!=left.source_id:raise ValueError("Order is not sourced from the opportunity quote")

    @staticmethod
    def _endpoint_manifest(left,right,relation):return {"from":{"id":left.id,"revision":left.source_revision,"fingerprint":left.source_fingerprint},"relation":relation,"to":{"id":right.id,"revision":right.source_revision,"fingerprint":right.source_fingerprint}}
    async def _get(self,model,item_id,project_id,label):
        item=await self.db.scalar(select(model).where(model.id==item_id,model.project_id==project_id))
        if not item:raise KeyError(f"{label} not found")
        return item
    @staticmethod
    def _revision(item,expected):
        if int(item.revision)!=int(expected):raise ValueError("Revision conflict")
    async def _event(self,item,subject_type,evidence_type,reference,note,actor):
        number=next((getattr(item,key,None) for key in ("graph_number","node_number","edge_number","version_reference","publication_number") if getattr(item,key,None)),str(item.id));self.db.add(FactoryAccountGraphEvidence(id=_id("account-evidence"),**_same(item),evidence_number=_number("AGX",item.project_id),subject_type=subject_type,subject_id=item.id,subject_number=number,evidence_type=evidence_type,evidence_reference=str(reference)[:255],note=note,recorded_by=str(actor),recorded_at=datetime.now(timezone.utc)))
