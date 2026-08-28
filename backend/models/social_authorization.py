"""Persisted control-plane records for social platform authorization.

Secrets and OAuth tokens deliberately do not belong in these tables.  The
headquarters record stores only a reference to an approved secret-management
entry; a future connector may resolve that reference server-side.
"""

from __future__ import annotations

from datetime import datetime

from core.database import Base
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint


class SocialOAuthApplication(Base):
    __tablename__ = "social_oauth_applications"
    __table_args__ = (UniqueConstraint("provider", name="uq_social_oauth_applications_provider"),)

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    provider = Column(String(80), nullable=False, index=True)
    status = Column(String(30), nullable=False, default="draft", index=True)
    client_id_reference = Column(String(255), nullable=True)
    secret_reference = Column(String(255), nullable=True)
    redirect_uri = Column(String(1000), nullable=True)
    approved_scopes_json = Column(Text, nullable=False, default="[]")
    configured_by = Column(String(255), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)


class SocialAuthorizationRequest(Base):
    __tablename__ = "social_authorization_requests"

    id = Column(String(64), primary_key=True)
    project_id = Column(Integer, ForeignKey("projects_platform.id"), nullable=False, index=True)
    agent_path = Column(String(512), nullable=False, index=True)
    tenant_id = Column(String(80), nullable=False, index=True)
    client_id = Column(String(80), nullable=False, index=True)
    plan_id = Column(String(80), nullable=False, index=True)
    provider = Column(String(80), nullable=False, index=True)
    account_label = Column(String(255), nullable=False)
    market = Column(String(20), nullable=False)
    requested_scopes_json = Column(Text, nullable=False, default="[]")
    status = Column(String(40), nullable=False, default="awaiting_headquarters_app", index=True)
    requested_by = Column(String(255), nullable=False, index=True)
    cancelled_by = Column(String(255), nullable=True)
    cancelled_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)
