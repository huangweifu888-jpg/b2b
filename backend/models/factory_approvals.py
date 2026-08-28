"""Tenant-scoped cross-domain approval orchestration and evidence records."""

from datetime import datetime

from core.database import Base
from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text, UniqueConstraint


class ApprovalTenantMixin:
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)


class FactoryApprovalWorkflow(ApprovalTenantMixin, Base):
    __tablename__ = "factory_approval_workflows"
    __table_args__ = (
        UniqueConstraint("tenant_id", "workflow_code", name="uq_factory_approval_tenant_workflow_code"),
        {"extend_existing": True},
    )
    id = Column(String(100), primary_key=True)
    workflow_number = Column(String(100), nullable=False, unique=True, index=True)
    workflow_code = Column(String(100), nullable=False, index=True)
    workflow_name = Column(String(255), nullable=False)
    subject_type = Column(String(40), nullable=False, index=True)
    status = Column(String(30), nullable=False, default="draft", server_default="draft", index=True)
    current_version = Column(Integer, nullable=False, default=1, server_default="1")
    authored_by = Column(String(255), nullable=False, index=True)
    approved_by = Column(String(255), nullable=True, index=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    approval_reference = Column(String(500), nullable=True)
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    updated_by = Column(String(255), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)


class FactoryApprovalWorkflowVersion(ApprovalTenantMixin, Base):
    __tablename__ = "factory_approval_workflow_versions"
    __table_args__ = (
        UniqueConstraint("workflow_id", "version_number", name="uq_factory_approval_workflow_version"),
        {"extend_existing": True},
    )
    id = Column(String(100), primary_key=True)
    version_number_ref = Column(String(100), nullable=False, unique=True, index=True)
    workflow_id = Column(String(100), nullable=False, index=True)
    workflow_number = Column(String(100), nullable=False, index=True)
    version_number = Column(Integer, nullable=False)
    steps_json = Column(Text, nullable=False)
    sla_hours = Column(Integer, nullable=False)
    allow_delegation = Column(Boolean, nullable=False, default=True, server_default="1")
    require_source_revision = Column(Boolean, nullable=False, default=True, server_default="1")
    status = Column(String(30), nullable=False, default="draft", server_default="draft", index=True)
    created_by = Column(String(255), nullable=False, index=True)
    activated_by = Column(String(255), nullable=True, index=True)
    activated_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)


class FactoryApprovalRequest(ApprovalTenantMixin, Base):
    __tablename__ = "factory_approval_requests"
    __table_args__ = (
        UniqueConstraint("tenant_id", "request_reference", name="uq_factory_approval_tenant_request_reference"),
        {"extend_existing": True},
    )
    id = Column(String(100), primary_key=True)
    request_number = Column(String(100), nullable=False, unique=True, index=True)
    request_reference = Column(String(255), nullable=False, index=True)
    workflow_id = Column(String(100), nullable=False, index=True)
    workflow_number = Column(String(100), nullable=False, index=True)
    workflow_version_id = Column(String(100), nullable=False, index=True)
    workflow_version = Column(Integer, nullable=False)
    subject_type = Column(String(40), nullable=False, index=True)
    subject_id = Column(String(100), nullable=False, index=True)
    subject_number = Column(String(100), nullable=False, index=True)
    subject_revision = Column(Integer, nullable=False)
    subject_status_snapshot = Column(String(40), nullable=False)
    subject_snapshot_json = Column(Text, nullable=False)
    business_reason = Column(Text, nullable=False)
    evidence_reference = Column(String(500), nullable=False)
    status = Column(String(30), nullable=False, default="in-review", server_default="in-review", index=True)
    current_sequence = Column(Integer, nullable=False, default=1, server_default="1")
    requested_by = Column(String(255), nullable=False, index=True)
    requested_at = Column(DateTime(timezone=True), nullable=False, index=True)
    due_at = Column(DateTime(timezone=True), nullable=False, index=True)
    decided_at = Column(DateTime(timezone=True), nullable=True)
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    updated_by = Column(String(255), nullable=True, index=True)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)


class FactoryApprovalStep(ApprovalTenantMixin, Base):
    __tablename__ = "factory_approval_steps"
    __table_args__ = (
        UniqueConstraint("request_id", "sequence", name="uq_factory_approval_request_sequence"),
        {"extend_existing": True},
    )
    id = Column(String(100), primary_key=True)
    step_number = Column(String(100), nullable=False, unique=True, index=True)
    request_id = Column(String(100), nullable=False, index=True)
    request_number = Column(String(100), nullable=False, index=True)
    sequence = Column(Integer, nullable=False)
    step_name = Column(String(255), nullable=False)
    assignee_reference = Column(String(255), nullable=False, index=True)
    status = Column(String(30), nullable=False, default="pending", server_default="pending", index=True)
    due_at = Column(DateTime(timezone=True), nullable=False, index=True)
    acted_by = Column(String(255), nullable=True, index=True)
    acted_as_delegate = Column(Boolean, nullable=False, default=False, server_default="0")
    acted_at = Column(DateTime(timezone=True), nullable=True)
    revision = Column(Integer, nullable=False, default=1, server_default="1")


class FactoryApprovalAction(ApprovalTenantMixin, Base):
    __tablename__ = "factory_approval_actions"
    __table_args__ = {"extend_existing": True}
    id = Column(String(100), primary_key=True)
    action_number = Column(String(100), nullable=False, unique=True, index=True)
    request_id = Column(String(100), nullable=False, index=True)
    request_number = Column(String(100), nullable=False, index=True)
    step_id = Column(String(100), nullable=True, index=True)
    sequence = Column(Integer, nullable=True)
    action = Column(String(30), nullable=False, index=True)
    reason = Column(Text, nullable=False)
    evidence_reference = Column(String(500), nullable=False)
    actor_reference = Column(String(255), nullable=False, index=True)
    acting_for_reference = Column(String(255), nullable=True, index=True)
    channel = Column(String(20), nullable=False, index=True)
    source_revision_verified = Column(Boolean, nullable=False, default=False, server_default="0")
    created_at = Column(DateTime(timezone=True), default=datetime.now, index=True)


class FactoryApprovalDelegation(ApprovalTenantMixin, Base):
    __tablename__ = "factory_approval_delegations"
    __table_args__ = {"extend_existing": True}
    id = Column(String(100), primary_key=True)
    delegation_number = Column(String(100), nullable=False, unique=True, index=True)
    workflow_id = Column(String(100), nullable=True, index=True)
    subject_type = Column(String(40), nullable=True, index=True)
    delegator_reference = Column(String(255), nullable=False, index=True)
    delegate_reference = Column(String(255), nullable=False, index=True)
    starts_at = Column(DateTime(timezone=True), nullable=False, index=True)
    ends_at = Column(DateTime(timezone=True), nullable=False, index=True)
    reason = Column(Text, nullable=False)
    evidence_reference = Column(String(500), nullable=False)
    status = Column(String(20), nullable=False, default="active", server_default="active", index=True)
    created_by = Column(String(255), nullable=False, index=True)
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    created_at = Column(DateTime(timezone=True), default=datetime.now)


class FactoryApprovalHandoff(ApprovalTenantMixin, Base):
    __tablename__ = "factory_approval_handoffs"
    __table_args__ = (
        UniqueConstraint("request_id", name="uq_factory_approval_request_handoff"),
        {"extend_existing": True},
    )
    id = Column(String(100), primary_key=True)
    handoff_number = Column(String(100), nullable=False, unique=True, index=True)
    request_id = Column(String(100), nullable=False, index=True)
    request_number = Column(String(100), nullable=False, index=True)
    subject_type = Column(String(40), nullable=False, index=True)
    subject_id = Column(String(100), nullable=False, index=True)
    subject_number = Column(String(100), nullable=False, index=True)
    subject_revision = Column(Integer, nullable=False)
    status = Column(String(30), nullable=False, default="ready", server_default="ready", index=True)
    created_by = Column(String(255), nullable=False, index=True)
    acknowledged_by = Column(String(255), nullable=True, index=True)
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)
    acknowledgement_reference = Column(String(500), nullable=True)
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    created_at = Column(DateTime(timezone=True), default=datetime.now)


class FactoryApprovalEvidence(ApprovalTenantMixin, Base):
    __tablename__ = "factory_approval_evidence"
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
