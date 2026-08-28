"""Tenant-scoped, release-governed product-channel content."""
from datetime import datetime

from core.database import Base
from sqlalchemy import Boolean, DateTime, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column


class ProductContentTenantMixin:
    project_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    agent_path: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    tenant_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    client_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    plan_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)


class FactoryProductContentAsset(ProductContentTenantMixin, Base):
    __tablename__ = "factory_product_content_assets"
    __table_args__ = (UniqueConstraint("project_id", "product_reference", name="uq_factory_product_content_product"),)
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    asset_number: Mapped[str] = mapped_column(String(96), unique=True, index=True)
    product_reference: Mapped[str] = mapped_column(String(160), nullable=False)
    display_name: Mapped[str] = mapped_column(String(200), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active", index=True)
    created_by: Mapped[str] = mapped_column(String(128), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)


class FactoryProductContentVersion(ProductContentTenantMixin, Base):
    __tablename__ = "factory_product_content_versions"
    __table_args__ = (UniqueConstraint("asset_id", "version_number", name="uq_factory_product_content_version"),)
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    version_number: Mapped[str] = mapped_column(String(96), unique=True, index=True)
    asset_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    asset_number: Mapped[str] = mapped_column(String(96), nullable=False)
    locale: Mapped[str] = mapped_column(String(16), nullable=False)
    content_document_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    document_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    product_fact_reference: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="draft", index=True)
    authored_by: Mapped[str] = mapped_column(String(128), nullable=False)
    reviewed_by: Mapped[str | None] = mapped_column(String(128))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    review_reference: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)


class FactoryProductContentPublication(ProductContentTenantMixin, Base):
    __tablename__ = "factory_product_content_publications"
    __table_args__ = (UniqueConstraint("content_version_id", "target", name="uq_factory_product_content_publication_target"),)
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    publication_number: Mapped[str] = mapped_column(String(96), unique=True, index=True)
    asset_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    content_version_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    version_number: Mapped[str] = mapped_column(String(96), nullable=False)
    target: Mapped[str] = mapped_column(String(40), nullable=False)
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


class FactoryProductContentEvidence(ProductContentTenantMixin, Base):
    __tablename__ = "factory_product_content_evidence"
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
