"""Tenant-scoped governed structured-data publishing records."""
from datetime import datetime

from core.database import Base
from sqlalchemy import Boolean, DateTime, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column


class StructuredDataTenantMixin:
    project_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    agent_path: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    tenant_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    client_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    plan_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)


class FactoryStructuredDataBundle(StructuredDataTenantMixin, Base):
    __tablename__ = "factory_structured_data_bundles"
    __table_args__ = (UniqueConstraint("project_id", "bundle_code", name="uq_factory_structured_project_bundle"),)
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    bundle_number: Mapped[str] = mapped_column(String(96), nullable=False, unique=True, index=True)
    bundle_code: Mapped[str] = mapped_column(String(64), nullable=False)
    bundle_name: Mapped[str] = mapped_column(String(180), nullable=False)
    target_site_reference: Mapped[str] = mapped_column(String(180), nullable=False)
    default_locale: Mapped[str] = mapped_column(String(16), nullable=False)
    graph_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    graph_number: Mapped[str] = mapped_column(String(96), nullable=False)
    graph_version_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    graph_version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    graph_manifest_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="draft", index=True)
    authored_by: Mapped[str] = mapped_column(String(128), nullable=False)
    published_by: Mapped[str | None] = mapped_column(String(128))
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class FactoryStructuredDataMapping(StructuredDataTenantMixin, Base):
    __tablename__ = "factory_structured_data_mappings"
    __table_args__ = (UniqueConstraint("bundle_id", "schema_type", name="uq_factory_structured_bundle_schema"),)
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    mapping_number: Mapped[str] = mapped_column(String(96), nullable=False, unique=True, index=True)
    bundle_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    bundle_number: Mapped[str] = mapped_column(String(96), nullable=False)
    schema_type: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    source_entity_type: Mapped[str] = mapped_column(String(32), nullable=False)
    source_entity_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    source_entity_number: Mapped[str] = mapped_column(String(96), nullable=False)
    source_entity_revision: Mapped[int] = mapped_column(Integer, nullable=False)
    source_entity_fingerprint: Mapped[str] = mapped_column(String(64), nullable=False)
    field_map_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    required_fields_json: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="pending", index=True)
    created_by: Mapped[str] = mapped_column(String(128), nullable=False)
    verified_by: Mapped[str | None] = mapped_column(String(128))
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    verification_reference: Mapped[str | None] = mapped_column(String(255))
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class FactoryStructuredDataValidation(StructuredDataTenantMixin, Base):
    __tablename__ = "factory_structured_data_validations"
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    validation_number: Mapped[str] = mapped_column(String(96), nullable=False, unique=True, index=True)
    bundle_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    bundle_number: Mapped[str] = mapped_column(String(96), nullable=False)
    graph_manifest_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    mapping_count: Mapped[int] = mapped_column(Integer, nullable=False)
    error_count: Mapped[int] = mapped_column(Integer, nullable=False)
    warning_count: Mapped[int] = mapped_column(Integer, nullable=False)
    report_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    generated_document_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    generated_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False, index=True)
    executed_by: Mapped[str] = mapped_column(String(128), nullable=False)
    executed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class FactoryStructuredDataRelease(StructuredDataTenantMixin, Base):
    __tablename__ = "factory_structured_data_releases"
    __table_args__ = (UniqueConstraint("bundle_id", "version_number", name="uq_factory_structured_bundle_version"),)
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    release_number: Mapped[str] = mapped_column(String(96), nullable=False, unique=True, index=True)
    bundle_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    bundle_number: Mapped[str] = mapped_column(String(96), nullable=False)
    validation_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    validation_number: Mapped[str] = mapped_column(String(96), nullable=False)
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    document_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    document_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    schema_types_json: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="published", index=True)
    published_by: Mapped[str] = mapped_column(String(128), nullable=False)
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class FactoryStructuredDataPublication(StructuredDataTenantMixin, Base):
    __tablename__ = "factory_structured_data_publications"
    __table_args__ = (UniqueConstraint("release_id", "consumer", name="uq_factory_structured_release_consumer"),)
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    publication_number: Mapped[str] = mapped_column(String(96), nullable=False, unique=True, index=True)
    bundle_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    release_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    release_number: Mapped[str] = mapped_column(String(96), nullable=False)
    document_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    consumer: Mapped[str] = mapped_column(String(32), nullable=False)
    deployment_reference: Mapped[str] = mapped_column(String(255), nullable=False)
    consumer_mutated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="pending", index=True)
    created_by: Mapped[str] = mapped_column(String(128), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    acknowledged_by: Mapped[str | None] = mapped_column(String(128))
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    acknowledgement_reference: Mapped[str | None] = mapped_column(String(255))
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)


class FactoryStructuredDataEvidence(StructuredDataTenantMixin, Base):
    __tablename__ = "factory_structured_data_evidence"
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
