"""Tenant-scoped governed rolling demand, capacity and cash forecasts."""

from datetime import datetime

from core.database import Base
from sqlalchemy import Column, DateTime, Integer, Numeric, String, Text, UniqueConstraint


class FactoryForecastPolicy(Base):
    __tablename__ = "factory_forecast_policies"
    __table_args__ = (
        UniqueConstraint("tenant_id", "policy_code", name="uq_factory_forecast_tenant_code"),
        UniqueConstraint("tenant_id", "policy_reference", name="uq_factory_forecast_tenant_reference"),
        {"extend_existing": True},
    )
    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    policy_number = Column(String(100), nullable=False, unique=True, index=True)
    policy_reference = Column(String(255), nullable=False, index=True)
    policy_code = Column(String(100), nullable=False, index=True)
    owner = Column(String(255), nullable=False, index=True)
    purpose = Column(Text, nullable=False)
    status = Column(String(30), nullable=False, default="draft", server_default="draft", index=True)
    current_version_id = Column(String(100), nullable=True, index=True)
    current_version_number = Column(Integer, nullable=True, index=True)
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    updated_by = Column(String(255), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)


class FactoryForecastPolicyVersion(Base):
    __tablename__ = "factory_forecast_policy_versions"
    __table_args__ = (
        UniqueConstraint("policy_id", "version_number", name="uq_factory_forecast_policy_version"),
        UniqueConstraint("tenant_id", "version_reference", name="uq_factory_forecast_tenant_version_reference"),
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
    policy_id = Column(String(100), nullable=False, index=True)
    policy_number = Column(String(100), nullable=False, index=True)
    policy_code = Column(String(100), nullable=False, index=True)
    version_number = Column(Integer, nullable=False, index=True)
    label = Column(String(255), nullable=False)
    model_type = Column(String(60), nullable=False, index=True)
    horizon_days = Column(Integer, nullable=False)
    bucket_days = Column(Integer, nullable=False)
    demand_growth_percent = Column(Numeric(9, 4), nullable=False)
    pipeline_probability_percent = Column(Numeric(9, 4), nullable=False)
    collection_percent = Column(Numeric(9, 4), nullable=False)
    capacity_buffer_percent = Column(Numeric(9, 4), nullable=False)
    procurement_payment_percent = Column(Numeric(9, 4), nullable=False)
    policy_fingerprint = Column(String(64), nullable=False, index=True)
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


class FactoryForecastRun(Base):
    __tablename__ = "factory_forecast_runs"
    __table_args__ = (
        UniqueConstraint("tenant_id", "forecast_reference", name="uq_factory_forecast_tenant_run_reference"),
        {"extend_existing": True},
    )
    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    run_number = Column(String(100), nullable=False, unique=True, index=True)
    forecast_reference = Column(String(255), nullable=False, index=True)
    policy_id = Column(String(100), nullable=False, index=True)
    policy_version_id = Column(String(100), nullable=False, index=True)
    policy_version_number = Column(Integer, nullable=False)
    policy_fingerprint = Column(String(64), nullable=False, index=True)
    model_type = Column(String(60), nullable=False, index=True)
    as_of_at = Column(DateTime(timezone=True), nullable=False, index=True)
    horizon_days = Column(Integer, nullable=False)
    bucket_days = Column(Integer, nullable=False)
    currency = Column(String(3), nullable=False, index=True)
    source_count = Column(Integer, nullable=False)
    input_fact_count = Column(Integer, nullable=False)
    pipeline_demand_value = Column(Numeric(18, 2), nullable=False)
    confirmed_order_value = Column(Numeric(18, 2), nullable=False)
    required_capacity_units = Column(Numeric(18, 4), nullable=False)
    available_capacity_units = Column(Numeric(18, 4), nullable=False)
    capacity_gap_units = Column(Numeric(18, 4), nullable=False)
    expected_cash_in = Column(Numeric(18, 2), nullable=False)
    expected_cash_out = Column(Numeric(18, 2), nullable=False)
    net_cash_change = Column(Numeric(18, 2), nullable=False)
    forecast_classification = Column(String(60), nullable=False, default="management-rolling-forecast", server_default="management-rolling-forecast", index=True)
    status = Column(String(30), nullable=False, default="calculated", server_default="calculated", index=True)
    calculated_by = Column(String(255), nullable=False, index=True)
    calculated_at = Column(DateTime(timezone=True), nullable=False)
    verification_reference = Column(String(500), nullable=True)
    verification_note = Column(Text, nullable=True)
    verified_by = Column(String(255), nullable=True, index=True)
    verified_at = Column(DateTime(timezone=True), nullable=True)
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    updated_by = Column(String(255), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)


class FactoryForecastInputEdge(Base):
    __tablename__ = "factory_forecast_input_edges"
    __table_args__ = (
        UniqueConstraint("forecast_run_id", "warehouse_fact_id", name="uq_factory_forecast_run_fact"),
        {"extend_existing": True},
    )
    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    edge_number = Column(String(100), nullable=False, unique=True, index=True)
    forecast_run_id = Column(String(100), nullable=False, index=True)
    run_number = Column(String(100), nullable=False, index=True)
    source_code = Column(String(60), nullable=False, index=True)
    warehouse_load_run_id = Column(String(100), nullable=False, index=True)
    warehouse_run_number = Column(String(100), nullable=False, index=True)
    warehouse_fact_id = Column(String(100), nullable=False, index=True)
    warehouse_fact_number = Column(String(100), nullable=False, index=True)
    source_object_id = Column(String(100), nullable=False, index=True)
    source_object_number = Column(String(100), nullable=False, index=True)
    source_revision = Column(Integer, nullable=False)
    content_hash = Column(String(64), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)


class FactoryForecastBucket(Base):
    __tablename__ = "factory_forecast_buckets"
    __table_args__ = (
        UniqueConstraint("forecast_run_id", "bucket_index", name="uq_factory_forecast_run_bucket"),
        {"extend_existing": True},
    )
    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    bucket_number = Column(String(100), nullable=False, unique=True, index=True)
    forecast_run_id = Column(String(100), nullable=False, index=True)
    run_number = Column(String(100), nullable=False, index=True)
    bucket_index = Column(Integer, nullable=False)
    bucket_start = Column(DateTime(timezone=True), nullable=False, index=True)
    bucket_end = Column(DateTime(timezone=True), nullable=False, index=True)
    pipeline_demand_value = Column(Numeric(18, 2), nullable=False)
    confirmed_order_value = Column(Numeric(18, 2), nullable=False)
    required_capacity_units = Column(Numeric(18, 4), nullable=False)
    available_capacity_units = Column(Numeric(18, 4), nullable=False)
    expected_cash_in = Column(Numeric(18, 2), nullable=False)
    expected_cash_out = Column(Numeric(18, 2), nullable=False)
    net_cash_change = Column(Numeric(18, 2), nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.now)


class FactoryForecastEvidence(Base):
    __tablename__ = "factory_forecast_evidence"
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
