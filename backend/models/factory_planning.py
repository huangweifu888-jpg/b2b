"""Tenant-scoped finite-capacity resources and production plans."""

from datetime import datetime

from core.database import Base
from sqlalchemy import Column, DateTime, Integer, Numeric, String, Text, UniqueConstraint


class FactoryPlanningResource(Base):
    __tablename__ = "factory_planning_resources"
    __table_args__ = (
        UniqueConstraint("tenant_id", "resource_reference", name="uq_factory_planning_resource_tenant_reference"),
        {"extend_existing": True},
    )

    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    resource_number = Column(String(100), nullable=False, unique=True, index=True)
    resource_reference = Column(String(255), nullable=False, index=True)
    resource_name = Column(String(500), nullable=False, index=True)
    daily_capacity = Column(Numeric(18, 4), nullable=False)
    shift_hours = Column(Numeric(9, 2), nullable=False)
    efficiency_percent = Column(Numeric(9, 4), nullable=False)
    calendar_evidence_reference = Column(String(500), nullable=False)
    lifecycle_status = Column(String(30), nullable=False, default="draft", server_default="draft", index=True)
    approval_reference = Column(String(255), nullable=True)
    approval_note = Column(Text, nullable=True)
    approved_by = Column(String(255), nullable=True, index=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    updated_by = Column(String(255), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)


class FactoryProductionPlan(Base):
    __tablename__ = "factory_production_plans"
    __table_args__ = {"extend_existing": True}

    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    production_plan_number = Column(String(100), nullable=False, unique=True, index=True)
    demand_order_id = Column(String(100), nullable=False, index=True)
    demand_order_number = Column(String(100), nullable=False, index=True)
    engineering_version_id = Column(String(100), nullable=False, index=True)
    engineering_number = Column(String(100), nullable=False, index=True)
    product_reference = Column(String(255), nullable=False, index=True)
    sku_reference = Column(String(255), nullable=False, index=True)
    demand_quantity = Column(Numeric(18, 4), nullable=False)
    resource_id = Column(String(100), nullable=False, index=True)
    resource_number = Column(String(100), nullable=False, index=True)
    effective_daily_capacity = Column(Numeric(18, 4), nullable=False)
    capacity_days = Column(Integer, nullable=False)
    planned_start_at = Column(DateTime(timezone=True), nullable=False, index=True)
    planned_end_at = Column(DateTime(timezone=True), nullable=False, index=True)
    due_at = Column(DateTime(timezone=True), nullable=False, index=True)
    material_requirements_json = Column(Text, nullable=False, default="[]", server_default="[]")
    shortage_json = Column(Text, nullable=False, default="[]", server_default="[]")
    material_readiness_status = Column(String(30), nullable=False, default="shortage", server_default="shortage", index=True)
    schedule_status = Column(String(30), nullable=False, default="on-time", server_default="on-time", index=True)
    lifecycle_status = Column(String(30), nullable=False, default="draft", server_default="draft", index=True)
    review_note = Column(Text, nullable=True)
    approval_reference = Column(String(255), nullable=True)
    release_reference = Column(String(255), nullable=True)
    work_order_intent_reference = Column(String(255), nullable=True, unique=True, index=True)
    milestones_json = Column(Text, nullable=False, default="[]", server_default="[]")
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    updated_by = Column(String(255), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)
