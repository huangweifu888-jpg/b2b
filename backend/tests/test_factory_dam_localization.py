import asyncio
from datetime import date, datetime, timedelta, timezone

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import models  # noqa: F401
from core.database import Base
from core.tenant_context import build_tenant_context
from models.platform import ContentDownloadAsset
from services.factory_dam_localization import FactoryDamLocalizationService


def context(project_id=62):
    return build_tenant_context(agent_path=f"hq/client-dam-{project_id}",tenant_id=f"tenant-dam-{project_id}",client_id=f"client-dam-{project_id}",plan_id=f"plan-{project_id}")


async def source(db,project_id=62):
    now=datetime.now(timezone.utc);item=ContentDownloadAsset(id=f"private-asset-{project_id}",project_id=project_id,client_org_id=1,storage_key=f"acceptance/source-{project_id}.png",display_name="robot-cell-source.png",media_type="image/png",visibility="authenticated",enabled=True,size_bytes=4096,sha256="a"*64,scan_status="clean",scan_detail="test-clean",scanned_at=now,created_by="uploader",created_at=now,updated_at=now);db.add(item);await db.flush();return item


async def masters(service,ctx,src,project_id=62):
    asset=await service.adopt_asset(project_id=project_id,context=ctx,actor="content-owner",source_asset_id=src.id,asset_name="Robot cell hero",asset_type="image",source_language="zh-CN",product_references=["ROBOT-CELL"],brand_reference="BRAND-MASTER",rights_owner_reference="FACTORY-OWNER")
    rights=await service.request_rights(asset["id"],project_id=project_id,context=ctx,actor="content-owner",grant_code="GLOBAL-DIGITAL",territories=["US","DE"],languages=["en-US","de-DE"],channels=["cms","social"],valid_from=date.today(),valid_until=date.today()+timedelta(days=365),license_type="owned",rights_evidence_reference="RIGHTS-EVIDENCE-62",restrictions="No resale of original file")
    with pytest.raises(ValueError,match="independent"):
        await service.approve_rights(rights["id"],project_id=project_id,actor="content-owner",expected_revision=1,approval_reference="SELF")
    approved=await service.approve_rights(rights["id"],project_id=project_id,actor="rights-reviewer",expected_revision=1,approval_reference="RIGHTS-APPROVAL-62")
    created=await service.create_glossary(project_id=project_id,context=ctx,actor="content-owner",glossary_code="ZH-EN-AUTO",glossary_name="Automation terminology",source_locale="zh-CN",target_locale="en-US",terms=[{"source":"机器人工作站","target":"robot cell","note":"preferred product term"},{"source":"节拍","target":"cycle time","note":"manufacturing metric"},{"source":"投产","target":"production launch","note":"market wording"}])
    with pytest.raises(ValueError,match="independent"):
        await service.approve_glossary(created["glossary"]["id"],project_id=project_id,actor="content-owner",expected_revision=1,approval_reference="SELF")
    glossary=await service.approve_glossary(created["glossary"]["id"],project_id=project_id,actor="language-reviewer",expected_revision=1,approval_reference="GLOSSARY-APPROVAL-62")
    return approved["asset"],approved["rights"],glossary


def test_dam_localization_closes_rights_review_country_pack_and_handoff_without_copying_source():
    async def scenario():
        engine=create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine,expire_on_commit=False)() as db:
            ctx=context();src=await source(db);service=FactoryDamLocalizationService(db);asset,rights,glossary=await masters(service,ctx,src)
            job=await service.create_job(project_id=62,context=ctx,actor="content-owner",asset_id=asset["id"],rights_grant_id=rights["id"],glossary_id=glossary["id"],target_market="US",target_locale="en-US",channel="cms",brief="Localize the approved hero asset for the US automation website.")
            rendition=await service.submit_rendition(job["id"],project_id=62,context=ctx,actor="translator",expected_revision=1,localized_storage_reference="private://localized/us/robot-cell.png",localized_sha256="b"*64,translator_reference="TRANSLATOR-62",ai_assisted=True,machine_translation_provider_reference="MT-JOB-62")
            with pytest.raises(ValueError,match="independent"):
                await service.review_rendition(rendition["id"],project_id=62,context=ctx,actor="translator",expected_revision=1,linguistic_score=95,terminology_score=94,brand_score=93,cultural_score=92,findings=[],recommendation="approve",compliance_assessment_reference="SELF")
            reviewed=await service.review_rendition(rendition["id"],project_id=62,context=ctx,actor="localization-reviewer",expected_revision=1,linguistic_score=95,terminology_score=94,brand_score=93,cultural_score=92,findings=[],recommendation="approve",compliance_assessment_reference="US-CONTENT-ASSESSMENT-62")
            pack=await service.create_pack(project_id=62,context=ctx,actor="content-owner",pack_code="US-AUTOMATION",pack_name="US automation launch pack",target_market="US",target_locale="en-US",rendition_ids=[reviewed["rendition"]["id"]],compliance_assessment_reference="US-REGIONAL-REVIEW-62",tax_reviewed=True,privacy_reviewed=True,market_access_reviewed=True)
            with pytest.raises(ValueError,match="independent"):
                await service.publish_pack(pack["id"],project_id=62,context=ctx,actor="content-owner",expected_revision=1,consumer="cms",delivery_reference="SELF")
            published=await service.publish_pack(pack["id"],project_id=62,context=ctx,actor="regional-publisher",expected_revision=1,consumer="cms",delivery_reference="CMS-PAYLOAD-62")
            with pytest.raises(ValueError,match="independent"):
                await service.acknowledge_handoff(published["handoff"]["id"],project_id=62,actor="regional-publisher",expected_revision=1,acknowledgement_reference="SELF")
            handoff=await service.acknowledge_handoff(published["handoff"]["id"],project_id=62,actor="cms-owner",expected_revision=1,acknowledgement_reference="CMS-ACK-62")
            workspace=await service.list_workspace(project_id=62)
            assert workspace["metrics"]=={"active_assets":1,"rights_coverage_percent":100.0,"approved_renditions":1,"localization_approval_percent":100.0,"published_country_packs":1,"handoff_acknowledgement_percent":100.0}
            assert workspace["contract"]["machine_translation_direct_publish"] is False and handoff["status"]=="acknowledged"
            assert src.sha256=="a"*64 and src.scan_status=="clean" and not hasattr(asset,"storage_key")
            assert (await service.list_workspace(project_id=63))["assets"]==[]
        await engine.dispose()
    asyncio.run(scenario())


def test_dam_localization_blocks_bad_rights_low_quality_duplicate_and_changed_source():
    async def scenario():
        engine=create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine,expire_on_commit=False)() as db:
            ctx=context();src=await source(db);service=FactoryDamLocalizationService(db);asset,rights,glossary=await masters(service,ctx,src)
            with pytest.raises(ValueError,match="already adopted"):
                await service.adopt_asset(project_id=62,context=ctx,actor="other",source_asset_id=src.id,asset_name="Duplicate",asset_type="image",source_language="zh-CN",product_references=[],brand_reference="B",rights_owner_reference="O")
            with pytest.raises(ValueError,match="target market"):
                await service.create_job(project_id=62,context=ctx,actor="owner",asset_id=asset["id"],rights_grant_id=rights["id"],glossary_id=glossary["id"],target_market="FR",target_locale="en-US",channel="cms",brief="Unsupported market localization job.")
            job=await service.create_job(project_id=62,context=ctx,actor="owner",asset_id=asset["id"],rights_grant_id=rights["id"],glossary_id=glossary["id"],target_market="US",target_locale="en-US",channel="cms",brief="Valid market localization job.")
            rendition=await service.submit_rendition(job["id"],project_id=62,context=ctx,actor="translator",expected_revision=1,localized_storage_reference="private://localized/low.png",localized_sha256="c"*64,translator_reference="T",ai_assisted=False,machine_translation_provider_reference=None)
            with pytest.raises(ValueError,match="at least 80"):
                await service.review_rendition(rendition["id"],project_id=62,context=ctx,actor="reviewer",expected_revision=1,linguistic_score=79,terminology_score=90,brand_score=90,cultural_score=90,findings=[{"type":"linguistic"}],recommendation="approve",compliance_assessment_reference="ASSESS")
            src.sha256="d"*64
            with pytest.raises(ValueError,match="changed"):
                await service.review_rendition(rendition["id"],project_id=62,context=ctx,actor="reviewer",expected_revision=1,linguistic_score=90,terminology_score=90,brand_score=90,cultural_score=90,findings=[],recommendation="approve",compliance_assessment_reference="ASSESS")
            with pytest.raises(ValueError,match="Revision conflict"):
                await service.submit_rendition(job["id"],project_id=62,context=ctx,actor="translator",expected_revision=99,localized_storage_reference="x",localized_sha256="e"*64,translator_reference="T",ai_assisted=False,machine_translation_provider_reference=None)
        await engine.dispose()
    asyncio.run(scenario())
