"""Database-backed tenant and plan authorization helpers."""

from __future__ import annotations

from dataclasses import dataclass
import json

from core.tenant_context import TenantContext, build_tenant_context
from fastapi import HTTPException, status
from models.platform import Membership, Organization, Project
from schemas.auth import UserResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


@dataclass(frozen=True)
class ResolvedProjectContext:
    project: Project
    client: Organization
    context: TenantContext
    ancestor_org_ids: tuple[int, ...]


async def resolve_project_context(db: AsyncSession, project_id: int) -> ResolvedProjectContext:
    project = await db.scalar(select(Project).where(Project.id == project_id, Project.status == "active"))
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Active plan not found")
    client = await db.scalar(select(Organization).where(Organization.id == project.client_org_id, Organization.org_type == "client"))
    if not client:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Plan has no valid client owner")

    lineage = tuple(int(token) for token in (client.lineage_path or "").split("/") if token.isdigit())
    # Membership at the client organization must authorize its own plans as well
    # as memberships inherited from headquarters/agency ancestors.  Lineage stores
    # ancestors only, so append the current client without admitting siblings.
    ancestor_ids = tuple(dict.fromkeys((*lineage, client.id))) if lineage else (client.id,)
    agent_path = "/".join(f"org-{org_id}" for org_id in ancestor_ids)
    context = build_tenant_context(
        agent_path=agent_path,
        tenant_id=f"tenant-{client.root_org_id or ancestor_ids[0]}",
        client_id=f"client-{client.id}",
        plan_id=f"plan-{project.id}",
    )
    return ResolvedProjectContext(project=project, client=client, context=context, ancestor_org_ids=ancestor_ids)


async def require_project_access(
    db: AsyncSession, *, current_user: UserResponse, project_id: int
) -> ResolvedProjectContext:
    resolved = await resolve_project_context(db, project_id)
    if current_user.role == "admin":
        return resolved

    membership = await db.scalar(
        select(Membership).where(
            Membership.user_id == current_user.id,
            Membership.status == "active",
            (Membership.project_id == project_id)
            | ((Membership.project_id.is_(None)) & (Membership.org_id.in_(resolved.ancestor_org_ids))),
        )
    )
    if not membership:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No access to this tenant plan")
    return resolved


async def require_project_permission(
    db: AsyncSession, *, current_user: UserResponse, project_id: int, permission: str
) -> ResolvedProjectContext:
    """Require an explicit role permission inside an already authorized plan.

    Headquarters administrators retain platform-wide break-glass access. Other
    users must have an active plan membership or inherited organization
    membership whose role grants the exact permission (or ``platform.*``).
    """
    resolved = await require_project_access(db, current_user=current_user, project_id=project_id)
    if current_user.role == "admin":
        return resolved

    memberships = (
        await db.execute(
            select(Membership).where(
                Membership.user_id == current_user.id,
                Membership.status == "active",
                (Membership.project_id == project_id)
                | ((Membership.project_id.is_(None)) & (Membership.org_id.in_(resolved.ancestor_org_ids))),
            )
        )
    ).scalars().all()
    role_ids = {membership.role_id for membership in memberships if membership.role_id is not None}
    if not role_ids:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No role grants this tenant operation")

    from models.platform import Role

    roles = (await db.execute(select(Role).where(Role.id.in_(role_ids)))).scalars().all()
    permissions: set[str] = set()
    for role in roles:
        try:
            values = json.loads(role.permissions_json or "[]")
        except json.JSONDecodeError:
            values = []
        if isinstance(values, list):
            permissions.update(str(value) for value in values)
    if "platform.*" not in permissions and permission not in permissions:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Role does not grant this tenant operation")
    return resolved


def _lineage_ids(org: Organization) -> tuple[int, ...]:
    lineage = tuple(int(token) for token in (org.lineage_path or "").split("/") if token.isdigit())
    return lineage or (org.id,)


async def visible_organization_ids(db: AsyncSession, *, current_user: UserResponse) -> set[int]:
    """Return the current user's organization roots plus every descendant.

    Memberships are intentionally evaluated from the database rather than from a
    client-supplied organization id.  An agency membership can see its downstream
    agencies and clients, while a client membership cannot see sibling tenants.
    """
    organizations = (await db.execute(select(Organization))).scalars().all()
    if current_user.role == "admin":
        return {organization.id for organization in organizations}

    memberships = (
        await db.execute(
            select(Membership).where(
                Membership.user_id == current_user.id,
                Membership.status == "active",
            )
        )
    ).scalars().all()
    organization_roots = {membership.org_id for membership in memberships if membership.project_id is None}
    project_scoped_org_ids = {membership.org_id for membership in memberships if membership.project_id is not None}

    return {
        organization.id
        for organization in organizations
        if organization.id in project_scoped_org_ids
        or organization.id in organization_roots
        or bool(organization_roots.intersection(_lineage_ids(organization)))
    }


async def visible_project_ids(db: AsyncSession, *, current_user: UserResponse) -> set[int]:
    """Return only plans allowed by organization-wide or plan-specific membership."""
    projects = (await db.execute(select(Project))).scalars().all()
    if current_user.role == "admin":
        return {project.id for project in projects}

    memberships = (
        await db.execute(
            select(Membership).where(
                Membership.user_id == current_user.id,
                Membership.status == "active",
            )
        )
    ).scalars().all()
    direct_project_ids = {membership.project_id for membership in memberships if membership.project_id is not None}
    organization_scope_ids = await visible_organization_ids(db, current_user=current_user)
    organization_wide_roots = {membership.org_id for membership in memberships if membership.project_id is None}

    return {
        project.id
        for project in projects
        if project.id in direct_project_ids
        or (
            project.client_org_id in organization_scope_ids
            and any(root_id in organization_scope_ids for root_id in organization_wide_roots)
        )
    }


async def require_organization_access(
    db: AsyncSession, *, current_user: UserResponse, organization_id: int
) -> Organization:
    organization = await db.scalar(select(Organization).where(Organization.id == organization_id))
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    if organization.id not in await visible_organization_ids(db, current_user=current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No access to this tenant organization")
    return organization


async def require_organization_permission(
    db: AsyncSession, *, current_user: UserResponse, organization_id: int, permission: str
) -> Organization:
    """Require a role permission inherited from the target organization's lineage."""
    organization = await require_organization_access(db, current_user=current_user, organization_id=organization_id)
    if current_user.role == "admin":
        return organization
    eligible_org_ids = _lineage_ids(organization)
    memberships = (
        await db.execute(
            select(Membership).where(
                Membership.user_id == current_user.id,
                Membership.status == "active",
                Membership.project_id.is_(None),
                Membership.org_id.in_(eligible_org_ids),
            )
        )
    ).scalars().all()
    if not memberships:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No permission for this tenant operation")

    from models.platform import Role

    role_ids = {membership.role_id for membership in memberships if membership.role_id is not None}
    roles = (await db.execute(select(Role).where(Role.id.in_(role_ids)))).scalars().all() if role_ids else []
    permissions: set[str] = set()
    for role in roles:
        try:
            values = json.loads(role.permissions_json or "[]")
        except json.JSONDecodeError:
            values = []
        if isinstance(values, list):
            permissions.update(str(value) for value in values)
    if "platform.*" not in permissions and permission not in permissions:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Role does not grant this tenant operation")
    return organization


async def require_global_platform_access(*, current_user: UserResponse) -> None:
    """Reserve cross-tenant platform configuration for headquarters administrators."""
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Headquarters administrator access required")
