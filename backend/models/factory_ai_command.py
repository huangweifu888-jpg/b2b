"""Tenant-scoped governed decision questions, scenarios and action handoffs."""

from datetime import datetime

from core.database import Base
from sqlalchemy import Column, DateTime, Integer, Numeric, String, Text, UniqueConstraint


class FactoryAiCommandQuery(Base):
    __tablename__ = "factory_ai_command_queries"
    __table_args__ = (
        UniqueConstraint("tenant_id", "query_reference", name="uq_factory_ai_query_tenant_reference"),
        {"extend_existing": True},
    )
    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    query_number = Column(String(100), nullable=False, unique=True, index=True)
    query_reference = Column(String(255), nullable=False, index=True)
    question = Column(Text, nullable=False)
    intent = Column(String(50), nullable=False, index=True)
    answer = Column(Text, nullable=False)
    confidence = Column(Numeric(7, 4), nullable=False)
    verified_fact_count = Column(Integer, nullable=False)
    engine_version = Column(String(50), nullable=False)
    engine_fingerprint = Column(String(64), nullable=False, index=True)
    classification = Column(String(60), nullable=False, default="governed-decision-assistance", server_default="governed-decision-assistance", index=True)
    status = Column(String(30), nullable=False, default="answered", server_default="answered", index=True)
    requested_by = Column(String(255), nullable=False, index=True)
    requested_at = Column(DateTime(timezone=True), nullable=False)
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    created_at = Column(DateTime(timezone=True), default=datetime.now)


class FactoryAiCommandCitation(Base):
    __tablename__ = "factory_ai_command_citations"
    __table_args__ = (
        UniqueConstraint("query_id", "source_type", "source_id", name="uq_factory_ai_query_source"),
        {"extend_existing": True},
    )
    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    citation_number = Column(String(100), nullable=False, unique=True, index=True)
    query_id = Column(String(100), nullable=False, index=True)
    query_number = Column(String(100), nullable=False, index=True)
    source_type = Column(String(60), nullable=False, index=True)
    source_id = Column(String(100), nullable=False, index=True)
    source_number = Column(String(100), nullable=False, index=True)
    source_revision = Column(Integer, nullable=False)
    source_status = Column(String(30), nullable=False)
    observed_at = Column(DateTime(timezone=True), nullable=False)
    content_fingerprint = Column(String(64), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)


class FactoryAiCommandScenario(Base):
    __tablename__ = "factory_ai_command_scenarios"
    __table_args__ = (
        UniqueConstraint("tenant_id", "scenario_reference", name="uq_factory_ai_scenario_tenant_reference"),
        {"extend_existing": True},
    )
    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    scenario_number = Column(String(100), nullable=False, unique=True, index=True)
    scenario_reference = Column(String(255), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    base_forecast_run_id = Column(String(100), nullable=False, index=True)
    base_forecast_run_number = Column(String(100), nullable=False, index=True)
    base_forecast_revision = Column(Integer, nullable=False)
    demand_change_percent = Column(Numeric(9, 4), nullable=False)
    capacity_change_percent = Column(Numeric(9, 4), nullable=False)
    cash_in_change_percent = Column(Numeric(9, 4), nullable=False)
    cash_out_change_percent = Column(Numeric(9, 4), nullable=False)
    simulated_order_value = Column(Numeric(18, 2), nullable=False)
    simulated_required_capacity = Column(Numeric(18, 4), nullable=False)
    simulated_available_capacity = Column(Numeric(18, 4), nullable=False)
    simulated_capacity_gap = Column(Numeric(18, 4), nullable=False)
    simulated_cash_in = Column(Numeric(18, 2), nullable=False)
    simulated_cash_out = Column(Numeric(18, 2), nullable=False)
    simulated_net_cash = Column(Numeric(18, 2), nullable=False)
    engine_version = Column(String(50), nullable=False)
    engine_fingerprint = Column(String(64), nullable=False, index=True)
    status = Column(String(30), nullable=False, default="calculated", server_default="calculated", index=True)
    calculated_by = Column(String(255), nullable=False, index=True)
    calculated_at = Column(DateTime(timezone=True), nullable=False)
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    created_at = Column(DateTime(timezone=True), default=datetime.now)


class FactoryAiCommandRecommendation(Base):
    __tablename__ = "factory_ai_command_recommendations"
    __table_args__ = {"extend_existing": True}
    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    recommendation_number = Column(String(100), nullable=False, unique=True, index=True)
    query_id = Column(String(100), nullable=True, index=True)
    scenario_id = Column(String(100), nullable=True, index=True)
    title = Column(String(255), nullable=False)
    rationale = Column(Text, nullable=False)
    target_system = Column(String(60), nullable=False, index=True)
    owner = Column(String(255), nullable=False, index=True)
    due_at = Column(DateTime(timezone=True), nullable=False, index=True)
    risk_level = Column(String(20), nullable=False, index=True)
    status = Column(String(30), nullable=False, default="pending-approval", server_default="pending-approval", index=True)
    authored_by = Column(String(255), nullable=False, index=True)
    approval_reference = Column(String(500), nullable=True)
    approved_by = Column(String(255), nullable=True, index=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    updated_by = Column(String(255), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)


class FactoryAiCommandHandoff(Base):
    __tablename__ = "factory_ai_command_handoffs"
    __table_args__ = (
        UniqueConstraint("recommendation_id", name="uq_factory_ai_recommendation_handoff"),
        {"extend_existing": True},
    )
    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    handoff_number = Column(String(100), nullable=False, unique=True, index=True)
    recommendation_id = Column(String(100), nullable=False, index=True)
    recommendation_number = Column(String(100), nullable=False, index=True)
    target_system = Column(String(60), nullable=False, index=True)
    handoff_reference = Column(String(500), nullable=False)
    execution_reference = Column(String(500), nullable=True)
    status = Column(String(30), nullable=False, default="handed-off", server_default="handed-off", index=True)
    handed_off_by = Column(String(255), nullable=False, index=True)
    handed_off_at = Column(DateTime(timezone=True), nullable=False)
    closed_by = Column(String(255), nullable=True, index=True)
    closed_at = Column(DateTime(timezone=True), nullable=True)
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    created_at = Column(DateTime(timezone=True), default=datetime.now)


class FactoryAiCommandEvidence(Base):
    __tablename__ = "factory_ai_command_evidence"
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
