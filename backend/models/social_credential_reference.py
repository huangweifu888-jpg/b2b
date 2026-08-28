"""Tenant-scoped references to externally managed social credentials.

Only a reference such as ``vault://social/meta/client-a`` is stored.  Token
material, authorization codes, cookies, passwords and client secrets are never
persisted in this database.
"""

from __future__ import annotations

from datetime import datetime

from core.database import Base
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint


class SocialCredentialReference(Base):
    __tablename__ = "social_credential_references"
    __table_args__ = (UniqueConstraint("project_id", "provider", "secret_reference", name="uq_social_credential_reference_scope"),)

    id = Column(String(64), primary_key=True)
    project_id = Column(Integer, ForeignKey("projects_platform.id"), nullable=False, index=True)
    agent_path = Column(String(512), nullable=False, index=True)
    tenant_id = Column(String(80), nullable=False, index=True)
    client_id = Column(String(80), nullable=False, index=True)
    plan_id = Column(String(80), nullable=False, index=True)
    authorization_request_id = Column(String(64), ForeignKey("social_authorization_requests.id"), nullable=True, index=True)
    provider = Column(String(80), nullable=False, index=True)
    secret_reference = Column(String(255), nullable=False)
    scopes_json = Column(Text, nullable=False, default="[]")
    status = Column(String(32), nullable=False, default="active", index=True)
    verified_at = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    revocation_requested_at = Column(DateTime(timezone=True), nullable=True)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    created_by = Column(String(255), nullable=False, index=True)
    revoked_by = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)
