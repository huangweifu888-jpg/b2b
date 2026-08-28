"""Governed customer-success reviews and renewal handoff receipts."""

from datetime import datetime

from core.database import Base
from sqlalchemy import Column, DateTime, Integer, String, Text, UniqueConstraint


class FactoryCustomerSuccessReview(Base):
    __tablename__ = "factory_customer_success_reviews"
    __table_args__ = (UniqueConstraint("project_id", "asset_id", name="uq_factory_customer_success_asset"), {"extend_existing": True})

    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    review_number = Column(String(100), nullable=False, unique=True, index=True)
    asset_id = Column(String(100), nullable=False, index=True)
    asset_number = Column(String(100), nullable=False, index=True)
    asset_revision = Column(Integer, nullable=False)
    source_fingerprint = Column(String(64), nullable=False)
    health_score = Column(Integer, nullable=False, index=True)
    risk_level = Column(String(20), nullable=False, index=True)
    success_summary = Column(Text, nullable=False)
    lifecycle_status = Column(String(30), nullable=False, default="draft", server_default="draft", index=True)
    created_by = Column(String(255), nullable=False, index=True)
    reviewed_by = Column(String(255), nullable=True, index=True)
    review_reference = Column(String(255), nullable=True)
    approved_by = Column(String(255), nullable=True, index=True)
    approval_reference = Column(String(255), nullable=True)
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)


class FactoryCustomerSuccessHandoff(Base):
    __tablename__ = "factory_customer_success_handoffs"
    __table_args__ = (UniqueConstraint("review_id", name="uq_factory_customer_success_handoff_review"), {"extend_existing": True})

    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    handoff_number = Column(String(100), nullable=False, unique=True, index=True)
    review_id = Column(String(100), nullable=False, index=True)
    review_number = Column(String(100), nullable=False, index=True)
    consumer = Column(String(64), nullable=False, default="renewal-growth")
    payload_fingerprint = Column(String(64), nullable=False)
    status = Column(String(30), nullable=False, default="pending", server_default="pending", index=True)
    released_by = Column(String(255), nullable=False, index=True)
    release_reference = Column(String(255), nullable=False)
    acknowledged_by = Column(String(255), nullable=True, index=True)
    receipt_reference = Column(String(255), nullable=True)
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)


class FactoryCustomerSuccessEvidence(Base):
    __tablename__ = "factory_customer_success_evidence"
    __table_args__ = {"extend_existing": True}

    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    evidence_number = Column(String(100), nullable=False, unique=True, index=True)
    review_id = Column(String(100), nullable=False, index=True)
    event_type = Column(String(64), nullable=False, index=True)
    reference = Column(String(255), nullable=False)
    note = Column(Text, nullable=True)
    recorded_by = Column(String(255), nullable=False, index=True)
    recorded_at = Column(DateTime(timezone=True), default=datetime.now, index=True)
