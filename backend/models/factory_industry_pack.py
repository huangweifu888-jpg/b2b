"""Tenant-scoped installations of governed Factory Platform industry packs."""

from datetime import datetime

from core.database import Base
from sqlalchemy import Column, DateTime, Integer, String, Text


class FactoryIndustryPackInstallation(Base):
    __tablename__ = "factory_industry_pack_installations"
    __table_args__ = {"extend_existing": True}

    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    pack_id = Column(String(100), nullable=False, default="machinery", server_default="machinery", index=True)
    segment = Column(String(100), nullable=False, index=True)
    package_version = Column(Integer, nullable=False, default=1, server_default="1")
    configuration_json = Column(Text, nullable=False, default="{}", server_default="{}")
    evidence_json = Column(Text, nullable=False, default="{}", server_default="{}")
    status = Column(String(30), nullable=False, default="draft", server_default="draft", index=True)
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    updated_by = Column(String(255), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)
