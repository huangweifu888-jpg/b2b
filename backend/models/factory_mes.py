"""Tenant-scoped manufacturing work orders, operations and downtime events."""

from datetime import datetime

from core.database import Base
from sqlalchemy import Column, DateTime, Integer, Numeric, String, Text, UniqueConstraint


class FactoryManufacturingWorkOrder(Base):
    __tablename__ = "factory_manufacturing_work_orders"
    __table_args__ = (
        UniqueConstraint("tenant_id", "production_plan_id", name="uq_factory_mes_tenant_production_plan"),
        UniqueConstraint("tenant_id", "batch_reference", name="uq_factory_mes_tenant_batch"),
        {"extend_existing": True},
    )

    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    work_order_number = Column(String(100), nullable=False, unique=True, index=True)
    production_plan_id = Column(String(100), nullable=False, index=True)
    production_plan_number = Column(String(100), nullable=False, index=True)
    work_order_intent_reference = Column(String(255), nullable=False, unique=True, index=True)
    demand_order_id = Column(String(100), nullable=False, index=True)
    demand_order_number = Column(String(100), nullable=False, index=True)
    engineering_version_id = Column(String(100), nullable=False, index=True)
    engineering_number = Column(String(100), nullable=False, index=True)
    product_reference = Column(String(255), nullable=False, index=True)
    sku_reference = Column(String(255), nullable=False, index=True)
    resource_id = Column(String(100), nullable=False, index=True)
    resource_number = Column(String(100), nullable=False, index=True)
    batch_reference = Column(String(255), nullable=False, index=True)
    target_quantity = Column(Numeric(18, 4), nullable=False)
    completed_quantity = Column(Numeric(18, 4), nullable=False, default=0, server_default="0")
    scrap_quantity = Column(Numeric(18, 4), nullable=False, default=0, server_default="0")
    material_lots_json = Column(Text, nullable=False, default="[]", server_default="[]")
    lifecycle_status = Column(String(40), nullable=False, default="draft", server_default="draft", index=True)
    current_operation_code = Column(String(100), nullable=True, index=True)
    release_reference = Column(String(255), nullable=True)
    completion_reference = Column(String(255), nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    milestones_json = Column(Text, nullable=False, default="[]", server_default="[]")
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    updated_by = Column(String(255), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)


class FactoryManufacturingOperation(Base):
    __tablename__ = "factory_manufacturing_operations"
    __table_args__ = (
        UniqueConstraint("work_order_id", "operation_sequence", name="uq_factory_mes_work_order_operation_sequence"),
        UniqueConstraint("work_order_id", "operation_code", name="uq_factory_mes_work_order_operation_code"),
        {"extend_existing": True},
    )

    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    work_order_id = Column(String(100), nullable=False, index=True)
    work_order_number = Column(String(100), nullable=False, index=True)
    operation_sequence = Column(Integer, nullable=False, index=True)
    operation_code = Column(String(100), nullable=False, index=True)
    operation_name = Column(String(500), nullable=False)
    work_center_reference = Column(String(255), nullable=False, index=True)
    input_quantity = Column(Numeric(18, 4), nullable=False, default=0, server_default="0")
    good_quantity = Column(Numeric(18, 4), nullable=False, default=0, server_default="0")
    scrap_quantity = Column(Numeric(18, 4), nullable=False, default=0, server_default="0")
    lifecycle_status = Column(String(40), nullable=False, default="pending", server_default="pending", index=True)
    operator_reference = Column(String(255), nullable=True, index=True)
    start_evidence_reference = Column(String(500), nullable=True)
    completion_evidence_reference = Column(String(500), nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    updated_by = Column(String(255), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)


class FactoryManufacturingDowntime(Base):
    __tablename__ = "factory_manufacturing_downtimes"
    __table_args__ = {"extend_existing": True}

    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    downtime_number = Column(String(100), nullable=False, unique=True, index=True)
    work_order_id = Column(String(100), nullable=False, index=True)
    work_order_number = Column(String(100), nullable=False, index=True)
    operation_id = Column(String(100), nullable=False, index=True)
    operation_code = Column(String(100), nullable=False, index=True)
    reason_code = Column(String(100), nullable=False, index=True)
    reason_note = Column(Text, nullable=False)
    lifecycle_status = Column(String(30), nullable=False, default="open", server_default="open", index=True)
    resolution_note = Column(Text, nullable=True)
    resolution_evidence_reference = Column(String(500), nullable=True)
    duration_minutes = Column(Integer, nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=False)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    updated_by = Column(String(255), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)
