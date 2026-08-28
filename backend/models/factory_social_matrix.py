"""Governed snapshots and receipts for tenant social-account matrices.

This projection only carries opaque credential references and social-page
identifiers. Credentials, OAuth codes and platform data are never copied here.
"""
from datetime import datetime
from core.database import Base
from sqlalchemy import Column, DateTime, Integer, String, Text, UniqueConstraint


class FactorySocialMatrix(Base):
    __tablename__ = "factory_social_matrices"
    __table_args__ = (UniqueConstraint("project_id", "matrix_key", name="uq_factory_social_matrix_key"), {"extend_existing": True})
    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    matrix_number = Column(String(100), nullable=False, unique=True, index=True)
    matrix_key = Column(String(100), nullable=False, index=True)
    matrix_name = Column(String(255), nullable=False)
    market_scope = Column(String(32), nullable=False, index=True)
    status = Column(String(32), nullable=False, default="draft", server_default="draft", index=True)
    created_by = Column(String(255), nullable=False, index=True)
    verified_by = Column(String(255), nullable=True, index=True)
    verification_reference = Column(String(255), nullable=True)
    published_by = Column(String(255), nullable=True, index=True)
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)


class FactorySocialMatrixBinding(Base):
    __tablename__ = "factory_social_matrix_bindings"
    __table_args__ = (UniqueConstraint("matrix_id", "page_asset_id", name="uq_factory_social_matrix_page"), {"extend_existing": True})
    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    binding_number = Column(String(100), nullable=False, unique=True, index=True)
    matrix_id = Column(String(100), nullable=False, index=True)
    matrix_number = Column(String(100), nullable=False, index=True)
    page_asset_id = Column(String(100), nullable=False, index=True)
    provider = Column(String(80), nullable=False, index=True)
    page_reference = Column(String(255), nullable=False)
    credential_reference_id = Column(String(100), nullable=False, index=True)
    credential_fingerprint = Column(String(64), nullable=False)
    page_fingerprint = Column(String(64), nullable=False)
    latest_snapshot_id = Column(String(100), nullable=False, index=True)
    latest_snapshot_fingerprint = Column(String(64), nullable=False)
    created_by = Column(String(255), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)


class FactorySocialMatrixPublication(Base):
    __tablename__ = "factory_social_matrix_publications"
    __table_args__ = (UniqueConstraint("matrix_id", "version_number", name="uq_factory_social_matrix_version"), {"extend_existing": True})
    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    publication_number = Column(String(100), nullable=False, unique=True, index=True)
    matrix_id = Column(String(100), nullable=False, index=True)
    matrix_number = Column(String(100), nullable=False, index=True)
    version_number = Column(Integer, nullable=False)
    manifest_json = Column(Text, nullable=False)
    manifest_fingerprint = Column(String(64), nullable=False)
    status = Column(String(32), nullable=False, default="pending", server_default="pending", index=True)
    published_by = Column(String(255), nullable=False, index=True)
    delivery_reference = Column(String(255), nullable=False)
    acknowledged_by = Column(String(255), nullable=True, index=True)
    acknowledgement_reference = Column(String(255), nullable=True)
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)
