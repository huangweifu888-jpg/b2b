"""Tenant-scoped social content review records.

The workflow stores only the customer's proposed content and review decisions.
OAuth credentials, access tokens and external publication results are excluded;
those belong to the server-side connector that will be added after approval.
"""

from __future__ import annotations

from datetime import datetime

from core.database import Base
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text


class SocialContentReview(Base):
    __tablename__ = "social_content_reviews"

    id = Column(String(64), primary_key=True)
    project_id = Column(Integer, ForeignKey("projects_platform.id"), nullable=False, index=True)
    agent_path = Column(String(512), nullable=False, index=True)
    tenant_id = Column(String(80), nullable=False, index=True)
    client_id = Column(String(80), nullable=False, index=True)
    plan_id = Column(String(80), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    content_text = Column(Text, nullable=False)
    channels_json = Column(Text, nullable=False, default="[]")
    status = Column(String(40), nullable=False, default="pending_agency_review", index=True)
    submitted_by = Column(String(255), nullable=False, index=True)
    agency_reviewed_by = Column(String(255), nullable=True)
    agency_reviewed_at = Column(DateTime(timezone=True), nullable=True)
    headquarters_reviewed_by = Column(String(255), nullable=True)
    headquarters_reviewed_at = Column(DateTime(timezone=True), nullable=True)
    review_note = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)
