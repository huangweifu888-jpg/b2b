"""Tenant-scoped operating ERP ledger built on authoritative confirmed orders."""

from datetime import datetime

from core.database import Base
from sqlalchemy import Column, Date, DateTime, Integer, Numeric, String, Text, UniqueConstraint


class FactoryErpOperatingUnit(Base):
    __tablename__ = "factory_erp_operating_units"
    __table_args__ = (
        UniqueConstraint("tenant_id", "unit_code", name="uq_factory_erp_tenant_unit_code"),
        UniqueConstraint("tenant_id", "unit_reference", name="uq_factory_erp_tenant_unit_reference"),
        {"extend_existing": True},
    )
    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    unit_number = Column(String(100), nullable=False, unique=True, index=True)
    unit_reference = Column(String(255), nullable=False, index=True)
    unit_code = Column(String(100), nullable=False, index=True)
    unit_name = Column(String(255), nullable=False)
    unit_type = Column(String(30), nullable=False, index=True)
    base_currency = Column(String(3), nullable=False, index=True)
    manager = Column(String(255), nullable=False, index=True)
    status = Column(String(30), nullable=False, default="draft", server_default="draft", index=True)
    authored_by = Column(String(255), nullable=False, index=True)
    approval_reference = Column(String(500), nullable=True)
    approved_by = Column(String(255), nullable=True, index=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    updated_by = Column(String(255), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)


class FactoryErpCostCenter(Base):
    __tablename__ = "factory_erp_cost_centers"
    __table_args__ = (
        UniqueConstraint("tenant_id", "center_code", name="uq_factory_erp_tenant_center_code"),
        UniqueConstraint("tenant_id", "center_reference", name="uq_factory_erp_tenant_center_reference"),
        {"extend_existing": True},
    )
    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    center_number = Column(String(100), nullable=False, unique=True, index=True)
    center_reference = Column(String(255), nullable=False, index=True)
    center_code = Column(String(100), nullable=False, index=True)
    center_name = Column(String(255), nullable=False)
    center_type = Column(String(30), nullable=False, index=True)
    operating_unit_id = Column(String(100), nullable=False, index=True)
    unit_number = Column(String(100), nullable=False, index=True)
    owner = Column(String(255), nullable=False, index=True)
    status = Column(String(30), nullable=False, default="active", server_default="active", index=True)
    created_by = Column(String(255), nullable=False, index=True)
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    updated_by = Column(String(255), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)


class FactoryErpOrderProject(Base):
    __tablename__ = "factory_erp_order_projects"
    __table_args__ = (
        UniqueConstraint("tenant_id", "order_id", name="uq_factory_erp_tenant_order_project"),
        UniqueConstraint("tenant_id", "project_reference", name="uq_factory_erp_tenant_project_reference"),
        {"extend_existing": True},
    )
    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    erp_project_number = Column(String(100), nullable=False, unique=True, index=True)
    project_reference = Column(String(255), nullable=False, index=True)
    operating_unit_id = Column(String(100), nullable=False, index=True)
    unit_number = Column(String(100), nullable=False, index=True)
    order_id = Column(String(100), nullable=False, index=True)
    order_number = Column(String(100), nullable=False, index=True)
    order_revision = Column(Integer, nullable=False)
    account_reference = Column(String(255), nullable=False, index=True)
    currency = Column(String(3), nullable=False, index=True)
    order_total = Column(Numeric(18, 2), nullable=False)
    status = Column(String(30), nullable=False, default="open", server_default="open", index=True)
    registered_by = Column(String(255), nullable=False, index=True)
    registered_at = Column(DateTime(timezone=True), nullable=False)
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    updated_by = Column(String(255), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)


class FactoryErpPeriod(Base):
    __tablename__ = "factory_erp_periods"
    __table_args__ = (
        UniqueConstraint("operating_unit_id", "period_code", name="uq_factory_erp_unit_period"),
        {"extend_existing": True},
    )
    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    period_number = Column(String(100), nullable=False, unique=True, index=True)
    period_reference = Column(String(255), nullable=False, index=True)
    operating_unit_id = Column(String(100), nullable=False, index=True)
    unit_number = Column(String(100), nullable=False, index=True)
    period_code = Column(String(7), nullable=False, index=True)
    period_start = Column(Date, nullable=False, index=True)
    period_end = Column(Date, nullable=False, index=True)
    currency = Column(String(3), nullable=False, index=True)
    total_inflow = Column(Numeric(18, 2), nullable=False, default=0, server_default="0")
    total_outflow = Column(Numeric(18, 2), nullable=False, default=0, server_default="0")
    net_result = Column(Numeric(18, 2), nullable=False, default=0, server_default="0")
    posting_count = Column(Integer, nullable=False, default=0, server_default="0")
    status = Column(String(30), nullable=False, default="open", server_default="open", index=True)
    opened_by = Column(String(255), nullable=False, index=True)
    close_submitted_by = Column(String(255), nullable=True, index=True)
    close_submitted_at = Column(DateTime(timezone=True), nullable=True)
    close_evidence_reference = Column(String(500), nullable=True)
    closed_by = Column(String(255), nullable=True, index=True)
    closed_at = Column(DateTime(timezone=True), nullable=True)
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    updated_by = Column(String(255), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)


class FactoryErpPosting(Base):
    __tablename__ = "factory_erp_postings"
    __table_args__ = (
        UniqueConstraint("tenant_id", "posting_reference", name="uq_factory_erp_tenant_posting_reference"),
        {"extend_existing": True},
    )
    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    posting_number = Column(String(100), nullable=False, unique=True, index=True)
    posting_reference = Column(String(255), nullable=False, index=True)
    period_id = Column(String(100), nullable=False, index=True)
    period_number = Column(String(100), nullable=False, index=True)
    order_project_id = Column(String(100), nullable=False, index=True)
    erp_project_number = Column(String(100), nullable=False, index=True)
    cost_center_id = Column(String(100), nullable=False, index=True)
    center_number = Column(String(100), nullable=False, index=True)
    posting_date = Column(Date, nullable=False, index=True)
    category = Column(String(40), nullable=False, index=True)
    direction = Column(String(10), nullable=False, index=True)
    currency = Column(String(3), nullable=False, index=True)
    amount = Column(Numeric(18, 2), nullable=False)
    description = Column(Text, nullable=False)
    evidence_reference = Column(String(500), nullable=False)
    correction_of_posting_id = Column(String(100), nullable=True, index=True)
    status = Column(String(30), nullable=False, default="draft", server_default="draft", index=True)
    authored_by = Column(String(255), nullable=False, index=True)
    submitted_by = Column(String(255), nullable=True, index=True)
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    approval_reference = Column(String(500), nullable=True)
    approved_by = Column(String(255), nullable=True, index=True)
    posted_at = Column(DateTime(timezone=True), nullable=True)
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    updated_by = Column(String(255), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)


class FactoryErpPeriodBalance(Base):
    __tablename__ = "factory_erp_period_balances"
    __table_args__ = (
        UniqueConstraint("period_id", "order_project_id", "cost_center_id", name="uq_factory_erp_period_project_center"),
        {"extend_existing": True},
    )
    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    balance_number = Column(String(100), nullable=False, unique=True, index=True)
    period_id = Column(String(100), nullable=False, index=True)
    period_number = Column(String(100), nullable=False, index=True)
    order_project_id = Column(String(100), nullable=False, index=True)
    erp_project_number = Column(String(100), nullable=False, index=True)
    cost_center_id = Column(String(100), nullable=False, index=True)
    center_number = Column(String(100), nullable=False, index=True)
    currency = Column(String(3), nullable=False, index=True)
    inflow = Column(Numeric(18, 2), nullable=False)
    outflow = Column(Numeric(18, 2), nullable=False)
    net_result = Column(Numeric(18, 2), nullable=False)
    posting_count = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.now)


class FactoryErpEvidence(Base):
    __tablename__ = "factory_erp_evidence"
    __table_args__ = {"extend_existing": True}
    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    evidence_number = Column(String(100), nullable=False, unique=True, index=True)
    subject_type = Column(String(40), nullable=False, index=True)
    subject_id = Column(String(100), nullable=False, index=True)
    subject_number = Column(String(100), nullable=False, index=True)
    evidence_type = Column(String(50), nullable=False, index=True)
    evidence_reference = Column(String(500), nullable=False)
    note = Column(Text, nullable=False)
    recorded_by = Column(String(255), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
