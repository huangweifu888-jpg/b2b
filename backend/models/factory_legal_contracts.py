"""Tenant-scoped legal party, contract, seal, signature and obligation records."""

from datetime import datetime

from core.database import Base
from sqlalchemy import Boolean, Column, Date, DateTime, Integer, Numeric, String, Text, UniqueConstraint


class LegalTenantMixin:
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)


class FactoryLegalParty(LegalTenantMixin, Base):
    __tablename__ = "factory_legal_parties"
    __table_args__ = (
        UniqueConstraint("tenant_id", "party_reference", name="uq_factory_legal_tenant_party_reference"),
        UniqueConstraint("tenant_id", "identity_fingerprint", name="uq_factory_legal_tenant_identity_fingerprint"),
        {"extend_existing": True},
    )
    id = Column(String(100), primary_key=True)
    party_number = Column(String(100), nullable=False, unique=True, index=True)
    party_reference = Column(String(255), nullable=False, index=True)
    party_type = Column(String(30), nullable=False, index=True)
    legal_name = Column(String(500), nullable=False, index=True)
    country_code = Column(String(2), nullable=False, index=True)
    identity_fingerprint = Column(String(64), nullable=False, index=True)
    registration_reference = Column(String(500), nullable=False)
    tax_profile_reference = Column(String(500), nullable=False)
    registered_address_reference = Column(String(500), nullable=False)
    source_type = Column(String(30), nullable=False, index=True)
    source_id = Column(String(100), nullable=True, index=True)
    source_number = Column(String(100), nullable=True, index=True)
    source_revision = Column(Integer, nullable=True)
    kyb_evidence_reference = Column(String(500), nullable=False)
    sanctions_screening_reference = Column(String(500), nullable=False)
    status = Column(String(30), nullable=False, default="draft", server_default="draft", index=True)
    authored_by = Column(String(255), nullable=False, index=True)
    approved_by = Column(String(255), nullable=True, index=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    approval_reference = Column(String(500), nullable=True)
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    updated_by = Column(String(255), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)


class FactoryLegalTemplate(LegalTenantMixin, Base):
    __tablename__ = "factory_legal_templates"
    __table_args__ = (
        UniqueConstraint("tenant_id", "template_code", name="uq_factory_legal_tenant_template_code"),
        {"extend_existing": True},
    )
    id = Column(String(100), primary_key=True)
    template_number = Column(String(100), nullable=False, unique=True, index=True)
    template_code = Column(String(100), nullable=False, index=True)
    template_name = Column(String(255), nullable=False)
    contract_type = Column(String(40), nullable=False, index=True)
    current_version = Column(Integer, nullable=False, default=1, server_default="1")
    status = Column(String(30), nullable=False, default="draft", server_default="draft", index=True)
    authored_by = Column(String(255), nullable=False, index=True)
    approved_by = Column(String(255), nullable=True, index=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    approval_reference = Column(String(500), nullable=True)
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    updated_by = Column(String(255), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)


class FactoryLegalTemplateVersion(LegalTenantMixin, Base):
    __tablename__ = "factory_legal_template_versions"
    __table_args__ = (
        UniqueConstraint("template_id", "version_number", name="uq_factory_legal_template_version"),
        {"extend_existing": True},
    )
    id = Column(String(100), primary_key=True)
    version_reference = Column(String(100), nullable=False, unique=True, index=True)
    template_id = Column(String(100), nullable=False, index=True)
    template_number = Column(String(100), nullable=False, index=True)
    version_number = Column(Integer, nullable=False)
    language_code = Column(String(10), nullable=False, index=True)
    governing_law = Column(String(100), nullable=False, index=True)
    dispute_resolution = Column(String(255), nullable=False)
    clauses_json = Column(Text, nullable=False)
    document_reference = Column(String(500), nullable=False)
    content_hash = Column(String(64), nullable=False, index=True)
    status = Column(String(30), nullable=False, default="draft", server_default="draft", index=True)
    created_by = Column(String(255), nullable=False, index=True)
    activated_by = Column(String(255), nullable=True, index=True)
    activated_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)


class FactoryBusinessContract(LegalTenantMixin, Base):
    __tablename__ = "factory_business_contracts"
    __table_args__ = (
        UniqueConstraint("tenant_id", "contract_reference", name="uq_factory_legal_tenant_contract_reference"),
        UniqueConstraint("project_id", "source_type", "source_id", name="uq_factory_legal_project_source_contract"),
        {"extend_existing": True},
    )
    id = Column(String(100), primary_key=True)
    contract_number = Column(String(100), nullable=False, unique=True, index=True)
    contract_reference = Column(String(255), nullable=False, index=True)
    contract_type = Column(String(40), nullable=False, index=True)
    party_id = Column(String(100), nullable=False, index=True)
    party_number = Column(String(100), nullable=False, index=True)
    party_revision = Column(Integer, nullable=False)
    template_id = Column(String(100), nullable=False, index=True)
    template_number = Column(String(100), nullable=False, index=True)
    template_version_id = Column(String(100), nullable=False, index=True)
    template_version = Column(Integer, nullable=False)
    template_content_hash = Column(String(64), nullable=False)
    source_type = Column(String(30), nullable=False, index=True)
    source_id = Column(String(100), nullable=False, index=True)
    source_number = Column(String(100), nullable=False, index=True)
    source_revision = Column(Integer, nullable=False)
    source_snapshot_json = Column(Text, nullable=False)
    approval_handoff_id = Column(String(100), nullable=False, index=True)
    approval_handoff_number = Column(String(100), nullable=False, index=True)
    currency = Column(String(3), nullable=False, index=True)
    contract_value = Column(Numeric(18, 2), nullable=False)
    effective_date = Column(Date, nullable=False, index=True)
    expiry_date = Column(Date, nullable=False, index=True)
    auto_renew = Column(Boolean, nullable=False, default=False, server_default="0")
    notice_days = Column(Integer, nullable=False)
    draft_document_reference = Column(String(500), nullable=False)
    status = Column(String(30), nullable=False, default="draft", server_default="draft", index=True)
    authored_by = Column(String(255), nullable=False, index=True)
    submitted_by = Column(String(255), nullable=True, index=True)
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    legal_review_id = Column(String(100), nullable=True, index=True)
    approved_by = Column(String(255), nullable=True, index=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    activated_at = Column(DateTime(timezone=True), nullable=True)
    terminated_by = Column(String(255), nullable=True, index=True)
    terminated_at = Column(DateTime(timezone=True), nullable=True)
    termination_reason = Column(Text, nullable=True)
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    updated_by = Column(String(255), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)


class FactoryLegalReview(LegalTenantMixin, Base):
    __tablename__ = "factory_legal_reviews"
    __table_args__ = (UniqueConstraint("contract_id", name="uq_factory_legal_contract_review"), {"extend_existing": True})
    id = Column(String(100), primary_key=True)
    review_number = Column(String(100), nullable=False, unique=True, index=True)
    contract_id = Column(String(100), nullable=False, index=True)
    contract_number = Column(String(100), nullable=False, index=True)
    risk_level = Column(String(20), nullable=False, index=True)
    deviations_json = Column(Text, nullable=False)
    recommendation = Column(String(20), nullable=False, index=True)
    legal_comment = Column(Text, nullable=False)
    review_evidence_reference = Column(String(500), nullable=False)
    reviewed_by = Column(String(255), nullable=False, index=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.now)


class FactorySealAuthorization(LegalTenantMixin, Base):
    __tablename__ = "factory_seal_authorizations"
    __table_args__ = (UniqueConstraint("contract_id", name="uq_factory_legal_contract_seal"), {"extend_existing": True})
    id = Column(String(100), primary_key=True)
    seal_number = Column(String(100), nullable=False, unique=True, index=True)
    contract_id = Column(String(100), nullable=False, index=True)
    contract_number = Column(String(100), nullable=False, index=True)
    seal_type = Column(String(30), nullable=False, index=True)
    document_hash = Column(String(64), nullable=False, index=True)
    purpose = Column(Text, nullable=False)
    status = Column(String(30), nullable=False, default="pending-approval", server_default="pending-approval", index=True)
    requested_by = Column(String(255), nullable=False, index=True)
    approved_by = Column(String(255), nullable=True, index=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    approval_reference = Column(String(500), nullable=True)
    used_by = Column(String(255), nullable=True, index=True)
    used_at = Column(DateTime(timezone=True), nullable=True)
    use_evidence_reference = Column(String(500), nullable=True)
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    created_at = Column(DateTime(timezone=True), default=datetime.now)


class FactorySignatureEnvelope(LegalTenantMixin, Base):
    __tablename__ = "factory_signature_envelopes"
    __table_args__ = (UniqueConstraint("contract_id", name="uq_factory_legal_contract_signature"), {"extend_existing": True})
    id = Column(String(100), primary_key=True)
    envelope_number = Column(String(100), nullable=False, unique=True, index=True)
    contract_id = Column(String(100), nullable=False, index=True)
    contract_number = Column(String(100), nullable=False, index=True)
    seal_authorization_id = Column(String(100), nullable=False, index=True)
    provider_reference = Column(String(255), nullable=False, index=True)
    provider_envelope_reference = Column(String(255), nullable=False, unique=True, index=True)
    signers_json = Column(Text, nullable=False)
    signatures_json = Column(Text, nullable=False, default="[]", server_default="[]")
    signed_document_reference = Column(String(500), nullable=False)
    status = Column(String(30), nullable=False, default="draft", server_default="draft", index=True)
    created_by = Column(String(255), nullable=False, index=True)
    sent_by = Column(String(255), nullable=True, index=True)
    sent_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    created_at = Column(DateTime(timezone=True), default=datetime.now)


class FactoryContractObligation(LegalTenantMixin, Base):
    __tablename__ = "factory_contract_obligations"
    __table_args__ = (
        UniqueConstraint("contract_id", "obligation_reference", name="uq_factory_legal_contract_obligation_reference"),
        {"extend_existing": True},
    )
    id = Column(String(100), primary_key=True)
    obligation_number = Column(String(100), nullable=False, unique=True, index=True)
    obligation_reference = Column(String(255), nullable=False, index=True)
    contract_id = Column(String(100), nullable=False, index=True)
    contract_number = Column(String(100), nullable=False, index=True)
    obligation_type = Column(String(30), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    owner_reference = Column(String(255), nullable=False, index=True)
    due_date = Column(Date, nullable=False, index=True)
    status = Column(String(30), nullable=False, default="open", server_default="open", index=True)
    created_by = Column(String(255), nullable=False, index=True)
    completed_by = Column(String(255), nullable=True, index=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    completion_evidence_reference = Column(String(500), nullable=True)
    waived_by = Column(String(255), nullable=True, index=True)
    waived_at = Column(DateTime(timezone=True), nullable=True)
    waiver_reference = Column(String(500), nullable=True)
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    created_at = Column(DateTime(timezone=True), default=datetime.now)


class FactoryLegalEvidence(LegalTenantMixin, Base):
    __tablename__ = "factory_legal_evidence"
    __table_args__ = {"extend_existing": True}
    id = Column(String(100), primary_key=True)
    evidence_number = Column(String(100), nullable=False, unique=True, index=True)
    subject_type = Column(String(40), nullable=False, index=True)
    subject_id = Column(String(100), nullable=False, index=True)
    subject_number = Column(String(100), nullable=False, index=True)
    evidence_type = Column(String(50), nullable=False, index=True)
    evidence_reference = Column(String(500), nullable=False)
    note = Column(Text, nullable=False)
    recorded_by = Column(String(255), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
