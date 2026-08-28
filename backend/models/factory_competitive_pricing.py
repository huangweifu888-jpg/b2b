"""Tenant-scoped competitor price intelligence records; never a quote or price master."""

from datetime import datetime
from decimal import Decimal

from core.database import Base
from sqlalchemy import Boolean, DateTime, Integer, JSON, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column


class CompetitivePricingTenantMixin:
    project_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    agent_path: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    tenant_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    client_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    plan_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)


class FactoryCompetitivePriceWatch(CompetitivePricingTenantMixin, Base):
    __tablename__ = "factory_competitive_price_watches"
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    watch_number: Mapped[str] = mapped_column(String(96), nullable=False, unique=True, index=True)
    product_reference: Mapped[str] = mapped_column(String(180), nullable=False, index=True)
    product_name: Mapped[str] = mapped_column(String(180), nullable=False)
    market_country: Mapped[str] = mapped_column(String(8), nullable=False, index=True)
    channel: Mapped[str] = mapped_column(String(64), nullable=False)
    currency: Mapped[str] = mapped_column(String(8), nullable=False)
    own_reference_price: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    scope_note: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="gathering", index=True)
    created_by: Mapped[str] = mapped_column(String(128), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)


class FactoryCompetitiveOfferSnapshot(CompetitivePricingTenantMixin, Base):
    __tablename__ = "factory_competitive_offer_snapshots"
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    snapshot_number: Mapped[str] = mapped_column(String(96), nullable=False, unique=True, index=True)
    watch_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    watch_number: Mapped[str] = mapped_column(String(96), nullable=False)
    competitor_name: Mapped[str] = mapped_column(String(180), nullable=False)
    competitor_offer_reference: Mapped[str] = mapped_column(String(180), nullable=False)
    offer_type: Mapped[str] = mapped_column(String(24), nullable=False)
    offer_price: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    freight_price: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    landed_price: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    feature_summary: Mapped[str] = mapped_column(Text, nullable=False)
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


class FactoryCompetitivePriceDecision(CompetitivePricingTenantMixin, Base):
    __tablename__ = "factory_competitive_price_decisions"
    __table_args__ = (UniqueConstraint("watch_id", name="uq_factory_competitive_watch_decision"),)
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    decision_number: Mapped[str] = mapped_column(String(96), nullable=False, unique=True, index=True)
    watch_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    watch_number: Mapped[str] = mapped_column(String(96), nullable=False)
    input_snapshot_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    input_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    low_landed_price: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    median_landed_price: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    high_landed_price: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    price_index: Mapped[Decimal] = mapped_column(Numeric(8, 2), nullable=False)
    recommendation: Mapped[str] = mapped_column(String(16), nullable=False)
    boundary_note: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="pending-review", index=True)
    authored_by: Mapped[str] = mapped_column(String(128), nullable=False)
    authored_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    reviewed_by: Mapped[str | None] = mapped_column(String(128))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    review_reference: Mapped[str | None] = mapped_column(String(255))
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)


class FactoryCompetitivePricingRelease(CompetitivePricingTenantMixin, Base):
    __tablename__ = "factory_competitive_pricing_releases"
    __table_args__ = (UniqueConstraint("project_id", "release_version", name="uq_factory_competitive_pricing_version"), UniqueConstraint("decision_id", name="uq_factory_competitive_decision_release"))
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    release_number: Mapped[str] = mapped_column(String(96), nullable=False, unique=True, index=True)
    application_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    release_version: Mapped[str] = mapped_column(String(64), nullable=False)
    watch_id: Mapped[str] = mapped_column(String(100), nullable=False)
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


class FactoryCompetitivePricingEvidence(CompetitivePricingTenantMixin, Base):
    __tablename__ = "factory_competitive_pricing_evidence"
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    evidence_number: Mapped[str] = mapped_column(String(96), nullable=False, unique=True, index=True)
    subject_type: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    subject_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    subject_number: Mapped[str] = mapped_column(String(96), nullable=False)
    evidence_type: Mapped[str] = mapped_column(String(64), nullable=False)
    evidence_reference: Mapped[str] = mapped_column(String(255), nullable=False)
    note: Mapped[str | None] = mapped_column(Text)
    recorded_by: Mapped[str] = mapped_column(String(128), nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
