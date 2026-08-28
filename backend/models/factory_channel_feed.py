"""Tenant-scoped governed product feed and channel listing records."""
from datetime import datetime

from core.database import Base
from sqlalchemy import Boolean, DateTime, Integer, JSON, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column


class ChannelTenantMixin:
    project_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    agent_path: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    tenant_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    client_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    plan_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)


class FactoryChannelCatalog(ChannelTenantMixin, Base):
    __tablename__ = "factory_channel_catalogs"
    __table_args__ = (UniqueConstraint("project_id", "catalog_code", name="uq_factory_channel_project_catalog"),)
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    catalog_number: Mapped[str] = mapped_column(String(96), nullable=False, unique=True, index=True)
    catalog_code: Mapped[str] = mapped_column(String(64), nullable=False)
    catalog_name: Mapped[str] = mapped_column(String(180), nullable=False)
    source_release_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    source_release_number: Mapped[str] = mapped_column(String(96), nullable=False)
    source_release_version: Mapped[int] = mapped_column(Integer, nullable=False)
    source_document_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    default_locale: Mapped[str] = mapped_column(String(16), nullable=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="draft", index=True)
    authored_by: Mapped[str] = mapped_column(String(128), nullable=False)
    published_by: Mapped[str | None] = mapped_column(String(128))
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class FactoryChannelAccount(ChannelTenantMixin, Base):
    __tablename__ = "factory_channel_accounts"
    __table_args__ = (UniqueConstraint("project_id", "platform", "account_reference", name="uq_factory_channel_platform_account"),)
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    account_number: Mapped[str] = mapped_column(String(96), nullable=False, unique=True, index=True)
    platform: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    account_reference: Mapped[str] = mapped_column(String(180), nullable=False)
    credential_reference: Mapped[str] = mapped_column(String(255), nullable=False)
    territory: Mapped[str] = mapped_column(String(16), nullable=False)
    locale: Mapped[str] = mapped_column(String(16), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="pending", index=True)
    requested_by: Mapped[str] = mapped_column(String(128), nullable=False)
    approved_by: Mapped[str | None] = mapped_column(String(128))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    approval_reference: Mapped[str | None] = mapped_column(String(255))
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class FactoryChannelListing(ChannelTenantMixin, Base):
    __tablename__ = "factory_channel_listings"
    __table_args__ = (UniqueConstraint("catalog_id", "account_id", "external_sku", name="uq_factory_channel_catalog_account_sku"),)
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    listing_number: Mapped[str] = mapped_column(String(96), nullable=False, unique=True, index=True)
    catalog_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    catalog_number: Mapped[str] = mapped_column(String(96), nullable=False)
    account_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    account_number: Mapped[str] = mapped_column(String(96), nullable=False)
    external_sku: Mapped[str] = mapped_column(String(120), nullable=False)
    product_name: Mapped[str] = mapped_column(String(255), nullable=False)
    product_identifier: Mapped[str] = mapped_column(String(180), nullable=False)
    source_product_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    price_mode: Mapped[str] = mapped_column(String(32), nullable=False)
    price_amount: Mapped[float | None] = mapped_column(Numeric(18, 2))
    currency: Mapped[str | None] = mapped_column(String(3))
    price_reference: Mapped[str | None] = mapped_column(String(255))
    inventory_mode: Mapped[str] = mapped_column(String(32), nullable=False)
    availability_status: Mapped[str] = mapped_column(String(32), nullable=False)
    inventory_reference: Mapped[str | None] = mapped_column(String(255))
    channel_attributes_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="pending", index=True)
    created_by: Mapped[str] = mapped_column(String(128), nullable=False)
    validated_by: Mapped[str | None] = mapped_column(String(128))
    validated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    validation_reference: Mapped[str | None] = mapped_column(String(255))
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class FactoryChannelFeedRun(ChannelTenantMixin, Base):
    __tablename__ = "factory_channel_feed_runs"
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    run_number: Mapped[str] = mapped_column(String(96), nullable=False, unique=True, index=True)
    catalog_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    catalog_number: Mapped[str] = mapped_column(String(96), nullable=False)
    source_document_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    listing_count: Mapped[int] = mapped_column(Integer, nullable=False)
    error_count: Mapped[int] = mapped_column(Integer, nullable=False)
    warning_count: Mapped[int] = mapped_column(Integer, nullable=False)
    report_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    payload_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    payload_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False, index=True)
    executed_by: Mapped[str] = mapped_column(String(128), nullable=False)
    executed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class FactoryChannelFeedRelease(ChannelTenantMixin, Base):
    __tablename__ = "factory_channel_feed_releases"
    __table_args__ = (UniqueConstraint("catalog_id", "version_number", name="uq_factory_channel_catalog_version"),)
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    release_number: Mapped[str] = mapped_column(String(96), nullable=False, unique=True, index=True)
    catalog_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    catalog_number: Mapped[str] = mapped_column(String(96), nullable=False)
    run_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    run_number: Mapped[str] = mapped_column(String(96), nullable=False)
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    payload_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    payload_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    channel_count: Mapped[int] = mapped_column(Integer, nullable=False)
    listing_count: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="published", index=True)
    published_by: Mapped[str] = mapped_column(String(128), nullable=False)
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class FactoryChannelPublication(ChannelTenantMixin, Base):
    __tablename__ = "factory_channel_publications"
    __table_args__ = (UniqueConstraint("release_id", "account_id", name="uq_factory_channel_release_account"),)
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    publication_number: Mapped[str] = mapped_column(String(96), nullable=False, unique=True, index=True)
    catalog_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    release_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    release_number: Mapped[str] = mapped_column(String(96), nullable=False)
    account_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    account_number: Mapped[str] = mapped_column(String(96), nullable=False)
    payload_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    remote_reference: Mapped[str] = mapped_column(String(255), nullable=False)
    consumer_mutated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="pending", index=True)
    created_by: Mapped[str] = mapped_column(String(128), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    acknowledged_by: Mapped[str | None] = mapped_column(String(128))
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    acknowledgement_reference: Mapped[str | None] = mapped_column(String(255))
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)


class FactoryChannelEvidence(ChannelTenantMixin, Base):
    __tablename__ = "factory_channel_evidence"
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    evidence_number: Mapped[str] = mapped_column(String(96), nullable=False, unique=True, index=True)
    subject_type: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    subject_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    subject_number: Mapped[str] = mapped_column(String(96), nullable=False)
    evidence_type: Mapped[str] = mapped_column(String(48), nullable=False)
    evidence_reference: Mapped[str] = mapped_column(String(255), nullable=False)
    note: Mapped[str | None] = mapped_column(Text)
    recorded_by: Mapped[str] = mapped_column(String(128), nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
