"""Tenant-scoped social page assets and metric snapshots.

This is an operational data plane for pages selected by a customer.  It never
stores platform passwords, OAuth tokens, cookies, authorization codes or API
keys.  Provider connectors may write ``official_api`` snapshots only after a
validated server-side OAuth callback; staff can enter a ``verified_manual``
snapshot from an official export while a connector is being prepared.
"""

from __future__ import annotations

from datetime import datetime

from core.database import Base
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text


class SocialPageAsset(Base):
    __tablename__ = "social_page_assets"

    id = Column(String(64), primary_key=True)
    project_id = Column(Integer, ForeignKey("projects_platform.id"), nullable=False, index=True)
    agent_path = Column(String(512), nullable=False, index=True)
    tenant_id = Column(String(80), nullable=False, index=True)
    client_id = Column(String(80), nullable=False, index=True)
    plan_id = Column(String(80), nullable=False, index=True)
    authorization_request_id = Column(String(64), ForeignKey("social_authorization_requests.id"), nullable=True, index=True)
    provider = Column(String(80), nullable=False, index=True)
    display_name = Column(String(255), nullable=False)
    page_url = Column(String(1000), nullable=False)
    asset_reference = Column(String(255), nullable=False)
    status = Column(String(32), nullable=False, default="awaiting_oauth", index=True)
    created_by = Column(String(255), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)


class SocialPageMetricSnapshot(Base):
    __tablename__ = "social_page_metric_snapshots"

    id = Column(String(64), primary_key=True)
    project_id = Column(Integer, ForeignKey("projects_platform.id"), nullable=False, index=True)
    page_asset_id = Column(String(64), ForeignKey("social_page_assets.id"), nullable=False, index=True)
    agent_path = Column(String(512), nullable=False, index=True)
    tenant_id = Column(String(80), nullable=False, index=True)
    client_id = Column(String(80), nullable=False, index=True)
    plan_id = Column(String(80), nullable=False, index=True)
    source = Column(String(32), nullable=False, index=True)
    captured_at = Column(DateTime(timezone=True), nullable=False, index=True)
    followers = Column(Integer, nullable=True)
    impressions = Column(Integer, nullable=True)
    engagements = Column(Integer, nullable=True)
    views = Column(Integer, nullable=True)
    clicks = Column(Integer, nullable=True)
    recorded_by = Column(String(255), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)


class SocialPageSyncRequest(Base):
    __tablename__ = "social_page_sync_requests"

    id = Column(String(64), primary_key=True)
    project_id = Column(Integer, ForeignKey("projects_platform.id"), nullable=False, index=True)
    page_asset_id = Column(String(64), ForeignKey("social_page_assets.id"), nullable=False, index=True)
    agent_path = Column(String(512), nullable=False, index=True)
    tenant_id = Column(String(80), nullable=False, index=True)
    client_id = Column(String(80), nullable=False, index=True)
    plan_id = Column(String(80), nullable=False, index=True)
    status = Column(String(32), nullable=False, default="blocked_configuration", index=True)
    block_reasons_json = Column(Text, nullable=False, default="[]")
    requested_by = Column(String(255), nullable=False, index=True)
    requested_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)
