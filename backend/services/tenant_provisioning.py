"""Transactional client-plan provisioning from an approved agency context."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
import json

from models.platform import Organization, PlanRuntimeConfig, Project
from models.template_snapshot import TemplateSnapshotInstance, TemplateSnapshotTemplate, TemplateSnapshotVersion
from services.organization_roles import ensure_default_roles
from services.product_market_factory_default import resolve_product_market_runtime_default
from services.template_instance_identity import (
    client_plan_runtime_instance_id,
    is_canonical_client_plan_runtime_instance_id,
)
from services.template_snapshot import TemplateSnapshotService, load_template_version_release_sections
from services.tenant_governance import ensure_creation_capacity
from sqlalchemy import inspect as sqlalchemy_inspect, select
from sqlalchemy.ext.asyncio import AsyncSession


AGENCY_SOURCE_TEMPLATE_ID = "agency-source-global"
CLIENT_SOURCE_TEMPLATE_ID = "client-source-global"

def agency_runtime_instance_id(agency_code: str) -> str:
    return f"agency-runtime-{agency_code.strip().upper()}"


def _persisted_identity_id(resource: object) -> int | None:
    identity = sqlalchemy_inspect(resource).identity
    return int(identity[0]) if identity and identity[0] is not None else None


async def provision_agency_runtime_template(db: AsyncSession, *, agency: Organization) -> str:
    """Create the canonical agency runtime record as part of tenant provisioning.

    The record is created even before headquarters publishes its first source
    version.  This makes a later rollout include every eligible level-one,
    level-two and level-three agency without relying on a browser to create a
    tenant-bound record on its behalf.
    """
    if agency.org_type not in {"agency", "sub_agency"}:
        raise ValueError("agency runtime provisioning requires an agency organization")

    instance_id = agency_runtime_instance_id(agency.code)
    existing = await db.scalar(select(TemplateSnapshotInstance).where(TemplateSnapshotInstance.instance_id == instance_id))
    if existing:
        return existing.instance_id

    template = await db.scalar(
        select(TemplateSnapshotTemplate).where(
            TemplateSnapshotTemplate.template_id == AGENCY_SOURCE_TEMPLATE_ID,
            TemplateSnapshotTemplate.is_published.is_(True),
        )
    )
    instance_type = "agency" if agency.agent_level == 1 else "sub-agency" if agency.agent_level == 2 else "third-agency"
    parent_id = "hq:HQ" if agency.agent_level == 1 else agency_runtime_instance_id(str(agency.parent_id or "HQ"))
    # The parent is only descriptive lineage.  The database organization_id is
    # the authoritative tenancy boundary and is never inferred from it.
    if agency.parent_id and agency.agent_level and agency.agent_level > 1:
        parent = await db.scalar(select(Organization).where(Organization.id == agency.parent_id))
        parent_id = agency_runtime_instance_id(parent.code) if parent else parent_id
    db.add(
        TemplateSnapshotInstance(
            instance_id=instance_id,
            instance_type=instance_type,
            owner_scope="agency",
            owner_id=agency.code,
            organization_id=agency.id,
            parent_id=parent_id,
            name=f"{agency.name} agency runtime",
            base_template_id=AGENCY_SOURCE_TEMPLATE_ID,
            base_template_version=template.latest_version if template else None,
            snapshot_config_json=template.config_json if template else "{}",
            override_config_json="{}",
            last_synced_at=datetime.now(timezone.utc) if template else None,
        )
    )
    return instance_id


@dataclass(frozen=True)
class ProvisionedPlan:
    client_org_id: int
    project_id: int
    deployment_id: str
    database_id: str
    template_instance_id: str | None


async def provision_plan_runtime_and_template(
    db: AsyncSession,
    *,
    client: Organization,
    project: Project,
    deployment_id: str = "shared-stamp-a",
    database_id: str = "shared-client-db-a",
    template_id: str = CLIENT_SOURCE_TEMPLATE_ID,
) -> str | None:
    """Attach one plan to its runtime stamp and the latest approved customer source."""
    client_id = _persisted_identity_id(client)
    project_id = _persisted_identity_id(project)
    if client_id is None or project_id is None:
        raise ValueError("Client plan runtime provisioning requires a persisted client organization")
    persisted_client = await db.scalar(
        select(Organization).where(Organization.id == client_id).with_for_update()
    )
    persisted_project = await db.scalar(
        select(Project).where(Project.id == project_id).with_for_update()
    )
    if not persisted_client or persisted_client.org_type != "client":
        raise ValueError("Client plan runtime provisioning requires a persisted client organization")
    if not persisted_project or persisted_project.client_org_id != persisted_client.id:
        raise ValueError("Client plan runtime project does not belong to the requested client organization")
    client, project = persisted_client, persisted_project
    template = await db.scalar(
        select(TemplateSnapshotTemplate).where(
            TemplateSnapshotTemplate.template_id == template_id,
            TemplateSnapshotTemplate.is_published.is_(True),
        ).with_for_update()
    )
    if not template:
        raise ValueError("An active client plan requires a published client-source template")
    runtime_template_version, runtime_template_config = await resolve_product_market_runtime_default(db, template)
    if not runtime_template_version:
        raise ValueError("An active client plan requires a resolved immutable client-source version")
    runtime_template_record = await db.scalar(
        select(TemplateSnapshotVersion).where(
            TemplateSnapshotVersion.template_id == template_id,
            TemplateSnapshotVersion.version == runtime_template_version,
            TemplateSnapshotVersion.review_status.in_(("published", "archived")),
        )
    )
    if not runtime_template_record or load_template_version_release_sections(
        runtime_template_record.release_sections_json
    ):
        raise ValueError("An active client plan requires a full immutable client-source baseline")
    runtime = await db.scalar(select(PlanRuntimeConfig).where(PlanRuntimeConfig.project_id == project.id))
    if not runtime:
        runtime = PlanRuntimeConfig(
            project_id=project.id,
            deployment_id=deployment_id.strip(),
            database_id=database_id.strip(),
            base_client_version="0.1.0",
            template_version="0.1.0",
            enabled_modules_json=json.dumps(["00-product-market", "02-content"], ensure_ascii=False),
            overrides_json=json.dumps({"content_download": False}, ensure_ascii=False),
            status="active",
        )
        db.add(runtime)
    instance_id = client_plan_runtime_instance_id(
        project.code,
        organization_id=client.id,
        project_id=project.id,
    )
    project_instances = (
        await db.execute(
            select(TemplateSnapshotInstance).where(
                TemplateSnapshotInstance.project_id == project.id,
                TemplateSnapshotInstance.base_template_id == template_id,
                TemplateSnapshotInstance.is_detached.is_(False),
            )
        )
    ).scalars().all()
    if len(project_instances) > 1:
        raise ValueError("client plan has multiple active runtime template instances")
    existing = project_instances[0] if project_instances else None
    if not existing:
        scoped_collision = await db.scalar(
            select(TemplateSnapshotInstance).where(TemplateSnapshotInstance.instance_id == instance_id)
        )
        if scoped_collision:
            raise ValueError("client plan runtime instance ID is already bound to a different tenant or plan")
    if existing:
        if (
            not is_canonical_client_plan_runtime_instance_id(
                existing.instance_id,
                plan_code=project.code,
                organization_id=client.id,
                project_id=project.id,
            )
            or existing.instance_type != "client-plan"
            or existing.owner_scope != "client"
            or existing.owner_id != project.code
            or existing.organization_id != client.id
            or existing.project_id != project.id
            or existing.base_template_id != template_id
        ):
            raise ValueError("client plan runtime instance ID is already bound to a different tenant or plan")
        baseline = await db.scalar(
            select(TemplateSnapshotVersion).where(
                TemplateSnapshotVersion.template_id == template_id,
                TemplateSnapshotVersion.version == existing.base_template_version,
                TemplateSnapshotVersion.review_status.in_(("published", "archived")),
            )
        ) if existing.base_template_version else None
        if not baseline:
            raise ValueError("client plan runtime instance has no valid immutable template baseline")
        if existing.base_template_version != runtime_template_version:
            await TemplateSnapshotService(db).sync_latest(
                existing.instance_id,
                {
                    "sync_mode": "merge",
                    "create_backup": True,
                    "operator": "tenant-provisioning",
                    "template_version": runtime_template_version,
                    "expected_template_id": template_id,
                    "expected_owner_scope": "client",
                    "expected_organization_id": client.id,
                    "expected_project_id": project.id,
                },
                commit=False,
            )
        runtime.template_version = runtime_template_version
        return existing.instance_id
    db.add(
        TemplateSnapshotInstance(
            instance_id=instance_id,
            instance_type="client-plan",
            owner_scope="client",
            owner_id=project.code,
            organization_id=client.id,
            project_id=project.id,
            parent_id=f"client:{client.code}",
            name=f"{client.name} · {project.name} 客户计划运行实例",
            base_template_id=template_id,
            base_template_version=runtime_template_version,
            snapshot_config_json=runtime_template_config,
            override_config_json="{}",
            last_synced_at=datetime.now(timezone.utc),
        )
    )
    runtime.template_version = runtime_template_version
    return instance_id


async def provision_plan_activation_set(
    db: AsyncSession,
    *,
    client: Organization,
    projects: list[Project],
    max_attempts: int = 2,
) -> str | None:
    """Provision a resurrection set and verify one factory baseline under lock.

    The helper deliberately does not commit.  The route owns the transaction
    that also flips the organization or project status to active.
    """
    if not projects:
        return None
    client_id = _persisted_identity_id(client)
    requested_project_ids = [_persisted_identity_id(project) for project in projects]
    if client_id is None or any(project_id is None for project_id in requested_project_ids):
        raise ValueError("Client plan activation requires a persisted client organization")
    persisted_client = await db.scalar(
        select(Organization).where(Organization.id == client_id).with_for_update()
    )
    persisted_projects = (
        await db.execute(
            select(Project)
            .where(Project.id.in_(requested_project_ids))
            .with_for_update()
        )
    ).scalars().all()
    projects_by_id = {project.id: project for project in persisted_projects}
    if not persisted_client or persisted_client.org_type != "client":
        raise ValueError("Client plan activation requires a persisted client organization")
    if (
        len(projects_by_id) != len(requested_project_ids)
        or any(projects_by_id[project_id].client_org_id != persisted_client.id for project_id in requested_project_ids)
    ):
        raise ValueError("Client plan activation project does not belong to the requested client organization")
    client = persisted_client
    projects = [projects_by_id[project_id] for project_id in requested_project_ids]
    if max_attempts < 1:
        raise ValueError("Client plan activation requires at least one consistency attempt")
    project_ids = {project.id for project in projects}
    if None in project_ids or len(project_ids) != len(projects):
        raise ValueError("Client plan activation requires distinct persisted projects")

    for _attempt in range(max_attempts):
        for project in projects:
            await provision_plan_runtime_and_template(db, client=client, project=project)
        await db.flush()

        template = await db.scalar(
            select(TemplateSnapshotTemplate)
            .where(
                TemplateSnapshotTemplate.template_id == CLIENT_SOURCE_TEMPLATE_ID,
                TemplateSnapshotTemplate.is_published.is_(True),
            )
            .execution_options(populate_existing=True)
            .with_for_update()
        )
        if not template:
            raise ValueError("An active client plan requires a published client-source template")
        confirmed_version, _config = await resolve_product_market_runtime_default(db, template)
        if not confirmed_version:
            raise ValueError("An active client plan requires a confirmed client-source factory default")

        instances = (
            await db.execute(
                select(TemplateSnapshotInstance)
                .where(TemplateSnapshotInstance.project_id.in_(project_ids))
                .with_for_update()
            )
        ).scalars().all()
        canonical = (
            len(instances) == len(projects)
            and {instance.project_id for instance in instances} == project_ids
            and all(
                is_canonical_client_plan_runtime_instance_id(
                    instance.instance_id,
                    plan_code=project.code,
                    organization_id=client.id,
                    project_id=project.id,
                )
                and instance.instance_type == "client-plan"
                and instance.owner_scope == "client"
                and instance.owner_id == project.code
                and instance.organization_id == client.id
                and instance.base_template_id == CLIENT_SOURCE_TEMPLATE_ID
                and instance.base_template_version == confirmed_version
                for project in projects
                for instance in instances
                if instance.project_id == project.id
            )
        )
        if canonical:
            return confirmed_version

    raise ValueError("Client plan activation could not stabilize on one confirmed factory default")


async def provision_client_plan(
    db: AsyncSession,
    *,
    agency_org_id: int,
    client_name: str,
    client_code: str,
    plan_name: str,
    plan_code: str,
    deployment_id: str = "shared-stamp-a",
    database_id: str = "shared-client-db-a",
) -> ProvisionedPlan:
    agency = await db.scalar(select(Organization).where(Organization.id == agency_org_id, Organization.status == "active"))
    if not agency or agency.org_type not in {"hq", "agency", "sub_agency"}:
        raise ValueError("active headquarters or agency is required")
    await ensure_creation_capacity(db, parent=agency, organization_type="client")
    if await db.scalar(select(Organization).where(Organization.code == client_code.strip())):
        raise ValueError("client code already exists")
    normalized_client_code = client_code.strip().upper()
    normalized_plan_code = plan_code.strip().upper()
    client = Organization(
        name=client_name.strip(), code=normalized_client_code, org_type="client", parent_id=agency.id,
        root_org_id=agency.root_org_id or agency.id, root_agency_id=agency.root_agency_id or (agency.id if agency.org_type != "hq" else None),
        agent_level=None,
        # ``agency.lineage_path`` already ends at the direct parent.  Appending
        # the parent a second time used to create a malformed path such as
        # ``hq/agency/agency/client`` and weakened descendant authorization.
        lineage_path=agency.lineage_path or str(agency.id),
        status="active",
    )
    db.add(client)
    await db.flush()
    client.lineage_path = "/".join(token for token in ((agency.lineage_path or str(agency.id)), str(client.id)) if token)
    client.settings_json = json.dumps(
        {
            "parentCode": agency.code,
            "rootOrgId": client.root_org_id,
            "rootAgencyId": client.root_agency_id,
            "lineagePath": client.lineage_path,
        },
        ensure_ascii=False,
    )
    await ensure_default_roles(db, client)
    await ensure_creation_capacity(db, parent=client, project=True)
    if await db.scalar(select(Project).where(Project.client_org_id == client.id, Project.code == normalized_plan_code)):
        raise ValueError("plan code already exists for client")
    project = Project(client_org_id=client.id, name=plan_name.strip(), code=normalized_plan_code, status="active")
    db.add(project)
    await db.flush()
    template_instance_id = await provision_plan_runtime_and_template(
        db,
        client=client,
        project=project,
        deployment_id=deployment_id,
        database_id=database_id,
    )
    runtime = await db.scalar(select(PlanRuntimeConfig).where(PlanRuntimeConfig.project_id == project.id))
    await db.flush()
    return ProvisionedPlan(
        client_org_id=client.id,
        project_id=project.id,
        deployment_id=runtime.deployment_id if runtime else deployment_id,
        database_id=runtime.database_id if runtime else database_id,
        template_instance_id=template_instance_id,
    )
