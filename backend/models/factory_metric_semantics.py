"""Tenant-scoped governed metric definitions, versions and observations."""

from datetime import datetime

from core.database import Base
from sqlalchemy import Column, DateTime, Integer, Numeric, String, Text, UniqueConstraint


class FactoryMetricDefinition(Base):
    __tablename__ = "factory_metric_definitions"
    __table_args__ = (
        UniqueConstraint("tenant_id", "metric_code", name="uq_factory_metric_tenant_code"),
        UniqueConstraint("tenant_id", "definition_reference", name="uq_factory_metric_tenant_reference"),
        {"extend_existing": True},
    )

    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    definition_number = Column(String(100), nullable=False, unique=True, index=True)
    definition_reference = Column(String(255), nullable=False, index=True)
    metric_code = Column(String(100), nullable=False, index=True)
    domain = Column(String(50), nullable=False, index=True)
    owner = Column(String(255), nullable=False, index=True)
    purpose = Column(Text, nullable=False)
    status = Column(String(30), nullable=False, default="draft", server_default="draft", index=True)
    current_version_id = Column(String(100), nullable=True, index=True)
    current_version_number = Column(Integer, nullable=True, index=True)
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    updated_by = Column(String(255), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)


class FactoryMetricVersion(Base):
    __tablename__ = "factory_metric_versions"
    __table_args__ = (
        UniqueConstraint("definition_id", "version_number", name="uq_factory_metric_definition_version"),
        UniqueConstraint("tenant_id", "version_reference", name="uq_factory_metric_tenant_version_reference"),
        {"extend_existing": True},
    )

    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    version_number_record = Column(String(100), nullable=False, unique=True, index=True)
    version_reference = Column(String(255), nullable=False, index=True)
    definition_id = Column(String(100), nullable=False, index=True)
    definition_number = Column(String(100), nullable=False, index=True)
    metric_code = Column(String(100), nullable=False, index=True)
    version_number = Column(Integer, nullable=False, index=True)
    label = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    unit = Column(String(50), nullable=False, index=True)
    aggregation = Column(String(30), nullable=False, index=True)
    value_field = Column(String(100), nullable=True, index=True)
    numerator_field = Column(String(100), nullable=True, index=True)
    denominator_field = Column(String(100), nullable=True, index=True)
    filter_field = Column(String(100), nullable=True, index=True)
    filter_operator = Column(String(20), nullable=True)
    filter_value = Column(String(500), nullable=True)
    dimensions_json = Column(Text, nullable=False, default="[]", server_default="[]")
    source_id = Column(String(100), nullable=False, index=True)
    source_code = Column(String(50), nullable=False, index=True)
    source_schema_fingerprint = Column(String(64), nullable=False, index=True)
    formula_hash = Column(String(64), nullable=False, index=True)
    status = Column(String(30), nullable=False, default="draft", server_default="draft", index=True)
    change_reason = Column(Text, nullable=False)
    effective_from = Column(DateTime(timezone=True), nullable=False, index=True)
    authored_by = Column(String(255), nullable=False, index=True)
    submitted_by = Column(String(255), nullable=True, index=True)
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    approval_reference = Column(String(500), nullable=True)
    approved_by = Column(String(255), nullable=True, index=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    updated_by = Column(String(255), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)


class FactoryMetricEvaluationRun(Base):
    __tablename__ = "factory_metric_evaluation_runs"
    __table_args__ = (
        UniqueConstraint("tenant_id", "evaluation_reference", name="uq_factory_metric_tenant_evaluation_reference"),
        UniqueConstraint("metric_version_id", "warehouse_load_run_id", name="uq_factory_metric_version_warehouse_run"),
        {"extend_existing": True},
    )

    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    run_number = Column(String(100), nullable=False, unique=True, index=True)
    evaluation_reference = Column(String(255), nullable=False, index=True)
    definition_id = Column(String(100), nullable=False, index=True)
    definition_number = Column(String(100), nullable=False, index=True)
    metric_version_id = Column(String(100), nullable=False, index=True)
    metric_version_number = Column(Integer, nullable=False, index=True)
    metric_code = Column(String(100), nullable=False, index=True)
    formula_hash = Column(String(64), nullable=False, index=True)
    warehouse_load_run_id = Column(String(100), nullable=False, index=True)
    warehouse_run_number = Column(String(100), nullable=False, index=True)
    source_code = Column(String(50), nullable=False, index=True)
    source_watermark_at = Column(DateTime(timezone=True), nullable=True, index=True)
    status = Column(String(30), nullable=False, default="evaluated", server_default="evaluated", index=True)
    fact_count = Column(Integer, nullable=False, default=0, server_default="0")
    lineage_count = Column(Integer, nullable=False, default=0, server_default="0")
    numerator_value = Column(Numeric(24, 6), nullable=False, default=0, server_default="0")
    denominator_value = Column(Numeric(24, 6), nullable=False, default=1, server_default="1")
    metric_value = Column(Numeric(24, 6), nullable=False, default=0, server_default="0")
    observation_count = Column(Integer, nullable=False, default=0, server_default="0")
    evaluated_by = Column(String(255), nullable=False, index=True)
    evaluated_at = Column(DateTime(timezone=True), nullable=False)
    verification_reference = Column(String(500), nullable=True)
    verification_note = Column(Text, nullable=True)
    verified_by = Column(String(255), nullable=True, index=True)
    verified_at = Column(DateTime(timezone=True), nullable=True)
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    updated_by = Column(String(255), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)


class FactoryMetricObservation(Base):
    __tablename__ = "factory_metric_observations"
    __table_args__ = (
        UniqueConstraint("evaluation_run_id", "dimension_key", name="uq_factory_metric_run_dimension"),
        {"extend_existing": True},
    )

    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    observation_number = Column(String(100), nullable=False, unique=True, index=True)
    evaluation_run_id = Column(String(100), nullable=False, index=True)
    run_number = Column(String(100), nullable=False, index=True)
    metric_code = Column(String(100), nullable=False, index=True)
    dimension_key = Column(String(500), nullable=False, index=True)
    dimensions_json = Column(Text, nullable=False, default="{}", server_default="{}")
    fact_count = Column(Integer, nullable=False, default=0, server_default="0")
    numerator_value = Column(Numeric(24, 6), nullable=False, default=0, server_default="0")
    denominator_value = Column(Numeric(24, 6), nullable=False, default=1, server_default="1")
    metric_value = Column(Numeric(24, 6), nullable=False, default=0, server_default="0")
    created_at = Column(DateTime(timezone=True), default=datetime.now)


class FactoryMetricEvidence(Base):
    __tablename__ = "factory_metric_evidence"
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
