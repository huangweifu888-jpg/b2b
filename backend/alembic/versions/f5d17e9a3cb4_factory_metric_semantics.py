"""add governed metric semantics, versions and observations

Revision ID: f5d17e9a3cb4
Revises: e4c06d8f2ba3

Rollback removes only metric definitions, immutable versions, derived evaluation
runs, observations, evidence and four role permissions. It never deletes or
changes warehouse facts, lineage, source operational records or prior business
system facts. Historical results remain version-pinned until this feature is
explicitly rolled back.
"""

import json

from alembic import op
import sqlalchemy as sa


revision = "f5d17e9a3cb4"
down_revision = "e4c06d8f2ba3"
branch_labels = None
depends_on = None

PERMISSIONS = (
    "factory.decision.metrics.definition.manage",
    "factory.decision.metrics.version.approve",
    "factory.decision.metrics.evaluation.execute",
    "factory.decision.metrics.evaluation.verify",
)
DEFINITION_INDEXES = ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", "definition_number", "definition_reference", "metric_code", "domain", "owner", "status", "current_version_id", "current_version_number", "updated_by")
VERSION_INDEXES = ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", "version_number_record", "version_reference", "definition_id", "definition_number", "metric_code", "version_number", "unit", "aggregation", "value_field", "numerator_field", "denominator_field", "filter_field", "source_id", "source_code", "source_schema_fingerprint", "formula_hash", "status", "effective_from", "authored_by", "submitted_by", "approved_by", "updated_by")
RUN_INDEXES = ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", "run_number", "evaluation_reference", "definition_id", "definition_number", "metric_version_id", "metric_version_number", "metric_code", "formula_hash", "warehouse_load_run_id", "warehouse_run_number", "source_code", "source_watermark_at", "status", "evaluated_by", "verified_by", "updated_by")
OBSERVATION_INDEXES = ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", "observation_number", "evaluation_run_id", "run_number", "metric_code", "dimension_key")
EVIDENCE_INDEXES = ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", "evidence_number", "subject_type", "subject_id", "subject_number", "evidence_type", "recorded_by")


def _tenant_columns() -> list[sa.Column]:
    return [
        sa.Column("id", sa.String(length=100), primary_key=True),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("agent_path", sa.String(length=500), nullable=False),
        sa.Column("tenant_id", sa.String(length=100), nullable=False),
        sa.Column("client_id", sa.String(length=100), nullable=False),
        sa.Column("plan_id", sa.String(length=100), nullable=False),
    ]


def _indexes(table: str, columns: tuple[str, ...]) -> None:
    for column in columns:
        op.create_index(f"ix_{table}_{column}", table, [column])


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
        bind.execute(sa.text("UPDATE roles_platform SET permissions_json=:permissions WHERE id=:id"), {"permissions": json.dumps(values, ensure_ascii=False), "id": row["id"]})


def upgrade() -> None:
    op.create_table(
        "factory_metric_definitions", *_tenant_columns(),
        sa.Column("definition_number", sa.String(100), nullable=False),
        sa.Column("definition_reference", sa.String(255), nullable=False),
        sa.Column("metric_code", sa.String(100), nullable=False),
        sa.Column("domain", sa.String(50), nullable=False), sa.Column("owner", sa.String(255), nullable=False),
        sa.Column("purpose", sa.Text(), nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="draft"),
        sa.Column("current_version_id", sa.String(100), nullable=True),
        sa.Column("current_version_number", sa.Integer(), nullable=True),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("updated_by", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("definition_number", name="uq_factory_metric_definition_number"),
        sa.UniqueConstraint("tenant_id", "metric_code", name="uq_factory_metric_tenant_code"),
        sa.UniqueConstraint("tenant_id", "definition_reference", name="uq_factory_metric_tenant_reference"),
    )
    _indexes("factory_metric_definitions", DEFINITION_INDEXES)

    op.create_table(
        "factory_metric_versions", *_tenant_columns(),
        sa.Column("version_number_record", sa.String(100), nullable=False),
        sa.Column("version_reference", sa.String(255), nullable=False),
        sa.Column("definition_id", sa.String(100), nullable=False),
        sa.Column("definition_number", sa.String(100), nullable=False),
        sa.Column("metric_code", sa.String(100), nullable=False),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("label", sa.String(255), nullable=False), sa.Column("description", sa.Text(), nullable=False),
        sa.Column("unit", sa.String(50), nullable=False), sa.Column("aggregation", sa.String(30), nullable=False),
        sa.Column("value_field", sa.String(100), nullable=True),
        sa.Column("numerator_field", sa.String(100), nullable=True),
        sa.Column("denominator_field", sa.String(100), nullable=True),
        sa.Column("filter_field", sa.String(100), nullable=True),
        sa.Column("filter_operator", sa.String(20), nullable=True),
        sa.Column("filter_value", sa.String(500), nullable=True),
        sa.Column("dimensions_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("source_id", sa.String(100), nullable=False), sa.Column("source_code", sa.String(50), nullable=False),
        sa.Column("source_schema_fingerprint", sa.String(64), nullable=False),
        sa.Column("formula_hash", sa.String(64), nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="draft"),
        sa.Column("change_reason", sa.Text(), nullable=False),
        sa.Column("effective_from", sa.DateTime(timezone=True), nullable=False),
        sa.Column("authored_by", sa.String(255), nullable=False),
        sa.Column("submitted_by", sa.String(255), nullable=True),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("approval_reference", sa.String(500), nullable=True),
        sa.Column("approved_by", sa.String(255), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("updated_by", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("version_number_record", name="uq_factory_metric_version_number_record"),
        sa.UniqueConstraint("definition_id", "version_number", name="uq_factory_metric_definition_version"),
        sa.UniqueConstraint("tenant_id", "version_reference", name="uq_factory_metric_tenant_version_reference"),
    )
    _indexes("factory_metric_versions", VERSION_INDEXES)

    op.create_table(
        "factory_metric_evaluation_runs", *_tenant_columns(),
        sa.Column("run_number", sa.String(100), nullable=False),
        sa.Column("evaluation_reference", sa.String(255), nullable=False),
        sa.Column("definition_id", sa.String(100), nullable=False),
        sa.Column("definition_number", sa.String(100), nullable=False),
        sa.Column("metric_version_id", sa.String(100), nullable=False),
        sa.Column("metric_version_number", sa.Integer(), nullable=False),
        sa.Column("metric_code", sa.String(100), nullable=False),
        sa.Column("formula_hash", sa.String(64), nullable=False),
        sa.Column("warehouse_load_run_id", sa.String(100), nullable=False),
        sa.Column("warehouse_run_number", sa.String(100), nullable=False),
        sa.Column("source_code", sa.String(50), nullable=False),
        sa.Column("source_watermark_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(30), nullable=False, server_default="evaluated"),
        sa.Column("fact_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("lineage_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("numerator_value", sa.Numeric(24, 6), nullable=False, server_default="0"),
        sa.Column("denominator_value", sa.Numeric(24, 6), nullable=False, server_default="1"),
        sa.Column("metric_value", sa.Numeric(24, 6), nullable=False, server_default="0"),
        sa.Column("observation_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("evaluated_by", sa.String(255), nullable=False),
        sa.Column("evaluated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("verification_reference", sa.String(500), nullable=True),
        sa.Column("verification_note", sa.Text(), nullable=True),
        sa.Column("verified_by", sa.String(255), nullable=True),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("updated_by", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("run_number", name="uq_factory_metric_run_number"),
        sa.UniqueConstraint("tenant_id", "evaluation_reference", name="uq_factory_metric_tenant_evaluation_reference"),
        sa.UniqueConstraint("metric_version_id", "warehouse_load_run_id", name="uq_factory_metric_version_warehouse_run"),
    )
    _indexes("factory_metric_evaluation_runs", RUN_INDEXES)

    op.create_table(
        "factory_metric_observations", *_tenant_columns(),
        sa.Column("observation_number", sa.String(100), nullable=False),
        sa.Column("evaluation_run_id", sa.String(100), nullable=False),
        sa.Column("run_number", sa.String(100), nullable=False),
        sa.Column("metric_code", sa.String(100), nullable=False),
        sa.Column("dimension_key", sa.String(500), nullable=False),
        sa.Column("dimensions_json", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("fact_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("numerator_value", sa.Numeric(24, 6), nullable=False, server_default="0"),
        sa.Column("denominator_value", sa.Numeric(24, 6), nullable=False, server_default="1"),
        sa.Column("metric_value", sa.Numeric(24, 6), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("observation_number", name="uq_factory_metric_observation_number"),
        sa.UniqueConstraint("evaluation_run_id", "dimension_key", name="uq_factory_metric_run_dimension"),
    )
    _indexes("factory_metric_observations", OBSERVATION_INDEXES)

    op.create_table(
        "factory_metric_evidence", *_tenant_columns(),
        sa.Column("evidence_number", sa.String(100), nullable=False),
        sa.Column("subject_type", sa.String(40), nullable=False),
        sa.Column("subject_id", sa.String(100), nullable=False),
        sa.Column("subject_number", sa.String(100), nullable=False),
        sa.Column("evidence_type", sa.String(50), nullable=False),
        sa.Column("evidence_reference", sa.String(500), nullable=False),
        sa.Column("note", sa.Text(), nullable=False),
        sa.Column("recorded_by", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("evidence_number", name="uq_factory_metric_evidence_number"),
    )
    _indexes("factory_metric_evidence", EVIDENCE_INDEXES)
    _update_permissions(remove=False)


def downgrade() -> None:
    _update_permissions(remove=True)
    for table, columns in (
        ("factory_metric_evidence", EVIDENCE_INDEXES),
        ("factory_metric_observations", OBSERVATION_INDEXES),
        ("factory_metric_evaluation_runs", RUN_INDEXES),
        ("factory_metric_versions", VERSION_INDEXES),
        ("factory_metric_definitions", DEFINITION_INDEXES),
    ):
        for column in reversed(columns):
            op.drop_index(f"ix_{table}_{column}", table_name=table)
        op.drop_table(table)
