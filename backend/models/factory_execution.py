"""Durable headquarters control-plane records for Factory Platform delivery."""

from datetime import datetime

from core.database import Base
from sqlalchemy import Column, DateTime, Integer, String, Text


class FactoryExecutionWorkstream(Base):
    __tablename__ = "factory_execution_workstreams"
    __table_args__ = {"extend_existing": True}

    id = Column(String(100), primary_key=True)
    sequence = Column(Integer, nullable=False, unique=True, index=True)
    label = Column(String(100), nullable=False)
    status = Column(String(30), nullable=False, default="queued", server_default="queued", index=True)
    current_gate = Column(String(50), nullable=False, default="intake-review", server_default="intake-review", index=True)
    owner_roles_json = Column(Text, nullable=False, default="[]", server_default="[]")
    deliverables_json = Column(Text, nullable=False, default="[]", server_default="[]")
    blockers_json = Column(Text, nullable=False, default="[]", server_default="[]")
    evidence_json = Column(Text, nullable=False, default="[]", server_default="[]")
    next_action = Column(String(2000), nullable=False)
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    updated_by = Column(String(255), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)
