"""Tenant-scoped operating-health snapshots, alerts and responsibility tasks."""

from datetime import datetime

from core.database import Base
from sqlalchemy import Column, DateTime, Integer, Numeric, String, Text, UniqueConstraint


class FactoryHealthCockpitSnapshot(Base):
    __tablename__ = "factory_health_cockpit_snapshots"
    __table_args__ = (
        UniqueConstraint("tenant_id", "snapshot_reference", name="uq_factory_health_tenant_snapshot_reference"),
        {"extend_existing": True},
    )

    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    snapshot_number = Column(String(100), nullable=False, unique=True, index=True)
    snapshot_reference = Column(String(255), nullable=False, index=True)
    period_start = Column(DateTime(timezone=True), nullable=False, index=True)
    period_end = Column(DateTime(timezone=True), nullable=False, index=True)
    overall_score = Column(Numeric(7, 2), nullable=False)
    health_grade = Column(String(20), nullable=False, index=True)
    metric_count = Column(Integer, nullable=False)
    available_metric_count = Column(Integer, nullable=False)
    alert_count = Column(Integer, nullable=False, default=0, server_default="0")
    dimensions_json = Column(Text, nullable=False, default="[]", server_default="[]")
    source_watermarks_json = Column(Text, nullable=False, default="[]", server_default="[]")
    methodology_version = Column(String(50), nullable=False, default="v1", server_default="v1")
    status = Column(String(30), nullable=False, default="published", server_default="published", index=True)
    generated_by = Column(String(255), nullable=False, index=True)
    generated_at = Column(DateTime(timezone=True), nullable=False)
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    created_at = Column(DateTime(timezone=True), default=datetime.now)


class FactoryHealthCockpitAlert(Base):
    __tablename__ = "factory_health_cockpit_alerts"
    __table_args__ = (
        UniqueConstraint("snapshot_id", "metric_code", name="uq_factory_health_snapshot_metric_alert"),
        {"extend_existing": True},
    )

    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    alert_number = Column(String(100), nullable=False, unique=True, index=True)
    snapshot_id = Column(String(100), nullable=False, index=True)
    snapshot_number = Column(String(100), nullable=False, index=True)
    dimension = Column(String(40), nullable=False, index=True)
    metric_code = Column(String(100), nullable=False, index=True)
    metric_label = Column(String(255), nullable=False)
    severity = Column(String(20), nullable=False, index=True)
    actual_value = Column(Numeric(18, 4), nullable=True)
    threshold_value = Column(Numeric(18, 4), nullable=False)
    unit = Column(String(30), nullable=False)
    source_object_type = Column(String(100), nullable=False, index=True)
    source_reference = Column(String(500), nullable=False)
    status = Column(String(30), nullable=False, default="open", server_default="open", index=True)
    owner = Column(String(255), nullable=True, index=True)
    acknowledged_by = Column(String(255), nullable=True, index=True)
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)
    due_at = Column(DateTime(timezone=True), nullable=True, index=True)
    verified_by = Column(String(255), nullable=True, index=True)
    verified_at = Column(DateTime(timezone=True), nullable=True)
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    updated_by = Column(String(255), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)


class FactoryHealthResponsibilityTask(Base):
    __tablename__ = "factory_health_responsibility_tasks"
    __table_args__ = (
        UniqueConstraint("alert_id", name="uq_factory_health_alert_task"),
        {"extend_existing": True},
    )

    id = Column(String(100), primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    agent_path = Column(String(500), nullable=False, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    client_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(String(100), nullable=False, index=True)
    task_number = Column(String(100), nullable=False, unique=True, index=True)
    alert_id = Column(String(100), nullable=False, index=True)
    alert_number = Column(String(100), nullable=False, index=True)
    owner = Column(String(255), nullable=False, index=True)
    action_plan = Column(Text, nullable=False)
    due_at = Column(DateTime(timezone=True), nullable=False, index=True)
    status = Column(String(30), nullable=False, default="assigned", server_default="assigned", index=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completion_note = Column(Text, nullable=True)
    completion_evidence_reference = Column(String(500), nullable=True)
    completed_by = Column(String(255), nullable=True, index=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    verified_by = Column(String(255), nullable=True, index=True)
    verified_at = Column(DateTime(timezone=True), nullable=True)
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    updated_by = Column(String(255), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)


class FactoryHealthCockpitEvidence(Base):
    __tablename__ = "factory_health_cockpit_evidence"
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
