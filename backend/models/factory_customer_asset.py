"""Tenant-scoped installed customer assets and service tickets."""

from datetime import datetime

from core.database import Base
from sqlalchemy import Column, DateTime, Integer, String, Text, UniqueConstraint


class FactoryCustomerAsset(Base):
    __tablename__ = "factory_customer_assets"
    __table_args__ = (
        UniqueConstraint("tenant_id", "serial_number", name="uq_factory_customer_asset_tenant_serial"),
        {"extend_existing": True},
    )

    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    asset_number = Column(String(100), nullable=False, unique=True, index=True)
    order_id = Column(String(100), nullable=False, index=True)
    order_number = Column(String(100), nullable=False, index=True)
    account_reference = Column(String(255), nullable=False, index=True)
    product_reference = Column(String(255), nullable=False, index=True)
    sku_reference = Column(String(255), nullable=False, index=True)
    serial_number = Column(String(255), nullable=False, index=True)
    installation_location = Column(String(500), nullable=False)
    installed_at = Column(DateTime(timezone=True), nullable=False, index=True)
    warranty_until = Column(DateTime(timezone=True), nullable=False, index=True)
    next_service_due_at = Column(DateTime(timezone=True), nullable=False, index=True)
    status = Column(String(40), nullable=False, default="active", server_default="active", index=True)
    renewal_status = Column(String(40), nullable=False, default="monitoring", server_default="monitoring", index=True)
    renewal_owner = Column(String(255), nullable=True, index=True)
    renewal_action = Column(Text, nullable=True)
    service_count = Column(Integer, nullable=False, default=0, server_default="0")
    last_service_at = Column(DateTime(timezone=True), nullable=True)
    emitted_events_json = Column(Text, nullable=False, default="[]", server_default="[]")
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    updated_by = Column(String(255), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)


class FactoryAssetServiceTicket(Base):
    __tablename__ = "factory_asset_service_tickets"
    __table_args__ = {"extend_existing": True}

    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    ticket_number = Column(String(100), nullable=False, unique=True, index=True)
    asset_id = Column(String(100), nullable=False, index=True)
    asset_number = Column(String(100), nullable=False, index=True)
    issue_summary = Column(String(1000), nullable=False)
    severity = Column(String(20), nullable=False, index=True)
    status = Column(String(40), nullable=False, default="open", server_default="open", index=True)
    sla_due_at = Column(DateTime(timezone=True), nullable=False, index=True)
    assigned_to = Column(String(255), nullable=True, index=True)
    scheduled_for = Column(DateTime(timezone=True), nullable=True)
    resolution_reference = Column(String(255), nullable=True)
    resolution_note = Column(Text, nullable=True)
    emitted_events_json = Column(Text, nullable=False, default="[]", server_default="[]")
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    updated_by = Column(String(255), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)
