"""Tenant-scoped renewal growth opportunities and append-only evidence."""

from datetime import datetime

from core.database import Base
from sqlalchemy import Column, DateTime, Integer, Numeric, String, Text, UniqueConstraint


class FactoryRenewalGrowthOpportunity(Base):
    __tablename__ = "factory_renewal_growth_opportunities"
    __table_args__ = (
        UniqueConstraint("tenant_id", "opportunity_reference", name="uq_factory_renewal_tenant_reference"),
        UniqueConstraint("tenant_id", "quote_id", name="uq_factory_renewal_tenant_quote"),
        UniqueConstraint("tenant_id", "order_id", name="uq_factory_renewal_tenant_order"),
        {"extend_existing": True},
    )

    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    opportunity_number = Column(String(100), nullable=False, unique=True, index=True)
    opportunity_reference = Column(String(255), nullable=False, index=True)
    asset_id = Column(String(100), nullable=False, index=True)
    asset_number = Column(String(100), nullable=False, index=True)
    original_order_id = Column(String(100), nullable=False, index=True)
    original_order_number = Column(String(100), nullable=False, index=True)
    account_reference = Column(String(255), nullable=False, index=True)
    current_product_reference = Column(String(255), nullable=False, index=True)
    current_sku_reference = Column(String(255), nullable=False, index=True)
    serial_number = Column(String(255), nullable=False, index=True)
    warranty_until = Column(DateTime(timezone=True), nullable=False, index=True)
    service_count_snapshot = Column(Integer, nullable=False, default=0, server_default="0")
    resolved_service_count = Column(Integer, nullable=False, default=0, server_default="0")
    closed_rma_count = Column(Integer, nullable=False, default=0, server_default="0")
    manufacturer_fault_count = Column(Integer, nullable=False, default=0, server_default="0")
    health_score = Column(Integer, nullable=True, index=True)
    risk_level = Column(String(20), nullable=True, index=True)
    source_snapshot_json = Column(Text, nullable=False, default="{}", server_default="{}")
    lifecycle_status = Column(String(40), nullable=False, default="draft", server_default="draft", index=True)
    motion = Column(String(30), nullable=True, index=True)
    owner = Column(String(255), nullable=False, index=True)
    next_action_at = Column(DateTime(timezone=True), nullable=False, index=True)
    value_evidence_reference = Column(String(500), nullable=True)
    customer_goal = Column(Text, nullable=True)
    customer_confirmation_reference = Column(String(500), nullable=True)
    recommendation_reference = Column(String(500), nullable=True)
    recommended_product_reference = Column(String(255), nullable=True, index=True)
    recommended_sku_reference = Column(String(255), nullable=True, index=True)
    recommended_quantity = Column(Numeric(18, 4), nullable=True)
    currency = Column(String(3), nullable=True)
    estimated_unit_price = Column(Numeric(18, 2), nullable=True)
    estimated_unit_cost = Column(Numeric(18, 2), nullable=True)
    estimated_value = Column(Numeric(18, 2), nullable=True)
    estimated_margin_percent = Column(Numeric(9, 4), nullable=True)
    recommendation_rationale = Column(Text, nullable=True)
    approval_reference = Column(String(500), nullable=True)
    approved_by = Column(String(255), nullable=True, index=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    cpq_handoff_reference = Column(String(500), nullable=True)
    cpq_handoff_at = Column(DateTime(timezone=True), nullable=True)
    quote_id = Column(String(100), nullable=True, index=True)
    quote_number = Column(String(100), nullable=True, index=True)
    quote_value = Column(Numeric(18, 2), nullable=True)
    quote_accepted_at = Column(DateTime(timezone=True), nullable=True)
    order_id = Column(String(100), nullable=True, index=True)
    order_number = Column(String(100), nullable=True, index=True)
    actual_value = Column(Numeric(18, 2), nullable=True)
    won_at = Column(DateTime(timezone=True), nullable=True)
    loss_reason = Column(Text, nullable=True)
    closed_by = Column(String(255), nullable=True, index=True)
    closed_at = Column(DateTime(timezone=True), nullable=True)
    milestones_json = Column(Text, nullable=False, default="[]", server_default="[]")
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    updated_by = Column(String(255), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)


class FactoryRenewalGrowthEvidence(Base):
    __tablename__ = "factory_renewal_growth_evidence"
    __table_args__ = {"extend_existing": True}

    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    evidence_number = Column(String(100), nullable=False, unique=True, index=True)
    opportunity_id = Column(String(100), nullable=False, index=True)
    opportunity_number = Column(String(100), nullable=False, index=True)
    evidence_type = Column(String(50), nullable=False, index=True)
    evidence_reference = Column(String(500), nullable=False)
    note = Column(Text, nullable=False)
    recorded_by = Column(String(255), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
