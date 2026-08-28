"""Tenant-scoped homepage and landing-page composition governance."""
from datetime import datetime

from core.database import Base
from sqlalchemy import Boolean, DateTime, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column


class HomepageDesignTenantMixin:
    project_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    agent_path: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    tenant_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    client_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    plan_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)


class FactoryHomepageDesign(HomepageDesignTenantMixin, Base):
    __tablename__ = "factory_homepage_designs"
    __table_args__ = (UniqueConstraint("project_id", "design_key", name="uq_factory_homepage_design_key"),)
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    design_number: Mapped[str] = mapped_column(String(96), unique=True, index=True)
    design_key: Mapped[str] = mapped_column(String(80), nullable=False)
    display_name: Mapped[str] = mapped_column(String(200), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active", index=True)
    created_by: Mapped[str] = mapped_column(String(128), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)


class FactoryHomepageDesignVersion(HomepageDesignTenantMixin, Base):
    __tablename__ = "factory_homepage_design_versions"
    __table_args__ = (UniqueConstraint("design_id", "version_number", name="uq_factory_homepage_design_version"),)
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    version_number: Mapped[str] = mapped_column(String(96), unique=True, index=True)
    design_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    design_number: Mapped[str] = mapped_column(String(96), nullable=False)
    locale: Mapped[str] = mapped_column(String(16), nullable=False)
    composition_manifest_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    manifest_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    source_reference: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="draft", index=True)
    authored_by: Mapped[str] = mapped_column(String(128), nullable=False)
    validated_by: Mapped[str | None] = mapped_column(String(128))
    validated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    validation_reference: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)


class FactoryHomepageDesignPublication(HomepageDesignTenantMixin, Base):
    __tablename__ = "factory_homepage_design_publications"
    __table_args__ = (UniqueConstraint("design_version_id", "target", name="uq_factory_homepage_design_publication_target"),)
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    publication_number: Mapped[str] = mapped_column(String(96), unique=True, index=True)
    design_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    design_version_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
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


class FactoryHomepageDesignEvidence(HomepageDesignTenantMixin, Base):
    __tablename__ = "factory_homepage_design_evidence"
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
