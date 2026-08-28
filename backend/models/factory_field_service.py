"""Tenant-scoped field-service technicians, visits and append-only work entries."""

from datetime import datetime

from core.database import Base
from sqlalchemy import Column, DateTime, Integer, Numeric, String, Text, UniqueConstraint


class FactoryFieldServiceTechnician(Base):
    __tablename__ = "factory_field_service_technicians"
    __table_args__ = (
        UniqueConstraint("tenant_id", "technician_reference", name="uq_factory_field_technician_tenant_reference"),
        {"extend_existing": True},
    )

    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    technician_number = Column(String(100), nullable=False, unique=True, index=True)
    technician_reference = Column(String(255), nullable=False, index=True)
    technician_name = Column(String(500), nullable=False, index=True)
    skills_json = Column(Text, nullable=False, default="[]", server_default="[]")
    service_regions_json = Column(Text, nullable=False, default="[]", server_default="[]")
    lifecycle_status = Column(String(30), nullable=False, default="draft", server_default="draft", index=True)
    approval_reference = Column(String(500), nullable=True)
    approved_by = Column(String(255), nullable=True, index=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    updated_by = Column(String(255), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)


class FactoryFieldServiceVisit(Base):
    __tablename__ = "factory_field_service_visits"
    __table_args__ = (
        UniqueConstraint("tenant_id", "service_ticket_id", name="uq_factory_field_visit_tenant_ticket"),
        {"extend_existing": True},
    )

    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    visit_number = Column(String(100), nullable=False, unique=True, index=True)
    service_ticket_id = Column(String(100), nullable=False, index=True)
    service_ticket_number = Column(String(100), nullable=False, index=True)
    asset_id = Column(String(100), nullable=False, index=True)
    asset_number = Column(String(100), nullable=False, index=True)
    account_reference = Column(String(255), nullable=False, index=True)
    technician_id = Column(String(100), nullable=False, index=True)
    technician_number = Column(String(100), nullable=False, index=True)
    technician_name = Column(String(500), nullable=False)
    scheduled_for = Column(DateTime(timezone=True), nullable=False, index=True)
    sla_due_at = Column(DateTime(timezone=True), nullable=False, index=True)
    sla_status = Column(String(30), nullable=False, default="pending", server_default="pending", index=True)
    lifecycle_status = Column(String(30), nullable=False, default="dispatched", server_default="dispatched", index=True)
    departure_reference = Column(String(500), nullable=True)
    arrival_reference = Column(String(500), nullable=True)
    arrival_location = Column(String(500), nullable=True)
    diagnosis_summary = Column(Text, nullable=True)
    resolution_reference = Column(String(500), nullable=True)
    resolution_note = Column(Text, nullable=True)
    customer_signer = Column(String(500), nullable=True)
    customer_signoff_reference = Column(String(500), nullable=True)
    escalation_reference = Column(String(500), nullable=True)
    total_labor_minutes = Column(Integer, nullable=False, default=0, server_default="0")
    parts_summary_json = Column(Text, nullable=False, default="[]", server_default="[]")
    departed_at = Column(DateTime(timezone=True), nullable=True)
    arrived_at = Column(DateTime(timezone=True), nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    milestones_json = Column(Text, nullable=False, default="[]", server_default="[]")
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    updated_by = Column(String(255), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)


class FactoryFieldServiceEntry(Base):
    __tablename__ = "factory_field_service_entries"
    __table_args__ = {"extend_existing": True}

    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    entry_number = Column(String(100), nullable=False, unique=True, index=True)
    visit_id = Column(String(100), nullable=False, index=True)
    visit_number = Column(String(100), nullable=False, index=True)
    entry_type = Column(String(30), nullable=False, index=True)
    description = Column(Text, nullable=False)
    labor_minutes = Column(Integer, nullable=False, default=0, server_default="0")
    part_reference = Column(String(255), nullable=True, index=True)
    quantity = Column(Numeric(18, 4), nullable=False, default=0, server_default="0")
    unit = Column(String(50), nullable=True)
    stock_evidence_reference = Column(String(500), nullable=True)
    evidence_reference = Column(String(500), nullable=False)
    recorded_by = Column(String(255), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
