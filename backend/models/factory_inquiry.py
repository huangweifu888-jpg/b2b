"""Tenant-scoped inquiry intake and independently acknowledged routing records."""
from datetime import datetime
from core.database import Base
from sqlalchemy import DateTime, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column


class InquiryTenantMixin:
    project_id: Mapped[int] = mapped_column(nullable=False, index=True)
    agent_path: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    tenant_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    client_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    plan_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)


class FactoryInquiry(InquiryTenantMixin, Base):
    __tablename__ = "factory_inquiries"
    __table_args__ = (UniqueConstraint("project_id", "source_channel", "source_reference_hash", name="uq_factory_inquiry_source"),)
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    inquiry_number: Mapped[str] = mapped_column(String(96), nullable=False, unique=True, index=True)
    source_channel: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    source_reference_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    account_reference: Mapped[str] = mapped_column(String(180), nullable=False, index=True)
    product_reference: Mapped[str] = mapped_column(String(180), nullable=False, index=True)
    country_code: Mapped[str] = mapped_column(String(8), nullable=False, index=True)
    requested_quantity: Mapped[int | None] = mapped_column(Integer)
    payload_summary: Mapped[str | None] = mapped_column(Text)
    score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="received", index=True)
    qualified_by: Mapped[str | None] = mapped_column(String(128))
    qualification_reference: Mapped[str | None] = mapped_column(String(255))
    revenue_flow_id: Mapped[str | None] = mapped_column(String(100), unique=True)
    created_by: Mapped[str] = mapped_column(String(128), nullable=False)
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class FactoryInquiryRoutingRule(InquiryTenantMixin, Base):
    __tablename__ = "factory_inquiry_routing_rules"
    __table_args__ = (UniqueConstraint("project_id", "rule_key", name="uq_factory_inquiry_rule_key"),)
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    rule_number: Mapped[str] = mapped_column(String(96), nullable=False, unique=True, index=True)
    rule_key: Mapped[str] = mapped_column(String(96), nullable=False)
    rule_name: Mapped[str] = mapped_column(String(160), nullable=False)
    priority: Mapped[int] = mapped_column(Integer, nullable=False, default=100)
    conditions_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    assignee_reference: Mapped[str] = mapped_column(String(128), nullable=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="draft", index=True)
    authored_by: Mapped[str] = mapped_column(String(128), nullable=False)
    approved_by: Mapped[str | None] = mapped_column(String(128))
    approval_reference: Mapped[str | None] = mapped_column(String(255))
    activated_by: Mapped[str | None] = mapped_column(String(128))
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class FactoryInquiryAssignment(InquiryTenantMixin, Base):
    __tablename__ = "factory_inquiry_assignments"
    __table_args__ = (UniqueConstraint("inquiry_id", name="uq_factory_inquiry_assignment"),)
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    assignment_number: Mapped[str] = mapped_column(String(96), nullable=False, unique=True, index=True)
    inquiry_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    inquiry_number: Mapped[str] = mapped_column(String(96), nullable=False)
    rule_id: Mapped[str] = mapped_column(String(100), nullable=False)
    rule_number: Mapped[str] = mapped_column(String(96), nullable=False)
    assignee_reference: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="pending", index=True)
    routed_by: Mapped[str] = mapped_column(String(128), nullable=False)
    acknowledged_by: Mapped[str | None] = mapped_column(String(128))
    receipt_reference: Mapped[str | None] = mapped_column(String(255))
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class FactoryInquiryEvidence(InquiryTenantMixin, Base):
    __tablename__ = "factory_inquiry_evidence"
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    evidence_number: Mapped[str] = mapped_column(String(96), nullable=False, unique=True, index=True)
    subject_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    event_type: Mapped[str] = mapped_column(String(48), nullable=False)
    reference: Mapped[str] = mapped_column(String(255), nullable=False)
    note: Mapped[str | None] = mapped_column(Text)
    recorded_by: Mapped[str] = mapped_column(String(128), nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
