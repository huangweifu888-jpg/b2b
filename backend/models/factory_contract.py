"""Versioned object and event contracts shared by all Factory Platform domains."""

from datetime import datetime

from core.database import Base
from sqlalchemy import Column, DateTime, Integer, String, Text


class FactoryCoreObjectContract(Base):
    __tablename__ = "factory_core_object_contracts"
    __table_args__ = {"extend_existing": True}

    id = Column(String(100), primary_key=True)
    sequence = Column(Integer, nullable=False, unique=True, index=True)
    label = Column(String(100), nullable=False)
    system_of_record = Column(String(50), nullable=False, index=True)
    identity_rule = Column(String(2000), nullable=False)
    minimum_fields_json = Column(Text, nullable=False, default="[]", server_default="[]")
    lifecycle_status = Column(String(30), nullable=False, default="draft", server_default="draft", index=True)
    schema_version = Column(Integer, nullable=False, default=1, server_default="1")
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    updated_by = Column(String(255), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)


class FactoryCoreEventContract(Base):
    __tablename__ = "factory_core_event_contracts"
    __table_args__ = {"extend_existing": True}

    id = Column(String(100), primary_key=True)
    sequence = Column(Integer, nullable=False, unique=True, index=True)
    label = Column(String(100), nullable=False)
    subject_id = Column(String(100), nullable=False, index=True)
    producer = Column(String(50), nullable=False, index=True)
    consumers_json = Column(Text, nullable=False, default="[]", server_default="[]")
    required_fields_json = Column(Text, nullable=False, default="[]", server_default="[]")
    compatibility = Column(String(30), nullable=False, default="backward", server_default="backward")
    lifecycle_status = Column(String(30), nullable=False, default="draft", server_default="draft", index=True)
    schema_version = Column(Integer, nullable=False, default=1, server_default="1")
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    updated_by = Column(String(255), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)
