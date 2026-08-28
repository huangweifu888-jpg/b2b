"""Tenant-scoped country market radar records and release evidence."""

from datetime import datetime
from decimal import Decimal

from core.database import Base
from sqlalchemy import Boolean, DateTime, Integer, JSON, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column


class MarketRadarTenantMixin:
    project_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    agent_path: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    tenant_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    client_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    plan_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)


class FactoryMarketScan(MarketRadarTenantMixin, Base):
    __tablename__ = "factory_market_scans"
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    scan_number: Mapped[str] = mapped_column(String(96), unique=True, nullable=False, index=True)
    product_reference: Mapped[str] = mapped_column(String(180), nullable=False, index=True)
    product_name: Mapped[str] = mapped_column(String(180), nullable=False)
    target_country: Mapped[str] = mapped_column(String(8), nullable=False, index=True)
    target_channel: Mapped[str] = mapped_column(String(64), nullable=False)
    objective: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="gathering", index=True)
    created_by: Mapped[str] = mapped_column(String(128), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)


class FactoryMarketSignal(MarketRadarTenantMixin, Base):
    __tablename__ = "factory_market_signals"
    __table_args__ = (UniqueConstraint("scan_id", "signal_type", name="uq_factory_market_scan_signal"),)
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    signal_number: Mapped[str] = mapped_column(String(96), unique=True, nullable=False, index=True)
    scan_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    scan_number: Mapped[str] = mapped_column(String(96), nullable=False)
    signal_type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    normalized_score: Mapped[Decimal] = mapped_column(Numeric(6, 2), nullable=False)
    raw_value: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    measurement_unit: Mapped[str] = mapped_column(String(32), nullable=False)
    source_system: Mapped[str] = mapped_column(String(64), nullable=False)
    source_reference: Mapped[str] = mapped_column(String(255), nullable=False)
    source_revision: Mapped[str] = mapped_column(String(96), nullable=False)
    source_observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    source_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending-verification", index=True)
    recorded_by: Mapped[str] = mapped_column(String(128), nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    verified_by: Mapped[str | None] = mapped_column(String(128))
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    verification_reference: Mapped[str | None] = mapped_column(String(255))
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)


class FactoryMarketEntryDecision(MarketRadarTenantMixin, Base):
    __tablename__ = "factory_market_entry_decisions"
    __table_args__ = (UniqueConstraint("scan_id", name="uq_factory_market_scan_decision"),)
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    decision_number: Mapped[str] = mapped_column(String(96), unique=True, nullable=False, index=True)
    scan_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    scan_number: Mapped[str] = mapped_column(String(96), nullable=False)
    input_snapshot_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    input_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    opportunity_score: Mapped[Decimal] = mapped_column(Numeric(6, 2), nullable=False)
    entry_recommendation: Mapped[str] = mapped_column(String(16), nullable=False)
    entry_gate_note: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="pending-review", index=True)
    authored_by: Mapped[str] = mapped_column(String(128), nullable=False)
    authored_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    reviewed_by: Mapped[str | None] = mapped_column(String(128))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    review_reference: Mapped[str | None] = mapped_column(String(255))
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)


class FactoryMarketRadarRelease(MarketRadarTenantMixin, Base):
    __tablename__ = "factory_market_radar_releases"
    __table_args__ = (UniqueConstraint("project_id", "release_version", name="uq_factory_market_radar_version"), UniqueConstraint("decision_id", name="uq_factory_market_decision_release"))
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    release_number: Mapped[str] = mapped_column(String(96), unique=True, nullable=False, index=True)
    application_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    release_version: Mapped[str] = mapped_column(String(64), nullable=False)
    scan_id: Mapped[str] = mapped_column(String(100), nullable=False)
    decision_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    manifest_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    manifest_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    support_owner: Mapped[str] = mapped_column(String(128), nullable=False)
    support_until: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    customer_trial_reference: Mapped[str] = mapped_column(String(255), nullable=False)
    role_training_reference: Mapped[str] = mapped_column(String(255), nullable=False)
    issue_closure_reference: Mapped[str] = mapped_column(String(255), nullable=False)
    monitoring_reference: Mapped[str] = mapped_column(String(255), nullable=False)
    rollback_reference: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="pending-approval", index=True)
    available: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    prepared_by: Mapped[str] = mapped_column(String(128), nullable=False)
    prepared_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    approved_by: Mapped[str | None] = mapped_column(String(128))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    approval_reference: Mapped[str | None] = mapped_column(String(255))
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)


class FactoryMarketRadarEvidence(MarketRadarTenantMixin, Base):
    __tablename__ = "factory_market_radar_evidence"
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    evidence_number: Mapped[str] = mapped_column(String(96), unique=True, nullable=False, index=True)
    subject_type: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    subject_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    subject_number: Mapped[str] = mapped_column(String(96), nullable=False)
    evidence_type: Mapped[str] = mapped_column(String(64), nullable=False)
    evidence_reference: Mapped[str] = mapped_column(String(255), nullable=False)
    note: Mapped[str | None] = mapped_column(Text)
    recorded_by: Mapped[str] = mapped_column(String(128), nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
