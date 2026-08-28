"""Tenant-scoped pilot records for the Factory Platform revenue golden flow."""

from datetime import datetime

from core.database import Base
from sqlalchemy import Column, DateTime, Integer, Numeric, String, Text


class FactoryRevenueFlowRun(Base):
    __tablename__ = "factory_revenue_flow_runs"
    __table_args__ = {"extend_existing": True}

    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    correlation_id = Column(String(100), nullable=False, unique=True, index=True)
    product_reference = Column(String(255), nullable=False)
    account_reference = Column(String(255), nullable=False)
    currency = Column(String(10), nullable=False, default="USD", server_default="USD")
    quoted_amount = Column(Numeric(18, 2), nullable=False, default=0, server_default="0")
    ordered_amount = Column(Numeric(18, 2), nullable=False, default=0, server_default="0")
    invoiced_amount = Column(Numeric(18, 2), nullable=False, default=0, server_default="0")
    paid_amount = Column(Numeric(18, 2), nullable=False, default=0, server_default="0")
    current_stage = Column(String(50), nullable=False, default="product-selected", server_default="product-selected", index=True)
    emitted_events_json = Column(Text, nullable=False, default="[]", server_default="[]")
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    updated_by = Column(String(255), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)
