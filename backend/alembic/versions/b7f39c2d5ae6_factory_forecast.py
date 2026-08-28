"""factory governed rolling forecast

Revision ID: b7f39c2d5ae6
Revises: a6e28f1b4dc5
Create Date: 2026-08-02

Rollback removes only forecast-owned tables and forecast permissions. Published
warehouse and authority facts are never modified by either direction.
"""

from __future__ import annotations

import json

from alembic import op
import sqlalchemy as sa


revision = "b7f39c2d5ae6"
down_revision = "a6e28f1b4dc5"
branch_labels = None
depends_on = None

PERMISSIONS = (
    "factory.decision.forecast.policy.manage",
    "factory.decision.forecast.policy.approve",
    "factory.decision.forecast.run.execute",
    "factory.decision.forecast.run.verify",
)

INDEXES = {
    "factory_forecast_policies": ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", "policy_number", "policy_reference", "policy_code", "owner", "status", "current_version_id", "current_version_number", "updated_by"),
    "factory_forecast_policy_versions": ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", "version_number_record", "version_reference", "policy_id", "policy_number", "policy_code", "version_number", "model_type", "policy_fingerprint", "status", "effective_from", "authored_by", "submitted_by", "approved_by", "updated_by"),
    "factory_forecast_runs": ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", "run_number", "forecast_reference", "policy_id", "policy_version_id", "policy_fingerprint", "model_type", "as_of_at", "currency", "forecast_classification", "status", "calculated_by", "verified_by", "updated_by"),
    "factory_forecast_input_edges": ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", "edge_number", "forecast_run_id", "run_number", "source_code", "warehouse_load_run_id", "warehouse_run_number", "warehouse_fact_id", "warehouse_fact_number", "source_object_id", "source_object_number", "content_hash"),
    "factory_forecast_buckets": ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", "bucket_number", "forecast_run_id", "run_number", "bucket_start", "bucket_end"),
    "factory_forecast_evidence": ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", "evidence_number", "subject_type", "subject_id", "subject_number", "evidence_type", "recorded_by"),
}


def _tenant_columns() -> list[sa.Column]:
    return [
        sa.Column("id", sa.String(100), primary_key=True),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("agent_path", sa.String(500), nullable=False),
        sa.Column("tenant_id", sa.String(100), nullable=False),
        sa.Column("client_id", sa.String(100), nullable=False),
        sa.Column("plan_id", sa.String(100), nullable=False),
    ]


def _indexes(table: str) -> None:
    for column in INDEXES[table]:
        op.create_index(f"ix_{table}_{column}", table, [column])


def _update_permissions(*, remove: bool) -> None:
    bind = op.get_bind()
    rows = bind.execute(sa.text(
        "SELECT id, permissions_json FROM roles_platform "
        "WHERE is_system = 1 AND scope IN ('client', 'project')"
    )).mappings().all()
    for row in rows:
        try:
            values = json.loads(row["permissions_json"] or "[]")
        except (TypeError, ValueError):
            values = []
        if not isinstance(values, list):
            values = []
        values = ([value for value in values if value not in PERMISSIONS] if remove
                  else list(dict.fromkeys([*values, *PERMISSIONS])))
        bind.execute(sa.text(
            "UPDATE roles_platform SET permissions_json=:permissions WHERE id=:id"
        ), {"permissions": json.dumps(values, ensure_ascii=False), "id": row["id"]})


def upgrade() -> None:
    op.create_table(
        "factory_forecast_policies", *_tenant_columns(),
        sa.Column("policy_number", sa.String(100), nullable=False),
        sa.Column("policy_reference", sa.String(255), nullable=False),
        sa.Column("policy_code", sa.String(100), nullable=False),
        sa.Column("owner", sa.String(255), nullable=False),
        sa.Column("purpose", sa.Text(), nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="draft"),
        sa.Column("current_version_id", sa.String(100), nullable=True),
        sa.Column("current_version_number", sa.Integer(), nullable=True),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("updated_by", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("policy_number", name="uq_factory_forecast_policy_number"),
        sa.UniqueConstraint("tenant_id", "policy_code", name="uq_factory_forecast_tenant_code"),
        sa.UniqueConstraint("tenant_id", "policy_reference", name="uq_factory_forecast_tenant_reference"),
    ); _indexes("factory_forecast_policies")
    op.create_table(
        "factory_forecast_policy_versions", *_tenant_columns(),
        sa.Column("version_number_record", sa.String(100), nullable=False),
        sa.Column("version_reference", sa.String(255), nullable=False),
        sa.Column("policy_id", sa.String(100), nullable=False),
        sa.Column("policy_number", sa.String(100), nullable=False),
        sa.Column("policy_code", sa.String(100), nullable=False),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("label", sa.String(255), nullable=False),
        sa.Column("model_type", sa.String(60), nullable=False),
        sa.Column("horizon_days", sa.Integer(), nullable=False),
        sa.Column("bucket_days", sa.Integer(), nullable=False),
        sa.Column("demand_growth_percent", sa.Numeric(9, 4), nullable=False),
        sa.Column("pipeline_probability_percent", sa.Numeric(9, 4), nullable=False),
        sa.Column("collection_percent", sa.Numeric(9, 4), nullable=False),
        sa.Column("capacity_buffer_percent", sa.Numeric(9, 4), nullable=False),
        sa.Column("procurement_payment_percent", sa.Numeric(9, 4), nullable=False),
        sa.Column("policy_fingerprint", sa.String(64), nullable=False),
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
        sa.UniqueConstraint("version_number_record", name="uq_factory_forecast_version_number_record"),
        sa.UniqueConstraint("policy_id", "version_number", name="uq_factory_forecast_policy_version"),
        sa.UniqueConstraint("tenant_id", "version_reference", name="uq_factory_forecast_tenant_version_reference"),
    ); _indexes("factory_forecast_policy_versions")
    op.create_table(
        "factory_forecast_runs", *_tenant_columns(),
        sa.Column("run_number", sa.String(100), nullable=False),
        sa.Column("forecast_reference", sa.String(255), nullable=False),
        sa.Column("policy_id", sa.String(100), nullable=False),
        sa.Column("policy_version_id", sa.String(100), nullable=False),
        sa.Column("policy_version_number", sa.Integer(), nullable=False),
        sa.Column("policy_fingerprint", sa.String(64), nullable=False),
        sa.Column("model_type", sa.String(60), nullable=False),
        sa.Column("as_of_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("horizon_days", sa.Integer(), nullable=False),
        sa.Column("bucket_days", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("source_count", sa.Integer(), nullable=False),
        sa.Column("input_fact_count", sa.Integer(), nullable=False),
        sa.Column("pipeline_demand_value", sa.Numeric(18, 2), nullable=False),
        sa.Column("confirmed_order_value", sa.Numeric(18, 2), nullable=False),
        sa.Column("required_capacity_units", sa.Numeric(18, 4), nullable=False),
        sa.Column("available_capacity_units", sa.Numeric(18, 4), nullable=False),
        sa.Column("capacity_gap_units", sa.Numeric(18, 4), nullable=False),
        sa.Column("expected_cash_in", sa.Numeric(18, 2), nullable=False),
        sa.Column("expected_cash_out", sa.Numeric(18, 2), nullable=False),
        sa.Column("net_cash_change", sa.Numeric(18, 2), nullable=False),
        sa.Column("forecast_classification", sa.String(60), nullable=False, server_default="management-rolling-forecast"),
        sa.Column("status", sa.String(30), nullable=False, server_default="calculated"),
        sa.Column("calculated_by", sa.String(255), nullable=False),
        sa.Column("calculated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("verification_reference", sa.String(500), nullable=True),
        sa.Column("verification_note", sa.Text(), nullable=True),
        sa.Column("verified_by", sa.String(255), nullable=True),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("updated_by", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("run_number", name="uq_factory_forecast_run_number"),
        sa.UniqueConstraint("tenant_id", "forecast_reference", name="uq_factory_forecast_tenant_run_reference"),
    ); _indexes("factory_forecast_runs")
    op.create_table(
        "factory_forecast_input_edges", *_tenant_columns(),
        sa.Column("edge_number", sa.String(100), nullable=False),
        sa.Column("forecast_run_id", sa.String(100), nullable=False),
        sa.Column("run_number", sa.String(100), nullable=False),
        sa.Column("source_code", sa.String(60), nullable=False),
        sa.Column("warehouse_load_run_id", sa.String(100), nullable=False),
        sa.Column("warehouse_run_number", sa.String(100), nullable=False),
        sa.Column("warehouse_fact_id", sa.String(100), nullable=False),
        sa.Column("warehouse_fact_number", sa.String(100), nullable=False),
        sa.Column("source_object_id", sa.String(100), nullable=False),
        sa.Column("source_object_number", sa.String(100), nullable=False),
        sa.Column("source_revision", sa.Integer(), nullable=False),
        sa.Column("content_hash", sa.String(64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("edge_number", name="uq_factory_forecast_edge_number"),
        sa.UniqueConstraint("forecast_run_id", "warehouse_fact_id", name="uq_factory_forecast_run_fact"),
    ); _indexes("factory_forecast_input_edges")
    op.create_table(
        "factory_forecast_buckets", *_tenant_columns(),
        sa.Column("bucket_number", sa.String(100), nullable=False),
        sa.Column("forecast_run_id", sa.String(100), nullable=False),
        sa.Column("run_number", sa.String(100), nullable=False),
        sa.Column("bucket_index", sa.Integer(), nullable=False),
        sa.Column("bucket_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("bucket_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column("pipeline_demand_value", sa.Numeric(18, 2), nullable=False),
        sa.Column("confirmed_order_value", sa.Numeric(18, 2), nullable=False),
        sa.Column("required_capacity_units", sa.Numeric(18, 4), nullable=False),
        sa.Column("available_capacity_units", sa.Numeric(18, 4), nullable=False),
        sa.Column("expected_cash_in", sa.Numeric(18, 2), nullable=False),
        sa.Column("expected_cash_out", sa.Numeric(18, 2), nullable=False),
        sa.Column("net_cash_change", sa.Numeric(18, 2), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("bucket_number", name="uq_factory_forecast_bucket_number"),
        sa.UniqueConstraint("forecast_run_id", "bucket_index", name="uq_factory_forecast_run_bucket"),
    ); _indexes("factory_forecast_buckets")
    op.create_table(
        "factory_forecast_evidence", *_tenant_columns(),
        sa.Column("evidence_number", sa.String(100), nullable=False),
        sa.Column("subject_type", sa.String(40), nullable=False),
        sa.Column("subject_id", sa.String(100), nullable=False),
        sa.Column("subject_number", sa.String(100), nullable=False),
        sa.Column("evidence_type", sa.String(50), nullable=False),
        sa.Column("evidence_reference", sa.String(500), nullable=False),
        sa.Column("note", sa.Text(), nullable=False),
        sa.Column("recorded_by", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("evidence_number", name="uq_factory_forecast_evidence_number"),
    ); _indexes("factory_forecast_evidence")
    _update_permissions(remove=False)


def downgrade() -> None:
    _update_permissions(remove=True)
    for table in reversed(tuple(INDEXES)):
        for column in reversed(INDEXES[table]):
            op.drop_index(f"ix_{table}_{column}", table_name=table)
        op.drop_table(table)
