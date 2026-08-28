"""Tenant-scoped consent, identity resolution and golden-profile records."""
from datetime import datetime

from core.database import Base
from sqlalchemy import Boolean, DateTime, Float, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column


class IdentityTenantMixin:
    project_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    agent_path: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    tenant_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    client_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    plan_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)


class FactoryIdentityConsent(IdentityTenantMixin, Base):
    __tablename__ = "factory_identity_consents"
    __table_args__ = (UniqueConstraint("project_id", "consent_reference", name="uq_factory_identity_project_consent_reference"),)
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    consent_number: Mapped[str] = mapped_column(String(96), nullable=False, unique=True, index=True)
    subject_reference: Mapped[str] = mapped_column(String(180), nullable=False, index=True)
    account_reference: Mapped[str] = mapped_column(String(180), nullable=False, index=True)
    consent_reference: Mapped[str] = mapped_column(String(255), nullable=False)
    lawful_basis: Mapped[str] = mapped_column(String(40), nullable=False)
    purposes_json: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    source_event_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    valid_from: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="pending", index=True)
    requested_by: Mapped[str] = mapped_column(String(128), nullable=False)
    approved_by: Mapped[str | None] = mapped_column(String(128))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_by: Mapped[str | None] = mapped_column(String(128))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class FactoryIdentitySignal(IdentityTenantMixin, Base):
    __tablename__ = "factory_identity_signals"
    __table_args__ = (UniqueConstraint("project_id", "signal_type", "identifier_hash", name="uq_factory_identity_project_signal_hash"),)
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    signal_number: Mapped[str] = mapped_column(String(96), nullable=False, unique=True, index=True)
    consent_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    consent_number: Mapped[str] = mapped_column(String(96), nullable=False)
    account_reference: Mapped[str] = mapped_column(String(180), nullable=False, index=True)
    signal_type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    identifier_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    display_hint: Mapped[str] = mapped_column(String(32), nullable=False)
    source_type: Mapped[str] = mapped_column(String(40), nullable=False)
    source_reference: Mapped[str] = mapped_column(String(255), nullable=False)
    source_revision: Mapped[int] = mapped_column(Integer, nullable=False)
    source_fingerprint: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="pending", index=True)
    captured_by: Mapped[str] = mapped_column(String(128), nullable=False)
    verified_by: Mapped[str | None] = mapped_column(String(128))
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    verification_reference: Mapped[str | None] = mapped_column(String(255))
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class FactoryIdentityMatchCase(IdentityTenantMixin, Base):
    __tablename__ = "factory_identity_match_cases"
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    case_number: Mapped[str] = mapped_column(String(96), nullable=False, unique=True, index=True)
    account_reference: Mapped[str] = mapped_column(String(180), nullable=False, index=True)
    signal_ids_json: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    signal_manifest_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    match_method: Mapped[str] = mapped_column(String(32), nullable=False)
    match_score: Mapped[float] = mapped_column(Float, nullable=False)
    reasons_json: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="proposed", index=True)
    proposed_by: Mapped[str] = mapped_column(String(128), nullable=False)
    decided_by: Mapped[str | None] = mapped_column(String(128))
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    decision_reference: Mapped[str | None] = mapped_column(String(255))
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class FactoryGoldenProfile(IdentityTenantMixin, Base):
    __tablename__ = "factory_golden_profiles"
    __table_args__ = (UniqueConstraint("project_id", "account_reference", name="uq_factory_identity_project_golden_account"),)
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    profile_number: Mapped[str] = mapped_column(String(96), nullable=False, unique=True, index=True)
    account_reference: Mapped[str] = mapped_column(String(180), nullable=False, index=True)
    match_case_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    match_case_number: Mapped[str] = mapped_column(String(96), nullable=False)
    member_signal_ids_json: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    source_manifest_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    source_manifest_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="draft", index=True)
    authored_by: Mapped[str] = mapped_column(String(128), nullable=False)
    published_by: Mapped[str | None] = mapped_column(String(128))
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class FactoryGoldenProfileVersion(IdentityTenantMixin, Base):
    __tablename__ = "factory_golden_profile_versions"
    __table_args__ = (UniqueConstraint("profile_id", "version_number", name="uq_factory_identity_profile_version"),)
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    version_number_ref: Mapped[str] = mapped_column(String(96), nullable=False, unique=True, index=True)
    profile_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    profile_number: Mapped[str] = mapped_column(String(96), nullable=False)
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    manifest_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    manifest_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="published", index=True)
    published_by: Mapped[str] = mapped_column(String(128), nullable=False)
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class FactoryIdentityPublication(IdentityTenantMixin, Base):
    __tablename__ = "factory_identity_publications"
    __table_args__ = (UniqueConstraint("version_id", "consumer_system", name="uq_factory_identity_version_consumer"),)
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    publication_number: Mapped[str] = mapped_column(String(96), nullable=False, unique=True, index=True)
    profile_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    version_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    version_number_ref: Mapped[str] = mapped_column(String(96), nullable=False)
    consumer_system: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    manifest_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    remote_reference: Mapped[str] = mapped_column(String(255), nullable=False)
    consumer_mutated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="pending", index=True)
    created_by: Mapped[str] = mapped_column(String(128), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    acknowledged_by: Mapped[str | None] = mapped_column(String(128))
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    acknowledgement_reference: Mapped[str | None] = mapped_column(String(255))
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)


class FactoryIdentityEvidence(IdentityTenantMixin, Base):
    __tablename__ = "factory_identity_evidence"
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
