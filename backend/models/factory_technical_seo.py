"""Tenant-bound technical SEO audit and remediation-release records."""
from datetime import datetime
from sqlalchemy import Boolean, DateTime, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from core.database import Base


class TechnicalSeoTenantMixin:
    project_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    agent_path: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    tenant_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    client_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    plan_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)


class FactoryTechnicalSeoAudit(TechnicalSeoTenantMixin, Base):
    __tablename__ = "factory_technical_seo_audits"
    __table_args__ = (UniqueConstraint("project_id", "site_reference", "audit_reference", name="uq_factory_technical_seo_audit"),)
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    audit_number: Mapped[str] = mapped_column(String(96), unique=True, index=True)
    site_reference: Mapped[str] = mapped_column(String(255), nullable=False)
    audit_reference: Mapped[str] = mapped_column(String(255), nullable=False)
    public_scope: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active", index=True)
    created_by: Mapped[str] = mapped_column(String(128), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)


class FactoryTechnicalSeoSnapshot(TechnicalSeoTenantMixin, Base):
    __tablename__ = "factory_technical_seo_snapshots"
    __table_args__ = (UniqueConstraint("audit_id", "snapshot_number", name="uq_factory_technical_seo_snapshot"),)
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    snapshot_number: Mapped[str] = mapped_column(String(96), unique=True, index=True)
    audit_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    audit_number: Mapped[str] = mapped_column(String(96), nullable=False)
    evidence_manifest_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    manifest_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="draft", index=True)
    captured_by: Mapped[str] = mapped_column(String(128), nullable=False)
    verified_by: Mapped[str | None] = mapped_column(String(128))
    verification_reference: Mapped[str | None] = mapped_column(String(255))
    captured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)


class FactoryTechnicalSeoRelease(TechnicalSeoTenantMixin, Base):
    __tablename__ = "factory_technical_seo_releases"
    __table_args__ = (UniqueConstraint("snapshot_id", "target", name="uq_factory_technical_seo_release"),)
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    release_number: Mapped[str] = mapped_column(String(96), unique=True, index=True)
    audit_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    snapshot_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    snapshot_number: Mapped[str] = mapped_column(String(96), nullable=False)
    target: Mapped[str] = mapped_column(String(40), nullable=False)
    remediation_manifest_json: Mapped[dict] = mapped_column(JSON, nullable=False)
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


class FactoryTechnicalSeoEvidence(TechnicalSeoTenantMixin, Base):
    __tablename__ = "factory_technical_seo_evidence"
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
