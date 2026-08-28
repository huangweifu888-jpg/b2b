"""add governed operating-health cockpit and responsibility tasks

Revision ID: d3bf5c7e1a92
Revises: c2ae4b6d9f81

Rollback removes only derived health snapshots, alerts, responsibility tasks,
append-only cockpit evidence and four permission grants. It never mutates or
deletes authoritative quotes, orders, quality, asset, service, VOC, RMA,
revenue, partner, invoice or payment records.
"""

import json

from alembic import op
import sqlalchemy as sa


revision = "d3bf5c7e1a92"
down_revision = "c2ae4b6d9f81"
branch_labels = None
depends_on = None

PERMISSIONS = (
    "factory.decision.health-cockpit.refresh",
    "factory.decision.health-cockpit.alert.manage",
    "factory.decision.health-cockpit.task.manage",
    "factory.decision.health-cockpit.task.verify",
)
SNAPSHOT_INDEXES = ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", "snapshot_number", "snapshot_reference", "period_start", "period_end", "health_grade", "status", "generated_by")
ALERT_INDEXES = ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", "alert_number", "snapshot_id", "snapshot_number", "dimension", "metric_code", "severity", "source_object_type", "status", "owner", "acknowledged_by", "due_at", "verified_by", "updated_by")
TASK_INDEXES = ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", "task_number", "alert_id", "alert_number", "owner", "due_at", "status", "completed_by", "verified_by", "updated_by")
EVIDENCE_INDEXES = ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", "evidence_number", "subject_type", "subject_id", "subject_number", "evidence_type", "recorded_by")


def _update_permissions(*, remove: bool) -> None:
    bind = op.get_bind()
    rows = bind.execute(sa.text("SELECT id, permissions_json FROM roles_platform WHERE is_system = 1 AND scope IN ('client', 'project')")).mappings().all()
    for row in rows:
        try:
            values = json.loads(row["permissions_json"] or "[]")
        except (TypeError, ValueError):
            values = []
        if not isinstance(values, list):
            values = []
        values = [value for value in values if value not in PERMISSIONS] if remove else list(dict.fromkeys([*values, *PERMISSIONS]))
        bind.execute(sa.text("UPDATE roles_platform SET permissions_json = :permissions WHERE id = :id"), {"permissions": json.dumps(values, ensure_ascii=False), "id": row["id"]})


def _tenant_columns() -> list[sa.Column]:
    return [
        sa.Column("id", sa.String(length=100), primary_key=True),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("agent_path", sa.String(length=500), nullable=False),
        sa.Column("tenant_id", sa.String(length=100), nullable=False),
        sa.Column("client_id", sa.String(length=100), nullable=False),
        sa.Column("plan_id", sa.String(length=100), nullable=False),
    ]


def upgrade() -> None:
    op.create_table(
        "factory_health_cockpit_snapshots", *_tenant_columns(),
        sa.Column("snapshot_number", sa.String(length=100), nullable=False),
        sa.Column("snapshot_reference", sa.String(length=255), nullable=False),
        sa.Column("period_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("period_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column("overall_score", sa.Numeric(7, 2), nullable=False),
        sa.Column("health_grade", sa.String(length=20), nullable=False),
        sa.Column("metric_count", sa.Integer(), nullable=False),
        sa.Column("available_metric_count", sa.Integer(), nullable=False),
        sa.Column("alert_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("dimensions_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("source_watermarks_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("methodology_version", sa.String(length=50), nullable=False, server_default="v1"),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="published"),
        sa.Column("generated_by", sa.String(length=255), nullable=False),
        sa.Column("generated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("snapshot_number", name="uq_factory_health_snapshot_number"),
        sa.UniqueConstraint("tenant_id", "snapshot_reference", name="uq_factory_health_tenant_snapshot_reference"),
    )
    for column in SNAPSHOT_INDEXES:
        op.create_index(f"ix_factory_health_cockpit_snapshots_{column}", "factory_health_cockpit_snapshots", [column])

    op.create_table(
        "factory_health_cockpit_alerts", *_tenant_columns(),
        sa.Column("alert_number", sa.String(length=100), nullable=False),
        sa.Column("snapshot_id", sa.String(length=100), nullable=False),
        sa.Column("snapshot_number", sa.String(length=100), nullable=False),
        sa.Column("dimension", sa.String(length=40), nullable=False),
        sa.Column("metric_code", sa.String(length=100), nullable=False),
        sa.Column("metric_label", sa.String(length=255), nullable=False),
        sa.Column("severity", sa.String(length=20), nullable=False),
        sa.Column("actual_value", sa.Numeric(18, 4), nullable=True),
        sa.Column("threshold_value", sa.Numeric(18, 4), nullable=False),
        sa.Column("unit", sa.String(length=30), nullable=False),
        sa.Column("source_object_type", sa.String(length=100), nullable=False),
        sa.Column("source_reference", sa.String(length=500), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="open"),
        sa.Column("owner", sa.String(length=255), nullable=True),
        sa.Column("acknowledged_by", sa.String(length=255), nullable=True),
        sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("verified_by", sa.String(length=255), nullable=True),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("updated_by", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("alert_number", name="uq_factory_health_alert_number"),
        sa.UniqueConstraint("snapshot_id", "metric_code", name="uq_factory_health_snapshot_metric_alert"),
    )
    for column in ALERT_INDEXES:
        op.create_index(f"ix_factory_health_cockpit_alerts_{column}", "factory_health_cockpit_alerts", [column])

    op.create_table(
        "factory_health_responsibility_tasks", *_tenant_columns(),
        sa.Column("task_number", sa.String(length=100), nullable=False),
        sa.Column("alert_id", sa.String(length=100), nullable=False),
        sa.Column("alert_number", sa.String(length=100), nullable=False),
        sa.Column("owner", sa.String(length=255), nullable=False),
        sa.Column("action_plan", sa.Text(), nullable=False),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="assigned"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completion_note", sa.Text(), nullable=True),
        sa.Column("completion_evidence_reference", sa.String(length=500), nullable=True),
        sa.Column("completed_by", sa.String(length=255), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("verified_by", sa.String(length=255), nullable=True),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("updated_by", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("task_number", name="uq_factory_health_task_number"),
        sa.UniqueConstraint("alert_id", name="uq_factory_health_alert_task"),
    )
    for column in TASK_INDEXES:
        op.create_index(f"ix_factory_health_responsibility_tasks_{column}", "factory_health_responsibility_tasks", [column])

    op.create_table(
        "factory_health_cockpit_evidence", *_tenant_columns(),
        sa.Column("evidence_number", sa.String(length=100), nullable=False),
        sa.Column("subject_type", sa.String(length=40), nullable=False),
        sa.Column("subject_id", sa.String(length=100), nullable=False),
        sa.Column("subject_number", sa.String(length=100), nullable=False),
        sa.Column("evidence_type", sa.String(length=50), nullable=False),
        sa.Column("evidence_reference", sa.String(length=500), nullable=False),
        sa.Column("note", sa.Text(), nullable=False),
        sa.Column("recorded_by", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("evidence_number", name="uq_factory_health_evidence_number"),
    )
    for column in EVIDENCE_INDEXES:
        op.create_index(f"ix_factory_health_cockpit_evidence_{column}", "factory_health_cockpit_evidence", [column])
    _update_permissions(remove=False)


def downgrade() -> None:
    _update_permissions(remove=True)
    for column in reversed(EVIDENCE_INDEXES):
        op.drop_index(f"ix_factory_health_cockpit_evidence_{column}", table_name="factory_health_cockpit_evidence")
    op.drop_table("factory_health_cockpit_evidence")
    for column in reversed(TASK_INDEXES):
        op.drop_index(f"ix_factory_health_responsibility_tasks_{column}", table_name="factory_health_responsibility_tasks")
    op.drop_table("factory_health_responsibility_tasks")
    for column in reversed(ALERT_INDEXES):
        op.drop_index(f"ix_factory_health_cockpit_alerts_{column}", table_name="factory_health_cockpit_alerts")
    op.drop_table("factory_health_cockpit_alerts")
    for column in reversed(SNAPSHOT_INDEXES):
        op.drop_index(f"ix_factory_health_cockpit_snapshots_{column}", table_name="factory_health_cockpit_snapshots")
    op.drop_table("factory_health_cockpit_snapshots")
