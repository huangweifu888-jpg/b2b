"""Tenant-scoped analytical sources, immutable fact versions and lineage."""

from datetime import datetime

from core.database import Base
from sqlalchemy import Column, DateTime, Integer, Numeric, String, Text, UniqueConstraint


class FactoryWarehouseSource(Base):
    __tablename__ = "factory_warehouse_sources"
    __table_args__ = (
        UniqueConstraint("project_id", "source_code", name="uq_factory_warehouse_project_source"),
        UniqueConstraint("tenant_id", "source_reference", name="uq_factory_warehouse_tenant_source_reference"),
        {"extend_existing": True},
    )

    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    source_number = Column(String(100), nullable=False, unique=True, index=True)
    source_reference = Column(String(255), nullable=False, index=True)
    source_code = Column(String(50), nullable=False, index=True)
    source_system = Column(String(100), nullable=False, index=True)
    source_table = Column(String(100), nullable=False, index=True)
    domain = Column(String(50), nullable=False, index=True)
    owner = Column(String(255), nullable=False, index=True)
    purpose = Column(Text, nullable=False)
    retention_days = Column(Integer, nullable=False, default=730, server_default="730")
    extraction_mode = Column(String(40), nullable=False, default="incremental-snapshot", server_default="incremental-snapshot")
    schema_contract_reference = Column(String(500), nullable=True)
    schema_fingerprint = Column(String(64), nullable=True, index=True)
    status = Column(String(30), nullable=False, default="draft", server_default="draft", index=True)
    activated_by = Column(String(255), nullable=True, index=True)
    activated_at = Column(DateTime(timezone=True), nullable=True)
    last_load_run_id = Column(String(100), nullable=True, index=True)
    last_watermark_at = Column(DateTime(timezone=True), nullable=True, index=True)
    last_published_at = Column(DateTime(timezone=True), nullable=True, index=True)
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    updated_by = Column(String(255), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)


class FactoryWarehouseLoadRun(Base):
    __tablename__ = "factory_warehouse_load_runs"
    __table_args__ = (
        UniqueConstraint("tenant_id", "load_reference", name="uq_factory_warehouse_tenant_load_reference"),
        {"extend_existing": True},
    )

    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    run_number = Column(String(100), nullable=False, unique=True, index=True)
    load_reference = Column(String(255), nullable=False, index=True)
    source_id = Column(String(100), nullable=False, index=True)
    source_number = Column(String(100), nullable=False, index=True)
    source_code = Column(String(50), nullable=False, index=True)
    source_table = Column(String(100), nullable=False, index=True)
    status = Column(String(30), nullable=False, default="extracted", server_default="extracted", index=True)
    cutoff_at = Column(DateTime(timezone=True), nullable=False, index=True)
    watermark_from = Column(DateTime(timezone=True), nullable=True)
    watermark_to = Column(DateTime(timezone=True), nullable=True)
    rows_read = Column(Integer, nullable=False, default=0, server_default="0")
    rows_accepted = Column(Integer, nullable=False, default=0, server_default="0")
    rows_rejected = Column(Integer, nullable=False, default=0, server_default="0")
    reused_fact_count = Column(Integer, nullable=False, default=0, server_default="0")
    quality_score = Column(Numeric(7, 2), nullable=False, default=0, server_default="0")
    schema_fingerprint = Column(String(64), nullable=False, index=True)
    validation_reference = Column(String(500), nullable=True)
    validated_by = Column(String(255), nullable=True, index=True)
    validated_at = Column(DateTime(timezone=True), nullable=True)
    publication_reference = Column(String(500), nullable=True)
    published_by = Column(String(255), nullable=True, index=True)
    published_at = Column(DateTime(timezone=True), nullable=True)
    failure_reason = Column(Text, nullable=True)
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    updated_by = Column(String(255), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)


class FactoryWarehouseFactVersion(Base):
    __tablename__ = "factory_warehouse_fact_versions"
    __table_args__ = (
        UniqueConstraint("tenant_id", "source_code", "source_object_id", "source_revision", name="uq_factory_warehouse_fact_source_version"),
        {"extend_existing": True},
    )

    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    fact_number = Column(String(100), nullable=False, unique=True, index=True)
    first_load_run_id = Column(String(100), nullable=False, index=True)
    source_id = Column(String(100), nullable=False, index=True)
    source_code = Column(String(50), nullable=False, index=True)
    source_system = Column(String(100), nullable=False, index=True)
    source_table = Column(String(100), nullable=False, index=True)
    source_object_id = Column(String(100), nullable=False, index=True)
    source_object_number = Column(String(255), nullable=False, index=True)
    source_revision = Column(Integer, nullable=False, index=True)
    source_updated_at = Column(DateTime(timezone=True), nullable=False, index=True)
    business_date = Column(DateTime(timezone=True), nullable=False, index=True)
    observed_at = Column(DateTime(timezone=True), nullable=False, index=True)
    payload_json = Column(Text, nullable=False)
    content_hash = Column(String(64), nullable=False, index=True)
    quality_status = Column(String(30), nullable=False, default="accepted", server_default="accepted", index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)


class FactoryWarehouseQualityIssue(Base):
    __tablename__ = "factory_warehouse_quality_issues"
    __table_args__ = {"extend_existing": True}

    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    issue_number = Column(String(100), nullable=False, unique=True, index=True)
    load_run_id = Column(String(100), nullable=False, index=True)
    run_number = Column(String(100), nullable=False, index=True)
    source_object_id = Column(String(100), nullable=True, index=True)
    source_object_number = Column(String(255), nullable=True, index=True)
    rule_code = Column(String(100), nullable=False, index=True)
    severity = Column(String(20), nullable=False, index=True)
    description = Column(Text, nullable=False)
    status = Column(String(30), nullable=False, default="open", server_default="open", index=True)
    resolution_reference = Column(String(500), nullable=True)
    resolution_note = Column(Text, nullable=True)
    resolved_by = Column(String(255), nullable=True, index=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    updated_by = Column(String(255), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)


class FactoryWarehouseLineageEdge(Base):
    __tablename__ = "factory_warehouse_lineage_edges"
    __table_args__ = (
        UniqueConstraint("load_run_id", "fact_id", name="uq_factory_warehouse_run_fact_lineage"),
        {"extend_existing": True},
    )

    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    edge_number = Column(String(100), nullable=False, unique=True, index=True)
    load_run_id = Column(String(100), nullable=False, index=True)
    run_number = Column(String(100), nullable=False, index=True)
    fact_id = Column(String(100), nullable=False, index=True)
    fact_number = Column(String(100), nullable=False, index=True)
    source_system = Column(String(100), nullable=False, index=True)
    source_table = Column(String(100), nullable=False, index=True)
    source_object_id = Column(String(100), nullable=False, index=True)
    source_revision = Column(Integer, nullable=False)
    transformation_reference = Column(String(500), nullable=False)
    observed_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.now)


class FactoryWarehouseEvidence(Base):
    __tablename__ = "factory_warehouse_evidence"
    __table_args__ = {"extend_existing": True}

    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    evidence_number = Column(String(100), nullable=False, unique=True, index=True)
    subject_type = Column(String(40), nullable=False, index=True)
    subject_id = Column(String(100), nullable=False, index=True)
    subject_number = Column(String(100), nullable=False, index=True)
    evidence_type = Column(String(50), nullable=False, index=True)
    evidence_reference = Column(String(500), nullable=False)
    note = Column(Text, nullable=False)
    recorded_by = Column(String(255), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
