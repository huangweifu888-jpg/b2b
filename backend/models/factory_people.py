"""Tenant-scoped HR organization, employment, time, performance and training records."""

from datetime import datetime

from core.database import Base
from sqlalchemy import Boolean, Column, Date, DateTime, Integer, Numeric, String, Text, UniqueConstraint


class FactoryPeopleOrgUnit(Base):
    __tablename__ = "factory_people_org_units"
    __table_args__ = (
        UniqueConstraint("tenant_id", "unit_code", name="uq_factory_people_tenant_unit_code"),
        UniqueConstraint("tenant_id", "unit_reference", name="uq_factory_people_tenant_unit_reference"),
        {"extend_existing": True},
    )
    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    unit_number = Column(String(100), nullable=False, unique=True, index=True)
    unit_reference = Column(String(255), nullable=False, index=True)
    unit_code = Column(String(100), nullable=False, index=True)
    unit_name = Column(String(255), nullable=False)
    unit_type = Column(String(30), nullable=False, index=True)
    parent_unit_id = Column(String(100), nullable=True, index=True)
    erp_operating_unit_id = Column(String(100), nullable=True, index=True)
    manager_employee_id = Column(String(100), nullable=True, index=True)
    country_code = Column(String(2), nullable=False, index=True)
    timezone_name = Column(String(100), nullable=False)
    status = Column(String(30), nullable=False, default="draft", server_default="draft", index=True)
    authored_by = Column(String(255), nullable=False, index=True)
    approval_reference = Column(String(500), nullable=True)
    approved_by = Column(String(255), nullable=True, index=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    updated_by = Column(String(255), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)


class FactoryPeoplePosition(Base):
    __tablename__ = "factory_people_positions"
    __table_args__ = (
        UniqueConstraint("tenant_id", "position_code", name="uq_factory_people_tenant_position_code"),
        {"extend_existing": True},
    )
    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    position_number = Column(String(100), nullable=False, unique=True, index=True)
    position_reference = Column(String(255), nullable=False, index=True)
    position_code = Column(String(100), nullable=False, index=True)
    position_title = Column(String(255), nullable=False)
    org_unit_id = Column(String(100), nullable=False, index=True)
    org_unit_number = Column(String(100), nullable=False, index=True)
    job_family = Column(String(100), nullable=False, index=True)
    employment_level = Column(String(40), nullable=False, index=True)
    planned_headcount = Column(Integer, nullable=False)
    weekly_capacity_hours = Column(Numeric(10, 2), nullable=False)
    critical_role = Column(Boolean, nullable=False, default=False, server_default="0", index=True)
    status = Column(String(20), nullable=False, default="active", server_default="active", index=True)
    created_by = Column(String(255), nullable=False, index=True)
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    updated_by = Column(String(255), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)


class FactoryPeopleEmployee(Base):
    __tablename__ = "factory_people_employees"
    __table_args__ = (
        UniqueConstraint("tenant_id", "employee_reference", name="uq_factory_people_tenant_employee_reference"),
        UniqueConstraint("tenant_id", "work_email", name="uq_factory_people_tenant_work_email"),
        {"extend_existing": True},
    )
    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    employee_number = Column(String(100), nullable=False, unique=True, index=True)
    employee_reference = Column(String(255), nullable=False, index=True)
    preferred_name = Column(String(255), nullable=False)
    work_email = Column(String(320), nullable=False, index=True)
    country_code = Column(String(2), nullable=False, index=True)
    source_type = Column(String(30), nullable=False, index=True)
    source_reference = Column(String(500), nullable=False)
    privacy_notice_reference = Column(String(500), nullable=False)
    status = Column(String(30), nullable=False, default="draft", server_default="draft", index=True)
    authored_by = Column(String(255), nullable=False, index=True)
    activation_reference = Column(String(500), nullable=True)
    activated_by = Column(String(255), nullable=True, index=True)
    activated_at = Column(DateTime(timezone=True), nullable=True)
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    updated_by = Column(String(255), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)


class FactoryPeopleContract(Base):
    __tablename__ = "factory_people_contracts"
    __table_args__ = (
        UniqueConstraint("tenant_id", "contract_reference", name="uq_factory_people_tenant_contract_reference"),
        {"extend_existing": True},
    )
    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    contract_number = Column(String(100), nullable=False, unique=True, index=True)
    contract_reference = Column(String(255), nullable=False, index=True)
    employee_id = Column(String(100), nullable=False, index=True)
    employee_number = Column(String(100), nullable=False, index=True)
    position_id = Column(String(100), nullable=False, index=True)
    position_number = Column(String(100), nullable=False, index=True)
    employment_type = Column(String(30), nullable=False, index=True)
    work_location = Column(String(255), nullable=False)
    start_date = Column(Date, nullable=False, index=True)
    end_date = Column(Date, nullable=True, index=True)
    weekly_hours = Column(Numeric(10, 2), nullable=False)
    compensation_band = Column(String(100), nullable=False, index=True)
    payroll_reference = Column(String(500), nullable=False)
    signed_document_reference = Column(String(500), nullable=False)
    status = Column(String(30), nullable=False, default="draft", server_default="draft", index=True)
    authored_by = Column(String(255), nullable=False, index=True)
    submitted_by = Column(String(255), nullable=True, index=True)
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    approval_reference = Column(String(500), nullable=True)
    approved_by = Column(String(255), nullable=True, index=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    updated_by = Column(String(255), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)


class FactoryPeopleTimeRecord(Base):
    __tablename__ = "factory_people_time_records"
    __table_args__ = (
        UniqueConstraint("employee_id", "period_code", name="uq_factory_people_employee_time_period"),
        {"extend_existing": True},
    )
    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    time_number = Column(String(100), nullable=False, unique=True, index=True)
    employee_id = Column(String(100), nullable=False, index=True)
    employee_number = Column(String(100), nullable=False, index=True)
    period_code = Column(String(7), nullable=False, index=True)
    scheduled_hours = Column(Numeric(10, 2), nullable=False)
    worked_hours = Column(Numeric(10, 2), nullable=False)
    approved_absence_hours = Column(Numeric(10, 2), nullable=False, default=0, server_default="0")
    overtime_hours = Column(Numeric(10, 2), nullable=False, default=0, server_default="0")
    source_reference = Column(String(500), nullable=False)
    status = Column(String(30), nullable=False, default="draft", server_default="draft", index=True)
    authored_by = Column(String(255), nullable=False, index=True)
    submitted_by = Column(String(255), nullable=True, index=True)
    approved_by = Column(String(255), nullable=True, index=True)
    approval_reference = Column(String(500), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    updated_by = Column(String(255), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)


class FactoryPeoplePerformanceReview(Base):
    __tablename__ = "factory_people_performance_reviews"
    __table_args__ = (
        UniqueConstraint("employee_id", "cycle_code", name="uq_factory_people_employee_review_cycle"),
        {"extend_existing": True},
    )
    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    review_number = Column(String(100), nullable=False, unique=True, index=True)
    employee_id = Column(String(100), nullable=False, index=True)
    employee_number = Column(String(100), nullable=False, index=True)
    position_id = Column(String(100), nullable=False, index=True)
    position_number = Column(String(100), nullable=False, index=True)
    cycle_code = Column(String(40), nullable=False, index=True)
    goals_score = Column(Numeric(5, 2), nullable=False)
    competency_score = Column(Numeric(5, 2), nullable=False)
    overall_score = Column(Numeric(5, 2), nullable=False)
    evidence_reference = Column(String(500), nullable=False)
    manager_comment = Column(Text, nullable=False)
    status = Column(String(30), nullable=False, default="draft", server_default="draft", index=True)
    authored_by = Column(String(255), nullable=False, index=True)
    calibration_reference = Column(String(500), nullable=True)
    calibrated_by = Column(String(255), nullable=True, index=True)
    calibrated_at = Column(DateTime(timezone=True), nullable=True)
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    updated_by = Column(String(255), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)


class FactoryPeopleTrainingRecord(Base):
    __tablename__ = "factory_people_training_records"
    __table_args__ = (
        UniqueConstraint("employee_id", "course_code", "assigned_at", name="uq_factory_people_employee_course_assignment"),
        {"extend_existing": True},
    )
    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    training_number = Column(String(100), nullable=False, unique=True, index=True)
    employee_id = Column(String(100), nullable=False, index=True)
    employee_number = Column(String(100), nullable=False, index=True)
    course_code = Column(String(100), nullable=False, index=True)
    course_title = Column(String(255), nullable=False)
    mandatory = Column(Boolean, nullable=False, default=False, server_default="0", index=True)
    assigned_at = Column(DateTime(timezone=True), nullable=False, index=True)
    due_date = Column(Date, nullable=False, index=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    completion_evidence_reference = Column(String(500), nullable=True)
    expires_at = Column(Date, nullable=True, index=True)
    status = Column(String(30), nullable=False, default="assigned", server_default="assigned", index=True)
    assigned_by = Column(String(255), nullable=False, index=True)
    completed_by = Column(String(255), nullable=True, index=True)
    verified_by = Column(String(255), nullable=True, index=True)
    verification_reference = Column(String(500), nullable=True)
    verified_at = Column(DateTime(timezone=True), nullable=True)
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    updated_by = Column(String(255), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)


class FactoryPeopleEvidence(Base):
    __tablename__ = "factory_people_evidence"
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
