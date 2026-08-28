"""Governed enterprise knowledge graph with pinned source facts and immutable publication."""
from __future__ import annotations
from datetime import date,datetime,timezone
import hashlib,json,secrets
from core.tenant_context import TenantContext
from models.factory_knowledge_graph import FactoryKnowledgeEntity,FactoryKnowledgeEvidence,FactoryKnowledgeGraph,FactoryKnowledgeGraphVersion,FactoryKnowledgePublication,FactoryKnowledgeRelation
from models.factory_legal_contracts import FactoryLegalParty
from models.factory_product_passport import FactoryProductPassport,FactoryProductPassportCertificate
from models.factory_icp import FactoryIcpProfile,FactoryIcpVersion
from models.factory_dam_localization import FactoryDamAsset,FactoryDamRightsGrant
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

ENTITY_TYPES={"organization","product","capability","certificate","case","market"};CONSUMERS={"geo","schema","ai-search","commerce","sales-enablement"}
SOURCE_ENTITY_TYPES={"legal-party":{"organization"},"product-passport":{"product","capability"},"passport-certificate":{"certificate"},"dam-asset":{"case"},"icp-profile":{"market"}}
GRAPH=("id","graph_number","graph_code","graph_name","scope","default_locale","objective","current_version","status","authored_by","published_by","revision")
ENTITY=("id","entity_number","graph_id","graph_number","entity_key","entity_type","canonical_name","aliases_json","properties_json","locale","source_type","source_id","source_number","source_revision","source_status","source_fingerprint","evidence_reference","status","created_by","verified_by","revision")
RELATION=("id","relation_number","graph_id","subject_entity_id","subject_entity_number","predicate","object_entity_id","object_entity_number","evidence_reference","status","created_by","verified_by","revision")
VERSION=("id","version_reference","graph_id","graph_number","version_number","entity_manifest_json","relation_manifest_json","manifest_hash","entity_type_coverage_json","status","published_by")
PUBLICATION=("id","publication_number","graph_id","graph_number","version_id","version_number","manifest_hash","consumer","delivery_reference","consumer_mutated","status","created_by","acknowledged_by","revision")
def _id(kind):return f"{kind}-{secrets.token_urlsafe(18)}"
def _number(prefix,project_id):return f"{prefix}-{project_id}-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S%f')}-{secrets.token_hex(3).upper()}"
def _context(context,project_id):return {"project_id":project_id,"agent_path":context.agent_path,"tenant_id":context.tenant_id,"client_id":context.client_id,"plan_id":context.plan_id or f"plan-{project_id}"}
def _same(item):return {k:getattr(item,k) for k in ("project_id","agent_path","tenant_id","client_id","plan_id")}
def _hash(payload):return hashlib.sha256(json.dumps(payload,ensure_ascii=False,sort_keys=True,separators=(",",":")).encode()).hexdigest()
def _serialize(item,fields):return {x:getattr(item,x) for x in fields}

class FactoryKnowledgeGraphService:
    def __init__(self,db:AsyncSession):self.db=db
    async def list_workspace(self,*,project_id:int):
        async def rows(model,order):return (await self.db.execute(select(model).where(model.project_id==project_id).order_by(order.desc()).limit(500))).scalars().all()
        graphs=await rows(FactoryKnowledgeGraph,FactoryKnowledgeGraph.created_at);entities=await rows(FactoryKnowledgeEntity,FactoryKnowledgeEntity.created_at);relations=await rows(FactoryKnowledgeRelation,FactoryKnowledgeRelation.created_at);versions=await rows(FactoryKnowledgeGraphVersion,FactoryKnowledgeGraphVersion.published_at);publications=await rows(FactoryKnowledgePublication,FactoryKnowledgePublication.created_at);evidence=await rows(FactoryKnowledgeEvidence,FactoryKnowledgeEvidence.recorded_at)
        verified=[x for x in entities if x.status=="verified"];types={x.entity_type for x in verified};verified_relations=[x for x in relations if x.status=="verified"];acks=[x for x in publications if x.status=="acknowledged"]
        return {"graphs":[_serialize(x,GRAPH) for x in graphs],"entities":[_serialize(x,ENTITY) for x in entities],"relations":[_serialize(x,RELATION) for x in relations],"versions":[_serialize(x,VERSION) for x in versions],"publications":[_serialize(x,PUBLICATION) for x in publications],"evidence":[{"id":x.id,"subject_type":x.subject_type,"subject_id":x.subject_id,"evidence_type":x.evidence_type,"evidence_reference":x.evidence_reference,"recorded_by":x.recorded_by} for x in evidence],"source_candidates":await self._candidates(project_id),"metrics":{"verified_entities":len(verified),"entity_type_completeness_percent":round(len(types&ENTITY_TYPES)*100/len(ENTITY_TYPES),2),"verified_relations":len(verified_relations),"relation_verification_percent":round(len(verified_relations)*100/max(1,len(relations)),2),"published_graph_versions":len(versions),"publication_acknowledgement_percent":round(len(acks)*100/max(1,len(publications)),2)},"contract":{"engineering_master_copied":False,"certificate_master_copied":False,"customer_master_copied":False,"source_revision_pinned":True,"source_fingerprint_pinned":True,"unverified_fact_publishable":False,"relation_self_verification":False,"graph_author_self_publish":False,"consumer_system_mutated":False,"publication_acknowledgement_required":True,"published_versions_mutable":False}}

    async def create_graph(self,*,project_id:int,context:TenantContext,actor:str,graph_code:str,graph_name:str,scope:str,default_locale:str,objective:str):
        if scope not in {"enterprise","brand","global-product"} or len(objective.strip())<12:raise ValueError("Knowledge graph requires supported scope and operating objective")
        now=datetime.now(timezone.utc);item=FactoryKnowledgeGraph(id=_id("knowledge-graph"),**_context(context,project_id),graph_number=_number("KGG",project_id),graph_code=graph_code.strip()[:64],graph_name=graph_name.strip()[:180],scope=scope,default_locale=default_locale.strip()[:16],objective=objective.strip(),current_version=0,status="draft",authored_by=str(actor),revision=1,created_at=now,updated_at=now);self.db.add(item);await self._event(item,"graph","graph-created",f"graph:{item.graph_code}","Created governed enterprise knowledge graph",actor);await self.db.flush();return _serialize(item,GRAPH)

    async def add_entity(self,graph_id:str,*,project_id:int,context:TenantContext,actor:str,entity_key:str,entity_type:str,canonical_name:str,aliases:list[str],properties:dict,locale:str,source_type:str,source_id:str,evidence_reference:str):
        graph=await self._get(FactoryKnowledgeGraph,graph_id,project_id,"Knowledge graph")
        if graph.status!="draft" or entity_type not in ENTITY_TYPES or entity_type not in SOURCE_ENTITY_TYPES.get(source_type,set()) or not properties or not evidence_reference.strip():raise ValueError("Entity requires draft graph, valid source/type mapping, properties and evidence")
        source=await self._source(project_id,source_type,source_id);now=datetime.now(timezone.utc);item=FactoryKnowledgeEntity(id=_id("knowledge-entity"),**_context(context,project_id),entity_number=_number("KGE",project_id),graph_id=graph.id,graph_number=graph.graph_number,entity_key=entity_key.strip()[:160],entity_type=entity_type,canonical_name=canonical_name.strip()[:255],aliases_json=sorted(set(str(x).strip() for x in aliases if str(x).strip())),properties_json=properties,locale=locale.strip()[:16],source_type=source_type,source_id=source_id,source_number=source["number"],source_revision=source["revision"],source_status=source["status"],source_fingerprint=source["fingerprint"],source_snapshot_json=source["snapshot"],evidence_reference=evidence_reference.strip()[:255],status="pending",created_by=str(actor),revision=1,created_at=now);self.db.add(item);await self._event(item,"entity","entity-ingested",evidence_reference,"Ingested source-pinned entity without copying authoritative master",actor);await self.db.flush();return _serialize(item,ENTITY)

    async def verify_entity(self,entity_id:str,*,project_id:int,actor:str,expected_revision:int,reference:str):
        item=await self._get(FactoryKnowledgeEntity,entity_id,project_id,"Knowledge entity");self._revision(item,expected_revision)
        if item.status!="pending" or item.created_by==str(actor) or not reference.strip():raise ValueError("Knowledge entity requires independent verification")
        await self._validate_entity(item);item.status="verified";item.verified_by=str(actor);item.verified_at=datetime.now(timezone.utc);item.verification_reference=reference.strip()[:255];item.revision+=1;await self._event(item,"entity","entity-verified",reference,"Independently verified source-pinned entity",actor);await self.db.flush();return _serialize(item,ENTITY)

    async def add_relation(self,graph_id:str,*,project_id:int,context:TenantContext,actor:str,subject_entity_id:str,predicate:str,object_entity_id:str,evidence_reference:str):
        graph=await self._get(FactoryKnowledgeGraph,graph_id,project_id,"Knowledge graph");subject=await self._get(FactoryKnowledgeEntity,subject_entity_id,project_id,"Subject entity");obj=await self._get(FactoryKnowledgeEntity,object_entity_id,project_id,"Object entity")
        if graph.status!="draft" or subject.graph_id!=graph.id or obj.graph_id!=graph.id or subject.id==obj.id or subject.status!="verified" or obj.status!="verified" or not predicate.strip() or not evidence_reference.strip():raise ValueError("Relation requires distinct verified entities in the draft graph and evidence")
        now=datetime.now(timezone.utc);item=FactoryKnowledgeRelation(id=_id("knowledge-relation"),**_context(context,project_id),relation_number=_number("KGR",project_id),graph_id=graph.id,subject_entity_id=subject.id,subject_entity_number=subject.entity_number,predicate=predicate.strip()[:100],object_entity_id=obj.id,object_entity_number=obj.entity_number,evidence_reference=evidence_reference.strip()[:255],status="pending",created_by=str(actor),revision=1,created_at=now);self.db.add(item);await self._event(item,"relation","relation-created",evidence_reference,"Created evidence-backed relationship for independent verification",actor);await self.db.flush();return _serialize(item,RELATION)

    async def verify_relation(self,relation_id:str,*,project_id:int,actor:str,expected_revision:int,reference:str):
        item=await self._get(FactoryKnowledgeRelation,relation_id,project_id,"Knowledge relation");self._revision(item,expected_revision)
        if item.status!="pending" or item.created_by==str(actor) or not reference.strip():raise ValueError("Knowledge relation requires independent verification")
        for entity_id in (item.subject_entity_id,item.object_entity_id):
            entity=await self._get(FactoryKnowledgeEntity,entity_id,project_id,"Knowledge entity");await self._validate_entity(entity)
            if entity.status!="verified":raise ValueError("Relation endpoint is no longer verified")
        item.status="verified";item.verified_by=str(actor);item.verified_at=datetime.now(timezone.utc);item.revision+=1;await self._event(item,"relation","relation-verified",reference,"Independently verified relation and both source pins",actor);await self.db.flush();return _serialize(item,RELATION)

    async def publish_graph(self,graph_id:str,*,project_id:int,context:TenantContext,actor:str,expected_revision:int,consumer:str,delivery_reference:str):
        graph=await self._get(FactoryKnowledgeGraph,graph_id,project_id,"Knowledge graph");self._revision(graph,expected_revision)
        if graph.status!="draft" or graph.authored_by==str(actor) or consumer not in CONSUMERS or not delivery_reference.strip():raise ValueError("Knowledge graph requires independent publisher, supported consumer and delivery evidence")
        entities=(await self.db.execute(select(FactoryKnowledgeEntity).where(FactoryKnowledgeEntity.graph_id==graph.id,FactoryKnowledgeEntity.status=="verified"))).scalars().all();relations=(await self.db.execute(select(FactoryKnowledgeRelation).where(FactoryKnowledgeRelation.graph_id==graph.id,FactoryKnowledgeRelation.status=="verified"))).scalars().all();types={x.entity_type for x in entities}
        if types!=ENTITY_TYPES or len(relations)<5:raise ValueError("Publication requires all six entity types and at least five verified relations")
        for entity in entities:await self._validate_entity(entity)
        entity_manifest=sorted(({"id":x.id,"type":x.entity_type,"source":x.source_fingerprint,"properties":_hash(x.properties_json)} for x in entities),key=lambda x:x["id"]);relation_manifest=sorted(({"id":x.id,"subject":x.subject_entity_id,"predicate":x.predicate,"object":x.object_entity_id,"evidence":x.evidence_reference} for x in relations),key=lambda x:x["id"]);manifest_hash=_hash({"entities":entity_manifest,"relations":relation_manifest});now=datetime.now(timezone.utc);version_number=graph.current_version+1
        version=FactoryKnowledgeGraphVersion(id=_id("knowledge-version"),**_context(context,project_id),version_reference=_number("KGV",project_id),graph_id=graph.id,graph_number=graph.graph_number,version_number=version_number,entity_manifest_json=entity_manifest,relation_manifest_json=relation_manifest,manifest_hash=manifest_hash,entity_type_coverage_json=sorted(types),status="published",published_by=str(actor),published_at=now)
        publication=FactoryKnowledgePublication(id=_id("knowledge-publication"),**_context(context,project_id),publication_number=_number("KGP",project_id),graph_id=graph.id,graph_number=graph.graph_number,version_id=version.id,version_number=version_number,manifest_hash=manifest_hash,consumer=consumer,delivery_reference=delivery_reference.strip()[:255],consumer_mutated=False,status="pending",created_by=str(actor),created_at=now,revision=1)
        graph.current_version=version_number;graph.status="published";graph.published_by=str(actor);graph.published_at=now;graph.revision+=1;graph.updated_at=now;self.db.add_all([version,publication]);await self._event(graph,"graph","graph-published",delivery_reference,"Published immutable graph manifest without mutating consumer",actor);await self._event(publication,"publication","publication-created",delivery_reference,"Created explicit downstream acknowledgement",actor);await self.db.flush();return {"graph":_serialize(graph,GRAPH),"version":_serialize(version,VERSION),"publication":_serialize(publication,PUBLICATION)}

    async def acknowledge_publication(self,publication_id:str,*,project_id:int,actor:str,expected_revision:int,reference:str):
        item=await self._get(FactoryKnowledgePublication,publication_id,project_id,"Knowledge publication");self._revision(item,expected_revision)
        if item.status!="pending" or item.created_by==str(actor) or not reference.strip():raise ValueError("Knowledge publication acknowledgement must be independent and evidenced")
        version=await self._get(FactoryKnowledgeGraphVersion,item.version_id,project_id,"Knowledge graph version")
        if version.status!="published" or version.manifest_hash!=item.manifest_hash:raise ValueError("Published graph manifest changed")
        item.status="acknowledged";item.acknowledged_by=str(actor);item.acknowledged_at=datetime.now(timezone.utc);item.acknowledgement_reference=reference.strip()[:255];item.revision+=1;await self._event(item,"publication","publication-acknowledged",reference,"Consumer acknowledged exact immutable graph manifest",actor);await self.db.flush();return _serialize(item,PUBLICATION)

    async def _candidates(self,project_id):
        result=[]
        for source_type,model,order in (("legal-party",FactoryLegalParty,FactoryLegalParty.created_at),("product-passport",FactoryProductPassport,FactoryProductPassport.created_at),("passport-certificate",FactoryProductPassportCertificate,FactoryProductPassportCertificate.created_at),("dam-asset",FactoryDamAsset,FactoryDamAsset.created_at),("icp-profile",FactoryIcpProfile,FactoryIcpProfile.created_at)):
            items=(await self.db.execute(select(model).where(model.project_id==project_id).order_by(order.desc()).limit(100))).scalars().all()
            for item in items:
                try:source=await self._source(project_id,source_type,item.id)
                except ValueError:continue
                result.append({"source_type":source_type,"source_id":item.id,"source_number":source["number"],"source_status":source["status"],"source_fingerprint":source["fingerprint"],"suggested_name":source["name"],"allowed_entity_types":sorted(SOURCE_ENTITY_TYPES[source_type])})
        return result

    async def _source(self,project_id,source_type,source_id):
        if source_type=="legal-party":
            x=await self.db.scalar(select(FactoryLegalParty).where(FactoryLegalParty.id==source_id,FactoryLegalParty.project_id==project_id));status=x.status if x else "";snapshot={"legal_name":x.legal_name,"country_code":x.country_code,"party_type":x.party_type,"identity_fingerprint":x.identity_fingerprint,"revision":x.revision} if x else {};number=x.party_number if x else "";name=x.legal_name if x else ""
            if not x or status!="active":raise ValueError("Legal-party source must be active")
        elif source_type=="product-passport":
            x=await self.db.scalar(select(FactoryProductPassport).where(FactoryProductPassport.id==source_id,FactoryProductPassport.project_id==project_id));status=x.lifecycle_status if x else "";snapshot={"product_reference":x.product_reference,"sku_reference":x.sku_reference,"target_market":x.target_market,"trace_digest":x.trace_digest,"revision":x.revision} if x else {};number=x.passport_number if x else "";name=x.product_reference if x else ""
            if not x or status!="published" or not x.trace_digest:raise ValueError("Product-passport source must be published")
        elif source_type=="passport-certificate":
            x=await self.db.scalar(select(FactoryProductPassportCertificate).where(FactoryProductPassportCertificate.id==source_id,FactoryProductPassportCertificate.project_id==project_id));status=x.verification_status if x else "";snapshot={"certificate_type":x.certificate_type,"certificate_number":x.certificate_number,"issuer":x.issuer,"jurisdiction":x.jurisdiction,"valid_until":str(x.valid_until),"evidence_reference":x.evidence_reference,"revision":x.revision} if x else {};number=x.certificate_number if x else "";name=f"{x.certificate_type} {x.certificate_number}" if x else ""
            if not x or status!="verified" or (x.valid_until.date() if hasattr(x.valid_until,"date") else x.valid_until)<date.today():raise ValueError("Certificate source must be verified and unexpired")
        elif source_type=="dam-asset":
            x=await self.db.scalar(select(FactoryDamAsset).where(FactoryDamAsset.id==source_id,FactoryDamAsset.project_id==project_id));status=x.status if x else "";snapshot={"asset_name":x.asset_name,"asset_type":x.asset_type,"source_sha256":x.source_sha256,"product_references":x.product_references_json,"brand_reference":x.brand_reference,"revision":x.revision} if x else {};number=x.asset_number if x else "";name=x.asset_name if x else ""
            rights=await self.db.scalar(select(FactoryDamRightsGrant).where(FactoryDamRightsGrant.asset_id==source_id,FactoryDamRightsGrant.status=="active")) if x else None
            if not x or status!="active" or not rights or rights.valid_until<date.today():raise ValueError("DAM case source requires active bounded rights")
        elif source_type=="icp-profile":
            x=await self.db.scalar(select(FactoryIcpProfile).where(FactoryIcpProfile.id==source_id,FactoryIcpProfile.project_id==project_id));status=x.status if x else "";version=await self.db.scalar(select(FactoryIcpVersion).where(FactoryIcpVersion.profile_id==source_id,FactoryIcpVersion.version_number==x.current_version)) if x else None;snapshot={"profile_name":x.profile_name,"market_mode":x.market_mode,"customer_type":x.customer_type,"definition_hash":version.definition_hash if version else None,"version":x.current_version,"revision":x.revision} if x else {};number=x.profile_number if x else "";name=x.profile_name if x else ""
            if not x or status!="active" or not version or version.status!="active":raise ValueError("ICP source must have active immutable version")
        else:raise ValueError("Unsupported knowledge source")
        return {"number":number,"name":name,"revision":x.revision,"status":status,"fingerprint":_hash(snapshot),"snapshot":snapshot}

    async def _validate_entity(self,item):
        source=await self._source(item.project_id,item.source_type,item.source_id)
        if source["revision"]!=item.source_revision or source["status"]!=item.source_status or source["fingerprint"]!=item.source_fingerprint:raise ValueError("Pinned knowledge source changed; re-ingestion is required")
    async def _get(self,model,item_id,project_id,label):
        item=await self.db.scalar(select(model).where(model.id==item_id,model.project_id==project_id))
        if not item:raise KeyError(f"{label} not found")
        return item
    @staticmethod
    def _revision(item,expected):
        if int(item.revision)!=int(expected):raise ValueError("Revision conflict")
    async def _event(self,item,subject_type,evidence_type,reference,note,actor):
        number=next((getattr(item,k,None) for k in ("graph_number","entity_number","relation_number","publication_number") if getattr(item,k,None)),str(item.id));self.db.add(FactoryKnowledgeEvidence(id=_id("knowledge-evidence"),**_same(item),evidence_number=_number("KGX",item.project_id),subject_type=subject_type,subject_id=item.id,subject_number=number,evidence_type=evidence_type,evidence_reference=str(reference)[:255],note=note,recorded_by=str(actor),recorded_at=datetime.now(timezone.utc)))
