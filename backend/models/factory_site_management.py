"""Tenant-scoped multi-site content governance records.

The tables deliberately describe controlled site content and release receipts;
they never contain registrar secrets or directly mutate a public site.
"""

from datetime import datetime

from core.database import Base
from sqlalchemy import Boolean, DateTime, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column


class SiteManagementTenantMixin:
    project_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    agent_path: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    tenant_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    client_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    plan_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)


class FactorySiteSpace(SiteManagementTenantMixin, Base):
    __tablename__ = "factory_site_spaces"
    __table_args__ = (UniqueConstraint("project_id", "site_code", name="uq_factory_site_space_code"),)
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    site_number: Mapped[str] = mapped_column(String(96), unique=True, index=True)
    site_code: Mapped[str] = mapped_column(String(80), nullable=False)
    site_name: Mapped[str] = mapped_column(String(200), nullable=False)
    channel: Mapped[str] = mapped_column(String(32), nullable=False)
    default_locale: Mapped[str] = mapped_column(String(16), nullable=False)
    domain_reference: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active", index=True)
    created_by: Mapped[str] = mapped_column(String(128), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)


class FactorySiteContentVersion(SiteManagementTenantMixin, Base):
    __tablename__ = "factory_site_content_versions"
    __table_args__ = (UniqueConstraint("site_id", "version_number", name="uq_factory_site_content_version"),)
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    version_number: Mapped[str] = mapped_column(String(96), unique=True, index=True)
    site_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    site_number: Mapped[str] = mapped_column(String(96), nullable=False)
    locale: Mapped[str] = mapped_column(String(16), nullable=False)
    page_manifest_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    manifest_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    source_reference: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="draft", index=True)
    authored_by: Mapped[str] = mapped_column(String(128), nullable=False)
    reviewed_by: Mapped[str | None] = mapped_column(String(128))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    review_reference: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)


class FactorySitePublication(SiteManagementTenantMixin, Base):
    __tablename__ = "factory_site_publications"
    __table_args__ = (UniqueConstraint("site_version_id", "target_environment", name="uq_factory_site_publication_target"),)
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    publication_number: Mapped[str] = mapped_column(String(96), unique=True, index=True)
    site_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    site_version_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    version_number: Mapped[str] = mapped_column(String(96), nullable=False)
    target_environment: Mapped[str] = mapped_column(String(16), nullable=False)
    release_manifest_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    manifest_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    rollback_reference: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending-approval", index=True)
    prepared_by: Mapped[str] = mapped_column(String(128), nullable=False)
    approved_by: Mapped[str | None] = mapped_column(String(128))
    approval_reference: Mapped[str | None] = mapped_column(String(255))
    consumer_receipt_reference: Mapped[str | None] = mapped_column(String(255))
    available: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    prepared_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)


class FactorySiteManagementEvidence(SiteManagementTenantMixin, Base):
    __tablename__ = "factory_site_management_evidence"
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    evidence_number: Mapped[str] = mapped_column(String(96), unique=True, index=True)
    subject_type: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    subject_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    subject_number: Mapped[str] = mapped_column(String(96), nullable=False)
    evidence_type: Mapped[str] = mapped_column(String(64), nullable=False)
    evidence_reference: Mapped[str] = mapped_column(String(255), nullable=False)
    note: Mapped[str | None] = mapped_column(Text)
    recorded_by: Mapped[str] = mapped_column(String(128), nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class FactoryWebsiteBuildProgram(SiteManagementTenantMixin, Base):
    """Project-level website delivery source of truth.

    This governs planning and acceptance around a site space; it never stores
    registrar credentials or performs a direct public-site deployment.
    """
    __tablename__ = "factory_website_build_programs"
    __table_args__ = (UniqueConstraint("project_id", "program_key", name="uq_factory_website_build_program_key"),)
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    program_number: Mapped[str] = mapped_column(String(96), unique=True, index=True)
    program_key: Mapped[str] = mapped_column(String(100), nullable=False)
    program_name: Mapped[str] = mapped_column(String(200), nullable=False)
    site_id: Mapped[str | None] = mapped_column(String(100), index=True)
    site_mode: Mapped[str] = mapped_column(String(24), nullable=False)
    market_scope: Mapped[str] = mapped_column(String(24), nullable=False)
    locales_json: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    route_strategy: Mapped[str] = mapped_column(String(24), nullable=False)
    brief_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="draft", index=True)
    current_phase: Mapped[str] = mapped_column(String(40), nullable=False, default="brief", index=True)
    created_by: Mapped[str] = mapped_column(String(128), nullable=False)
    activated_by: Mapped[str | None] = mapped_column(String(128))
    activation_reference: Mapped[str | None] = mapped_column(String(255))
    activated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)


class FactoryWebsiteBuildGate(SiteManagementTenantMixin, Base):
    __tablename__ = "factory_website_build_gates"
    __table_args__ = (UniqueConstraint("program_id", "gate_key", name="uq_factory_website_build_gate_key"),)
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    program_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    gate_key: Mapped[str] = mapped_column(String(40), nullable=False)
    gate_label: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="pending", index=True)
    evidence_reference: Mapped[str | None] = mapped_column(String(255))
    passed_by: Mapped[str | None] = mapped_column(String(128))
    passed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
