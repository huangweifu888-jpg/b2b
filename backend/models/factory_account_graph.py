"""Tenant-scoped B2B account, contact, opportunity and fulfilment graph."""
from datetime import datetime

from core.database import Base
from sqlalchemy import Boolean, DateTime, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column


class AccountGraphTenantMixin:
    project_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    agent_path: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    tenant_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    client_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    plan_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)


class FactoryAccountGraph(AccountGraphTenantMixin, Base):
    __tablename__ = "factory_account_graphs"
    __table_args__ = (UniqueConstraint("project_id", "graph_code", name="uq_factory_account_graph_project_code"),)
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    graph_number: Mapped[str] = mapped_column(String(96), nullable=False, unique=True, index=True)
    graph_code: Mapped[str] = mapped_column(String(64), nullable=False)
    graph_name: Mapped[str] = mapped_column(String(180), nullable=False)
    scope: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="draft", index=True)
    authored_by: Mapped[str] = mapped_column(String(128), nullable=False)
    published_by: Mapped[str | None] = mapped_column(String(128))
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class FactoryAccountGraphNode(AccountGraphTenantMixin, Base):
    __tablename__ = "factory_account_graph_nodes"
    __table_args__ = (UniqueConstraint("graph_id", "source_type", "source_id", name="uq_factory_account_graph_source_node"),)
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    node_number: Mapped[str] = mapped_column(String(96), nullable=False, unique=True, index=True)
    graph_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    graph_number: Mapped[str] = mapped_column(String(96), nullable=False)
    node_type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    node_key: Mapped[str] = mapped_column(String(180), nullable=False)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    account_reference: Mapped[str] = mapped_column(String(180), nullable=False, index=True)
    country_code: Mapped[str | None] = mapped_column(String(8))
    source_type: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    source_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    source_number: Mapped[str] = mapped_column(String(100), nullable=False)
    source_revision: Mapped[int] = mapped_column(Integer, nullable=False)
    source_status: Mapped[str] = mapped_column(String(32), nullable=False)
    source_fingerprint: Mapped[str] = mapped_column(String(64), nullable=False)
    source_snapshot_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="pending", index=True)
    created_by: Mapped[str] = mapped_column(String(128), nullable=False)
    verified_by: Mapped[str | None] = mapped_column(String(128))
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    verification_reference: Mapped[str | None] = mapped_column(String(255))
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class FactoryAccountGraphEdge(AccountGraphTenantMixin, Base):
    __tablename__ = "factory_account_graph_edges"
    __table_args__ = (UniqueConstraint("graph_id", "from_node_id", "relation_type", "to_node_id", name="uq_factory_account_graph_relation"),)
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    edge_number: Mapped[str] = mapped_column(String(96), nullable=False, unique=True, index=True)
    graph_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    graph_number: Mapped[str] = mapped_column(String(96), nullable=False)
    from_node_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    from_node_number: Mapped[str] = mapped_column(String(96), nullable=False)
    to_node_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    to_node_number: Mapped[str] = mapped_column(String(96), nullable=False)
    relation_type: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    strength: Mapped[str] = mapped_column(String(16), nullable=False)
    evidence_reference: Mapped[str] = mapped_column(String(255), nullable=False)
    endpoint_manifest_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="pending", index=True)
    created_by: Mapped[str] = mapped_column(String(128), nullable=False)
    verified_by: Mapped[str | None] = mapped_column(String(128))
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    verification_reference: Mapped[str | None] = mapped_column(String(255))
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class FactoryAccountGraphVersion(AccountGraphTenantMixin, Base):
    __tablename__ = "factory_account_graph_versions"
    __table_args__ = (UniqueConstraint("graph_id", "version_number", name="uq_factory_account_graph_version"),)
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    version_reference: Mapped[str] = mapped_column(String(96), nullable=False, unique=True, index=True)
    graph_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    graph_number: Mapped[str] = mapped_column(String(96), nullable=False)
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    manifest_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    manifest_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    node_count: Mapped[int] = mapped_column(Integer, nullable=False)
    edge_count: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="published", index=True)
    published_by: Mapped[str] = mapped_column(String(128), nullable=False)
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class FactoryAccountGraphPublication(AccountGraphTenantMixin, Base):
    __tablename__ = "factory_account_graph_publications"
    __table_args__ = (UniqueConstraint("version_id", "consumer", name="uq_factory_account_graph_version_consumer"),)
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    publication_number: Mapped[str] = mapped_column(String(96), nullable=False, unique=True, index=True)
    graph_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    version_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    version_reference: Mapped[str] = mapped_column(String(96), nullable=False)
    consumer: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    manifest_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    delivery_reference: Mapped[str] = mapped_column(String(255), nullable=False)
    consumer_mutated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="pending", index=True)
    created_by: Mapped[str] = mapped_column(String(128), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    acknowledged_by: Mapped[str | None] = mapped_column(String(128))
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    acknowledgement_reference: Mapped[str | None] = mapped_column(String(255))
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)


class FactoryAccountGraphEvidence(AccountGraphTenantMixin, Base):
    __tablename__ = "factory_account_graph_evidence"
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    evidence_number: Mapped[str] = mapped_column(String(96), nullable=False, unique=True, index=True)
    subject_type: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    subject_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    subject_number: Mapped[str] = mapped_column(String(96), nullable=False)
    evidence_type: Mapped[str] = mapped_column(String(48), nullable=False)
    evidence_reference: Mapped[str] = mapped_column(String(255), nullable=False)
    note: Mapped[str | None] = mapped_column(Text)
    recorded_by: Mapped[str] = mapped_column(String(128), nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
