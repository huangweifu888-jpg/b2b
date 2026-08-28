"""Tenant-scoped partner, academy, voice-of-customer and advocacy records."""

from datetime import datetime

from core.database import Base
from sqlalchemy import Column, DateTime, Integer, Numeric, String, Text, UniqueConstraint


class FactoryPartnerAccount(Base):
    __tablename__ = "factory_partner_accounts"
    __table_args__ = (
        UniqueConstraint("tenant_id", "external_reference", name="uq_factory_partner_tenant_external"),
        {"extend_existing": True},
    )

    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    partner_number = Column(String(100), nullable=False, unique=True, index=True)
    external_reference = Column(String(255), nullable=False, index=True)
    legal_name = Column(String(500), nullable=False, index=True)
    partner_type = Column(String(40), nullable=False, index=True)
    country_code = Column(String(2), nullable=False, index=True)
    territory = Column(String(500), nullable=False)
    product_scope_json = Column(Text, nullable=False, default="[]", server_default="[]")
    account_reference = Column(String(255), nullable=True, index=True)
    primary_contact_reference = Column(String(500), nullable=False)
    relationship_evidence_reference = Column(String(500), nullable=False)
    agreement_reference = Column(String(500), nullable=True)
    status = Column(String(30), nullable=False, default="draft", server_default="draft", index=True)
    activated_by = Column(String(255), nullable=True, index=True)
    activated_at = Column(DateTime(timezone=True), nullable=True)
    suspension_reason = Column(Text, nullable=True)
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    updated_by = Column(String(255), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)


class FactoryPartnerAcademyEnrollment(Base):
    __tablename__ = "factory_partner_academy_enrollments"
    __table_args__ = (
        UniqueConstraint("tenant_id", "enrollment_reference", name="uq_factory_academy_tenant_reference"),
        UniqueConstraint("tenant_id", "partner_id", "course_code", "course_version", name="uq_factory_academy_partner_course"),
        {"extend_existing": True},
    )

    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    enrollment_number = Column(String(100), nullable=False, unique=True, index=True)
    enrollment_reference = Column(String(255), nullable=False, index=True)
    partner_id = Column(String(100), nullable=False, index=True)
    partner_number = Column(String(100), nullable=False, index=True)
    learner_reference = Column(String(500), nullable=False)
    course_code = Column(String(100), nullable=False, index=True)
    course_title = Column(String(500), nullable=False)
    course_version = Column(String(100), nullable=False, index=True)
    passing_score = Column(Integer, nullable=False, default=80, server_default="80")
    planned_completion_at = Column(DateTime(timezone=True), nullable=False, index=True)
    status = Column(String(30), nullable=False, default="enrolled", server_default="enrolled", index=True)
    assessment_score = Column(Numeric(7, 2), nullable=True)
    completion_evidence_reference = Column(String(500), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    certification_reference = Column(String(500), nullable=True)
    certification_expires_at = Column(DateTime(timezone=True), nullable=True, index=True)
    certified_by = Column(String(255), nullable=True, index=True)
    certified_at = Column(DateTime(timezone=True), nullable=True)
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    updated_by = Column(String(255), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)


class FactoryVoiceOfCustomerCase(Base):
    __tablename__ = "factory_voice_of_customer_cases"
    __table_args__ = (
        UniqueConstraint("tenant_id", "feedback_reference", name="uq_factory_voc_tenant_feedback"),
        {"extend_existing": True},
    )

    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    voice_number = Column(String(100), nullable=False, unique=True, index=True)
    feedback_reference = Column(String(255), nullable=False, index=True)
    source_type = Column(String(30), nullable=False, index=True)
    partner_id = Column(String(100), nullable=True, index=True)
    partner_number = Column(String(100), nullable=True, index=True)
    account_reference = Column(String(255), nullable=False, index=True)
    related_order_id = Column(String(100), nullable=True, index=True)
    related_order_number = Column(String(100), nullable=True, index=True)
    related_asset_id = Column(String(100), nullable=True, index=True)
    related_asset_number = Column(String(100), nullable=True, index=True)
    category = Column(String(50), nullable=False, index=True)
    severity = Column(String(20), nullable=False, index=True)
    score = Column(Integer, nullable=True)
    sentiment = Column(String(20), nullable=False, index=True)
    summary = Column(Text, nullable=False)
    lifecycle_status = Column(String(40), nullable=False, default="received", server_default="received", index=True)
    triage_reference = Column(String(500), nullable=True)
    owner = Column(String(255), nullable=True, index=True)
    due_at = Column(DateTime(timezone=True), nullable=True, index=True)
    root_cause = Column(Text, nullable=True)
    action_plan = Column(Text, nullable=True)
    action_reference = Column(String(500), nullable=True)
    resolution_reference = Column(String(500), nullable=True)
    resolution_note = Column(Text, nullable=True)
    escalation_reference = Column(String(500), nullable=True)
    resolved_by = Column(String(255), nullable=True, index=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    customer_confirmation_reference = Column(String(500), nullable=True)
    customer_confirmed_at = Column(DateTime(timezone=True), nullable=True)
    closed_by = Column(String(255), nullable=True, index=True)
    closed_at = Column(DateTime(timezone=True), nullable=True)
    advocacy_status = Column(String(30), nullable=False, default="not-eligible", server_default="not-eligible", index=True)
    advocacy_invitation_reference = Column(String(500), nullable=True)
    advocacy_consent_reference = Column(String(500), nullable=True)
    advocacy_consent_scope = Column(Text, nullable=True)
    advocacy_consent_expires_at = Column(DateTime(timezone=True), nullable=True)
    case_study_reference = Column(String(500), nullable=True)
    publication_channel = Column(String(255), nullable=True)
    published_by = Column(String(255), nullable=True, index=True)
    published_at = Column(DateTime(timezone=True), nullable=True)
    milestones_json = Column(Text, nullable=False, default="[]", server_default="[]")
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    updated_by = Column(String(255), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)


class FactoryPartnerVoiceEvidence(Base):
    __tablename__ = "factory_partner_voice_evidence"
    __table_args__ = {"extend_existing": True}

    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    evidence_number = Column(String(100), nullable=False, unique=True, index=True)
    subject_type = Column(String(40), nullable=False, index=True)
    subject_id = Column(String(100), nullable=False, index=True)
    subject_number = Column(String(100), nullable=False, index=True)
    evidence_type = Column(String(50), nullable=False, index=True)
    evidence_reference = Column(String(500), nullable=False)
    note = Column(Text, nullable=False)
    recorded_by = Column(String(255), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
