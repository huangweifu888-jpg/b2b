import asyncio
from datetime import datetime, timedelta, timezone
import hashlib

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import models  # noqa: F401
from core.database import Base
from core.tenant_context import build_tenant_context
from services.factory_identity_resolution import FactoryIdentityResolutionService


def context(project_id=66): return build_tenant_context(agent_path=f"hq/client-identity-{project_id}",tenant_id=f"tenant-identity-{project_id}",client_id=f"client-identity-{project_id}",plan_id=f"plan-{project_id}")
def digest(value): return hashlib.sha256(value.encode()).hexdigest()


async def active_consent(service, ctx, project_id=66):
    item=await service.create_consent(project_id=project_id,context=ctx,actor="privacy-owner",subject_reference="CONTACT-001",account_reference="ACCOUNT-001",consent_reference=f"CMP-CONSENT-{project_id}",lawful_basis="consent",purposes=["customer-identity","service-personalization"],expires_at=datetime.now(timezone.utc)+timedelta(days=365))
    return await service.approve_consent(item["id"],project_id=project_id,actor="privacy-reviewer",expected_revision=1,reference="DPO-APPROVAL")


async def verified_signal(service, ctx, consent, signal_type, raw, actor="signal-capture"):
    project_id=int(ctx.plan_id.split("-")[-1])
    item=await service.add_signal(project_id=project_id,context=ctx,actor=actor,consent_id=consent["id"],signal_type=signal_type,identifier_hash=digest(raw),display_hint=raw[-4:],source_type="consent-event",source_reference=consent["consent_reference"],source_revision=consent["revision"],source_fingerprint=consent["source_event_hash"])
    return await service.verify_signal(item["id"],project_id=project_id,actor="identity-reviewer",expected_revision=1,reference=f"VERIFY-{signal_type}")


def test_identity_resolution_publishes_consent_governed_golden_profile_and_acknowledges():
    async def scenario():
        engine=create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection: await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine,expire_on_commit=False)() as db:
            ctx=context();service=FactoryIdentityResolutionService(db);consent=await active_consent(service,ctx)
            signals=[]
            for signal_type,raw in (("account","ACCOUNT-001"),("email","buyer@example.test"),("device","browser-device-001")): signals.append(await verified_signal(service,ctx,consent,signal_type,raw))
            case=await service.propose_match(project_id=66,context=ctx,actor="identity-analyst",account_reference="ACCOUNT-001",signal_ids=[x["id"] for x in signals],match_method="deterministic",match_score=100,reasons=["same verified account","consented email and device"])
            with pytest.raises(ValueError,match="independent"): await service.decide_match(case["id"],project_id=66,actor="identity-analyst",expected_revision=1,decision="approved",reference="SELF")
            case=await service.decide_match(case["id"],project_id=66,actor="identity-steward",expected_revision=1,decision="approved",reference="MDM-DECISION")
            profile=await service.create_profile(case["id"],project_id=66,context=ctx,actor="profile-author")
            with pytest.raises(ValueError,match="independent publisher"): await service.publish_profile(profile["id"],project_id=66,context=ctx,actor="profile-author",expected_revision=1,consumers=["cdp"],remote_reference_prefix="SELF")
            result=await service.publish_profile(profile["id"],project_id=66,context=ctx,actor="profile-publisher",expected_revision=1,consumers=["cdp","crm","service"],remote_reference_prefix="GOLDEN-PROFILE-V1")
            for publication in result["publications"]: await service.acknowledge_publication(publication["id"],project_id=66,actor="downstream-owner",expected_revision=1,reference=f"ACK-{publication['consumer_system']}")
            workspace=await service.list_workspace(project_id=66)
            assert workspace["metrics"]=={"active_consents":1,"verified_signals":3,"identity_match_percent":100.0,"approved_matches":1,"published_profiles":1,"handoff_acknowledgement_percent":100.0}
            assert workspace["contract"]["raw_identifier_stored"] is False
            assert all(x["consumer_mutated"] is False for x in result["publications"])
            assert "buyer@example.test" not in str(workspace)
            assert (await service.list_workspace(project_id=67))["profiles"]==[]
        await engine.dispose()
    asyncio.run(scenario())


def test_identity_resolution_blocks_plaintext_self_verification_source_drift_and_revocation():
    async def scenario():
        engine=create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection: await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine,expire_on_commit=False)() as db:
            ctx=context(67);service=FactoryIdentityResolutionService(db);consent=await active_consent(service,ctx,67)
            with pytest.raises(ValueError,match="64-character"): await service.add_signal(project_id=67,context=ctx,actor="capture",consent_id=consent["id"],signal_type="email",identifier_hash="buyer@example.test",display_hint="test",source_type="consent-event",source_reference=consent["consent_reference"],source_revision=consent["revision"],source_fingerprint=consent["source_event_hash"])
            with pytest.raises(ValueError,match="drifted"): await service.add_signal(project_id=67,context=ctx,actor="capture",consent_id=consent["id"],signal_type="email",identifier_hash=digest("buyer@example.test"),display_hint="test",source_type="consent-event",source_reference=consent["consent_reference"],source_revision=consent["revision"],source_fingerprint="0"*64)
            item=await service.add_signal(project_id=67,context=ctx,actor="capture",consent_id=consent["id"],signal_type="email",identifier_hash=digest("buyer@example.test"),display_hint="test",source_type="consent-event",source_reference=consent["consent_reference"],source_revision=consent["revision"],source_fingerprint=consent["source_event_hash"])
            with pytest.raises(ValueError,match="independent"): await service.verify_signal(item["id"],project_id=67,actor="capture",expected_revision=1,reference="SELF")
            await service.verify_signal(item["id"],project_id=67,actor="reviewer",expected_revision=1,reference="VERIFY")
            revoked=await service.revoke_consent(consent["id"],project_id=67,actor="privacy-owner",expected_revision=2,reference="WITHDRAWN")
            assert revoked["status"]=="revoked"
            with pytest.raises(ValueError,match="Active unexpired"): await service.verify_signal(item["id"],project_id=67,actor="reviewer-2",expected_revision=2,reference="AFTER-REVOCATION")
        await engine.dispose()
    asyncio.run(scenario())
