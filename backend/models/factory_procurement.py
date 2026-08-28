"""Tenant-scoped supplier qualification and authoritative procurement records."""

from datetime import datetime

from core.database import Base
from sqlalchemy import Column, DateTime, Integer, Numeric, String, Text, UniqueConstraint


class FactorySupplier(Base):
    __tablename__ = "factory_suppliers"
    __table_args__ = (
        UniqueConstraint("tenant_id", "supplier_reference", name="uq_factory_supplier_tenant_reference"),
        {"extend_existing": True},
    )

    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    supplier_number = Column(String(100), nullable=False, unique=True, index=True)
    supplier_reference = Column(String(255), nullable=False, index=True)
    legal_name = Column(String(500), nullable=False, index=True)
    country_code = Column(String(2), nullable=False, index=True)
    currency = Column(String(3), nullable=False)
    standard_lead_time_days = Column(Integer, nullable=False)
    qualified_materials_json = Column(Text, nullable=False, default="[]", server_default="[]")
    qualification_evidence_reference = Column(String(500), nullable=False)
    risk_level = Column(String(20), nullable=False, default="medium", server_default="medium", index=True)
    lifecycle_status = Column(String(30), nullable=False, default="draft", server_default="draft", index=True)
    approval_reference = Column(String(255), nullable=True)
    approval_note = Column(Text, nullable=True)
    approved_by = Column(String(255), nullable=True, index=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    updated_by = Column(String(255), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)


class FactoryPurchaseOrder(Base):
    __tablename__ = "factory_purchase_orders"
    __table_args__ = {"extend_existing": True}

    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    purchase_order_number = Column(String(100), nullable=False, unique=True, index=True)
    supplier_id = Column(String(100), nullable=False, index=True)
    supplier_number = Column(String(100), nullable=False, index=True)
    supplier_reference = Column(String(255), nullable=False, index=True)
    demand_order_id = Column(String(100), nullable=False, index=True)
    demand_order_number = Column(String(100), nullable=False, index=True)
    engineering_version_id = Column(String(100), nullable=False, index=True)
    engineering_number = Column(String(100), nullable=False, index=True)
    product_reference = Column(String(255), nullable=False, index=True)
    sku_reference = Column(String(255), nullable=False, index=True)
    currency = Column(String(3), nullable=False)
    lines_json = Column(Text, nullable=False, default="[]", server_default="[]")
    subtotal = Column(Numeric(18, 2), nullable=False)
    needed_by = Column(DateTime(timezone=True), nullable=False, index=True)
    lifecycle_status = Column(String(30), nullable=False, default="draft", server_default="draft", index=True)
    review_note = Column(Text, nullable=True)
    approval_reference = Column(String(255), nullable=True)
    issue_document_reference = Column(String(500), nullable=True)
    acknowledgement_reference = Column(String(500), nullable=True)
    promised_delivery_at = Column(DateTime(timezone=True), nullable=True, index=True)
    receiving_reference = Column(String(500), nullable=True)
    received_quantities_json = Column(Text, nullable=False, default="[]", server_default="[]")
    received_at = Column(DateTime(timezone=True), nullable=True)
    milestones_json = Column(Text, nullable=False, default="[]", server_default="[]")
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    updated_by = Column(String(255), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)
