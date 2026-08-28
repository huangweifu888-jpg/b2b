"""Tenant-scoped durable social workspace state.

This record is intentionally a workflow state container, not a secret store.
OAuth tokens, platform passwords, cookies, authorization codes and API keys are
rejected by the API and must stay in the approved server-side secret manager.
"""

from __future__ import annotations

from datetime import datetime

from core.database import Base
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint


class SocialPlanWorkspace(Base):
    __tablename__ = "social_plan_workspaces"
    __table_args__ = (UniqueConstraint("project_id", name="uq_social_plan_workspaces_project_id"),)

    id = Column(String(64), primary_key=True)
    project_id = Column(Integer, ForeignKey("projects_platform.id"), nullable=False, index=True)
    agent_path = Column(String(512), nullable=False, index=True)
    tenant_id = Column(String(80), nullable=False, index=True)
    client_id = Column(String(80), nullable=False, index=True)
    plan_id = Column(String(80), nullable=False, index=True)
    state_json = Column(Text, nullable=False, default="{}")
    revision = Column(Integer, nullable=False, default=0)
    updated_by = Column(String(255), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)
