import asyncio
from datetime import date,datetime,timedelta,timezone
from decimal import Decimal
import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker,create_async_engine
import models  # noqa: F401
from core.database import Base
from core.tenant_context import build_tenant_context
from models.factory_legal_contracts import FactoryLegalParty
from models.factory_product_passport import FactoryProductPassport,FactoryProductPassportCertificate
from models.factory_icp import FactoryIcpProfile,FactoryIcpVersion
from models.factory_dam_localization import FactoryDamAsset,FactoryDamRightsGrant
from models.factory_knowledge_graph import FactoryKnowledgeEntity
from services.factory_knowledge_graph import FactoryKnowledgeGraphService

def context(project_id=63):return build_tenant_context(agent_path=f"hq/client-kg-{project_id}",tenant_id=f"tenant-kg-{project_id}",client_id=f"client-kg-{project_id}",plan_id=f"plan-{project_id}")
async def sources(db,ctx,project_id=63):
    now=datetime.now(timezone.utc);common=dict(project_id=project_id,agent_path=ctx.agent_path,tenant_id=ctx.tenant_id,client_id=ctx.client_id,plan_id=ctx.plan_id)
    party=FactoryLegalParty(id="kg-party",**common,party_number="LPTY-KG",party_reference="FACTORY",party_type="seller",legal_name="Future Robotics Ltd",country_code="CN",identity_fingerprint="a"*64,registration_reference="REG",tax_profile_reference="TAX",registered_address_reference="ADDR",source_type="manual",source_id=None,source_number=None,source_revision=None,kyb_evidence_reference="KYB",sanctions_screening_reference="SCREEN",status="active",authored_by="legal",approved_by="reviewer",approved_at=now,approval_reference="APP",revision=2,updated_by="reviewer",created_at=now,updated_at=now)
    passport=FactoryProductPassport(id="kg-passport",**common,passport_number="DPP-KG",engineering_version_id="eng",engineering_number="ENG-1",product_reference="ROBOT-CELL",sku_reference="RC-01",order_id="order",order_number="ORD-1",account_reference="BUYER",work_order_reference="WO",batch_reference="BATCH",inspection_reference="QMS",shipment_reference="SHIP",delivery_receipt_reference="POD",target_market="US",access_mode="public",lifecycle_status="published",trace_digest="b"*64,qr_payload="qr",published_by="quality",published_at=now,emitted_events_json="[]",revision=3,updated_by="quality",created_at=now,updated_at=now)
    cert=FactoryProductPassportCertificate(id="kg-cert",**common,passport_id=passport.id,passport_number=passport.passport_number,certificate_type="CE",certificate_number="CE-KG-001",issuer="Notified Body",jurisdiction="EU",valid_from=now-timedelta(days=10),valid_until=now+timedelta(days=365),evidence_reference="CERT-EVIDENCE",verification_status="verified",revision=1,updated_by="quality",created_at=now,updated_at=now)
    profile=FactoryIcpProfile(id="kg-icp",**common,profile_number="ICP-KG",profile_code="AUTO",profile_name="Automation plants",market_mode="global",customer_type="b2b",objective="Market",current_version=1,status="active",authored_by="strategy",approved_by="reviewer",approved_at=now,approval_reference="ICP-APP",revision=2,updated_by="reviewer",created_at=now,updated_at=now)
    version=FactoryIcpVersion(id="kg-icp-v1",**common,version_reference="ICPV-KG",profile_id=profile.id,profile_number=profile.profile_number,version_number=1,countries_json=["US"],industries_json=["automation"],company_size_bands_json=["500+"],product_references_json=["ROBOT-CELL"],required_roles_json=["CTO"],buying_triggers_json=["expansion"],minimum_potential_value=Decimal("100000"),currency="USD",scoring_weights_json={"country":100},definition_hash="c"*64,status="active",created_by="strategy",created_at=now,activated_by="reviewer",activated_at=now)
    asset=FactoryDamAsset(id="kg-asset",**common,asset_number="DAMA-KG",asset_name="Robot Cell Case Study",asset_type="document",source_asset_id="private",source_display_name="case.pdf",source_media_type="application/pdf",source_sha256="d"*64,source_size_bytes=1000,source_language="zh-CN",product_references_json=["ROBOT-CELL"],brand_reference="BRAND",rights_owner_reference="OWNER",status="active",authored_by="content",activated_by="rights",activated_at=now,revision=2,updated_by="rights",created_at=now,updated_at=now)
    rights=FactoryDamRightsGrant(id="kg-rights",**common,grant_number="DAMR-KG",grant_code="GLOBAL",asset_id=asset.id,asset_number=asset.asset_number,territories_json=["GLOBAL"],languages_json=["en-US"],channels_json=["geo"],valid_from=date.today(),valid_until=date.today()+timedelta(days=365),license_type="owned",rights_evidence_reference="RIGHTS",restrictions=None,status="active",requested_by="content",approved_by="rights",approved_at=now,approval_reference="APP",revision=2,created_at=now)
    db.add_all([party,passport,cert,profile,version,asset,rights]);await db.flush();return party,passport,cert,profile,asset
async def complete_entities(service,ctx,masters,project_id=63):
    party,passport,cert,profile,asset=masters;graph=await service.create_graph(project_id=project_id,context=ctx,actor="architect",graph_code="ENTERPRISE",graph_name="Enterprise truth graph",scope="enterprise",default_locale="zh-CN",objective="Publish traceable enterprise facts for AI and recommendation channels.")
    specs=[("org","organization","Future Robotics Ltd",{},"legal-party",party.id),("product","product","Robot Cell",{"sku":"RC-01"},"product-passport",passport.id),("capability","capability","Flexible robot assembly",{"capability":"flexible-assembly"},"product-passport",passport.id),("certificate","certificate","CE conformity",{"certificate":"CE-KG-001"},"passport-certificate",cert.id),("case","case","Robot Cell Case Study",{"outcome":"traceable-delivery"},"dam-asset",asset.id),("market","market","Automation plants",{"market":"US automation"},"icp-profile",profile.id)]
    entities=[]
    for key,kind,name,props,source_type,source_id in specs:
        item=await service.add_entity(graph["id"],project_id=project_id,context=ctx,actor="architect",entity_key=key,entity_type=kind,canonical_name=name,aliases=[],properties=props or {"legal_name":name},locale="en-US",source_type=source_type,source_id=source_id,evidence_reference=f"EVIDENCE-{key}")
        entities.append(await service.verify_entity(item["id"],project_id=project_id,actor="fact-reviewer",expected_revision=1,reference=f"VERIFY-{key}"))
    return graph,entities
def test_knowledge_graph_publishes_six_source_pinned_entity_types_and_acknowledges():
    async def scenario():
        engine=create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine,expire_on_commit=False)() as db:
            ctx=context();masters=await sources(db,ctx);service=FactoryKnowledgeGraphService(db);graph,entities=await complete_entities(service,ctx,masters)
            pairs=[(0,"offers",1),(1,"has-capability",2),(1,"certified-by",3),(1,"proven-by",4),(5,"demands",1)];relations=[]
            for index,(a,predicate,b) in enumerate(pairs):
                relation=await service.add_relation(graph["id"],project_id=63,context=ctx,actor="architect",subject_entity_id=entities[a]["id"],predicate=predicate,object_entity_id=entities[b]["id"],evidence_reference=f"REL-{index}")
                relations.append(await service.verify_relation(relation["id"],project_id=63,actor="relation-reviewer",expected_revision=1,reference=f"REL-VERIFY-{index}"))
            with pytest.raises(ValueError,match="independent publisher"):await service.publish_graph(graph["id"],project_id=63,context=ctx,actor="architect",expected_revision=1,consumer="geo",delivery_reference="SELF")
            published=await service.publish_graph(graph["id"],project_id=63,context=ctx,actor="publisher",expected_revision=1,consumer="geo",delivery_reference="GEO-GRAPH-V1")
            publication=await service.acknowledge_publication(published["publication"]["id"],project_id=63,actor="geo-owner",expected_revision=1,reference="GEO-ACK")
            workspace=await service.list_workspace(project_id=63);assert workspace["metrics"]=={"verified_entities":6,"entity_type_completeness_percent":100.0,"verified_relations":5,"relation_verification_percent":100.0,"published_graph_versions":1,"publication_acknowledgement_percent":100.0};assert publication["status"]=="acknowledged" and published["publication"]["consumer_mutated"] is False;assert (await service.list_workspace(project_id=64))["graphs"]==[]
        await engine.dispose()
    asyncio.run(scenario())
def test_knowledge_graph_blocks_self_verification_incomplete_graph_and_source_drift():
    async def scenario():
        engine=create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine,expire_on_commit=False)() as db:
            ctx=context();masters=await sources(db,ctx);service=FactoryKnowledgeGraphService(db);graph=await service.create_graph(project_id=63,context=ctx,actor="architect",graph_code="DRIFT",graph_name="Drift graph",scope="enterprise",default_locale="en-US",objective="Verify source drift blocks all graph publication paths.");party=masters[0]
            entity=await service.add_entity(graph["id"],project_id=63,context=ctx,actor="architect",entity_key="org",entity_type="organization",canonical_name="Future Robotics",aliases=[],properties={"country":"CN"},locale="en-US",source_type="legal-party",source_id=party.id,evidence_reference="KYB")
            with pytest.raises(ValueError,match="independent"):await service.verify_entity(entity["id"],project_id=63,actor="architect",expected_revision=1,reference="SELF")
            await service.verify_entity(entity["id"],project_id=63,actor="reviewer",expected_revision=1,reference="VERIFIED")
            with pytest.raises(ValueError,match="six entity types"):await service.publish_graph(graph["id"],project_id=63,context=ctx,actor="publisher",expected_revision=1,consumer="geo",delivery_reference="INCOMPLETE")
            party.revision+=1;await db.flush();stored=await db.get(FactoryKnowledgeEntity,entity["id"])
            with pytest.raises(ValueError,match="changed"):await service._validate_entity(stored)
        await engine.dispose()
    asyncio.run(scenario())
