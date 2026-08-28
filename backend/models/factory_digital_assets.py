"""Tenant-scoped AI site-plan and digital-asset governance records."""

from datetime import datetime

from core.database import Base
from sqlalchemy import Boolean, DateTime, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column


class DigitalAssetTenantMixin:
    project_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    agent_path: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    tenant_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    client_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    plan_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)


class FactoryDigitalAssetPlan(DigitalAssetTenantMixin, Base):
    __tablename__ = "factory_digital_asset_plans"

    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    plan_number: Mapped[str] = mapped_column(String(96), unique=True, index=True)
    business_goal: Mapped[str] = mapped_column(Text, nullable=False)
    target_market: Mapped[str] = mapped_column(String(120), nullable=False)
    target_audience: Mapped[str] = mapped_column(Text, nullable=False)
    site_scope: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="draft", index=True)
    authored_by: Mapped[str] = mapped_column(String(128), nullable=False)
    approved_by: Mapped[str | None] = mapped_column(String(128))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    approval_reference: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revision: Mapped[int] = mapped_column(Integer, default=1, nullable=False)


class FactoryDigitalAssetSuggestion(DigitalAssetTenantMixin, Base):
    __tablename__ = "factory_digital_asset_suggestions"
    __table_args__ = (UniqueConstraint("source_plan_id", "suggestion_hash", name="uq_factory_digital_asset_suggestion_hash"),)

    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    suggestion_number: Mapped[str] = mapped_column(String(96), unique=True, index=True)
    source_plan_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    plan_number: Mapped[str] = mapped_column(String(96), nullable=False)
    suggestion_type: Mapped[str] = mapped_column(String(64), nullable=False)
    recommendation_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    source_reference: Mapped[str] = mapped_column(String(255), nullable=False)
    suggestion_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="pending-review", index=True)
    generated_by: Mapped[str] = mapped_column(String(128), nullable=False)
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    reviewed_by: Mapped[str | None] = mapped_column(String(128))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    review_reference: Mapped[str | None] = mapped_column(String(255))
    revision: Mapped[int] = mapped_column(Integer, default=1, nullable=False)


class FactoryDigitalAssetRegister(DigitalAssetTenantMixin, Base):
    __tablename__ = "factory_digital_asset_registers"
    __table_args__ = (UniqueConstraint("project_id", "asset_kind", "asset_identifier", name="uq_factory_digital_asset_identifier"),)

    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    asset_number: Mapped[str] = mapped_column(String(96), unique=True, index=True)
    source_plan_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    plan_number: Mapped[str] = mapped_column(String(96), nullable=False)
    asset_kind: Mapped[str] = mapped_column(String(32), nullable=False)
    asset_identifier: Mapped[str] = mapped_column(String(255), nullable=False)
    ownership_reference: Mapped[str] = mapped_column(String(255), nullable=False)
    rights_scope: Mapped[str] = mapped_column(Text, nullable=False)
    registrar_secret_stored: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="pending-approval", index=True)
    registered_by: Mapped[str] = mapped_column(String(128), nullable=False)
    registered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    approved_by: Mapped[str | None] = mapped_column(String(128))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    approval_reference: Mapped[str | None] = mapped_column(String(255))
    revision: Mapped[int] = mapped_column(Integer, default=1, nullable=False)


class FactoryDigitalAssetHandoff(DigitalAssetTenantMixin, Base):
    __tablename__ = "factory_digital_asset_handoffs"
    __table_args__ = (UniqueConstraint("source_plan_id", "release_version", name="uq_factory_digital_asset_release_version"),)

    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    handoff_number: Mapped[str] = mapped_column(String(96), unique=True, index=True)
    application_id: Mapped[str] = mapped_column(String(100), nullable=False)
    source_plan_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    plan_number: Mapped[str] = mapped_column(String(96), nullable=False)
    release_version: Mapped[str] = mapped_column(String(64), nullable=False)
    manifest_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    manifest_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    support_owner: Mapped[str] = mapped_column(String(128), nullable=False)
    support_until: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    customer_trial_reference: Mapped[str] = mapped_column(String(255), nullable=False)
    role_training_reference: Mapped[str] = mapped_column(String(255), nullable=False)
    issue_closure_reference: Mapped[str] = mapped_column(String(255), nullable=False)
    monitoring_reference: Mapped[str] = mapped_column(String(255), nullable=False)
    rollback_reference: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="pending-approval", index=True)
    available: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    prepared_by: Mapped[str] = mapped_column(String(128), nullable=False)
    prepared_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    approved_by: Mapped[str | None] = mapped_column(String(128))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    approval_reference: Mapped[str | None] = mapped_column(String(255))
    revision: Mapped[int] = mapped_column(Integer, default=1, nullable=False)


class FactoryDigitalAssetEvidence(DigitalAssetTenantMixin, Base):
    __tablename__ = "factory_digital_asset_evidence"

    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    evidence_number: Mapped[str] = mapped_column(String(96), unique=True, index=True)
    subject_type: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    subject_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    subject_number: Mapped[str] = mapped_column(String(96), nullable=False)
    evidence_type: Mapped[str] = mapped_column(String(64), nullable=False)
    evidence_reference: Mapped[str] = mapped_column(String(255), nullable=False)
    note: Mapped[str | None] = mapped_column(Text)
    recorded_by: Mapped[str] = mapped_column(String(128), nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
