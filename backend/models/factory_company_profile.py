"""Tenant-scoped company-profile governance records.

These records govern the customer-facing profile projection.  Source facts stay
in their designated systems; this application only carries approved content
manifests and downstream receipts.
"""
from datetime import datetime

from core.database import Base
from sqlalchemy import Boolean, DateTime, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column


class CompanyProfileTenantMixin:
    project_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    agent_path: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    tenant_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    client_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    plan_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)


class FactoryCompanyProfile(CompanyProfileTenantMixin, Base):
    __tablename__ = "factory_company_profiles"
    __table_args__ = (UniqueConstraint("project_id", "profile_key", name="uq_factory_company_profile_key"),)
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    profile_number: Mapped[str] = mapped_column(String(96), unique=True, index=True)
    profile_key: Mapped[str] = mapped_column(String(80), nullable=False)
    display_name: Mapped[str] = mapped_column(String(200), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active", index=True)
    created_by: Mapped[str] = mapped_column(String(128), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)


class FactoryCompanyProfileVersion(CompanyProfileTenantMixin, Base):
    __tablename__ = "factory_company_profile_versions"
    __table_args__ = (UniqueConstraint("profile_id", "version_number", name="uq_factory_company_profile_version"),)
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    version_number: Mapped[str] = mapped_column(String(96), unique=True, index=True)
    profile_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    profile_number: Mapped[str] = mapped_column(String(96), nullable=False)
    locale: Mapped[str] = mapped_column(String(16), nullable=False)
    profile_manifest_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    manifest_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    source_reference: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="draft", index=True)
    authored_by: Mapped[str] = mapped_column(String(128), nullable=False)
    verified_by: Mapped[str | None] = mapped_column(String(128))
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    verification_reference: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)


class FactoryCompanyProfilePublication(CompanyProfileTenantMixin, Base):
    __tablename__ = "factory_company_profile_publications"
    __table_args__ = (UniqueConstraint("profile_version_id", "target", name="uq_factory_company_profile_publication_target"),)
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    publication_number: Mapped[str] = mapped_column(String(96), unique=True, index=True)
    profile_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    profile_version_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    version_number: Mapped[str] = mapped_column(String(96), nullable=False)
    target: Mapped[str] = mapped_column(String(32), nullable=False)
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


class FactoryCompanyProfileEvidence(CompanyProfileTenantMixin, Base):
    __tablename__ = "factory_company_profile_evidence"
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
