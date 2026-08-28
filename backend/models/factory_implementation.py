"""Tenant-scoped 7/30/90 day implementation programs."""

from datetime import datetime

from core.database import Base
from sqlalchemy import Column, DateTime, Integer, String, Text


class FactoryImplementationProgram(Base):
    __tablename__ = "factory_implementation_programs"
    __table_args__ = {"extend_existing": True}

    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    golden_flow = Column(String(50), nullable=False, index=True)
    baseline_summary = Column(Text, nullable=False)
    target_outcome = Column(Text, nullable=False)
    current_stage = Column(String(50), nullable=False, default="day-7", server_default="day-7", index=True)
    status = Column(String(30), nullable=False, default="active", server_default="active", index=True)
    artifacts_json = Column(Text, nullable=False, default="{}", server_default="{}")
    blockers_json = Column(Text, nullable=False, default="[]", server_default="[]")
    next_action = Column(Text, nullable=False)
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    updated_by = Column(String(255), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)
