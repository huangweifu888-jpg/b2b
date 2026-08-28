"""Tenant-scoped recruiting, structured interview, offer and HR handoff records."""

from datetime import datetime

from core.database import Base
from sqlalchemy import Boolean, Column, Date, DateTime, Integer, Numeric, String, Text, UniqueConstraint


class RecruitingTenantMixin:
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)


class FactoryRecruitingRequisition(RecruitingTenantMixin, Base):
    __tablename__ = "factory_recruiting_requisitions"
    __table_args__ = (UniqueConstraint("tenant_id", "requisition_reference", name="uq_factory_recruiting_tenant_requisition_reference"), {"extend_existing": True})
    id = Column(String(100), primary_key=True)
    requisition_number = Column(String(100), nullable=False, unique=True, index=True)
    requisition_reference = Column(String(255), nullable=False, index=True)
    position_id = Column(String(100), nullable=False, index=True)
    position_number = Column(String(100), nullable=False, index=True)
    opening_count = Column(Integer, nullable=False)
    employment_type = Column(String(30), nullable=False, index=True)
    work_location = Column(String(255), nullable=False)
    target_start_date = Column(Date, nullable=False, index=True)
    hiring_reason = Column(Text, nullable=False)
    rubric_version = Column(String(40), nullable=False)
    rubric_json = Column(Text, nullable=False)
    status = Column(String(30), nullable=False, default="draft", server_default="draft", index=True)
    authored_by = Column(String(255), nullable=False, index=True)
    approval_reference = Column(String(500), nullable=True)
    approved_by = Column(String(255), nullable=True, index=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    closed_by = Column(String(255), nullable=True, index=True)
    closed_at = Column(DateTime(timezone=True), nullable=True)
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    updated_by = Column(String(255), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)


class FactoryRecruitingCandidate(RecruitingTenantMixin, Base):
    __tablename__ = "factory_recruiting_candidates"
    __table_args__ = (
        UniqueConstraint("tenant_id", "candidate_reference", name="uq_factory_recruiting_tenant_candidate_reference"),
        UniqueConstraint("tenant_id", "email", name="uq_factory_recruiting_tenant_candidate_email"),
        {"extend_existing": True},
    )
    id = Column(String(100), primary_key=True)
    candidate_number = Column(String(100), nullable=False, unique=True, index=True)
    candidate_reference = Column(String(255), nullable=False, index=True)
    display_name = Column(String(255), nullable=False)
    email = Column(String(320), nullable=False, index=True)
    country_code = Column(String(2), nullable=False, index=True)
    source_type = Column(String(30), nullable=False, index=True)
    source_reference = Column(String(500), nullable=False)
    consent_reference = Column(String(500), nullable=False)
    privacy_notice_reference = Column(String(500), nullable=False)
    retention_until = Column(Date, nullable=False, index=True)
    profile_reference = Column(String(500), nullable=False)
    status = Column(String(30), nullable=False, default="active", server_default="active", index=True)
    created_by = Column(String(255), nullable=False, index=True)
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    updated_by = Column(String(255), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)


class FactoryRecruitingApplication(RecruitingTenantMixin, Base):
    __tablename__ = "factory_recruiting_applications"
    __table_args__ = (UniqueConstraint("requisition_id", "candidate_id", name="uq_factory_recruiting_requisition_candidate"), {"extend_existing": True})
    id = Column(String(100), primary_key=True)
    application_number = Column(String(100), nullable=False, unique=True, index=True)
    requisition_id = Column(String(100), nullable=False, index=True)
    requisition_number = Column(String(100), nullable=False, index=True)
    candidate_id = Column(String(100), nullable=False, index=True)
    candidate_number = Column(String(100), nullable=False, index=True)
    application_reference = Column(String(255), nullable=False, index=True)
    submitted_evidence_reference = Column(String(500), nullable=False)
    current_stage = Column(String(30), nullable=False, default="applied", server_default="applied", index=True)
    status = Column(String(30), nullable=False, default="active", server_default="active", index=True)
    submitted_by = Column(String(255), nullable=False, index=True)
    final_decision = Column(String(30), nullable=True, index=True)
    decision_reason = Column(Text, nullable=True)
    decided_by = Column(String(255), nullable=True, index=True)
    decided_at = Column(DateTime(timezone=True), nullable=True)
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    updated_by = Column(String(255), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)


class FactoryRecruitingInterview(RecruitingTenantMixin, Base):
    __tablename__ = "factory_recruiting_interviews"
    __table_args__ = {"extend_existing": True}
    id = Column(String(100), primary_key=True)
    interview_number = Column(String(100), nullable=False, unique=True, index=True)
    application_id = Column(String(100), nullable=False, index=True)
    application_number = Column(String(100), nullable=False, index=True)
    interview_type = Column(String(30), nullable=False, index=True)
    scheduled_at = Column(DateTime(timezone=True), nullable=False, index=True)
    interviewer_reference = Column(String(500), nullable=False)
    rubric_version = Column(String(40), nullable=False)
    status = Column(String(30), nullable=False, default="scheduled", server_default="scheduled", index=True)
    scheduled_by = Column(String(255), nullable=False, index=True)
    completed_by = Column(String(255), nullable=True, index=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    updated_by = Column(String(255), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)


class FactoryRecruitingAssessment(RecruitingTenantMixin, Base):
    __tablename__ = "factory_recruiting_assessments"
    __table_args__ = (UniqueConstraint("interview_id", name="uq_factory_recruiting_interview_assessment"), {"extend_existing": True})
    id = Column(String(100), primary_key=True)
    assessment_number = Column(String(100), nullable=False, unique=True, index=True)
    interview_id = Column(String(100), nullable=False, index=True)
    interview_number = Column(String(100), nullable=False, index=True)
    application_id = Column(String(100), nullable=False, index=True)
    skills_score = Column(Numeric(5, 2), nullable=False)
    evidence_score = Column(Numeric(5, 2), nullable=False)
    communication_score = Column(Numeric(5, 2), nullable=False)
    integrity_score = Column(Numeric(5, 2), nullable=False)
    overall_score = Column(Numeric(5, 2), nullable=False)
    transcript_reference = Column(String(500), nullable=False)
    citation_references_json = Column(Text, nullable=False)
    assessor_comment = Column(Text, nullable=False)
    ai_assisted = Column(Boolean, nullable=False, default=False, server_default="0", index=True)
    ai_model_reference = Column(String(500), nullable=True)
    ai_autonomous_decision = Column(Boolean, nullable=False, default=False, server_default="0")
    assessed_by = Column(String(255), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)


class FactoryRecruitingOffer(RecruitingTenantMixin, Base):
    __tablename__ = "factory_recruiting_offers"
    __table_args__ = (UniqueConstraint("application_id", name="uq_factory_recruiting_application_offer"), {"extend_existing": True})
    id = Column(String(100), primary_key=True)
    offer_number = Column(String(100), nullable=False, unique=True, index=True)
    application_id = Column(String(100), nullable=False, index=True)
    application_number = Column(String(100), nullable=False, index=True)
    position_id = Column(String(100), nullable=False, index=True)
    candidate_id = Column(String(100), nullable=False, index=True)
    offer_reference = Column(String(255), nullable=False, index=True)
    proposed_start_date = Column(Date, nullable=False, index=True)
    compensation_band = Column(String(100), nullable=False, index=True)
    offer_document_reference = Column(String(500), nullable=False)
    status = Column(String(30), nullable=False, default="draft", server_default="draft", index=True)
    authored_by = Column(String(255), nullable=False, index=True)
    approval_reference = Column(String(500), nullable=True)
    approved_by = Column(String(255), nullable=True, index=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    sent_by = Column(String(255), nullable=True, index=True)
    sent_at = Column(DateTime(timezone=True), nullable=True)
    candidate_response_reference = Column(String(500), nullable=True)
    responded_by = Column(String(255), nullable=True, index=True)
    responded_at = Column(DateTime(timezone=True), nullable=True)
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    updated_by = Column(String(255), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)


class FactoryRecruitingOnboardingHandoff(RecruitingTenantMixin, Base):
    __tablename__ = "factory_recruiting_onboarding_handoffs"
    __table_args__ = (UniqueConstraint("offer_id", name="uq_factory_recruiting_offer_handoff"), {"extend_existing": True})
    id = Column(String(100), primary_key=True)
    handoff_number = Column(String(100), nullable=False, unique=True, index=True)
    offer_id = Column(String(100), nullable=False, index=True)
    offer_number = Column(String(100), nullable=False, index=True)
    candidate_id = Column(String(100), nullable=False, index=True)
    candidate_number = Column(String(100), nullable=False, index=True)
    position_id = Column(String(100), nullable=False, index=True)
    position_number = Column(String(100), nullable=False, index=True)
    source_reference = Column(String(500), nullable=False)
    status = Column(String(30), nullable=False, default="ready", server_default="ready", index=True)
    created_by = Column(String(255), nullable=False, index=True)
    consumed_employee_id = Column(String(100), nullable=True, index=True)
    consumed_by = Column(String(255), nullable=True, index=True)
    consumed_at = Column(DateTime(timezone=True), nullable=True)
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    created_at = Column(DateTime(timezone=True), default=datetime.now)


class FactoryRecruitingEvidence(RecruitingTenantMixin, Base):
    __tablename__ = "factory_recruiting_evidence"
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
