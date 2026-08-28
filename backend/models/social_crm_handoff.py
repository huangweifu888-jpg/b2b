"""Tenant-scoped, human-reviewed social lead handoff records."""

from __future__ import annotations

from datetime import datetime

from core.database import Base
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text


class SocialCrmHandoff(Base):
    __tablename__ = "social_crm_handoffs"

    id = Column(String(64), primary_key=True)
    project_id = Column(Integer, ForeignKey("projects_platform.id"), nullable=False, index=True)
    agent_path = Column(String(512), nullable=False, index=True)
    tenant_id = Column(String(80), nullable=False, index=True)
    client_id = Column(String(80), nullable=False, index=True)
    plan_id = Column(String(80), nullable=False, index=True)
    provider = Column(String(80), nullable=False, index=True)
    contact_reference = Column(String(160), nullable=False)
    lead_summary = Column(Text, nullable=False)
    status = Column(String(40), nullable=False, default="pending_manual_review", index=True)
    submitted_by = Column(String(255), nullable=False, index=True)
    reviewed_by = Column(String(255), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    review_note = Column(Text, nullable=True)
    dispatched_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)
