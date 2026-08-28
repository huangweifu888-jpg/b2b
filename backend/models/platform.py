from datetime import datetime

from core.database import Base
from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint


class Organization(Base):
    __tablename__ = "organizations"
    __table_args__ = (
        UniqueConstraint("code", name="uq_organizations_code"),
        {"extend_existing": True},
    )

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    code = Column(String(100), nullable=False, index=True)
    org_type = Column(String(50), nullable=False, index=True)  # hq, agency, sub_agency, client
    parent_id = Column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)
    root_org_id = Column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)
    root_agency_id = Column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)
    agent_level = Column(Integer, nullable=True, index=True)
    lineage_path = Column(String(1000), nullable=True)
    owner_user_id = Column(String(255), ForeignKey("users.id"), nullable=True, index=True)
    status = Column(String(50), nullable=False, default="active", server_default="active")
    commission_mode = Column(String(50), nullable=True)  # percentage, fixed, tiered
    commission_rate = Column(Float, nullable=True, default=0)
    first_order_commission_rate = Column(Float, nullable=True, default=0)
    renewal_commission_rate = Column(Float, nullable=True, default=0)
    package_commission_rate = Column(Float, nullable=True, default=0)
    discount_rate = Column(Float, nullable=True, default=1)
    invite_code = Column(String(100), nullable=True, index=True)
    invite_url = Column(String(500), nullable=True)
    qr_code_url = Column(String(500), nullable=True)
    settings_json = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)


class Project(Base):
    __tablename__ = "projects_platform"
    __table_args__ = (
        UniqueConstraint("client_org_id", "code", name="uq_projects_client_code"),
        {"extend_existing": True},
    )

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    client_org_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    code = Column(String(100), nullable=False, index=True)
    domain = Column(String(255), nullable=True)
    status = Column(String(50), nullable=False, default="active", server_default="active")
    owner_user_id = Column(String(255), ForeignKey("users.id"), nullable=True, index=True)
    settings_json = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)


class PlanRuntimeConfig(Base):
    """Deployment and version binding for one independent client plan."""

    __tablename__ = "plan_runtime_configs"
    __table_args__ = (
        UniqueConstraint("project_id", name="uq_plan_runtime_project"),
        {"extend_existing": True},
    )

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects_platform.id"), nullable=False, index=True)
    deployment_id = Column(String(100), nullable=False, default="shared-stamp-a", server_default="shared-stamp-a")
    database_id = Column(String(100), nullable=False, default="shared-client-db-a", server_default="shared-client-db-a")
    base_client_version = Column(String(100), nullable=False, default="0.1.0", server_default="0.1.0")
    template_version = Column(String(100), nullable=False, default="0.1.0", server_default="0.1.0")
    enabled_modules_json = Column(Text, nullable=False, default="[]", server_default="[]")
    overrides_json = Column(Text, nullable=False, default="{}", server_default="{}")
    status = Column(String(50), nullable=False, default="active", server_default="active")
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)


class ContentDownloadAsset(Base):
    """Metadata only; bytes remain in private asset storage outside the web root."""

    __tablename__ = "content_download_assets"
    __table_args__ = (
        UniqueConstraint("project_id", "storage_key", name="uq_content_download_project_key"),
        {"extend_existing": True},
    )

    id = Column(String(64), primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects_platform.id"), nullable=False, index=True)
    client_org_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    storage_key = Column(String(1000), nullable=False)
    display_name = Column(String(500), nullable=False)
    media_type = Column(String(255), nullable=True)
    visibility = Column(String(50), nullable=False, default="authenticated", server_default="authenticated")
    enabled = Column(Boolean, nullable=False, default=True, server_default="1")
    size_bytes = Column(Integer, nullable=False, default=0, server_default="0")
    sha256 = Column(String(64), nullable=True)
    scan_status = Column(String(50), nullable=False, default="pending", server_default="pending")
    scan_detail = Column(String(1000), nullable=True)
    scanned_at = Column(DateTime(timezone=True), nullable=True)
    created_by = Column(String(255), ForeignKey("users.id"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)


class Role(Base):
    __tablename__ = "roles_platform"
    __table_args__ = (
        UniqueConstraint("org_id", "name", name="uq_roles_org_name"),
        {"extend_existing": True},
    )

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    org_id = Column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)
    scope = Column(String(50), nullable=False, index=True)  # hq, agency, client, project
    name = Column(String(100), nullable=False)
    description = Column(String(500), nullable=True)
    permissions_json = Column(Text, nullable=False, default="[]", server_default="[]")
    is_system = Column(Boolean, nullable=False, default=False, server_default="0")
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)


class Membership(Base):
    __tablename__ = "memberships_platform"
    __table_args__ = (
        UniqueConstraint("user_id", "org_id", "project_id", name="uq_membership_user_org_project"),
        {"extend_existing": True},
    )

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(String(255), ForeignKey("users.id"), nullable=False, index=True)
    org_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    project_id = Column(Integer, ForeignKey("projects_platform.id"), nullable=True, index=True)
    role_id = Column(Integer, ForeignKey("roles_platform.id"), nullable=True, index=True)
    status = Column(String(50), nullable=False, default="active", server_default="active")
    is_default = Column(Boolean, nullable=False, default=False, server_default="0")
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)


class MembershipInvite(Base):
    """A one-time invitation that grants a predefined role without exposing its raw code."""

    __tablename__ = "membership_invites_platform"
    __table_args__ = (UniqueConstraint("code_hash", name="uq_membership_invite_code_hash"), {"extend_existing": True})

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    code_hash = Column(String(64), nullable=False, index=True)
    org_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    project_id = Column(Integer, ForeignKey("projects_platform.id"), nullable=True, index=True)
    role_id = Column(Integer, ForeignKey("roles_platform.id"), nullable=False, index=True)
    email = Column(String(255), nullable=True, index=True)
    status = Column(String(50), nullable=False, default="pending", server_default="pending", index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)
    invited_by = Column(String(255), ForeignKey("users.id"), nullable=True, index=True)
    accepted_by = Column(String(255), ForeignKey("users.id"), nullable=True, index=True)
    accepted_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)


class AuditLog(Base):
    __tablename__ = "audit_logs_platform"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    actor_user_id = Column(String(255), ForeignKey("users.id"), nullable=True, index=True)
    org_id = Column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)
    project_id = Column(Integer, ForeignKey("projects_platform.id"), nullable=True, index=True)
    action = Column(String(100), nullable=False, index=True)
    target_type = Column(String(100), nullable=True)
    target_id = Column(String(100), nullable=True)
    ip_address = Column(String(100), nullable=True)
    detail_json = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)


class BillingLedgerEntry(Base):
    """Append-only monetary record; amounts are integer minor currency units."""

    __tablename__ = "billing_ledger_entries"
    __table_args__ = (
        UniqueConstraint("org_id", "external_event_id", name="uq_billing_ledger_org_external_event"),
        {"extend_existing": True},
    )

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    org_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    project_id = Column(Integer, ForeignKey("projects_platform.id"), nullable=True, index=True)
    entry_key = Column(String(100), nullable=False, unique=True, index=True)
    entry_type = Column(String(50), nullable=False, index=True)
    amount_minor = Column(Integer, nullable=False)
    currency = Column(String(10), nullable=False)
    external_event_id = Column(String(255), nullable=False, index=True)
    payload_digest = Column(String(64), nullable=False)
    previous_hash = Column(String(64), nullable=True)
    entry_hash = Column(String(64), nullable=False, unique=True, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)


class SupportTicket(Base):
    __tablename__ = "support_tickets"
    __table_args__ = ({"extend_existing": True},)

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    org_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    project_id = Column(Integer, ForeignKey("projects_platform.id"), nullable=True, index=True)
    ticket_key = Column(String(100), nullable=False, unique=True, index=True)
    subject = Column(String(500), nullable=False)
    severity = Column(String(20), nullable=False, index=True)
    status = Column(String(30), nullable=False, default="open", server_default="open", index=True)
    assigned_to = Column(String(255), ForeignKey("users.id"), nullable=True, index=True)
    first_response_due_at = Column(DateTime(timezone=True), nullable=False)
    next_update_due_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)


class DataBackup(Base):
    __tablename__ = "data_backups_platform"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    org_id = Column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)
    backup_type = Column(String(50), nullable=False, default="manual", server_default="manual")
    file_path = Column(String(1000), nullable=False)
    status = Column(String(50), nullable=False, default="pending", server_default="pending")
    size_bytes = Column(Integer, nullable=True)
    created_by = Column(String(255), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)


class ReleaseRollout(Base):
    """Control-plane record for a staged release; it never performs deployment itself."""

    __tablename__ = "release_rollouts_platform"
    __table_args__ = (UniqueConstraint("version", "deployment_id", name="uq_release_rollout_version_deployment"), {"extend_existing": True})

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    version = Column(String(100), nullable=False, index=True)
    release_role = Column(String(50), nullable=False, index=True)
    deployment_id = Column(String(100), nullable=False, index=True)
    manifest_sha256 = Column(String(64), nullable=False)
    change_summary = Column(String(2000), nullable=True)
    status = Column(String(50), nullable=False, default="draft", server_default="draft", index=True)
    current_stage = Column(String(50), nullable=True)
    rollback_reason = Column(String(1000), nullable=True)
    created_by = Column(String(255), ForeignKey("users.id"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)


class ReleaseRolloutStage(Base):
    __tablename__ = "release_rollout_stages_platform"
    __table_args__ = (UniqueConstraint("rollout_id", "stage_key", name="uq_release_rollout_stage"), {"extend_existing": True})

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    rollout_id = Column(Integer, ForeignKey("release_rollouts_platform.id"), nullable=False, index=True)
    stage_key = Column(String(50), nullable=False, index=True)
    stage_label = Column(String(100), nullable=False)
    sequence = Column(Integer, nullable=False)
    status = Column(String(50), nullable=False, default="pending", server_default="pending", index=True)
    note = Column(String(2000), nullable=True)
    acted_by = Column(String(255), ForeignKey("users.id"), nullable=True, index=True)
    acted_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)


class AIProviderConfig(Base):
    __tablename__ = "ai_provider_configs"
    __table_args__ = (
        UniqueConstraint("org_id", "provider_key", name="uq_ai_provider_org_key"),
        {"extend_existing": True},
    )

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    org_id = Column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)
    provider_key = Column(String(100), nullable=False, index=True)  # openai, codex, gemini, custom
    name = Column(String(255), nullable=False)
    base_url = Column(String(500), nullable=True)
    default_model = Column(String(255), nullable=True)
    api_key_env = Column(String(255), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True, server_default="1")
    is_default = Column(Boolean, nullable=False, default=False, server_default="0")
    settings_json = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)


class AIAppAssignment(Base):
    __tablename__ = "ai_app_assignments"
    __table_args__ = (
        UniqueConstraint("org_id", "app_key", name="uq_ai_assignment_org_app"),
        {"extend_existing": True},
    )

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    org_id = Column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)
    app_key = Column(String(100), nullable=False, index=True)
    app_name = Column(String(255), nullable=False)
    category = Column(String(255), nullable=True)
    scope = Column(String(255), nullable=True)
    primary_provider_id = Column(Integer, ForeignKey("ai_provider_configs.id"), nullable=True, index=True)
    primary_model = Column(String(255), nullable=True)
    backup_provider_id = Column(Integer, ForeignKey("ai_provider_configs.id"), nullable=True, index=True)
    backup_model = Column(String(255), nullable=True)
    enabled = Column(Boolean, nullable=False, default=True, server_default="1")
    sort_order = Column(Integer, nullable=False, default=0, server_default="0")
    settings_json = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)


class LocalAccount(Base):
    __tablename__ = "local_accounts"
    __table_args__ = (
        UniqueConstraint("email", name="uq_local_accounts_email"),
        {"extend_existing": True},
    )

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(String(255), ForeignKey("users.id"), nullable=False, index=True)
    org_id = Column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)
    email = Column(String(255), nullable=False, index=True)
    password_hash = Column(String(500), nullable=False)
    status = Column(String(50), nullable=False, default="active", server_default="active")
    last_login = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)
