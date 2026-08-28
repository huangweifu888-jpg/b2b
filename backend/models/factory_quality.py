"""Tenant-scoped quality inspections, nonconformances and batch releases."""

from datetime import datetime

from core.database import Base
from sqlalchemy import Column, DateTime, Integer, String, Text, UniqueConstraint


class FactoryQualityInspection(Base):
    __tablename__ = "factory_quality_inspections"
    __table_args__ = (
        UniqueConstraint("tenant_id", "inspection_reference", name="uq_factory_quality_tenant_inspection_reference"),
        {"extend_existing": True},
    )

    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    inspection_number = Column(String(100), nullable=False, unique=True, index=True)
    inspection_reference = Column(String(255), nullable=False, index=True)
    order_id = Column(String(100), nullable=False, index=True)
    order_number = Column(String(100), nullable=False, index=True)
    product_reference = Column(String(255), nullable=False, index=True)
    sku_reference = Column(String(255), nullable=False, index=True)
    work_order_reference = Column(String(255), nullable=False, index=True)
    batch_reference = Column(String(255), nullable=False, index=True)
    inspection_type = Column(String(50), nullable=False, default="final", server_default="final", index=True)
    sample_size = Column(Integer, nullable=False)
    accepted_quantity = Column(Integer, nullable=False, default=0, server_default="0")
    rejected_quantity = Column(Integer, nullable=False, default=0, server_default="0")
    lifecycle_status = Column(String(40), nullable=False, default="draft", server_default="draft", index=True)
    inspector = Column(String(255), nullable=True, index=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    check_results_json = Column(Text, nullable=False, default="[]", server_default="[]")
    approval_reference = Column(String(255), nullable=True)
    release_note = Column(Text, nullable=True)
    released_by = Column(String(255), nullable=True, index=True)
    released_at = Column(DateTime(timezone=True), nullable=True)
    emitted_events_json = Column(Text, nullable=False, default="[]", server_default="[]")
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    updated_by = Column(String(255), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)


class FactoryQualityFinding(Base):
    __tablename__ = "factory_quality_findings"
    __table_args__ = {"extend_existing": True}

    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    finding_number = Column(String(100), nullable=False, unique=True, index=True)
    inspection_id = Column(String(100), nullable=False, index=True)
    inspection_number = Column(String(100), nullable=False, index=True)
    check_code = Column(String(50), nullable=False, index=True)
    severity = Column(String(20), nullable=False, index=True)
    description = Column(String(1000), nullable=False)
    affected_quantity = Column(Integer, nullable=False)
    lifecycle_status = Column(String(40), nullable=False, default="open", server_default="open", index=True)
    disposition = Column(String(40), nullable=True, index=True)
    root_cause = Column(Text, nullable=True)
    corrective_action = Column(Text, nullable=True)
    resolution_evidence_reference = Column(String(500), nullable=True)
    resolved_by = Column(String(255), nullable=True, index=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    updated_by = Column(String(255), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)
