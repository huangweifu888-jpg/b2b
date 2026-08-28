from datetime import datetime
import json
import re
from typing import Optional

from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from models.auth import User
from models.platform import AIAppAssignment, AIProviderConfig, AuditLog, DataBackup, LocalAccount, Membership, MembershipInvite, Organization, Project, Role
from models.template_snapshot import TemplateSnapshotTemplate
from routers.local_dev import _normalize_published_sites, _read_sites_store, _write_sites_store
from services.aihub import AIHubService
from services.audit import record_audit_event
from services.membership_invites import create_membership_invite
from services.organization_roles import TENANT_MEMBER_MANAGE, ensure_default_roles
from services.tenant_provisioning import (
    provision_agency_runtime_template,
    provision_plan_activation_set,
    provision_plan_runtime_and_template,
)
from services.tenant_governance import (
    TenantQuotaExceeded,
    ensure_creation_capacity,
    normalize_quota_limits,
    quota_status,
    serialize_quota_statuses,
    tenant_health_report,
)
from services.tenant_access import (
    require_global_platform_access,
    require_organization_access,
    require_organization_permission,
    require_project_access,
    visible_organization_ids,
    visible_project_ids,
)
from schemas.auth import UserResponse

router = APIRouter(
    prefix="/api/v1/platform",
    tags=["platform"],
    # Every platform route must have an authenticated identity. Individual
    # handlers additionally narrow that identity to a tenant or HQ scope.
    dependencies=[Depends(get_current_user)],
)


class OrganizationCreate(BaseModel):
    name: str
    org_type: str
    code: Optional[str] = None
    parent_id: Optional[int] = None
    commission_mode: Optional[str] = None
    commission_rate: Optional[float] = 0
    first_order_commission_rate: Optional[float] = None
    renewal_commission_rate: Optional[float] = None
    package_commission_rate: Optional[float] = None
    discount_rate: Optional[float] = 1
    invite_code: Optional[str] = None
    company_short_name: Optional[str] = None
    company_logo_url: Optional[str] = None
    company_logo_asset_id: Optional[str] = None
    company_logo_icon: Optional[str] = None
    contact_name: Optional[str] = None
    mobile_phone: Optional[str] = None
    address: Optional[str] = None
    email: Optional[str] = None
    status: Optional[str] = "active"


class OrganizationUpdate(BaseModel):
    """Editable commercial and contact fields for an existing organization.

    Organization type and hierarchy are intentionally not editable here: moving
    an agency changes tenant inheritance and is handled as a separate workflow.
    """

    name: Optional[str] = None
    commission_mode: Optional[str] = None
    commission_rate: Optional[float] = None
    discount_rate: Optional[float] = None
    invite_code: Optional[str] = None
    company_short_name: Optional[str] = None
    company_logo_url: Optional[str] = None
    company_logo_asset_id: Optional[str] = None
    company_logo_icon: Optional[str] = None
    contact_name: Optional[str] = None
    mobile_phone: Optional[str] = None
    address: Optional[str] = None
    email: Optional[str] = None
    status: Optional[str] = None
    quota_limits: Optional[dict[str, int]] = None


class ProjectCreate(BaseModel):
    client_org_id: int
    name: str
    code: Optional[str] = None
    domain: Optional[str] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    domain: Optional[str] = None
    status: Optional[str] = None


class RoleCreate(BaseModel):
    org_id: Optional[int] = None
    scope: str
    name: str
    description: Optional[str] = None
    permissions: list[str] = Field(default_factory=list)


class MembershipInviteCreate(BaseModel):
    org_id: int = Field(gt=0)
    role_id: int = Field(gt=0)
    project_id: Optional[int] = Field(default=None, gt=0)
    email: Optional[str] = None
    expires_in_hours: int = Field(default=168, ge=1, le=24 * 30)


class AIAppAssignmentCreate(BaseModel):
    org_id: Optional[int] = None
    app_key: str
    app_name: str
    category: Optional[str] = None
    scope: Optional[str] = None
    primary_provider_id: Optional[int] = None
    primary_model: Optional[str] = None
    backup_provider_id: Optional[int] = None
    backup_model: Optional[str] = None
    enabled: bool = True
    sort_order: int = 0


class AIAppAssignmentUpdate(BaseModel):
    org_id: Optional[int] = None
    app_name: Optional[str] = None
    category: Optional[str] = None
    scope: Optional[str] = None
    primary_provider_id: Optional[int] = None
    primary_model: Optional[str] = None
    backup_provider_id: Optional[int] = None
    backup_model: Optional[str] = None
    enabled: Optional[bool] = None
    sort_order: Optional[int] = None


def safe_json_loads(value: Optional[str], fallback):
    try:
        return json.loads(value or "")
    except Exception:
        return fallback


def extract_code_number(value: Optional[str], prefix: str) -> int:
    if not value:
        return 0
    match = re.search(rf"{re.escape(prefix.upper())}(\d+)", str(value).upper())
    return int(match.group(1)) if match else 0


def derive_agent_level_from_code(code: Optional[str], org_type: Optional[str] = None) -> Optional[int]:
    normalized = str(code or "").strip().upper()
    if not normalized:
        return None
    if "-3-" in normalized:
        return 3
    if "-2-" in normalized:
        return 2
    if org_type == "agency":
        return 1
    if org_type == "sub_agency":
        return 2
    return 1 if normalized.startswith("D") else None


def get_agent_level(org: Optional[Organization]) -> Optional[int]:
    if not org or org.org_type not in {"agency", "sub_agency"}:
        return None
    if org.agent_level:
        return int(org.agent_level)
    return derive_agent_level_from_code(org.code, org.org_type) or (1 if org.org_type == "agency" else 2)


def get_agent_level_label(level: Optional[int]) -> str:
    if level == 1:
        return "一级代理商"
    if level == 2:
        return "二级代理商"
    if level == 3:
        return "三级代理商"
    return ""


def build_lineage_path(chain: list[Organization]) -> str:
    return "/".join(str(node.id) for node in chain if node and node.id is not None)


async def generate_next_org_code(
    db: AsyncSession, org_type: str, parent: Optional[Organization] = None
) -> str:
    if org_type == "agency":
        result = await db.execute(select(Organization.code).where(Organization.org_type == "agency"))
        next_number = max((extract_code_number(code, "D") for code in result.scalars().all()), default=0) + 1
        return f"D{next_number:03d}"

    if org_type == "sub_agency":
        if not parent:
            raise HTTPException(status_code=400, detail="Sub agencies must choose an upper agency")
        parent_level = get_agent_level(parent)
        if parent.org_type not in {"agency", "sub_agency"} or parent_level not in {1, 2}:
            raise HTTPException(status_code=400, detail="Sub agencies can only be created under level 1 or level 2 agents")
        child_level = 2 if parent_level == 1 else 3
        token = f"-{child_level}-"
        result = await db.execute(
            select(Organization.code).where(
                Organization.parent_id == parent.id,
                Organization.org_type == "sub_agency",
            )
        )
        next_number = 1
        for code in result.scalars().all():
            normalized = str(code or "").upper()
            if token not in normalized:
                continue
            tail = normalized.rsplit(token, 1)[-1]
            match = re.match(r"^(\d+)$", tail)
            if match:
                next_number = max(next_number, int(match.group(1)) + 1)
        return f"{parent.code}{token}{next_number:03d}"

    if org_type == "client":
        prefix = "K"
        query = select(Organization.code).where(Organization.org_type == "client")
        result = await db.execute(query)
        next_number = max((extract_code_number(code, prefix) for code in result.scalars().all()), default=0) + 1
        return f"{prefix}{next_number:03d}"

    raise HTTPException(status_code=400, detail="Unsupported organization type")


async def generate_next_project_code(db: AsyncSession) -> str:
    result = await db.execute(select(Project.code))
    next_number = max((extract_code_number(code, "J") for code in result.scalars().all()), default=0) + 1
    return f"J{next_number:03d}"


def repair_mojibake_text(value: Optional[str]) -> Optional[str]:
    if value is None:
        return value
    text = str(value)
    if not text:
        return text

    suspicious = any(ch in text for ch in ("Ã", "æ", "ä", "å", "é", "è", "ç", "ï", "»", "¼", "浠", "悊", "鍟", "瀹", "㈡", "埛"))
    if not suspicious:
        return text

    try:
        repaired = text.encode("latin1").decode("utf-8")
    except Exception:
        return text

    return repaired or text


def _is_placeholder_text(value: Optional[str]) -> bool:
    if value is None:
        return True
    text = str(value).strip()
    return not text or set(text) == {"?"}


def _fallback_org_name(org_type: Optional[str], code: Optional[str]) -> str:
    normalized = str(code or "").strip().upper()
    if org_type == "hq":
        return "总部"
    if org_type == "agency":
        return f"代理商{normalized[1:]}" if normalized.startswith("D") and normalized[1:].isdigit() else "代理商"
    if org_type == "sub_agency":
        level = derive_agent_level_from_code(normalized, org_type)
        if level == 2:
            return f"二级代理商{normalized}"
        if level == 3:
            return f"三级代理商{normalized}"
        return f"代理商{normalized}" if normalized else "代理商"
    if org_type == "client":
        return f"客户{normalized[1:]}" if normalized.startswith("K") and normalized[1:].isdigit() else "客户"
    return normalized or "未命名组织"


def clean_org_display_name(org: Optional[Organization]) -> str:
    if not org:
        return ""
    repaired = repair_mojibake_text(org.name)
    if _is_placeholder_text(repaired):
        return _fallback_org_name(org.org_type, org.code)
    return str(repaired)


def clean_project_display_name(project: Optional[Project]) -> str:
    if not project:
        return ""
    repaired = repair_mojibake_text(project.name)
    if _is_placeholder_text(repaired):
        code = str(project.code or "").strip().upper()
        return f"计划{code[1:]}" if code.startswith("J") and code[1:].isdigit() else (code or "未命名计划")
    return str(repaired)


def derive_name_from_email(email: str) -> str:
    return email.split("@", 1)[0] if email else ""


def get_sort_timestamp(payload: dict) -> float:
    raw = payload.get("updated_at") or payload.get("created_at")
    if isinstance(raw, datetime):
        return raw.timestamp()
    if isinstance(raw, str):
        try:
            return datetime.fromisoformat(raw.replace("Z", "+00:00")).timestamp()
        except Exception:
            return 0
    return 0


def sort_platform_tree(nodes: list[dict]) -> list[dict]:
    nodes.sort(key=lambda node: (get_sort_timestamp(node), node.get("id", 0)), reverse=True)
    for node in nodes:
        node["children"] = sort_platform_tree(node.get("children", []))
        node["projects"].sort(
            key=lambda project: (get_sort_timestamp(project), project.get("id", 0)),
            reverse=True,
        )
    return nodes


async def resolve_parent_for_new_organization(
    db: AsyncSession, org_type: str, parent_id: Optional[int]
) -> Optional[Organization]:
    if org_type == "agency":
        if parent_id is None:
            hq = await db.scalar(select(Organization).where(Organization.org_type == "hq").order_by(Organization.id.asc()))
            if not hq:
                raise HTTPException(status_code=400, detail="HQ organization is required before creating agencies")
            return hq

        parent = await db.scalar(select(Organization).where(Organization.id == parent_id))
        if not parent:
            raise HTTPException(status_code=404, detail="Parent organization not found")
        if parent.org_type != "hq":
            raise HTTPException(status_code=400, detail="Top-level agencies must belong directly to HQ")
        return parent

    if org_type == "sub_agency":
        if parent_id is None:
            raise HTTPException(status_code=400, detail="Sub agencies must choose an agency parent")
        parent = await db.scalar(select(Organization).where(Organization.id == parent_id))
        if not parent:
            raise HTTPException(status_code=404, detail="Parent organization not found")
        if parent.org_type not in {"agency", "sub_agency"}:
            raise HTTPException(status_code=400, detail="Sub agencies can only belong to an agency or sub agency")
        parent_level = get_agent_level(parent)
        if parent_level not in {1, 2}:
            raise HTTPException(status_code=400, detail="Sub agencies can only be created under level 1 or level 2 agents")
        return parent

    if org_type == "client":
        if parent_id is None:
            raise HTTPException(status_code=400, detail="Clients must choose an agency parent")
        parent = await db.scalar(select(Organization).where(Organization.id == parent_id))
        if not parent:
            raise HTTPException(status_code=404, detail="Parent organization not found")
        if parent.org_type not in {"agency", "sub_agency"}:
            raise HTTPException(status_code=400, detail="Clients can only belong to an agency or sub agency")
        return parent

    raise HTTPException(status_code=400, detail="Unsupported organization type")


async def get_organization_chain(db: AsyncSession, org: Optional[Organization]) -> list[Organization]:
    chain: list[Organization] = []
    current = org
    while current:
        chain.append(current)
        if not current.parent_id:
            break
        current = await db.scalar(select(Organization).where(Organization.id == current.parent_id))
    return list(reversed(chain))


async def derive_organization_hierarchy(
    db: AsyncSession, org_type: str, parent: Optional[Organization]
) -> dict[str, Optional[int]]:
    chain = await get_organization_chain(db, parent)
    root_org = chain[0] if chain else parent
    agency_nodes = [node for node in chain if node.org_type in {"agency", "sub_agency"}]

    if org_type == "agency":
        return {
            "agent_level": 1,
            "root_org_id": root_org.id if root_org else None,
            "root_agency_id": None,
        }

    if org_type == "sub_agency":
        parent_level = get_agent_level(parent)
        if parent_level == 1:
            agent_level = 2
        elif parent_level == 2:
            agent_level = 3
        else:
            raise HTTPException(status_code=400, detail="Sub agencies can only be created under level 1 or level 2 agents")

        root_agency = agency_nodes[0] if agency_nodes else parent
        return {
            "agent_level": agent_level,
            "root_org_id": root_org.id if root_org else None,
            "root_agency_id": root_agency.id if root_agency else None,
        }

    if org_type == "client":
        root_agency = agency_nodes[0] if agency_nodes else parent
        return {
            "agent_level": None,
            "root_org_id": root_org.id if root_org else None,
            "root_agency_id": root_agency.id if root_agency else None,
        }

    raise HTTPException(status_code=400, detail="Unsupported organization type")


async def build_organization_settings(db: AsyncSession, org: Organization) -> dict[str, object]:
    chain = await get_organization_chain(db, org)
    parent = chain[-2] if len(chain) >= 2 else None
    agency_nodes = [node for node in chain if node.org_type in {"agency", "sub_agency"}]
    root_org = chain[0] if chain else None
    level_1_agency = next((node for node in agency_nodes if get_agent_level(node) == 1), agency_nodes[0] if agency_nodes else None)
    level_2_agency = next((node for node in agency_nodes if get_agent_level(node) == 2), None)
    level_3_agency = next((node for node in agency_nodes if get_agent_level(node) == 3), None)

    direct_agency: Optional[Organization]
    if org.org_type == "client":
        direct_agency = parent if parent and parent.org_type in {"agency", "sub_agency"} else (agency_nodes[-1] if agency_nodes else None)
    elif org.org_type in {"agency", "sub_agency"}:
        direct_agency = org
    else:
        direct_agency = agency_nodes[-1] if agency_nodes else None

    settings: dict[str, object] = {
        "parentCode": parent.code if parent else None,
        "parentName": clean_org_display_name(parent) if parent else None,
        "rootOrgCode": root_org.code if root_org else None,
        "rootOrgName": clean_org_display_name(root_org) if root_org else None,
        "lineageCodes": [node.code for node in chain],
        "lineageNames": [clean_org_display_name(node) or node.code for node in chain],
        "lineagePath": build_lineage_path(chain),
        "agencyCode": level_1_agency.code if level_1_agency else None,
        "agencyName": clean_org_display_name(level_1_agency) if level_1_agency else None,
        "agencyLevel1Code": level_1_agency.code if level_1_agency else None,
        "agencyLevel1Name": clean_org_display_name(level_1_agency) if level_1_agency else None,
        "agencyLevel2Code": level_2_agency.code if level_2_agency else None,
        "agencyLevel2Name": clean_org_display_name(level_2_agency) if level_2_agency else None,
        "agencyLevel3Code": level_3_agency.code if level_3_agency else None,
        "agencyLevel3Name": clean_org_display_name(level_3_agency) if level_3_agency else None,
        "directAgencyCode": direct_agency.code if direct_agency else None,
        "directAgencyName": clean_org_display_name(direct_agency) if direct_agency else None,
        "directAgencyLevel": get_agent_level(direct_agency),
        "rootAgencyCode": level_1_agency.code if level_1_agency else None,
        "rootAgencyName": clean_org_display_name(level_1_agency) if level_1_agency else None,
        "subAgencyCode": direct_agency.code if direct_agency and direct_agency.org_type == "sub_agency" else None,
        "subAgencyName": clean_org_display_name(direct_agency)
        if direct_agency and direct_agency.org_type == "sub_agency"
        else None,
    }
    if org.org_type in {"agency", "sub_agency"}:
        settings["agentLevel"] = get_agent_level(org)
        settings["agentLevelLabel"] = get_agent_level_label(get_agent_level(org))
    if org.org_type == "client":
        settings["clientCode"] = org.code
        settings["clientName"] = clean_org_display_name(org)
    return settings


def org_to_dict(org: Organization) -> dict:
    settings = safe_json_loads(org.settings_json, {})
    parent_code = settings.get("parentCode") if isinstance(settings, dict) else None
    agent_level = org.agent_level if org.agent_level is not None else (settings.get("agentLevel") if isinstance(settings, dict) else None)
    return {
        "id": org.id,
        "name": clean_org_display_name(org),
        "code": org.code,
        "org_type": org.org_type,
        "parent_id": org.parent_id,
        "root_org_id": org.root_org_id,
        "root_agency_id": org.root_agency_id,
        "agent_level": agent_level,
        "agent_level_label": get_agent_level_label(agent_level) if agent_level is not None else "",
        "lineage_path": org.lineage_path or (settings.get("lineagePath") if isinstance(settings, dict) else None),
        "status": org.status,
        "commission_mode": org.commission_mode,
        "commission_rate": org.commission_rate,
        "first_order_commission_rate": org.first_order_commission_rate,
        "renewal_commission_rate": org.renewal_commission_rate,
        "package_commission_rate": org.package_commission_rate,
        "discount_rate": org.discount_rate,
        "invite_code": org.invite_code,
        "invite_url": org.invite_url,
        "qr_code_url": org.qr_code_url,
        "settings": settings,
        "parent_code": parent_code,
        "created_at": org.created_at,
        "updated_at": org.updated_at,
    }


def project_to_dict(project: Project) -> dict:
    return {
        "id": project.id,
        "client_org_id": project.client_org_id,
        "name": clean_project_display_name(project),
        "code": project.code,
        "domain": project.domain,
        "status": project.status,
        "owner_user_id": project.owner_user_id,
        "settings": safe_json_loads(project.settings_json, {}),
        "created_at": project.created_at,
        "updated_at": project.updated_at,
    }


async def sync_project_name_to_published_sites(db: AsyncSession, project: Project) -> None:
    items = await _normalize_published_sites(db, _read_sites_store())
    changed = False
    next_name = clean_project_display_name(project)
    normalized_code = str(project.code or "").strip().upper()

    for site in items:
        same_project = False
        if isinstance(site.get("planId"), int) and site.get("planId") == project.id:
            same_project = True
        elif str(site.get("planCode") or "").strip().upper() == normalized_code:
            same_project = True

        if not same_project:
            continue

        if site.get("planName") != next_name:
            site["planName"] = next_name
            changed = True
        if site.get("name") != next_name:
            site["name"] = next_name
            changed = True

        builder_state = site.get("builderState")
        if isinstance(builder_state, dict):
            for key in ("planName", "siteName", "companyName", "brandName"):
                if builder_state.get(key) != next_name:
                    builder_state[key] = next_name
                    changed = True

    if changed:
        _write_sites_store(items)


def role_to_dict(role: Role) -> dict:
    return {
        "id": role.id,
        "org_id": role.org_id,
        "scope": role.scope,
        "name": role.name,
        "description": role.description,
        "permissions": safe_json_loads(role.permissions_json, []),
        "is_system": role.is_system,
    }


def ai_assignment_to_dict(
    assignment: AIAppAssignment,
    *,
    org: Optional[Organization],
    primary_provider: Optional[AIProviderConfig],
    backup_provider: Optional[AIProviderConfig],
) -> dict:
    return {
        "id": assignment.id,
        "org_id": assignment.org_id,
        "org_code": org.code if org else "",
        "org_name": clean_org_display_name(org) if org else "",
        "org_type": org.org_type if org else ("global" if assignment.org_id is None else ""),
        "app_key": assignment.app_key,
        "app_name": repair_mojibake_text(assignment.app_name) or assignment.app_key,
        "category": repair_mojibake_text(assignment.category) if assignment.category else "",
        "scope": repair_mojibake_text(assignment.scope) if assignment.scope else "",
        "primary_provider_id": assignment.primary_provider_id,
        "primary_provider_key": primary_provider.provider_key if primary_provider else "",
        "primary_provider_name": repair_mojibake_text(primary_provider.name) if primary_provider else "",
        "primary_model": assignment.primary_model or "",
        "backup_provider_id": assignment.backup_provider_id,
        "backup_provider_key": backup_provider.provider_key if backup_provider else "",
        "backup_provider_name": repair_mojibake_text(backup_provider.name) if backup_provider else "",
        "backup_model": assignment.backup_model or "",
        "enabled": assignment.enabled,
        "sort_order": assignment.sort_order,
        "settings": safe_json_loads(assignment.settings_json, {}),
        "created_at": assignment.created_at,
        "updated_at": assignment.updated_at,
    }


def membership_to_dict(
    membership: Membership,
    *,
    user: Optional[User],
    account: Optional[LocalAccount],
    org: Optional[Organization],
    project: Optional[Project],
    role: Optional[Role],
) -> dict:
    display_name = ""
    if user and user.name:
        display_name = repair_mojibake_text(user.name) or ""
    if not display_name and account and account.email:
        display_name = derive_name_from_email(account.email)
    if not display_name and user and user.email:
        display_name = derive_name_from_email(user.email)
    if not display_name:
        display_name = membership.user_id

    last_login = None
    if account and account.last_login:
        last_login = account.last_login
    elif user and user.last_login:
        last_login = user.last_login

    return {
        "id": membership.id,
        "user_id": membership.user_id,
        "email": (account.email if account and account.email else (user.email if user else "")) or "",
        "name": display_name,
        "org_id": membership.org_id,
        "org_code": org.code if org else "",
        "org_name": clean_org_display_name(org) if org else "",
        "org_type": org.org_type if org else "",
        "project_id": membership.project_id,
        "project_code": project.code if project else "",
        "project_name": clean_project_display_name(project) if project else "",
        "role_id": membership.role_id,
        "role_name": repair_mojibake_text(role.name) if role else "",
        "role_scope": role.scope if role else "",
        "status": membership.status,
        "is_default": membership.is_default,
        "last_login": last_login,
        "created_at": membership.created_at,
        "updated_at": membership.updated_at,
    }


@router.get("/overview")
async def platform_overview(
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    await require_global_platform_access(current_user=current_user)
    org_count = await db.scalar(select(func.count(Organization.id)))
    project_count = await db.scalar(select(func.count(Project.id)))
    role_count = await db.scalar(select(func.count(Role.id)))
    member_count = await db.scalar(select(func.count(Membership.id)))
    backup_count = await db.scalar(select(func.count(DataBackup.id)))
    ai_provider_count = await db.scalar(select(func.count(AIProviderConfig.id)))

    return {
        "status": "ready",
        "counts": {
            "organizations": org_count or 0,
            "projects": project_count or 0,
            "roles": role_count or 0,
            "memberships": member_count or 0,
            "backups": backup_count or 0,
            "aiProviders": ai_provider_count or 0,
        },
        "tech_stack": {
            "primary_languages": [
                {
                    "name": "Python",
                    "usage": "后端唯一主语言",
                    "framework": "FastAPI",
                    "responsibility": ["接口", "数据服务", "权限控制", "AI 调用", "数据库", "多租户逻辑"],
                },
                {
                    "name": "TypeScript",
                    "usage": "前端唯一主语言",
                    "framework": "React + Vite + TSX",
                    "responsibility": ["总部后台界面", "代理商平台界面", "客户端界面", "交互逻辑", "全局响应式页面"],
                },
            ],
            "supporting_languages": [
                {"name": "CSS / Tailwind", "usage": "页面样式、主题和响应式布局"},
                {"name": "PowerShell", "usage": "本地启动、停止、重启和部署辅助脚本"},
                {"name": "PostgreSQL + SQLAlchemy / Alembic", "usage": "线上主数据库、结构迁移和查询模型"},
                {"name": "Redis", "usage": "缓存、队列、会话和异步任务协同"},
            ],
        },
        "deployment_strategy": [
            "后端采用 Python + FastAPI 部署为 API 服务，适合 Linux、Docker 与进程守护。",
            "前端采用 TypeScript + React + Vite 构建为静态资源，由 Nginx 统一分发。",
            "前后端建议分服务部署，由 Nginx 统一反向代理，适合上传到云服务器长期运行。",
            "线上主数据库建议使用 PostgreSQL，开发期可保留 SQLite，本地与线上分环境管理。",
            "缓存、队列、会话建议使用 Redis，方便后续接入任务调度、通知与 AI 调用队列。",
            "后台系统与已发布站点建议分服务器或分容器部署，降低联动故障风险。",
            "所有页面默认按全局响应式规则开发，兼容总部、代理商、客户端三端的小屏与宽屏场景。",
        ],
        "implemented": [
            "总部 / 一级代理 / 二级代理 / 客户端组织模型",
            "代理分佣、折扣、专属注册链接、二维码字段",
            "客户端多项目模型",
            "总部 / 代理 / 客户端 / 项目角色权限模型",
            "AI 供应商配置模型，可由总部切换默认接口",
            "数据备份和审计日志基础表",
            "双主语言架构标准：Python 后端 + TypeScript 前端",
        ],
        "next": [
            "把前端 mock 页面逐步改为读取这些 API",
            "增加账号密码注册登录和邀请注册链接落地",
            "把每个业务接口加上租户过滤和权限检查",
            "增加真实备份任务、日志监控面板和安全策略",
            "继续把三端深层页面统一成全局响应式结构",
            "逐步完善 PostgreSQL + Redis 的线上可用部署方案",
        ],
    }


@router.get("/tree")
async def platform_tree(
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    visible_ids = await visible_organization_ids(db, current_user=current_user)
    visible_projects = await visible_project_ids(db, current_user=current_user)
    orgs = (
        await db.execute(
            select(Organization)
            .where(Organization.id.in_(visible_ids))
            .order_by(Organization.updated_at.desc(), Organization.id.desc())
        )
    ).scalars().all()
    projects = (
        await db.execute(
            select(Project)
            .where(Project.id.in_(visible_projects))
            .order_by(Project.updated_at.desc(), Project.id.desc())
        )
    ).scalars().all()

    nodes = [{**org_to_dict(org), "children": [], "projects": []} for org in orgs]
    by_id = {node["id"]: node for node in nodes}
    roots = []
    for node in nodes:
        parent_id = node["parent_id"]
        if parent_id and parent_id in by_id:
            by_id[parent_id]["children"].append(node)
        else:
            roots.append(node)

    for project in projects:
        if project.client_org_id in by_id:
            by_id[project.client_org_id]["projects"].append(project_to_dict(project))

    return {"items": sort_platform_tree(roots)}


@router.get("/organizations")
async def list_organizations(
    org_type: Optional[str] = Query(None),
    parent_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    visible_ids = await visible_organization_ids(db, current_user=current_user)
    if parent_id is not None:
        await require_organization_access(db, current_user=current_user, organization_id=parent_id)
    query = select(Organization).where(Organization.id.in_(visible_ids))
    if org_type:
        query = query.where(Organization.org_type == org_type)
    if parent_id is not None:
        query = query.where(Organization.parent_id == parent_id)
    result = await db.execute(query.order_by(Organization.updated_at.desc(), Organization.id.desc()))
    return {"items": [org_to_dict(org) for org in result.scalars().all()]}


@router.get("/organizations/next-code")
async def get_next_organization_code(
    org_type: str = Query(...),
    parent_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    if org_type not in {"agency", "sub_agency", "client"}:
        raise HTTPException(status_code=400, detail="Unsupported organization type")
    parent = await resolve_parent_for_new_organization(db, org_type, parent_id)
    if org_type == "agency":
        await require_global_platform_access(current_user=current_user)
    elif parent:
        await require_organization_access(db, current_user=current_user, organization_id=parent.id)
    return {"code": await generate_next_org_code(db, org_type, parent)}


@router.get("/organizations/{organization_id}/quota-status")
async def get_organization_quota_status(
    organization_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    """Show the consumable direct-child capacity for one authorized tenant."""
    organization = await require_organization_access(db, current_user=current_user, organization_id=organization_id)
    if organization.org_type == "hq":
        resources = ("agencies",)
    elif organization.org_type in {"agency", "sub_agency"}:
        resources = ("sub_agencies", "clients")
    elif organization.org_type == "client":
        resources = ("plans",)
    else:
        resources = ()
    return {"organization_id": organization.id, "items": serialize_quota_statuses([await quota_status(db, owner=organization, resource=resource) for resource in resources])}


@router.get("/tenant-health")
async def get_tenant_health(
    organization_id: Optional[int] = Query(default=None, gt=0),
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    """Return a read-only hierarchy/runtime consistency report for an allowed branch."""
    if organization_id is None:
        await require_global_platform_access(current_user=current_user)
    else:
        await require_organization_access(db, current_user=current_user, organization_id=organization_id)
    try:
        return await tenant_health_report(db, organization_id=organization_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Organization not found") from exc


@router.post("/organizations", status_code=status.HTTP_201_CREATED)
async def create_organization(
    payload: OrganizationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    parent = await resolve_parent_for_new_organization(db, payload.org_type, payload.parent_id)
    if payload.org_type == "agency":
        await require_global_platform_access(current_user=current_user)
    elif parent:
        await require_organization_access(db, current_user=current_user, organization_id=parent.id)
    try:
        await ensure_creation_capacity(db, parent=parent, organization_type=payload.org_type)
    except TenantQuotaExceeded as exc:
        raise HTTPException(status_code=409, detail={"message": "Tenant quota reached", "resource": exc.resource, "used": exc.used, "limit": exc.limit}) from exc
    normalized_code = (payload.code or "").strip().upper() or await generate_next_org_code(db, payload.org_type, parent)
    existing = await db.scalar(select(Organization).where(Organization.code == normalized_code))
    if existing:
        raise HTTPException(status_code=409, detail="Organization code already exists")
    invite_code = payload.invite_code or normalized_code
    hierarchy = await derive_organization_hierarchy(db, payload.org_type, parent)
    org = Organization(
        name=payload.name,
        code=normalized_code,
        org_type=payload.org_type,
        parent_id=parent.id if parent else None,
        root_org_id=hierarchy["root_org_id"],
        root_agency_id=hierarchy["root_agency_id"],
        agent_level=hierarchy["agent_level"],
        commission_mode=payload.commission_mode,
        commission_rate=payload.commission_rate,
        first_order_commission_rate=payload.first_order_commission_rate
        if payload.first_order_commission_rate is not None
        else payload.commission_rate,
        renewal_commission_rate=payload.renewal_commission_rate
        if payload.renewal_commission_rate is not None
        else payload.commission_rate,
        package_commission_rate=payload.package_commission_rate
        if payload.package_commission_rate is not None
        else payload.commission_rate,
        discount_rate=payload.discount_rate,
        status=(payload.status or "active").strip().lower() or "active",
        invite_code=invite_code,
        invite_url=f"/register?invite={invite_code}",
        qr_code_url=f"/api/v1/platform/invites/{invite_code}/qrcode",
        settings_json="{}",
    )
    db.add(org)
    await db.flush()
    if org.org_type == "agency" and not org.root_agency_id:
        org.root_agency_id = org.id
    if org.org_type in {"agency", "sub_agency"} and org.agent_level is None:
        org.agent_level = hierarchy["agent_level"]
    chain = await get_organization_chain(db, org)
    org.lineage_path = build_lineage_path(chain)
    settings = await build_organization_settings(db, org)
    settings.update(
        {
            "companyShortName": (payload.company_short_name or "").strip() or None,
            "companyLogoUrl": (payload.company_logo_url or "").strip() or None,
            "companyLogoAssetId": (payload.company_logo_asset_id or "").strip() or None,
            "companyLogoIcon": (payload.company_logo_icon or "").strip() or None,
            "contactName": (payload.contact_name or "").strip() or None,
            "mobilePhone": (payload.mobile_phone or "").strip() or None,
            "address": (payload.address or "").strip() or None,
            "email": (payload.email or "").strip() or None,
        }
    )
    org.settings_json = json.dumps(settings, ensure_ascii=False)
    await ensure_default_roles(db, org)
    if org.org_type in {"agency", "sub_agency"}:
        await provision_agency_runtime_template(db, agency=org)
    record_audit_event(
        db,
        action="organization.created",
        actor_user_id=current_user.id,
        org_id=org.id,
        target_type="organization",
        target_id=str(org.id),
        detail={"org_type": org.org_type, "parent_id": org.parent_id, "agent_level": org.agent_level},
    )
    await db.commit()
    await db.refresh(org)
    return org_to_dict(org)


@router.put("/organizations/{organization_id}")
async def update_organization(
    organization_id: int,
    payload: OrganizationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    """Update contact and commercial information without changing hierarchy."""
    organization = await db.scalar(select(Organization).where(Organization.id == organization_id))
    if not organization:
        raise HTTPException(status_code=404, detail="Organization not found")

    if organization.org_type in {"agency", "sub_agency"}:
        await require_global_platform_access(current_user=current_user)
    else:
        await require_organization_access(db, current_user=current_user, organization_id=organization.id)

    fields_set = payload.model_fields_set
    if "name" in fields_set:
        normalized_name = (payload.name or "").strip()
        if not normalized_name:
            raise HTTPException(status_code=400, detail="Organization name is required")
        organization.name = normalized_name
    if "commission_mode" in fields_set:
        organization.commission_mode = (payload.commission_mode or "").strip() or None
    if "commission_rate" in fields_set:
        organization.commission_rate = payload.commission_rate
        organization.first_order_commission_rate = payload.commission_rate
        organization.renewal_commission_rate = payload.commission_rate
        organization.package_commission_rate = payload.commission_rate
    if "discount_rate" in fields_set:
        organization.discount_rate = payload.discount_rate
    if "status" in fields_set:
        requested_status = (payload.status or "").strip().lower() or organization.status
        if (
            organization.org_type == "client"
            and organization.status != "active"
            and requested_status == "active"
        ):
            projects = (
                await db.execute(
                    select(Project).where(
                        Project.client_org_id == organization.id,
                        Project.status == "active",
                    )
                )
            ).scalars().all()
            try:
                await provision_plan_activation_set(db, client=organization, projects=list(projects))
            except ValueError as exc:
                raise HTTPException(status_code=409, detail=str(exc)) from exc
        organization.status = requested_status
    if "invite_code" in fields_set:
        normalized_invite_code = (payload.invite_code or "").strip() or organization.code
        organization.invite_code = normalized_invite_code
        organization.invite_url = f"/register?invite={normalized_invite_code}"
        organization.qr_code_url = f"/api/v1/platform/invites/{normalized_invite_code}/qrcode"

    settings = safe_json_loads(organization.settings_json, {})
    if not isinstance(settings, dict):
        settings = {}
    if "quota_limits" in fields_set:
        # Package limits are commercial controls, not tenant self-service settings.
        await require_global_platform_access(current_user=current_user)
        try:
            settings["quotaLimits"] = normalize_quota_limits(payload.quota_limits or {})
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
    registration_fields = {
        "company_short_name": "companyShortName",
        "company_logo_url": "companyLogoUrl",
        "company_logo_asset_id": "companyLogoAssetId",
        "company_logo_icon": "companyLogoIcon",
        "contact_name": "contactName",
        "mobile_phone": "mobilePhone",
        "address": "address",
        "email": "email",
    }
    for payload_key, settings_key in registration_fields.items():
        if payload_key in fields_set:
            value = getattr(payload, payload_key)
            settings[settings_key] = value.strip() if isinstance(value, str) and value.strip() else None
    organization.settings_json = json.dumps(settings, ensure_ascii=False)

    db.add(
        AuditLog(
            actor_user_id=current_user.id,
            org_id=organization.id,
            action="organization.updated",
            target_type="organization",
            target_id=str(organization.id),
            detail_json=json.dumps({"fields": sorted(fields_set)}, ensure_ascii=False),
        )
    )
    await db.commit()
    await db.refresh(organization)
    return org_to_dict(organization)


@router.get("/projects")
async def list_projects(
    client_org_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    visible_ids = await visible_organization_ids(db, current_user=current_user)
    visible_projects = await visible_project_ids(db, current_user=current_user)
    if client_org_id is not None:
        await require_organization_access(db, current_user=current_user, organization_id=client_org_id)
    query = select(Project).where(Project.id.in_(visible_projects))
    if client_org_id is not None:
        query = query.where(Project.client_org_id == client_org_id)
    result = await db.execute(query.order_by(Project.updated_at.desc(), Project.id.desc()))
    return {"items": [project_to_dict(project) for project in result.scalars().all()]}


@router.get("/projects/next-code")
async def get_next_project_code(
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    return {"code": await generate_next_project_code(db)}


@router.post("/projects", status_code=status.HTTP_201_CREATED)
async def create_project(
    payload: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    client = await db.scalar(select(Organization).where(Organization.id == payload.client_org_id))
    if not client or client.org_type != "client":
        raise HTTPException(status_code=400, detail="client_org_id must point to a client organization")
    if client.status != "active":
        raise HTTPException(status_code=409, detail="An active client organization is required before plan creation")
    await require_organization_access(db, current_user=current_user, organization_id=client.id)
    try:
        await ensure_creation_capacity(db, parent=client, project=True)
    except TenantQuotaExceeded as exc:
        raise HTTPException(status_code=409, detail={"message": "Tenant quota reached", "resource": exc.resource, "used": exc.used, "limit": exc.limit}) from exc
    normalized_code = (payload.code or "").strip().upper() or await generate_next_project_code(db)
    existing = await db.scalar(
        select(Project).where(Project.client_org_id == payload.client_org_id, Project.code == normalized_code)
    )
    if existing:
        raise HTTPException(status_code=409, detail="Project code already exists under this client")
    client_settings = safe_json_loads(client.settings_json, {})
    agency_code = client_settings.get("agencyCode") if isinstance(client_settings, dict) else None
    project = Project(
        client_org_id=payload.client_org_id,
        name=payload.name,
        code=normalized_code,
        domain=payload.domain,
        settings_json=json.dumps(
            {
                "statsMode": "single",
                "clientCode": client.code,
                "clientName": repair_mojibake_text(client.name),
                "rootOrgId": client.root_org_id,
                "rootAgencyId": client.root_agency_id,
                "agencyCode": agency_code,
                "agencyName": client_settings.get("agencyName") if isinstance(client_settings, dict) else None,
                "agencyLevel1Code": client_settings.get("agencyLevel1Code") if isinstance(client_settings, dict) else None,
                "agencyLevel1Name": client_settings.get("agencyLevel1Name") if isinstance(client_settings, dict) else None,
                "agencyLevel2Code": client_settings.get("agencyLevel2Code") if isinstance(client_settings, dict) else None,
                "agencyLevel2Name": client_settings.get("agencyLevel2Name") if isinstance(client_settings, dict) else None,
                "agencyLevel3Code": client_settings.get("agencyLevel3Code") if isinstance(client_settings, dict) else None,
                "agencyLevel3Name": client_settings.get("agencyLevel3Name") if isinstance(client_settings, dict) else None,
                "directAgencyCode": client_settings.get("directAgencyCode") if isinstance(client_settings, dict) else None,
                "directAgencyName": client_settings.get("directAgencyName") if isinstance(client_settings, dict) else None,
                "rootAgencyCode": client_settings.get("rootAgencyCode") if isinstance(client_settings, dict) else None,
                "rootAgencyName": client_settings.get("rootAgencyName") if isinstance(client_settings, dict) else None,
                "subAgencyCode": client_settings.get("subAgencyCode") if isinstance(client_settings, dict) else None,
                "subAgencyName": client_settings.get("subAgencyName") if isinstance(client_settings, dict) else None,
                "lineagePath": client.lineage_path or (client_settings.get("lineagePath") if isinstance(client_settings, dict) else None),
            },
            ensure_ascii=False,
        ),
    )
    db.add(project)
    await db.flush()
    await provision_plan_runtime_and_template(db, client=client, project=project)
    record_audit_event(
        db,
        action="client_plan.created",
        actor_user_id=current_user.id,
        org_id=client.id,
        project_id=project.id,
        target_type="project",
        target_id=str(project.id),
        detail={"plan_code": project.code, "deployment": "provisioned"},
    )
    await db.commit()
    await db.refresh(project)
    return project_to_dict(project)


@router.put("/projects/{project_id}")
async def update_project(
    project_id: int,
    payload: ProjectUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    await require_project_access(db, current_user=current_user, project_id=project_id)
    project = await db.scalar(select(Project).where(Project.id == project_id))
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if payload.name is not None:
        normalized_name = payload.name.strip()
        if not normalized_name:
            raise HTTPException(status_code=400, detail="Project name is required")
        project.name = normalized_name
    if payload.domain is not None:
        project.domain = payload.domain.strip() or None
    if payload.status is not None:
        requested_status = payload.status.strip().lower() or project.status
        if project.status != "active" and requested_status == "active":
            client = await db.scalar(
                select(Organization).where(
                    Organization.id == project.client_org_id,
                    Organization.org_type == "client",
                    Organization.status == "active",
                )
            )
            if not client:
                raise HTTPException(status_code=409, detail="An active client organization is required before plan activation")
            try:
                await provision_plan_activation_set(db, client=client, projects=[project])
            except ValueError as exc:
                raise HTTPException(status_code=409, detail=str(exc)) from exc
        project.status = requested_status

    record_audit_event(
        db,
        action="client_plan.updated",
        actor_user_id=current_user.id,
        org_id=project.client_org_id,
        project_id=project.id,
        target_type="project",
        target_id=str(project.id),
        detail={"fields": sorted(payload.model_fields_set)},
    )
    await db.commit()
    await db.refresh(project)
    await sync_project_name_to_published_sites(db, project)
    return project_to_dict(project)


@router.delete("/projects/{project_id}")
async def delete_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    await require_project_access(db, current_user=current_user, project_id=project_id)
    project = await db.scalar(select(Project).where(Project.id == project_id))
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    memberships = (await db.execute(select(Membership).where(Membership.project_id == project.id))).scalars().all()
    for membership in memberships:
        membership.project_id = None

    audit_logs = (await db.execute(select(AuditLog).where(AuditLog.project_id == project.id))).scalars().all()
    for item in audit_logs:
        item.project_id = None

    record_audit_event(
        db,
        action="client_plan.deleted",
        actor_user_id=current_user.id,
        org_id=project.client_org_id,
        target_type="project",
        target_id=str(project.id),
        detail={"plan_code": project.code},
    )
    await db.delete(project)
    await db.commit()
    return {"deleted": True, "project_id": project_id}


@router.get("/roles")
async def list_roles(
    org_id: Optional[int] = Query(None),
    scope: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    visible_ids = await visible_organization_ids(db, current_user=current_user)
    if org_id is not None:
        await require_organization_access(db, current_user=current_user, organization_id=org_id)
    query = select(Role)
    if current_user.role != "admin":
        query = query.where(Role.org_id.in_(visible_ids))
    if org_id is not None:
        query = query.where(Role.org_id == org_id)
    if scope:
        query = query.where(Role.scope == scope)
    result = await db.execute(query.order_by(Role.scope, Role.id))
    return {"items": [role_to_dict(role) for role in result.scalars().all()]}


@router.get("/memberships")
async def list_memberships(
    org_id: Optional[int] = Query(None),
    scope: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    visible_ids = await visible_organization_ids(db, current_user=current_user)
    if org_id is not None:
        await require_organization_access(db, current_user=current_user, organization_id=org_id)
    query = (
        select(Membership, User, LocalAccount, Organization, Project, Role)
        .outerjoin(User, User.id == Membership.user_id)
        .outerjoin(LocalAccount, LocalAccount.user_id == Membership.user_id)
        .outerjoin(Organization, Organization.id == Membership.org_id)
        .outerjoin(Project, Project.id == Membership.project_id)
        .outerjoin(Role, Role.id == Membership.role_id)
    )
    if current_user.role != "admin":
        query = query.where(Membership.org_id.in_(visible_ids))
    if org_id is not None:
        query = query.where(Membership.org_id == org_id)
    if scope:
        query = query.where(Role.scope == scope)

    result = await db.execute(query.order_by(Membership.updated_at.desc(), Membership.id.desc()))
    items = [
        membership_to_dict(
            membership,
            user=user,
            account=account,
            org=organization,
            project=project,
            role=role,
        )
        for membership, user, account, organization, project, role in result.all()
    ]
    return {"items": items}


@router.post("/roles", status_code=status.HTTP_201_CREATED)
async def create_role(
    payload: RoleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    if payload.org_id is None:
        await require_global_platform_access(current_user=current_user)
    else:
        await require_organization_permission(
            db, current_user=current_user, organization_id=payload.org_id, permission=TENANT_MEMBER_MANAGE
        )
    role = Role(
        org_id=payload.org_id,
        scope=payload.scope,
        name=payload.name,
        description=payload.description,
        permissions_json=json.dumps(payload.permissions, ensure_ascii=False),
        is_system=False,
    )
    db.add(role)
    await db.commit()
    await db.refresh(role)
    return role_to_dict(role)


@router.post("/memberships/invitations", status_code=status.HTTP_201_CREATED)
async def create_member_invitation(
    payload: MembershipInviteCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    organization = await require_organization_permission(
        db, current_user=current_user, organization_id=payload.org_id, permission=TENANT_MEMBER_MANAGE
    )
    role = await db.scalar(select(Role).where(Role.id == payload.role_id, Role.org_id == organization.id))
    if not role:
        raise HTTPException(status_code=422, detail="Role must belong to the invitation organization")
    if payload.project_id is not None:
        project = await db.scalar(select(Project).where(Project.id == payload.project_id, Project.client_org_id == organization.id))
        if not project:
            raise HTTPException(status_code=422, detail="Project must belong to the invitation organization")
    invite, raw_code = await create_membership_invite(
        db,
        org_id=organization.id,
        role_id=role.id,
        project_id=payload.project_id,
        email=payload.email,
        invited_by=current_user.id,
        expires_in_hours=payload.expires_in_hours,
    )
    record_audit_event(
        db,
        action="membership_invited",
        actor_user_id=current_user.id,
        org_id=organization.id,
        project_id=payload.project_id,
        target_type="membership_invite",
        target_id=invite.id,
        ip_address=request.client.host if request.client else None,
        detail={"role_id": role.id, "email_bound": bool(invite.email), "expires_at": invite.expires_at.isoformat()},
    )
    await db.commit()
    return {
        "id": invite.id,
        "invite_code": raw_code,
        "org_id": invite.org_id,
        "project_id": invite.project_id,
        "role_id": invite.role_id,
        "email": invite.email,
        "expires_at": invite.expires_at,
        "status": invite.status,
    }


@router.get("/ai-providers")
async def list_ai_providers(
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    query = select(AIProviderConfig)
    if current_user.role != "admin":
        visible_ids = await visible_organization_ids(db, current_user=current_user)
        query = query.where(AIProviderConfig.org_id.in_(visible_ids))
    result = await db.execute(query.order_by(AIProviderConfig.is_default.desc(), AIProviderConfig.id))
    return {
        "items": [
            {
                "id": item.id,
                "org_id": item.org_id,
                "provider_key": item.provider_key,
                "name": item.name,
                "base_url": item.base_url,
                "default_model": item.default_model,
                "api_key_env": item.api_key_env,
                "is_active": item.is_active,
                "is_default": item.is_default,
                "settings": safe_json_loads(item.settings_json, {}),
            }
            for item in result.scalars().all()
        ]
    }


@router.put("/ai-providers/{provider_id}/default")
async def set_default_ai_provider(
    provider_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    provider = await db.scalar(select(AIProviderConfig).where(AIProviderConfig.id == provider_id))
    if not provider:
        raise HTTPException(status_code=404, detail="AI provider not found")
    if provider.org_id is None:
        await require_global_platform_access(current_user=current_user)
    else:
        await require_organization_access(db, current_user=current_user, organization_id=provider.org_id)
    result = await db.execute(select(AIProviderConfig).where(AIProviderConfig.org_id == provider.org_id))
    for item in result.scalars().all():
        item.is_default = item.id == provider.id
    await db.commit()
    return {"message": "Default AI provider updated", "provider_id": provider_id}


@router.get("/ai-assignments")
async def list_ai_assignments(
    org_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    visible_ids = await visible_organization_ids(db, current_user=current_user)
    if org_id is not None:
        await require_organization_access(db, current_user=current_user, organization_id=org_id)
    query = select(AIAppAssignment).order_by(
        AIAppAssignment.sort_order.desc(),
        AIAppAssignment.updated_at.desc(),
        AIAppAssignment.id.desc(),
    )
    if org_id is not None:
        query = query.where(AIAppAssignment.org_id == org_id)
    elif current_user.role != "admin":
        query = query.where(AIAppAssignment.org_id.in_(visible_ids))
    result = await db.execute(query)
    items = result.scalars().all()
    org_ids = {item.org_id for item in items if item.org_id}
    provider_ids = {
        provider_id
        for provider_id in [
            *(item.primary_provider_id for item in items),
            *(item.backup_provider_id for item in items),
        ]
        if provider_id
    }
    providers = {}
    if provider_ids:
        provider_result = await db.execute(select(AIProviderConfig).where(AIProviderConfig.id.in_(provider_ids)))
        providers = {item.id: item for item in provider_result.scalars().all()}
    orgs = {}
    if org_ids:
        org_result = await db.execute(select(Organization).where(Organization.id.in_(org_ids)))
        orgs = {item.id: item for item in org_result.scalars().all()}

    return {
        "items": [
            ai_assignment_to_dict(
                item,
                org=orgs.get(item.org_id),
                primary_provider=providers.get(item.primary_provider_id),
                backup_provider=providers.get(item.backup_provider_id),
            )
            for item in items
        ]
    }


@router.get("/ai-assignments/resolve")
async def resolve_ai_assignment(
    app_key: str = Query(...),
    site_id: Optional[str] = Query(None),
    project_id: Optional[int] = Query(None),
    org_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    if project_id is not None:
        await require_project_access(db, current_user=current_user, project_id=project_id)
    elif org_id is not None:
        await require_organization_access(db, current_user=current_user, organization_id=org_id)
    else:
        # A site id alone is not a verified tenant boundary yet. Do not allow it
        # to select a global AI configuration for a non-HQ user.
        await require_global_platform_access(current_user=current_user)
    service = AIHubService()
    return await service.resolve_assigned_app_scope(
        db=db,
        app_key=app_key,
        site_id=site_id,
        project_id=project_id,
        org_id=org_id,
    )


@router.post("/ai-assignments", status_code=status.HTTP_201_CREATED)
async def create_ai_assignment(
    payload: AIAppAssignmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    if payload.org_id is None:
        await require_global_platform_access(current_user=current_user)
    else:
        await require_organization_access(db, current_user=current_user, organization_id=payload.org_id)
    normalized_key = payload.app_key.strip()
    if not normalized_key:
        raise HTTPException(status_code=400, detail="app_key is required")
    existing = await db.scalar(
        select(AIAppAssignment).where(
            AIAppAssignment.org_id == payload.org_id,
            AIAppAssignment.app_key == normalized_key,
        )
    )
    if existing:
        raise HTTPException(status_code=409, detail="AI assignment app_key already exists")

    assignment = AIAppAssignment(
        org_id=payload.org_id,
        app_key=normalized_key,
        app_name=payload.app_name.strip() or normalized_key,
        category=(payload.category or "").strip(),
        scope=(payload.scope or "").strip(),
        primary_provider_id=payload.primary_provider_id,
        primary_model=(payload.primary_model or "").strip(),
        backup_provider_id=payload.backup_provider_id,
        backup_model=(payload.backup_model or "").strip(),
        enabled=payload.enabled,
        sort_order=payload.sort_order,
        settings_json=json.dumps({"managedBy": "hq"}, ensure_ascii=False),
    )
    db.add(assignment)
    await db.commit()
    await db.refresh(assignment)

    primary_provider = None
    backup_provider = None
    if assignment.primary_provider_id:
        primary_provider = await db.scalar(select(AIProviderConfig).where(AIProviderConfig.id == assignment.primary_provider_id))
    if assignment.backup_provider_id:
        backup_provider = await db.scalar(select(AIProviderConfig).where(AIProviderConfig.id == assignment.backup_provider_id))

    return ai_assignment_to_dict(
        assignment,
        org=await db.scalar(select(Organization).where(Organization.id == assignment.org_id)) if assignment.org_id else None,
        primary_provider=primary_provider,
        backup_provider=backup_provider,
    )


@router.put("/ai-assignments/{assignment_id}")
async def update_ai_assignment(
    assignment_id: int,
    payload: AIAppAssignmentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    assignment = await db.scalar(select(AIAppAssignment).where(AIAppAssignment.id == assignment_id))
    if not assignment:
        raise HTTPException(status_code=404, detail="AI assignment not found")
    if assignment.org_id is None:
        await require_global_platform_access(current_user=current_user)
    else:
        await require_organization_access(db, current_user=current_user, organization_id=assignment.org_id)

    requested_org_id = payload.org_id if "org_id" in payload.model_fields_set else assignment.org_id
    if requested_org_id is None:
        await require_global_platform_access(current_user=current_user)
    else:
        await require_organization_access(db, current_user=current_user, organization_id=requested_org_id)

    updates = payload.model_dump(exclude_unset=True)
    if "org_id" in updates:
        assignment.org_id = updates["org_id"]
    if "app_name" in updates:
        assignment.app_name = (updates["app_name"] or "").strip() or assignment.app_key
    if "category" in updates:
        assignment.category = (updates["category"] or "").strip()
    if "scope" in updates:
        assignment.scope = (updates["scope"] or "").strip()
    if "primary_provider_id" in updates:
        assignment.primary_provider_id = updates["primary_provider_id"]
    if "primary_model" in updates:
        assignment.primary_model = (updates["primary_model"] or "").strip()
    if "backup_provider_id" in updates:
        assignment.backup_provider_id = updates["backup_provider_id"]
    if "backup_model" in updates:
        assignment.backup_model = (updates["backup_model"] or "").strip()
    if "enabled" in updates:
        assignment.enabled = updates["enabled"]
    if "sort_order" in updates:
        assignment.sort_order = updates["sort_order"]

    await db.commit()
    await db.refresh(assignment)

    primary_provider = None
    backup_provider = None
    if assignment.primary_provider_id:
        primary_provider = await db.scalar(select(AIProviderConfig).where(AIProviderConfig.id == assignment.primary_provider_id))
    if assignment.backup_provider_id:
        backup_provider = await db.scalar(select(AIProviderConfig).where(AIProviderConfig.id == assignment.backup_provider_id))

    return ai_assignment_to_dict(
        assignment,
        org=await db.scalar(select(Organization).where(Organization.id == assignment.org_id)) if assignment.org_id else None,
        primary_provider=primary_provider,
        backup_provider=backup_provider,
    )


@router.delete("/ai-assignments/{assignment_id}")
async def delete_ai_assignment(
    assignment_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    assignment = await db.scalar(select(AIAppAssignment).where(AIAppAssignment.id == assignment_id))
    if not assignment:
        raise HTTPException(status_code=404, detail="AI assignment not found")
    if assignment.org_id is None:
        await require_global_platform_access(current_user=current_user)
    else:
        await require_organization_access(db, current_user=current_user, organization_id=assignment.org_id)
    await db.delete(assignment)
    await db.commit()
    return {"message": "AI assignment deleted", "assignment_id": assignment_id}
