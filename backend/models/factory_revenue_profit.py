"""Tenant-scoped governed attribution and management contribution analysis."""

from datetime import datetime

from core.database import Base
from sqlalchemy import Column, DateTime, Integer, Numeric, String, Text, UniqueConstraint

class FactoryAttributionPolicy(Base):
    __tablename__ = "factory_attribution_policies"
    __table_args__ = (
        UniqueConstraint("tenant_id", "policy_code", name="uq_factory_attribution_tenant_code"),
        UniqueConstraint("tenant_id", "policy_reference", name="uq_factory_attribution_tenant_reference"),
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


class FactoryAttributionPolicyVersion(Base):
    __tablename__ = "factory_attribution_policy_versions"
    __table_args__ = (
        UniqueConstraint("policy_id", "version_number", name="uq_factory_attribution_policy_version"),
        UniqueConstraint("tenant_id", "version_reference", name="uq_factory_attribution_tenant_version_reference"),
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
    model_type = Column(String(30), nullable=False, index=True)
    lookback_days = Column(Integer, nullable=False)
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


class FactoryAttributionTouchpoint(Base):
    __tablename__ = "factory_attribution_touchpoints"
    __table_args__ = (
        UniqueConstraint("tenant_id", "external_event_reference", name="uq_factory_attribution_tenant_event"),
        {"extend_existing": True},
    )
    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    touchpoint_number = Column(String(100), nullable=False, unique=True, index=True)
    external_event_reference = Column(String(255), nullable=False, index=True)
    correlation_id = Column(String(100), nullable=False, index=True)
    account_reference = Column(String(255), nullable=False, index=True)
    channel = Column(String(100), nullable=False, index=True)
    campaign_reference = Column(String(255), nullable=False, index=True)
    content_reference = Column(String(255), nullable=True, index=True)
    occurred_at = Column(DateTime(timezone=True), nullable=False, index=True)
    spend_amount = Column(Numeric(18, 2), nullable=False, default=0, server_default="0")
    currency = Column(String(3), nullable=False, index=True)
    consent_reference = Column(String(500), nullable=False)
    evidence_fingerprint = Column(String(64), nullable=False, index=True)
    recorded_by = Column(String(255), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)


class FactoryRevenueProfitBinding(Base):
    __tablename__ = "factory_revenue_profit_bindings"
    __table_args__ = (
        UniqueConstraint("tenant_id", "binding_reference", name="uq_factory_revenue_profit_tenant_binding"),
        UniqueConstraint("revenue_fact_id", "quote_fact_id", name="uq_factory_revenue_profit_fact_pair"),
        {"extend_existing": True},
    )
    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    binding_number = Column(String(100), nullable=False, unique=True, index=True)
    binding_reference = Column(String(255), nullable=False, index=True)
    correlation_id = Column(String(100), nullable=False, index=True)
    account_reference = Column(String(255), nullable=False, index=True)
    currency = Column(String(3), nullable=False, index=True)
    revenue_load_run_id = Column(String(100), nullable=False, index=True)
    revenue_run_number = Column(String(100), nullable=False, index=True)
    revenue_fact_id = Column(String(100), nullable=False, index=True)
    revenue_fact_number = Column(String(100), nullable=False, index=True)
    revenue_source_revision = Column(Integer, nullable=False)
    quote_load_run_id = Column(String(100), nullable=False, index=True)
    quote_run_number = Column(String(100), nullable=False, index=True)
    quote_fact_id = Column(String(100), nullable=False, index=True)
    quote_fact_number = Column(String(100), nullable=False, index=True)
    quote_source_revision = Column(Integer, nullable=False)
    status = Column(String(30), nullable=False, default="pending-verification", server_default="pending-verification", index=True)
    created_by = Column(String(255), nullable=False, index=True)
    verified_by = Column(String(255), nullable=True, index=True)
    verification_reference = Column(String(500), nullable=True)
    verified_at = Column(DateTime(timezone=True), nullable=True)
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    updated_by = Column(String(255), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)


class FactoryRevenueProfitRun(Base):
    __tablename__ = "factory_revenue_profit_runs"
    __table_args__ = (
        UniqueConstraint("tenant_id", "analysis_reference", name="uq_factory_revenue_profit_tenant_analysis"),
        UniqueConstraint("binding_id", "policy_version_id", name="uq_factory_revenue_profit_binding_policy"),
        {"extend_existing": True},
    )
    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    run_number = Column(String(100), nullable=False, unique=True, index=True)
    analysis_reference = Column(String(255), nullable=False, index=True)
    binding_id = Column(String(100), nullable=False, index=True)
    binding_number = Column(String(100), nullable=False, index=True)
    policy_id = Column(String(100), nullable=False, index=True)
    policy_version_id = Column(String(100), nullable=False, index=True)
    policy_version_number = Column(Integer, nullable=False)
    policy_fingerprint = Column(String(64), nullable=False, index=True)
    model_type = Column(String(30), nullable=False, index=True)
    correlation_id = Column(String(100), nullable=False, index=True)
    account_reference = Column(String(255), nullable=False, index=True)
    currency = Column(String(3), nullable=False, index=True)
    recognized_revenue = Column(Numeric(18, 2), nullable=False)
    governed_sales_cost = Column(Numeric(18, 2), nullable=False)
    marketing_spend = Column(Numeric(18, 2), nullable=False)
    contribution_margin = Column(Numeric(18, 2), nullable=False)
    contribution_margin_percent = Column(Numeric(9, 4), nullable=False)
    touchpoint_count = Column(Integer, nullable=False)
    profit_classification = Column(String(60), nullable=False, default="management-contribution-estimate", server_default="management-contribution-estimate", index=True)
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


class FactoryRevenueProfitAllocation(Base):
    __tablename__ = "factory_revenue_profit_allocations"
    __table_args__ = (
        UniqueConstraint("analysis_run_id", "touchpoint_id", name="uq_factory_revenue_profit_run_touchpoint"),
        {"extend_existing": True},
    )
    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    allocation_number = Column(String(100), nullable=False, unique=True, index=True)
    analysis_run_id = Column(String(100), nullable=False, index=True)
    run_number = Column(String(100), nullable=False, index=True)
    touchpoint_id = Column(String(100), nullable=False, index=True)
    touchpoint_number = Column(String(100), nullable=False, index=True)
    channel = Column(String(100), nullable=False, index=True)
    campaign_reference = Column(String(255), nullable=False, index=True)
    weight = Column(Numeric(9, 6), nullable=False)
    attributed_revenue = Column(Numeric(18, 2), nullable=False)
    attributed_sales_cost = Column(Numeric(18, 2), nullable=False)
    touchpoint_spend = Column(Numeric(18, 2), nullable=False)
    attributed_contribution = Column(Numeric(18, 2), nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.now)


class FactoryRevenueProfitEvidence(Base):
    __tablename__ = "factory_revenue_profit_evidence"
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
