"""Tenant-scoped, review-pinned social content calendar projections."""
from datetime import datetime
from core.database import Base
from sqlalchemy import Column, DateTime, Integer, String, Text, UniqueConstraint

class FactoryContentCalendar(Base):
    __tablename__ = "factory_content_calendars"
    __table_args__ = (UniqueConstraint("project_id", "calendar_key", name="uq_factory_content_calendar_key"), {"extend_existing": True})
    id = Column(String(100), primary_key=True); project_id = Column(Integer, nullable=False, index=True); agent_path = Column(String(500), nullable=False, index=True); tenant_id = Column(String(100), nullable=False, index=True); client_id = Column(String(100), nullable=False, index=True); plan_id = Column(String(100), nullable=False, index=True)
    calendar_number = Column(String(100), nullable=False, unique=True, index=True); calendar_key = Column(String(100), nullable=False, index=True); calendar_name = Column(String(255), nullable=False); market_scope = Column(String(32), nullable=False, index=True); status = Column(String(32), nullable=False, default="draft", server_default="draft", index=True); created_by = Column(String(255), nullable=False, index=True); verified_by = Column(String(255), index=True); verification_reference = Column(String(255)); published_by = Column(String(255), index=True); revision = Column(Integer, nullable=False, default=1, server_default="1"); created_at = Column(DateTime(timezone=True), default=datetime.now); updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)

class FactoryContentCalendarEntry(Base):
    __tablename__ = "factory_content_calendar_entries"
    __table_args__ = (UniqueConstraint("calendar_id", "review_id", "channel", name="uq_factory_content_calendar_entry_review_channel"), {"extend_existing": True})
    id = Column(String(100), primary_key=True); project_id = Column(Integer, nullable=False, index=True); agent_path = Column(String(500), nullable=False, index=True); tenant_id = Column(String(100), nullable=False, index=True); client_id = Column(String(100), nullable=False, index=True); plan_id = Column(String(100), nullable=False, index=True)
    entry_number = Column(String(100), nullable=False, unique=True, index=True); calendar_id = Column(String(100), nullable=False, index=True); calendar_number = Column(String(100), nullable=False, index=True); review_id = Column(String(100), nullable=False, index=True); review_fingerprint = Column(String(64), nullable=False); channel = Column(String(80), nullable=False, index=True); scheduled_for = Column(DateTime(timezone=True), nullable=False, index=True); created_by = Column(String(255), nullable=False, index=True); created_at = Column(DateTime(timezone=True), default=datetime.now)

class FactoryContentCalendarPublication(Base):
    __tablename__ = "factory_content_calendar_publications"
    __table_args__ = (UniqueConstraint("calendar_id", "version_number", name="uq_factory_content_calendar_version"), {"extend_existing": True})
    id = Column(String(100), primary_key=True); project_id = Column(Integer, nullable=False, index=True); agent_path = Column(String(500), nullable=False, index=True); tenant_id = Column(String(100), nullable=False, index=True); client_id = Column(String(100), nullable=False, index=True); plan_id = Column(String(100), nullable=False, index=True)
    publication_number = Column(String(100), nullable=False, unique=True, index=True); calendar_id = Column(String(100), nullable=False, index=True); calendar_number = Column(String(100), nullable=False, index=True); version_number = Column(Integer, nullable=False); manifest_json = Column(Text, nullable=False); manifest_fingerprint = Column(String(64), nullable=False); status = Column(String(32), nullable=False, default="pending", server_default="pending", index=True); published_by = Column(String(255), nullable=False, index=True); delivery_reference = Column(String(255), nullable=False); acknowledged_by = Column(String(255), index=True); acknowledgement_reference = Column(String(255)); revision = Column(Integer, nullable=False, default=1, server_default="1"); created_at = Column(DateTime(timezone=True), default=datetime.now); acknowledged_at = Column(DateTime(timezone=True))
