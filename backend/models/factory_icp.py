"""Tenant-scoped ideal-customer-profile operating models."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, Integer, JSON, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base


class IcpTenantMixin:
    project_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    agent_path: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    tenant_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    client_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    plan_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)


class FactoryIcpProfile(IcpTenantMixin, Base):
    __tablename__ = "factory_icp_profiles"
    __table_args__ = (
        UniqueConstraint("project_id", "tenant_id", "profile_code", name="uq_factory_icp_profile_code"),
    )

    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    profile_number: Mapped[str] = mapped_column(String(96), nullable=False, unique=True, index=True)
    profile_code: Mapped[str] = mapped_column(String(64), nullable=False)
    profile_name: Mapped[str] = mapped_column(String(180), nullable=False)
    market_mode: Mapped[str] = mapped_column(String(32), nullable=False)
    customer_type: Mapped[str] = mapped_column(String(16), nullable=False)
    objective: Mapped[str] = mapped_column(Text, nullable=False)
    current_version: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="draft", index=True)
    authored_by: Mapped[str] = mapped_column(String(128), nullable=False)
    approved_by: Mapped[str | None] = mapped_column(String(128))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    approval_reference: Mapped[str | None] = mapped_column(String(255))
    retired_by: Mapped[str | None] = mapped_column(String(128))
    retired_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    retirement_reference: Mapped[str | None] = mapped_column(String(255))
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    updated_by: Mapped[str] = mapped_column(String(128), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class FactoryIcpVersion(IcpTenantMixin, Base):
    __tablename__ = "factory_icp_versions"
    __table_args__ = (
        UniqueConstraint("profile_id", "version_number", name="uq_factory_icp_profile_version"),
    )

    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    version_reference: Mapped[str] = mapped_column(String(96), nullable=False, unique=True, index=True)
    profile_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    profile_number: Mapped[str] = mapped_column(String(96), nullable=False)
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    countries_json: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    industries_json: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    company_size_bands_json: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    product_references_json: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    required_roles_json: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    buying_triggers_json: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    minimum_potential_value: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    currency: Mapped[str] = mapped_column(String(8), nullable=False, default="CNY")
    scoring_weights_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    definition_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="draft")
    created_by: Mapped[str] = mapped_column(String(128), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    activated_by: Mapped[str | None] = mapped_column(String(128))
    activated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class FactoryIcpBuyingRole(IcpTenantMixin, Base):
    __tablename__ = "factory_icp_buying_roles"
    __table_args__ = (
        UniqueConstraint("profile_id", "role_code", name="uq_factory_icp_profile_role"),
    )

    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    role_number: Mapped[str] = mapped_column(String(96), nullable=False, unique=True)
    profile_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    profile_number: Mapped[str] = mapped_column(String(96), nullable=False)
    role_code: Mapped[str] = mapped_column(String(64), nullable=False)
    role_name: Mapped[str] = mapped_column(String(128), nullable=False)
    influence_type: Mapped[str] = mapped_column(String(32), nullable=False)
    pains_json: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    proof_requirements_json: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    preferred_channels_json: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    created_by: Mapped[str] = mapped_column(String(128), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class FactoryIcpScenario(IcpTenantMixin, Base):
    __tablename__ = "factory_icp_scenarios"
    __table_args__ = (
        UniqueConstraint("profile_id", "scenario_code", name="uq_factory_icp_profile_scenario"),
    )

    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    scenario_number: Mapped[str] = mapped_column(String(96), nullable=False, unique=True)
    profile_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    profile_number: Mapped[str] = mapped_column(String(96), nullable=False)
    scenario_code: Mapped[str] = mapped_column(String(64), nullable=False)
    scenario_name: Mapped[str] = mapped_column(String(128), nullable=False)
    job_to_be_done: Mapped[str] = mapped_column(Text, nullable=False)
    buying_trigger: Mapped[str] = mapped_column(String(255), nullable=False)
    product_references_json: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    success_outcomes_json: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    disqualifiers_json: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    created_by: Mapped[str] = mapped_column(String(128), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class FactoryIcpAccountEvidence(IcpTenantMixin, Base):
    __tablename__ = "factory_icp_account_evidence"
    __table_args__ = (
        UniqueConstraint("profile_id", "source_type", "source_id", name="uq_factory_icp_profile_source"),
    )

    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    evidence_number: Mapped[str] = mapped_column(String(96), nullable=False, unique=True, index=True)
    profile_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    profile_number: Mapped[str] = mapped_column(String(96), nullable=False)
    account_reference: Mapped[str] = mapped_column(String(180), nullable=False, index=True)
    source_type: Mapped[str] = mapped_column(String(40), nullable=False)
    source_id: Mapped[str] = mapped_column(String(100), nullable=False)
    source_number: Mapped[str] = mapped_column(String(96), nullable=False)
    source_revision: Mapped[int] = mapped_column(Integer, nullable=False)
    source_status: Mapped[str] = mapped_column(String(32), nullable=False)
    source_snapshot_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    firmographic_country: Mapped[str | None] = mapped_column(String(64))
    firmographic_industry: Mapped[str | None] = mapped_column(String(128))
    firmographic_company_size: Mapped[str | None] = mapped_column(String(64))
    firmographic_evidence_reference: Mapped[str | None] = mapped_column(String(255))
    observed_roles_json: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    observed_triggers_json: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    observed_products_json: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    potential_value: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    currency: Mapped[str] = mapped_column(String(8), nullable=False, default="CNY")
    verification_status: Mapped[str] = mapped_column(String(24), nullable=False, default="pending")
    captured_by: Mapped[str] = mapped_column(String(128), nullable=False)
    captured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    verified_by: Mapped[str | None] = mapped_column(String(128))
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    verification_reference: Mapped[str | None] = mapped_column(String(255))
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)


class FactoryIcpFitAssessment(IcpTenantMixin, Base):
    __tablename__ = "factory_icp_fit_assessments"
    __table_args__ = (
        UniqueConstraint("profile_id", "account_evidence_id", name="uq_factory_icp_profile_assessment"),
    )

    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    assessment_number: Mapped[str] = mapped_column(String(96), nullable=False, unique=True, index=True)
    profile_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    profile_number: Mapped[str] = mapped_column(String(96), nullable=False)
    profile_version: Mapped[int] = mapped_column(Integer, nullable=False)
    definition_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    account_evidence_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    account_evidence_number: Mapped[str] = mapped_column(String(96), nullable=False)
    account_reference: Mapped[str] = mapped_column(String(180), nullable=False, index=True)
    score_components_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    total_score: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    fit_tier: Mapped[str] = mapped_column(String(16), nullable=False)
    explanation: Mapped[str] = mapped_column(Text, nullable=False)
    disqualified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="pending")
    assessed_by: Mapped[str] = mapped_column(String(128), nullable=False)
    assessed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    verified_by: Mapped[str | None] = mapped_column(String(128))
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    verification_reference: Mapped[str | None] = mapped_column(String(255))
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)


class FactoryIcpActivation(IcpTenantMixin, Base):
    __tablename__ = "factory_icp_activations"
    __table_args__ = (
        UniqueConstraint("profile_id", "consumer", name="uq_factory_icp_profile_consumer"),
    )

    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    activation_number: Mapped[str] = mapped_column(String(96), nullable=False, unique=True, index=True)
    profile_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    profile_number: Mapped[str] = mapped_column(String(96), nullable=False)
    profile_version: Mapped[int] = mapped_column(Integer, nullable=False)
    definition_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    consumer: Mapped[str] = mapped_column(String(64), nullable=False)
    minimum_fit_tier: Mapped[str] = mapped_column(String(16), nullable=False)
    delivery_reference: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="pending")
    created_by: Mapped[str] = mapped_column(String(128), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    acknowledged_by: Mapped[str | None] = mapped_column(String(128))
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    acknowledgement_reference: Mapped[str | None] = mapped_column(String(255))
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)


class FactoryIcpEvidence(IcpTenantMixin, Base):
    __tablename__ = "factory_icp_evidence"

    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    event_number: Mapped[str] = mapped_column(String(96), nullable=False, unique=True, index=True)
    subject_type: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    subject_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    subject_number: Mapped[str] = mapped_column(String(96), nullable=False)
    evidence_type: Mapped[str] = mapped_column(String(48), nullable=False)
    reference: Mapped[str] = mapped_column(String(255), nullable=False)
    note: Mapped[str | None] = mapped_column(Text)
    recorded_by: Mapped[str] = mapped_column(String(128), nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
