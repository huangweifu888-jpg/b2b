"""Quota enforcement and integrity reporting for the multi-tenant hierarchy.

The limits live in the owning organization ``settings_json`` under
``quotaLimits`` so commercial packages can change them without a schema
migration.  A safe default applies when a package has not yet been configured.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
import json
from typing import Iterable

from models.platform import Organization, PlanRuntimeConfig, Project
from models.template_snapshot import TemplateSnapshotInstance, TemplateSnapshotTemplate
from services.quota_controls import evaluate_quota
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession


DEFAULT_QUOTA_LIMITS = {
    "agencies": 100,
    "sub_agencies": 100,
    "clients": 1_000,
    "plans": 1_000,
}
RESOURCE_BY_ORGANIZATION_TYPE = {
    "agency": "agencies",
    "sub_agency": "sub_agencies",
    "client": "clients",
}


class TenantQuotaExceeded(ValueError):
    def __init__(self, resource: str, used: int, limit: int):
        super().__init__(f"{resource} quota reached ({used}/{limit})")
        self.resource, self.used, self.limit = resource, used, limit


@dataclass(frozen=True)
class TenantQuotaStatus:
    resource: str
    used: int
    limit: int
    status: str


def _settings(value: str | None) -> dict[str, object]:
    try:
        result = json.loads(value or "{}")
    except json.JSONDecodeError:
        return {}
    return result if isinstance(result, dict) else {}


def quota_limit(owner: Organization, resource: str) -> int:
    configured = _settings(owner.settings_json).get("quotaLimits")
    raw = configured.get(resource) if isinstance(configured, dict) else None
    try:
        value = int(raw)
    except (TypeError, ValueError):
        value = DEFAULT_QUOTA_LIMITS[resource]
    return max(0, value)


def normalize_quota_limits(value: object) -> dict[str, int]:
    """Validate a package limit map before it is stored in tenant settings."""
    if not isinstance(value, dict):
        raise ValueError("quota_limits must be an object")
    unknown = set(value).difference(DEFAULT_QUOTA_LIMITS)
    if unknown:
        raise ValueError(f"Unsupported quota resources: {', '.join(sorted(unknown))}")
    normalized: dict[str, int] = {}
    for resource, raw in value.items():
        if isinstance(raw, bool):
            raise ValueError(f"Invalid quota for {resource}")
        try:
            limit = int(raw)
        except (TypeError, ValueError) as exc:
            raise ValueError(f"Invalid quota for {resource}") from exc
        if not 0 <= limit <= 1_000_000:
            raise ValueError(f"Quota out of range for {resource}")
        normalized[resource] = limit
    return normalized


async def quota_status(db: AsyncSession, *, owner: Organization, resource: str) -> TenantQuotaStatus:
    if resource not in DEFAULT_QUOTA_LIMITS:
        raise ValueError(f"Unsupported tenant quota resource: {resource}")
    if resource == "plans":
        used = await db.scalar(select(func.count()).select_from(Project).where(Project.client_org_id == owner.id))
    else:
        child_type = "agency" if resource == "agencies" else "sub_agency" if resource == "sub_agencies" else "client"
        used = await db.scalar(
            select(func.count()).select_from(Organization).where(
                Organization.parent_id == owner.id,
                Organization.org_type == child_type,
            )
        )
    decision = evaluate_quota(resource, used=int(used or 0), limit=quota_limit(owner, resource))
    return TenantQuotaStatus(resource=resource, used=decision.used, limit=decision.limit, status=decision.status)


async def ensure_creation_capacity(db: AsyncSession, *, parent: Organization, organization_type: str | None = None, project: bool = False) -> TenantQuotaStatus:
    if project:
        resource = "plans"
    elif organization_type in RESOURCE_BY_ORGANIZATION_TYPE:
        resource = RESOURCE_BY_ORGANIZATION_TYPE[organization_type]
    else:
        raise ValueError("Unsupported tenant creation type")
    result = await quota_status(db, owner=parent, resource=resource)
    if result.status == "blocked":
        raise TenantQuotaExceeded(result.resource, result.used, result.limit)
    return result


def _lineage_ids(value: str | None) -> tuple[int, ...]:
    return tuple(int(token) for token in (value or "").split("/") if token.isdigit())


def _expected_lineage(org: Organization, by_id: dict[int, Organization]) -> tuple[int, ...] | None:
    path: list[int] = []
    current = org
    seen: set[int] = set()
    while current:
        if current.id in seen:
            return None
        seen.add(current.id)
        path.append(current.id)
        if current.parent_id is None:
            return tuple(reversed(path))
        current = by_id.get(current.parent_id)
        if current is None:
            return None
    return None


def _finding(code: str, severity: str, subject_type: str, subject_id: int | str, detail: str) -> dict[str, object]:
    return {"code": code, "severity": severity, "subject_type": subject_type, "subject_id": str(subject_id), "detail": detail}


async def tenant_health_report(db: AsyncSession, *, organization_id: int | None = None, max_findings: int = 200) -> dict[str, object]:
    """Read-only consistency report scoped to an organization and descendants."""
    all_organizations = (await db.execute(select(Organization))).scalars().all()
    by_id = {org.id: org for org in all_organizations}
    if organization_id is not None and organization_id not in by_id:
        raise KeyError("Organization not found")
    organizations = [
        org for org in all_organizations
        if organization_id is None or org.id == organization_id or organization_id in _lineage_ids(org.lineage_path)
    ]
    organization_ids = {org.id for org in organizations}
    projects = (await db.execute(select(Project).where(Project.client_org_id.in_(organization_ids)))).scalars().all() if organization_ids else []
    project_ids = {project.id for project in projects}
    runtimes = (await db.execute(select(PlanRuntimeConfig).where(PlanRuntimeConfig.project_id.in_(project_ids)))).scalars().all() if project_ids else []
    instances = (await db.execute(select(TemplateSnapshotInstance).where(TemplateSnapshotInstance.organization_id.in_(organization_ids)))).scalars().all() if organization_ids else []
    findings: list[dict[str, object]] = []

    for org in organizations:
        expected = _expected_lineage(org, by_id)
        if expected is None:
            findings.append(_finding("organization.parent.invalid", "error", "organization", org.id, "Parent chain is missing or cyclic"))
            continue
        if _lineage_ids(org.lineage_path) != expected:
            findings.append(_finding("organization.lineage.mismatch", "error", "organization", org.id, "lineage_path does not match the parent chain"))
        parent = by_id.get(org.parent_id) if org.parent_id else None
        if org.org_type == "agency" and (not parent or parent.org_type != "hq" or org.agent_level != 1 or org.root_agency_id != org.id):
            findings.append(_finding("agency.level1.invalid", "error", "organization", org.id, "Level-one agency must belong to HQ and be its own root agency"))
        if org.org_type == "sub_agency":
            expected_level = (parent.agent_level + 1) if parent and parent.agent_level else None
            if not parent or parent.org_type not in {"agency", "sub_agency"} or expected_level not in {2, 3} or org.agent_level != expected_level:
                findings.append(_finding("agency.level.invalid", "error", "organization", org.id, "Sub-agency level must be exactly one below an agency parent"))
        if org.org_type == "client" and (not parent or parent.org_type not in {"agency", "sub_agency"}):
            findings.append(_finding("client.parent.invalid", "error", "organization", org.id, "Client must belong directly to an agency"))

    runtime_project_ids = {runtime.project_id for runtime in runtimes}
    client_instance_project_ids = {
        instance.project_id for instance in instances
        if instance.owner_scope == "client" and instance.base_template_id == "client-source-global" and instance.project_id is not None
    }
    for project in projects:
        if project.id not in runtime_project_ids:
            findings.append(_finding("plan.runtime.missing", "error", "project", project.id, "Plan has no runtime configuration"))
        if project.id not in client_instance_project_ids:
            findings.append(_finding("plan.template_instance.missing", "error", "project", project.id, "Plan has no client-source runtime instance"))
    agency_instance_org_ids = {instance.organization_id for instance in instances if instance.owner_scope == "agency" and instance.base_template_id == "agency-source-global"}
    for org in organizations:
        if org.org_type in {"agency", "sub_agency"} and org.id not in agency_instance_org_ids:
            findings.append(_finding("agency.template_instance.missing", "error", "organization", org.id, "Agency has no agency-source runtime instance"))

    for template_id in ("agency-source-global", "client-source-global"):
        template = await db.scalar(select(TemplateSnapshotTemplate).where(TemplateSnapshotTemplate.template_id == template_id))
        if not template or not template.is_published or not template.latest_version:
            findings.append(_finding("source_template.unpublished", "error", "template", template_id, "Required source template is not published"))

    trimmed = findings[:max_findings]
    severity_counts = {level: sum(item["severity"] == level for item in findings) for level in ("error", "warning")}
    return {
        "status": "healthy" if not findings else "unhealthy",
        "scope_organization_id": organization_id,
        "totals": {"organizations": len(organizations), "projects": len(projects), "runtime_configs": len(runtimes), "template_instances": len(instances)},
        "findings": trimmed,
        "finding_counts": {**severity_counts, "reported": len(trimmed), "total": len(findings)},
    }


def serialize_quota_statuses(statuses: Iterable[TenantQuotaStatus]) -> list[dict[str, object]]:
    return [asdict(item) for item in statuses]
