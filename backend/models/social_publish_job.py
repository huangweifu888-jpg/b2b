"""Tenant-scoped internal social publish jobs.

Jobs are a durable approval and idempotency record.  They do not contain
OAuth credentials and this model does not publish to any external provider.
"""

from __future__ import annotations

from datetime import datetime

from core.database import Base
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint


class SocialPublishJob(Base):
    __tablename__ = "social_publish_jobs"
    __table_args__ = (UniqueConstraint("project_id", "idempotency_key", name="uq_social_publish_jobs_project_idempotency"),)

    id = Column(String(64), primary_key=True)
    project_id = Column(Integer, ForeignKey("projects_platform.id"), nullable=False, index=True)
    agent_path = Column(String(512), nullable=False, index=True)
    tenant_id = Column(String(80), nullable=False, index=True)
    client_id = Column(String(80), nullable=False, index=True)
    plan_id = Column(String(80), nullable=False, index=True)
    content_review_id = Column(String(64), ForeignKey("social_content_reviews.id"), nullable=False, index=True)
    provider = Column(String(80), nullable=False, index=True)
    idempotency_key = Column(String(128), nullable=False)
    status = Column(String(32), nullable=False, default="blocked", index=True)
    block_reasons_json = Column(Text, nullable=False, default="[]")
    requested_by = Column(String(255), nullable=False, index=True)
    scheduled_for = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)
