"""Tenant-scoped warranty/RMA cases and append-only return evidence."""

from datetime import datetime

from core.database import Base
from sqlalchemy import Column, DateTime, Integer, Numeric, String, Text, UniqueConstraint


class FactoryWarrantyRmaCase(Base):
    __tablename__ = "factory_warranty_rma_cases"
    __table_args__ = (
        UniqueConstraint("tenant_id", "claim_reference", name="uq_factory_rma_tenant_claim_reference"),
        UniqueConstraint("tenant_id", "service_ticket_id", name="uq_factory_rma_tenant_service_ticket"),
        {"extend_existing": True},
    )

    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    rma_number = Column(String(100), nullable=False, unique=True, index=True)
    claim_reference = Column(String(255), nullable=False, index=True)
    asset_id = Column(String(100), nullable=False, index=True)
    asset_number = Column(String(100), nullable=False, index=True)
    service_ticket_id = Column(String(100), nullable=False, index=True)
    service_ticket_number = Column(String(100), nullable=False, index=True)
    order_id = Column(String(100), nullable=False, index=True)
    order_number = Column(String(100), nullable=False, index=True)
    account_reference = Column(String(255), nullable=False, index=True)
    product_reference = Column(String(255), nullable=False, index=True)
    sku_reference = Column(String(255), nullable=False, index=True)
    serial_number = Column(String(255), nullable=False, index=True)
    warranty_until = Column(DateTime(timezone=True), nullable=False, index=True)
    eligibility_status = Column(String(30), nullable=False, default="unchecked", server_default="unchecked", index=True)
    claim_summary = Column(Text, nullable=False)
    requested_remedy = Column(String(30), nullable=False, index=True)
    lifecycle_status = Column(String(40), nullable=False, default="draft", server_default="draft", index=True)
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    authorization_reference = Column(String(500), nullable=True)
    goodwill_reference = Column(String(500), nullable=True)
    return_instructions = Column(Text, nullable=True)
    authorized_by = Column(String(255), nullable=True, index=True)
    authorized_at = Column(DateTime(timezone=True), nullable=True)
    return_shipment_reference = Column(String(500), nullable=True, index=True)
    shipped_at = Column(DateTime(timezone=True), nullable=True)
    warehouse_receipt_reference = Column(String(500), nullable=True, index=True)
    received_condition = Column(Text, nullable=True)
    received_by = Column(String(255), nullable=True, index=True)
    received_at = Column(DateTime(timezone=True), nullable=True)
    inspection_reference = Column(String(500), nullable=True, index=True)
    inspection_result = Column(String(40), nullable=True, index=True)
    inspection_note = Column(Text, nullable=True)
    quality_evidence_reference = Column(String(500), nullable=True, index=True)
    inspected_by = Column(String(255), nullable=True, index=True)
    inspected_at = Column(DateTime(timezone=True), nullable=True)
    disposition = Column(String(40), nullable=True, index=True)
    responsibility = Column(String(40), nullable=True, index=True)
    disposition_approval_reference = Column(String(500), nullable=True)
    currency = Column(String(10), nullable=False, default="USD", server_default="USD")
    estimated_parts_cost = Column(Numeric(18, 2), nullable=False, default=0, server_default="0")
    estimated_labor_cost = Column(Numeric(18, 2), nullable=False, default=0, server_default="0")
    estimated_logistics_cost = Column(Numeric(18, 2), nullable=False, default=0, server_default="0")
    estimated_total_cost = Column(Numeric(18, 2), nullable=False, default=0, server_default="0")
    finance_followup_reference = Column(String(500), nullable=True)
    supplier_recovery_reference = Column(String(500), nullable=True)
    disposition_by = Column(String(255), nullable=True, index=True)
    disposition_at = Column(DateTime(timezone=True), nullable=True)
    remedy_evidence_reference = Column(String(500), nullable=True)
    customer_acknowledgement_reference = Column(String(500), nullable=True)
    closed_by = Column(String(255), nullable=True, index=True)
    closed_at = Column(DateTime(timezone=True), nullable=True)
    milestones_json = Column(Text, nullable=False, default="[]", server_default="[]")
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    updated_by = Column(String(255), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)


class FactoryRmaEvidence(Base):
    __tablename__ = "factory_rma_evidence"
    __table_args__ = {"extend_existing": True}

    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    evidence_number = Column(String(100), nullable=False, unique=True, index=True)
    rma_case_id = Column(String(100), nullable=False, index=True)
    rma_number = Column(String(100), nullable=False, index=True)
    evidence_type = Column(String(50), nullable=False, index=True)
    evidence_reference = Column(String(500), nullable=False)
    note = Column(Text, nullable=False)
    recorded_by = Column(String(255), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
