"""Tenant-scoped social data-retention and deletion-review policy."""

from __future__ import annotations

from datetime import datetime

from core.database import Base
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String


class SocialCompliancePolicy(Base):
    __tablename__ = "social_compliance_policies"

    id = Column(String(64), primary_key=True)
    project_id = Column(Integer, ForeignKey("projects_platform.id"), nullable=False, unique=True, index=True)
    agent_path = Column(String(512), nullable=False, index=True)
    tenant_id = Column(String(80), nullable=False, index=True)
    client_id = Column(String(80), nullable=False, index=True)
    plan_id = Column(String(80), nullable=False, index=True)
    retention_days = Column(Integer, nullable=False, default=180)
    deletion_status = Column(String(40), nullable=False, default="active", index=True)
    deletion_requested_by = Column(String(255), nullable=True)
    deletion_requested_at = Column(DateTime(timezone=True), nullable=True)
    deletion_reviewed_by = Column(String(255), nullable=True)
    deletion_reviewed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)
