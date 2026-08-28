"""Authoritative tenant-scoped orders and fulfillment evidence."""

from datetime import datetime

from core.database import Base
from sqlalchemy import Column, DateTime, Integer, Numeric, String, Text


class FactoryFulfillmentOrder(Base):
    __tablename__ = "factory_fulfillment_orders"
    __table_args__ = {"extend_existing": True}

    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    order_number = Column(String(100), nullable=False, unique=True, index=True)
    quote_id = Column(String(100), nullable=False, unique=True, index=True)
    quote_number = Column(String(100), nullable=False, index=True)
    order_intent_id = Column(String(100), nullable=False, unique=True, index=True)
    account_reference = Column(String(255), nullable=False, index=True)
    currency = Column(String(3), nullable=False)
    exchange_rate = Column(Numeric(18, 6), nullable=False)
    lines_json = Column(Text, nullable=False, default="[]", server_default="[]")
    order_total = Column(Numeric(18, 2), nullable=False)
    status = Column(String(40), nullable=False, default="pending-validation", server_default="pending-validation", index=True)
    authority_source = Column(String(50), nullable=False, default="factory-oms", server_default="factory-oms", index=True)
    validation_json = Column(Text, nullable=False, default="{}", server_default="{}")
    fulfillment_evidence_json = Column(Text, nullable=False, default="[]", server_default="[]")
    emitted_events_json = Column(Text, nullable=False, default="[]", server_default="[]")
    confirmed_by = Column(String(255), nullable=True, index=True)
    confirmed_at = Column(DateTime(timezone=True), nullable=True)
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    updated_by = Column(String(255), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)
