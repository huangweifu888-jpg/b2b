import json
import logging
import os

from core.database import db_manager
from models.platform import AIAppAssignment, AIProviderConfig, Organization, Project, Role
from sqlalchemy import select

logger = logging.getLogger(__name__)


DEFAULT_PERMISSIONS = {
    "hq_admin": [
        "hq.manage_agencies",
        "hq.manage_ai_providers",
        "hq.manage_platform_roles",
        "hq.view_all_tenants",
        "hq.backup_data",
        "hq.view_audit_logs",
    ],
    "agency_admin": [
        "agency.manage_sub_agencies",
        "agency.manage_clients",
        "agency.manage_commission",
        "agency.manage_invites",
        "agency.view_reports",
    ],
    "sub_agency_admin": [
        "agency.manage_clients",
        "agency.manage_invites",
        "agency.view_reports",
    ],
    "client_admin": [
        "client.manage_projects",
        "client.manage_members",
        "client.view_all_project_stats",
        "client.manage_site",
    ],
    "project_manager": [
        "project.view_stats",
        "project.edit_site",
        "project.manage_content",
        "project.use_ai_builder",
    ],
}


def _demo_tenant_seed_enabled() -> bool:
    """Keep development fixtures opt-in so a cleared platform stays cleared after restart."""

    return os.getenv("B2B_SEED_DEMO_TENANTS", "").strip().lower() in {"1", "true", "yes"}


async def _get_or_create_org(db, **data):
    result = await db.execute(select(Organization).where(Organization.code == data["code"]))
    existing = result.scalar_one_or_none()
    if existing:
        preferred_name = data.get("name")
        if preferred_name and (not existing.name or "?" in str(existing.name)):
            existing.name = preferred_name
        if data.get("parent_id") is not None and existing.parent_id != data.get("parent_id"):
            existing.parent_id = data.get("parent_id")
        if data.get("root_org_id") is not None:
            existing.root_org_id = data.get("root_org_id")
        if data.get("root_agency_id") is not None:
            existing.root_agency_id = data.get("root_agency_id")
        if data.get("agent_level") is not None:
            existing.agent_level = data.get("agent_level")
        if data.get("lineage_path"):
            existing.lineage_path = data.get("lineage_path")
        if data.get("settings_json"):
            existing.settings_json = data.get("settings_json")
        return existing
    obj = Organization(**data)
    db.add(obj)
    await db.flush()
    return obj


async def _get_or_create_project(db, **data):
    result = await db.execute(
        select(Project).where(Project.client_org_id == data["client_org_id"], Project.code == data["code"])
    )
    existing = result.scalar_one_or_none()
    if existing:
        preferred_name = data.get("name")
        if preferred_name and (not existing.name or "?" in str(existing.name)):
            existing.name = preferred_name
        if data.get("domain"):
            existing.domain = data.get("domain")
        if data.get("settings_json"):
            existing.settings_json = data.get("settings_json")
        return existing
    obj = Project(**data)
    db.add(obj)
    await db.flush()
    return obj


async def _get_or_create_role(db, **data):
    result = await db.execute(select(Role).where(Role.org_id == data.get("org_id"), Role.name == data["name"]))
    existing = result.scalar_one_or_none()
    if existing:
        return existing
    obj = Role(**data)
    db.add(obj)
    await db.flush()
    return obj


async def _get_or_create_ai_provider(db, **data):
    result = await db.execute(
        select(AIProviderConfig).where(
            AIProviderConfig.org_id == data.get("org_id"),
            AIProviderConfig.provider_key == data["provider_key"],
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        return existing
    obj = AIProviderConfig(**data)
    db.add(obj)
    await db.flush()
    return obj


async def _get_or_create_ai_assignment(db, **data):
    result = await db.execute(
        select(AIAppAssignment).where(
            AIAppAssignment.org_id == data.get("org_id"),
            AIAppAssignment.app_key == data["app_key"],
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        return existing
    obj = AIAppAssignment(**data)
    db.add(obj)
    await db.flush()
    return obj


async def initialize_platform_seed():
    if not db_manager.async_session_maker:
        logger.warning("Platform seed skipped: database session maker is not ready")
        return

    async with db_manager.async_session_maker() as db:
        hq = await _get_or_create_org(
            db,
            name="总部",
            code="HQ",
            org_type="hq",
            parent_id=None,
            status="active",
            commission_mode="platform",
            commission_rate=0,
            discount_rate=1,
            invite_code="HQROOT",
            invite_url="/register?invite=HQROOT",
            qr_code_url="/api/v1/platform/invites/HQROOT/qrcode",
            settings_json=json.dumps({"tenantIsolation": "strict", "defaultPlatform": True}, ensure_ascii=False),
        )

        if not _demo_tenant_seed_enabled():
            await _get_or_create_role(
                db,
                org_id=hq.id,
                scope="hq",
                name="HQ Super Admin",
                description="Manage platform, agencies, AI providers, backups and audits",
                permissions_json=json.dumps(DEFAULT_PERMISSIONS["hq_admin"], ensure_ascii=False),
                is_system=True,
            )
            await db.commit()
            logger.info("Platform baseline initialized without demo tenants")
            return

        agency = await _get_or_create_org(
            db,
            name="代理商1",
            code="D001",
            org_type="agency",
            parent_id=hq.id,
            root_org_id=hq.id,
            agent_level=1,
            lineage_path=f"{hq.id}",
            status="active",
            commission_mode="percentage",
            commission_rate=0.2,
            first_order_commission_rate=0.2,
            renewal_commission_rate=0.1,
            package_commission_rate=0.05,
            discount_rate=0.85,
            invite_code="D001",
            invite_url="/register?invite=D001",
            qr_code_url="/api/v1/platform/invites/D001/qrcode",
            settings_json=json.dumps({"canCreateSubAgency": True, "canCreateClients": True, "agentLevel": 1}, ensure_ascii=False),
        )
        agency.root_agency_id = agency.id
        agency.lineage_path = f"{hq.id}/{agency.id}"

        sub_agency_level_2 = await _get_or_create_org(
            db,
            name="二级代理商D001-2-001",
            code="D001-2-001",
            org_type="sub_agency",
            parent_id=agency.id,
            root_org_id=hq.id,
            root_agency_id=agency.id,
            agent_level=2,
            lineage_path=f"{hq.id}/{agency.id}",
            status="active",
            commission_mode="percentage",
            commission_rate=0.08,
            first_order_commission_rate=0.08,
            renewal_commission_rate=0.04,
            package_commission_rate=0.03,
            discount_rate=0.92,
            invite_code="D001-2-001",
            invite_url="/register?invite=D001-2-001",
            qr_code_url="/api/v1/platform/invites/D001-2-001/qrcode",
            settings_json=json.dumps({"canCreateClients": True, "agentLevel": 2}, ensure_ascii=False),
        )
        sub_agency_level_2.lineage_path = f"{hq.id}/{agency.id}/{sub_agency_level_2.id}"

        sub_agency_level_3 = await _get_or_create_org(
            db,
            name="三级代理商D001-2-001-3-001",
            code="D001-2-001-3-001",
            org_type="sub_agency",
            parent_id=sub_agency_level_2.id,
            root_org_id=hq.id,
            root_agency_id=agency.id,
            agent_level=3,
            lineage_path=f"{hq.id}/{agency.id}/{sub_agency_level_2.id}",
            status="active",
            commission_mode="percentage",
            commission_rate=0.05,
            first_order_commission_rate=0.05,
            renewal_commission_rate=0.03,
            package_commission_rate=0.02,
            discount_rate=0.95,
            invite_code="D001-2-001-3-001",
            invite_url="/register?invite=D001-2-001-3-001",
            qr_code_url="/api/v1/platform/invites/D001-2-001-3-001/qrcode",
            settings_json=json.dumps({"canCreateClients": True, "agentLevel": 3}, ensure_ascii=False),
        )
        sub_agency_level_3.lineage_path = f"{hq.id}/{agency.id}/{sub_agency_level_2.id}/{sub_agency_level_3.id}"

        client = await _get_or_create_org(
            db,
            name="客户1",
            code="K001",
            org_type="client",
            parent_id=sub_agency_level_3.id,
            root_org_id=hq.id,
            root_agency_id=agency.id,
            lineage_path=f"{hq.id}/{agency.id}/{sub_agency_level_2.id}/{sub_agency_level_3.id}",
            status="active",
            invite_code="K001",
            invite_url="/register?invite=K001",
            qr_code_url="/api/v1/platform/invites/K001/qrcode",
            settings_json=json.dumps(
                {
                    "projectSwitchMode": "multi",
                    "agencyCode": agency.code,
                    "agencyLevel1Code": agency.code,
                    "agencyLevel2Code": sub_agency_level_2.code,
                    "agencyLevel3Code": sub_agency_level_3.code,
                    "directAgencyCode": sub_agency_level_3.code,
                    "rootAgencyCode": agency.code,
                    "subAgencyCode": sub_agency_level_3.code,
                },
                ensure_ascii=False,
            ),
        )
        client.lineage_path = f"{hq.id}/{agency.id}/{sub_agency_level_2.id}/{sub_agency_level_3.id}/{client.id}"

        for plan_index, plan_name in enumerate(("计划1", "计划2", "计划3"), start=1):
            await _get_or_create_project(
                db,
                client_org_id=client.id,
                name=plan_name,
                code=f"J{plan_index:03d}",
                domain=f"plan-{plan_index}.local",
                status="active",
                settings_json=json.dumps({"statsMode": "single", "clientCode": "K001", "agencyCode": "D001"}, ensure_ascii=False),
            )

        role_specs = [
            (hq.id, "hq", "HQ Super Admin", "Manage platform, agencies, AI providers, backups and audits", "hq_admin"),
            (agency.id, "agency", "Agency Admin", "Manage sub agencies, clients, commission and invite links", "agency_admin"),
            (sub_agency_level_2.id, "agency", "Sub Agency Admin", "Manage clients, invites and reports", "sub_agency_admin"),
            (client.id, "client", "Client Admin", "Manage projects, members and client-level stats", "client_admin"),
            (client.id, "project", "Project Manager", "Manage single project content, AI builder and project stats", "project_manager"),
        ]
        for org_id, scope, name, desc, permission_key in role_specs:
            await _get_or_create_role(
                db,
                org_id=org_id,
                scope=scope,
                name=name,
                description=desc,
                permissions_json=json.dumps(DEFAULT_PERMISSIONS[permission_key], ensure_ascii=False),
                is_system=True,
            )

        codex_provider = await _get_or_create_ai_provider(
            db,
            org_id=hq.id,
            provider_key="codex",
            name="Codex Gateway",
            base_url="https://openrouter.ai/api/v1",
            default_model="deepseek/deepseek-chat-v3-0324",
            api_key_env="CODEX_API_KEY",
            is_active=True,
            is_default=True,
            settings_json=json.dumps({"managedBy": "hq", "switchable": True, "provider": "openrouter"}, ensure_ascii=False),
        )
        openai_provider = await _get_or_create_ai_provider(
            db,
            org_id=hq.id,
            provider_key="openai",
            name="OpenAI Compatible Gateway",
            base_url="https://openrouter.ai/api/v1",
            default_model="deepseek/deepseek-chat-v3-0324",
            api_key_env="CODEX_API_KEY",
            is_active=True,
            is_default=False,
            settings_json=json.dumps({"managedBy": "hq", "switchable": True, "provider": "openrouter"}, ensure_ascii=False),
        )

        assignment_specs = [
            {
                "app_key": "ai-chat",
                "app_name": "AI Site Builder",
                "category": "site builder",
                "scope": "hq / agency / client / project",
                "primary_provider_id": codex_provider.id,
                "primary_model": "codex",
                "backup_provider_id": openai_provider.id,
                "backup_model": "deepseek/deepseek-chat-v3-0324",
                "enabled": True,
                "sort_order": 100,
            },
            {
                "app_key": "ai-customer-service",
                "app_name": "AI Customer Service",
                "category": "customer service",
                "scope": "agency / client / project",
                "primary_provider_id": openai_provider.id,
                "primary_model": "deepseek/deepseek-chat-v3-0324",
                "backup_provider_id": codex_provider.id,
                "backup_model": "codex",
                "enabled": True,
                "sort_order": 90,
            },
            {
                "app_key": "live-chat",
                "app_name": "Live Chat",
                "category": "im service",
                "scope": "client / project",
                "primary_provider_id": openai_provider.id,
                "primary_model": "deepseek/deepseek-chat-v3-0324",
                "backup_provider_id": codex_provider.id,
                "backup_model": "codex",
                "enabled": True,
                "sort_order": 85,
            },
            {
                "app_key": "seo-blog",
                "app_name": "AI SEO Blog",
                "category": "content generation",
                "scope": "client / project",
                "primary_provider_id": codex_provider.id,
                "primary_model": "codex",
                "backup_provider_id": openai_provider.id,
                "backup_model": "deepseek/deepseek-chat-v3-0324",
                "enabled": True,
                "sort_order": 80,
            },
            {
                "app_key": "product-copy",
                "app_name": "Product Copy",
                "category": "product content",
                "scope": "client / project",
                "primary_provider_id": openai_provider.id,
                "primary_model": "deepseek/deepseek-chat-v3-0324",
                "backup_provider_id": codex_provider.id,
                "backup_model": "codex",
                "enabled": True,
                "sort_order": 70,
            },
        ]
        for item in assignment_specs:
            await _get_or_create_ai_assignment(
                db,
                org_id=hq.id,
                settings_json=json.dumps({"managedBy": "hq"}, ensure_ascii=False),
                **item,
            )

        await db.commit()
        logger.info("Platform seed initialized")
