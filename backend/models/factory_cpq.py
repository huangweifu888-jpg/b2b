"""Tenant-scoped governed CPQ quotes for the Factory Platform."""

from datetime import datetime

from core.database import Base
from sqlalchemy import Column, DateTime, Integer, Numeric, String, Text


class FactoryCpqQuote(Base):
    __tablename__ = "factory_cpq_quotes"
    __table_args__ = {"extend_existing": True}

    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    quote_number = Column(String(100), nullable=False, unique=True, index=True)
    account_reference = Column(String(255), nullable=False, index=True)
    currency = Column(String(3), nullable=False, default="USD", server_default="USD")
    exchange_rate = Column(Numeric(18, 6), nullable=False, default=1, server_default="1")
    valid_until = Column(DateTime(timezone=True), nullable=False, index=True)
    lines_json = Column(Text, nullable=False, default="[]", server_default="[]")
    subtotal = Column(Numeric(18, 2), nullable=False, default=0, server_default="0")
    cost_total = Column(Numeric(18, 2), nullable=False, default=0, server_default="0")
    gross_margin_percent = Column(Numeric(9, 4), nullable=False, default=0, server_default="0")
    status = Column(String(30), nullable=False, default="draft", server_default="draft", index=True)
    approval_note = Column(Text, nullable=True)
    order_intent_id = Column(String(100), nullable=True, unique=True, index=True)
    emitted_events_json = Column(Text, nullable=False, default="[]", server_default="[]")
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    updated_by = Column(String(255), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)
