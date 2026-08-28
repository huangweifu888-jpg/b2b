"""Tenant-scoped CRM accounts, opportunities and immutable activity evidence."""
from datetime import datetime

from core.database import Base
from sqlalchemy import Column, DateTime, Integer, String, Text, UniqueConstraint


class FactoryCrmAccount(Base):
    __tablename__ = "factory_crm_accounts"
    __table_args__ = (UniqueConstraint("project_id", "account_reference", name="uq_factory_crm_account_reference"), {"extend_existing": True})
    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True); agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True); client_id = Column(String(100), nullable=False, index=True); plan_id = Column(String(100), nullable=False, index=True)
    account_number = Column(String(100), nullable=False, unique=True, index=True); account_reference = Column(String(255), nullable=False, index=True)
    account_name = Column(String(255), nullable=False); market = Column(String(80), nullable=False); status = Column(String(32), nullable=False, default="draft", server_default="draft", index=True)
    created_by = Column(String(255), nullable=False, index=True); verified_by = Column(String(255), index=True); verification_reference = Column(String(255))
    revision = Column(Integer, nullable=False, default=1, server_default="1"); created_at = Column(DateTime(timezone=True), default=datetime.now); updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)


class FactoryCrmOpportunity(Base):
    __tablename__ = "factory_crm_opportunities"
    __table_args__ = (UniqueConstraint("project_id", "opportunity_key", name="uq_factory_crm_opportunity_key"), {"extend_existing": True})
    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True); agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True); client_id = Column(String(100), nullable=False, index=True); plan_id = Column(String(100), nullable=False, index=True)
    opportunity_number = Column(String(100), nullable=False, unique=True, index=True); opportunity_key = Column(String(100), nullable=False, index=True)
    account_id = Column(String(100), nullable=False, index=True); account_number = Column(String(100), nullable=False, index=True)
    title = Column(String(255), nullable=False); currency = Column(String(8), nullable=False); amount_cents = Column(Integer, nullable=False); stage = Column(String(32), nullable=False, default="qualified", server_default="qualified", index=True)
    owner_team = Column(String(80), nullable=False); created_by = Column(String(255), nullable=False, index=True); last_updated_by = Column(String(255), nullable=False, index=True)
    close_reference = Column(String(255)); revision = Column(Integer, nullable=False, default=1, server_default="1"); created_at = Column(DateTime(timezone=True), default=datetime.now); updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)


class FactoryCrmEvidence(Base):
    __tablename__ = "factory_crm_evidence"
    __table_args__ = {"extend_existing": True}
    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True); agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True); client_id = Column(String(100), nullable=False, index=True); plan_id = Column(String(100), nullable=False, index=True)
    evidence_number = Column(String(100), nullable=False, unique=True, index=True); subject_type = Column(String(32), nullable=False, index=True); subject_id = Column(String(100), nullable=False, index=True)
    event_type = Column(String(64), nullable=False, index=True); reference = Column(String(255), nullable=False); note = Column(Text, nullable=False); recorded_by = Column(String(255), nullable=False, index=True); recorded_at = Column(DateTime(timezone=True), default=datetime.now, index=True)
