import asyncio
import json

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import models  # noqa: F401
from core.database import Base
from models.platform import Organization, PlanRuntimeConfig, Project
from models.template_snapshot import TemplateSnapshotInstance, TemplateSnapshotTemplate
from services.tenant_governance import TenantQuotaExceeded, ensure_creation_capacity, normalize_quota_limits, tenant_health_report


def test_quota_limits_accept_only_supported_bounded_values():
    assert normalize_quota_limits({"clients": 25, "plans": "4"}) == {"clients": 25, "plans": 4}
    with pytest.raises(ValueError, match="Unsupported quota"):
        normalize_quota_limits({"unknown": 1})
    with pytest.raises(ValueError, match="out of range"):
        normalize_quota_limits({"plans": -1})


def test_tenant_governance_enforces_direct_child_quota_and_reports_runtime_integrity():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        session_factory = async_sessionmaker(engine, expire_on_commit=False)
        async with session_factory() as db:
            hq = Organization(name="HQ", code="HQ", org_type="hq", status="active", lineage_path="1", settings_json=json.dumps({"quotaLimits": {"agencies": 1}}))
            db.add(hq)
            await db.flush()
            hq.lineage_path = str(hq.id)
            await ensure_creation_capacity(db, parent=hq, organization_type="agency")
            agency = Organization(name="Agency", code="A01", org_type="agency", parent_id=hq.id, root_org_id=hq.id, root_agency_id=None, agent_level=1, status="active", lineage_path=f"{hq.id}")
            db.add(agency)
            await db.flush()
            agency.root_agency_id, agency.lineage_path = agency.id, f"{hq.id}/{agency.id}"
            with pytest.raises(TenantQuotaExceeded, match="agencies quota reached"):
                await ensure_creation_capacity(db, parent=hq, organization_type="agency")

            client = Organization(name="Client", code="C01", org_type="client", parent_id=agency.id, root_org_id=hq.id, root_agency_id=agency.id, status="active", lineage_path=f"{hq.id}/{agency.id}")
            db.add(client)
            await db.flush()
            client.lineage_path = f"{hq.id}/{agency.id}/{client.id}"
            project = Project(client_org_id=client.id, name="Plan", code="P01", status="active")
            db.add(project)
            await db.flush()
            db.add_all([
                PlanRuntimeConfig(project_id=project.id),
                TemplateSnapshotTemplate(template_id="agency-source-global", template_type="hq-agent", owner_scope="agency_source", name="Agency source", latest_version="v1", config_json="{}", is_published=True),
                TemplateSnapshotTemplate(template_id="client-source-global", template_type="hq-client", owner_scope="client_source", name="Client source", latest_version="v1", config_json="{}", is_published=True),
                TemplateSnapshotInstance(instance_id="agency-runtime-A01", instance_type="agency", owner_scope="agency", organization_id=agency.id, name="Agency", base_template_id="agency-source-global", base_template_version="v1", snapshot_config_json="{}"),
                TemplateSnapshotInstance(instance_id="client-plan:P01", instance_type="client-plan", owner_scope="client", organization_id=client.id, project_id=project.id, name="Plan", base_template_id="client-source-global", base_template_version="v1", snapshot_config_json="{}"),
            ])
            await db.commit()

            report = await tenant_health_report(db)
            assert report["status"] == "healthy"
            assert report["totals"]["projects"] == 1

            client.lineage_path = f"{hq.id}/{client.id}"
            await db.commit()
            report = await tenant_health_report(db, organization_id=hq.id)
            assert report["status"] == "unhealthy"
            assert any(item["code"] == "organization.lineage.mismatch" for item in report["findings"])
        await engine.dispose()

    asyncio.run(scenario())
