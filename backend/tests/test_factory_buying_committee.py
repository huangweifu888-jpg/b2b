import asyncio
from datetime import datetime,timedelta,timezone
from decimal import Decimal
import hashlib
import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker,create_async_engine
import models  # noqa:F401
from core.database import Base
from core.tenant_context import build_tenant_context
from models.factory_cpq import FactoryCpqQuote
from models.factory_icp import FactoryIcpBuyingRole,FactoryIcpProfile,FactoryIcpVersion
from services.factory_buying_committee import FactoryBuyingCommitteeService
from services.factory_identity_resolution import FactoryIdentityResolutionService
def context(pid=68):return build_tenant_context(agent_path=f"hq/client-buying-{pid}",tenant_id=f"tenant-buying-{pid}",client_id=f"client-buying-{pid}",plan_id=f"plan-{pid}")
def digest(x):return hashlib.sha256(x.encode()).hexdigest()
def scope(ctx,pid):return dict(project_id=pid,agent_path=ctx.agent_path,tenant_id=ctx.tenant_id,client_id=ctx.client_id,plan_id=ctx.plan_id)
async def sources(db,ctx,pid=68):
    now=datetime.now(timezone.utc);s=scope(ctx,pid);account=f"BUYER-{pid}";quote=FactoryCpqQuote(id=f"quote-{pid}",**s,quote_number=f"CPQ-{pid}",account_reference=account,currency="USD",exchange_rate=Decimal("1"),valid_until=now+timedelta(days=30),lines_json="[]",subtotal=Decimal("50000"),cost_total=Decimal("35000"),gross_margin_percent=Decimal("30"),status="accepted",order_intent_id=f"intent-{pid}",emitted_events_json="[]",revision=5,created_at=now,updated_at=now);db.add(quote)
    profile=FactoryIcpProfile(id=f"icp-{pid}",**s,profile_number=f"ICP-{pid}",profile_code=f"ICP-{pid}",profile_name="Industrial buying committee",market_mode="overseas",customer_type="b2b",objective="Governed committee roles",current_version=1,status="active",authored_by="icp-author",approved_by="icp-reviewer",approved_at=now,approval_reference="ICP-APPROVAL",revision=2,updated_by="icp-reviewer",created_at=now,updated_at=now);db.add(profile);version=FactoryIcpVersion(id=f"icp-version-{pid}",**s,version_reference=f"ICPV-{pid}",profile_id=profile.id,profile_number=profile.profile_number,version_number=1,countries_json=["US"],industries_json=["automation"],company_size_bands_json=["mid"],product_references_json=["ROBOT"],required_roles_json=["CFO","CTO","CHAMPION"],buying_triggers_json=["capacity"],minimum_potential_value=Decimal("10000"),currency="USD",scoring_weights_json={"fit":100},definition_hash=digest(f"definition-{pid}"),status="active",created_by="icp-author",created_at=now,activated_by="icp-reviewer",activated_at=now);db.add(version)
    roles=[]
    for i,(code,name,influence) in enumerate((("CFO","Economic buyer","economic-buyer"),("CTO","Technical buyer","technical-buyer"),("CHAMPION","Plant champion","champion")),1):
        role=FactoryIcpBuyingRole(id=f"role-{pid}-{i}",**s,role_number=f"ICPR-{pid}-{i}",profile_id=profile.id,profile_number=profile.profile_number,role_code=code,role_name=name,influence_type=influence,pains_json=["risk"],proof_requirements_json=["ROI"],preferred_channels_json=["meeting"],created_by="icp-author",created_at=now);db.add(role);roles.append(role)
    await db.flush();identity=FactoryIdentityResolutionService(db);consent=await identity.create_consent(project_id=pid,context=ctx,actor="privacy-owner",subject_reference=f"COMMITTEE-{pid}",account_reference=account,consent_reference=f"CONSENT-{pid}",lawful_basis="consent",purposes=["sales-committee"],expires_at=now+timedelta(days=365));consent=await identity.approve_consent(consent["id"],project_id=pid,actor="privacy-reviewer",expected_revision=1,reference="DPO");signals=[]
    for i in range(3):
        item=await identity.add_signal(project_id=pid,context=ctx,actor="contact-capture",consent_id=consent["id"],signal_type="contact",identifier_hash=digest(f"contact-{pid}-{i}"),display_hint=f"c{i+1}",source_type="consent-event",source_reference=consent["consent_reference"],source_revision=consent["revision"],source_fingerprint=consent["source_event_hash"]);signals.append(await identity.verify_signal(item["id"],project_id=pid,actor="contact-reviewer",expected_revision=1,reference=f"VERIFY-{i}"))
    return quote,profile,roles,signals
def test_buying_committee_publishes_complete_multithreaded_opportunity_and_acknowledges():
    async def scenario():
        engine=create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as c:await c.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine,expire_on_commit=False)() as db:
            ctx=context();quote,profile,roles,signals=await sources(db,ctx);service=FactoryBuyingCommitteeService(db);committee=await service.create_committee(project_id=68,context=ctx,actor="committee-author",committee_name="Strategic opportunity committee",opportunity_source_id=quote.id,icp_profile_id=profile.id);members=[]
            for i,(role,signal) in enumerate(zip(roles,signals)):
                member=await service.add_member(committee["id"],project_id=68,context=ctx,actor="member-author",role_id=role.id,contact_signal_id=signal["id"],influence_score=90-i*10,relationship_strength="strong",stance="supportive" if i else "neutral",preferred_channel="meeting",evidence_reference=f"DISCOVERY-{i}");members.append(await service.verify_member(member["id"],project_id=68,actor="member-reviewer",expected_revision=1,reference=f"VERIFY-MEMBER-{i}"))
            edges=[]
            for i in range(2):
                edge=await service.add_influence(committee["id"],project_id=68,context=ctx,actor="influence-author",from_member_id=members[i]["id"],to_member_id=members[i+1]["id"],influence_direction="influences",strength="strong",evidence_reference=f"INFLUENCE-{i}");edges.append(await service.verify_influence(edge["id"],project_id=68,actor="influence-reviewer",expected_revision=1,reference=f"VERIFY-INFLUENCE-{i}"))
            with pytest.raises(ValueError,match="independent publisher"):await service.publish_committee(committee["id"],project_id=68,context=ctx,actor="committee-author",expected_revision=1,consumers=["crm"],delivery_reference_prefix="SELF")
            result=await service.publish_committee(committee["id"],project_id=68,context=ctx,actor="committee-publisher",expected_revision=1,consumers=["crm","sales","marketing","service"],delivery_reference_prefix="BUYING-COMMITTEE-V1")
            for p in result["publications"]:await service.acknowledge_publication(p["id"],project_id=68,actor="consumer-owner",expected_revision=1,reference=f"ACK-{p['consumer']}")
            w=await service.list_workspace(project_id=68);assert w["metrics"]=={"verified_members":3,"role_coverage_percent":100.0,"multi_threaded_opportunities":1,"verified_influence_edges":2,"published_versions":1,"handoff_acknowledgement_percent":100.0};assert result["version"]["required_role_count"]==3 and result["version"]["member_count"]==3 and result["version"]["influence_edge_count"]==2;assert (await service.list_workspace(project_id=69))["committees"]==[]
        await engine.dispose()
    asyncio.run(scenario())
def test_buying_committee_blocks_self_verification_incomplete_publish_and_role_drift():
    async def scenario():
        engine=create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as c:await c.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine,expire_on_commit=False)() as db:
            ctx=context(69);quote,profile,roles,signals=await sources(db,ctx,69);service=FactoryBuyingCommitteeService(db);committee=await service.create_committee(project_id=69,context=ctx,actor="author",committee_name="Incomplete committee",opportunity_source_id=quote.id,icp_profile_id=profile.id);member=await service.add_member(committee["id"],project_id=69,context=ctx,actor="curator",role_id=roles[0].id,contact_signal_id=signals[0]["id"],influence_score=80,relationship_strength="medium",stance="neutral",preferred_channel="meeting",evidence_reference="DISCOVERY")
            with pytest.raises(ValueError,match="independent"):await service.verify_member(member["id"],project_id=69,actor="curator",expected_revision=1,reference="SELF")
            member=await service.verify_member(member["id"],project_id=69,actor="reviewer",expected_revision=1,reference="VERIFY")
            with pytest.raises(ValueError,match="All required"):await service.publish_committee(committee["id"],project_id=69,context=ctx,actor="publisher",expected_revision=1,consumers=["crm"],delivery_reference_prefix="INCOMPLETE")
            roles[0].role_name="Changed role";await db.flush()
            with pytest.raises(ValueError,match="drifted"):await service._validate_member(await service._get(__import__("models.factory_buying_committee",fromlist=["FactoryBuyingCommitteeMember"]).FactoryBuyingCommitteeMember,member["id"],69,"Member"))
        await engine.dispose()
    asyncio.run(scenario())
