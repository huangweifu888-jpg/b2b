import asyncio

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import models  # noqa: F401
from core.database import Base
from core.tenant_context import build_tenant_context
from models.factory_contract import FactoryCoreEventContract, FactoryCoreObjectContract
from models.factory_site_management import FactorySiteContentVersion
from services.factory_site_management import FactorySiteManagementService


def context(project_id: int):
    return build_tenant_context(agent_path=f"hq/site-{project_id}", tenant_id=f"tenant-{project_id}", client_id=f"client-{project_id}", plan_id=f"plan-{project_id}")


async def contracts(db):
    db.add_all([
        FactoryCoreObjectContract(id="site-content-version", sequence=28, label="Site content version", system_of_record="content", identity_rule="tenant", minimum_fields_json="[]", lifecycle_status="frozen", schema_version=1, revision=1),
        FactoryCoreEventContract(id="site-version-released", sequence=20, label="Site version released", subject_id="site-content-version", producer="content", consumers_json="[]", required_fields_json="[]", compatibility="backward", lifecycle_status="frozen", schema_version=1, revision=1),
    ])
    await db.flush()


def test_site_management_closes_controlled_content_release_with_consumer_receipt():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection: await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            await contracts(db); service = FactorySiteManagementService(db); tenant = context(701)
            site = await service.create_site(project_id=701, context=tenant, actor="site-owner", site_code="global", site_name="Global Factory Site", channel="official", default_locale="en-US", domain_reference="DOMAIN-701")
            version = await service.draft_version(site["id"], project_id=701, context=tenant, actor="author", locale="en-US", page_manifest={"pages": ["home", "products", "contact"]}, source_reference="CMS-701")
            with pytest.raises(ValueError, match="independent review"):
                await service.review_version(version["id"], project_id=701, actor="author", expected_revision=1, review_reference="SELF")
            version = await service.review_version(version["id"], project_id=701, actor="reviewer", expected_revision=1, review_reference="REVIEW-701")
            release = await service.prepare_publication(version["id"], project_id=701, context=tenant, actor="release-owner", target_environment="production", rollback_reference="ROLLBACK-701")
            with pytest.raises(ValueError, match="independent approval"):
                await service.approve_publication(release["id"], project_id=701, actor="release-owner", expected_revision=1, approval_reference="SELF")
            release = await service.approve_publication(release["id"], project_id=701, actor="approver", expected_revision=1, approval_reference="APPROVE-701")
            with pytest.raises(ValueError, match="separate handoff actor"):
                await service.acknowledge_publication(release["id"], project_id=701, actor="approver", expected_revision=2, consumer_receipt_reference="SELF")
            release = await service.acknowledge_publication(release["id"], project_id=701, actor="consumer-adapter", expected_revision=2, consumer_receipt_reference="RECEIPT-701")
            workspace = await service.workspace(project_id=701)
            assert release["available"] and workspace["availability"]["status"] == "available"
            assert workspace["contract"]["public_site_mutated_directly"] is False
            assert workspace["contract"]["registrar_secret_stored"] is False
            assert len(workspace["evidence"]) == 6
            assert (await service.workspace(project_id=702))["sites"] == []
        await engine.dispose()
    asyncio.run(scenario())


def test_site_management_rejects_tampered_or_stale_version():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection: await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            await contracts(db); service = FactorySiteManagementService(db); tenant = context(703)
            site = await service.create_site(project_id=703, context=tenant, actor="owner", site_code="brand", site_name="Brand Site", channel="brand", default_locale="zh-CN", domain_reference="DOMAIN-703")
            version = await service.draft_version(site["id"], project_id=703, context=tenant, actor="author", locale="zh-CN", page_manifest={"pages": ["home"]}, source_reference="CMS-703")
            stored = await service._get(FactorySiteContentVersion, version["id"], 703, "Version"); stored.page_manifest_json = {"pages": ["tampered"]}; await db.flush()
            with pytest.raises(ValueError, match="unchanged manifest"):
                await service.review_version(version["id"], project_id=703, actor="reviewer", expected_revision=1, review_reference="QA")
        await engine.dispose()
    asyncio.run(scenario())


def test_site_management_preserves_site_scoped_content_snapshot_for_review():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection: await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            await contracts(db); service = FactorySiteManagementService(db); tenant = context(704)
            site = await service.create_site(project_id=704, context=tenant, actor="owner", site_code="global", site_name="Global Factory Site", channel="official", default_locale="en-US", domain_reference="DOMAIN-704")
            manifest = {
                "schema_version": 1,
                "source": {"kind": "website-content-store", "scope": "site_56"},
                "pages": ["home", "products", "cases", "news", "videos", "blog", "company", "service", "contact"],
                "locales": ["en-US", "zh-CN"],
                "navigation_template": "global-b2b",
                "content_snapshot": {"profile": {"companyName": "Proof Factory"}, "navigation": {"items": [{"id": "products", "label": "Products"}]}},
            }
            version = await service.draft_version(site["id"], project_id=704, context=tenant, actor="author", locale="en-US", page_manifest=manifest, source_reference="website-content:site_56")
            assert version["source_reference"] == "website-content:site_56"
            stored = await service._get(FactorySiteContentVersion, version["id"], 704, "Version")
            assert stored.page_manifest_json == manifest
            reviewed = await service.review_version(version["id"], project_id=704, actor="reviewer", expected_revision=1, review_reference="REVIEW-704")
            assert reviewed["status"] == "reviewed"
        await engine.dispose()
    asyncio.run(scenario())


def test_website_build_program_requires_independent_gates_and_acknowledged_site_release():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection: await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            await contracts(db); service = FactorySiteManagementService(db); tenant = context(705)
            site = await service.create_site(project_id=705, context=tenant, actor="site-owner", site_code="overseas", site_name="Overseas Factory Site", channel="official", default_locale="en-US", domain_reference="DOMAIN-705")
            version = await service.draft_version(site["id"], project_id=705, context=tenant, actor="author", locale="en-US", page_manifest={"pages": ["home", "products", "contact"]}, source_reference="CMS-705")
            version = await service.review_version(version["id"], project_id=705, actor="reviewer", expected_revision=1, review_reference="REVIEW-705")
            publication = await service.prepare_publication(version["id"], project_id=705, context=tenant, actor="release-owner", target_environment="production", rollback_reference="ROLLBACK-705")
            publication = await service.approve_publication(publication["id"], project_id=705, actor="approver", expected_revision=1, approval_reference="APPROVE-705")
            publication = await service.acknowledge_publication(publication["id"], project_id=705, actor="consumer", expected_revision=2, consumer_receipt_reference="RECEIPT-705")
            program = await service.create_website_build_program(project_id=705, context=tenant, actor="planner", program_key="global-2026", program_name="Global B2B growth site", site_mode="hybrid", market_scope="dual", locales=["zh-CN", "en-US"], route_strategy="subdomain", brief={"audience": "industrial buyers", "value_proposition": "proof-led manufacturing", "conversion_goal": "qualified RFQ", "navigation_template": "global-b2b"})
            with pytest.raises(ValueError, match="independent verifier"):
                await service.verify_website_build_gate(program["id"], "brief", project_id=705, actor="planner", expected_revision=1, evidence_reference="SELF")
            program = await service.bind_website_build_site(program["id"], project_id=705, actor="planner", expected_revision=1, site_id=site["id"], reference="SITE-BIND-705")
            workspace = await service.workspace(project_id=705)
            for gate in workspace["website_build_gates"]:
                result = await service.verify_website_build_gate(program["id"], gate["gate_key"], project_id=705, actor="independent-verifier", expected_revision=gate["revision"], evidence_reference=f"EVIDENCE-{gate['gate_key']}")
                program = {key: value for key, value in result.items() if key != "gate"}
            with pytest.raises(ValueError, match="every configured locale"):
                await service.activate_website_build_program(program["id"], project_id=705, actor="operations-owner", expected_revision=program["revision"], site_publication_id=publication["id"], activation_reference="MISSING-ZH-CN")
            zh_version = await service.draft_version(site["id"], project_id=705, context=tenant, actor="zh-author", locale="zh-CN", page_manifest={"pages": ["home", "products", "contact"]}, source_reference="CMS-705-ZH")
            zh_version = await service.review_version(zh_version["id"], project_id=705, actor="zh-reviewer", expected_revision=1, review_reference="REVIEW-705-ZH")
            zh_publication = await service.prepare_publication(zh_version["id"], project_id=705, context=tenant, actor="zh-release-owner", target_environment="production", rollback_reference="ROLLBACK-705-ZH")
            zh_publication = await service.approve_publication(zh_publication["id"], project_id=705, actor="zh-approver", expected_revision=1, approval_reference="APPROVE-705-ZH")
            zh_publication = await service.acknowledge_publication(zh_publication["id"], project_id=705, actor="zh-consumer", expected_revision=2, consumer_receipt_reference="RECEIPT-705-ZH")
            with pytest.raises(ValueError, match="separate activation actor"):
                await service.activate_website_build_program(program["id"], project_id=705, actor="planner", expected_revision=program["revision"], site_publication_id=publication["id"], activation_reference="SELF")
            program = await service.activate_website_build_program(program["id"], project_id=705, actor="operations-owner", expected_revision=program["revision"], site_publication_id=publication["id"], activation_reference="OPERATE-705")
            workspace = await service.workspace(project_id=705)
            assert program["status"] == "available" and workspace["metrics"]["website_build_ready"] == 1
            assert workspace["contract"]["website_build_requires_site_receipt"] is True
            assert (await service.workspace(project_id=706))["website_build_programs"] == []
        await engine.dispose()
    asyncio.run(scenario())
