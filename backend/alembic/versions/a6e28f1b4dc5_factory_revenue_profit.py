"""add governed attribution and management contribution analysis

Revision ID: a6e28f1b4dc5
Revises: f5d17e9a3cb4

Rollback removes only attribution policies, immutable touchpoint evidence,
warehouse fact bindings, derived management contribution runs, allocations,
evidence and six role permissions. It never changes or deletes CPQ, revenue,
warehouse facts, lineage, formal finance records or previously published
metric results.
"""

import json

from alembic import op
import sqlalchemy as sa


revision = "a6e28f1b4dc5"
down_revision = "f5d17e9a3cb4"
branch_labels = None
depends_on = None

PERMISSIONS = (
    "factory.decision.revenue-profit.policy.manage",
    "factory.decision.revenue-profit.policy.approve",
    "factory.decision.revenue-profit.evidence.record",
    "factory.decision.revenue-profit.binding.verify",
    "factory.decision.revenue-profit.analysis.execute",
    "factory.decision.revenue-profit.analysis.verify",
)
TABLE_INDEXES = {
    "factory_attribution_policies": ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", "policy_number", "policy_reference", "policy_code", "owner", "status", "current_version_id", "current_version_number", "updated_by"),
    "factory_attribution_policy_versions": ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", "version_number_record", "version_reference", "policy_id", "policy_number", "policy_code", "version_number", "model_type", "policy_fingerprint", "status", "effective_from", "authored_by", "submitted_by", "approved_by", "updated_by"),
    "factory_attribution_touchpoints": ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", "touchpoint_number", "external_event_reference", "correlation_id", "account_reference", "channel", "campaign_reference", "content_reference", "occurred_at", "currency", "evidence_fingerprint", "recorded_by"),
    "factory_revenue_profit_bindings": ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", "binding_number", "binding_reference", "correlation_id", "account_reference", "currency", "revenue_load_run_id", "revenue_run_number", "revenue_fact_id", "revenue_fact_number", "quote_load_run_id", "quote_run_number", "quote_fact_id", "quote_fact_number", "status", "created_by", "verified_by", "updated_by"),
    "factory_revenue_profit_runs": ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", "run_number", "analysis_reference", "binding_id", "binding_number", "policy_id", "policy_version_id", "policy_fingerprint", "model_type", "correlation_id", "account_reference", "currency", "profit_classification", "status", "calculated_by", "verified_by", "updated_by"),
    "factory_revenue_profit_allocations": ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", "allocation_number", "analysis_run_id", "run_number", "touchpoint_id", "touchpoint_number", "channel", "campaign_reference"),
    "factory_revenue_profit_evidence": ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", "evidence_number", "subject_type", "subject_id", "subject_number", "evidence_type", "recorded_by"),
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
    for column in TABLE_INDEXES[table]:
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
        bind.execute(sa.text("UPDATE roles_platform SET permissions_json=:permissions WHERE id=:id"), {
            "permissions": json.dumps(values, ensure_ascii=False), "id": row["id"],
        })


def upgrade() -> None:
    op.create_table(
        "factory_attribution_policies", *_tenant_columns(),
        sa.Column("policy_number", sa.String(100), nullable=False), sa.Column("policy_reference", sa.String(255), nullable=False),
        sa.Column("policy_code", sa.String(100), nullable=False), sa.Column("owner", sa.String(255), nullable=False),
        sa.Column("purpose", sa.Text(), nullable=False), sa.Column("status", sa.String(30), nullable=False, server_default="draft"),
        sa.Column("current_version_id", sa.String(100), nullable=True), sa.Column("current_version_number", sa.Integer(), nullable=True),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"), sa.Column("updated_by", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True), sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("policy_number", name="uq_factory_attribution_policy_number"),
        sa.UniqueConstraint("tenant_id", "policy_code", name="uq_factory_attribution_tenant_code"),
        sa.UniqueConstraint("tenant_id", "policy_reference", name="uq_factory_attribution_tenant_reference"),
    ); _indexes("factory_attribution_policies")
    op.create_table(
        "factory_attribution_policy_versions", *_tenant_columns(),
        sa.Column("version_number_record", sa.String(100), nullable=False), sa.Column("version_reference", sa.String(255), nullable=False),
        sa.Column("policy_id", sa.String(100), nullable=False), sa.Column("policy_number", sa.String(100), nullable=False),
        sa.Column("policy_code", sa.String(100), nullable=False), sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("label", sa.String(255), nullable=False), sa.Column("model_type", sa.String(30), nullable=False),
        sa.Column("lookback_days", sa.Integer(), nullable=False), sa.Column("policy_fingerprint", sa.String(64), nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="draft"), sa.Column("change_reason", sa.Text(), nullable=False),
        sa.Column("effective_from", sa.DateTime(timezone=True), nullable=False), sa.Column("authored_by", sa.String(255), nullable=False),
        sa.Column("submitted_by", sa.String(255), nullable=True), sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("approval_reference", sa.String(500), nullable=True), sa.Column("approved_by", sa.String(255), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True), sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("updated_by", sa.String(255), nullable=True), sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("version_number_record", name="uq_factory_attribution_version_number_record"),
        sa.UniqueConstraint("policy_id", "version_number", name="uq_factory_attribution_policy_version"),
        sa.UniqueConstraint("tenant_id", "version_reference", name="uq_factory_attribution_tenant_version_reference"),
    ); _indexes("factory_attribution_policy_versions")
    op.create_table(
        "factory_attribution_touchpoints", *_tenant_columns(),
        sa.Column("touchpoint_number", sa.String(100), nullable=False), sa.Column("external_event_reference", sa.String(255), nullable=False),
        sa.Column("correlation_id", sa.String(100), nullable=False), sa.Column("account_reference", sa.String(255), nullable=False),
        sa.Column("channel", sa.String(100), nullable=False), sa.Column("campaign_reference", sa.String(255), nullable=False),
        sa.Column("content_reference", sa.String(255), nullable=True), sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("spend_amount", sa.Numeric(18, 2), nullable=False, server_default="0"), sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("consent_reference", sa.String(500), nullable=False), sa.Column("evidence_fingerprint", sa.String(64), nullable=False),
        sa.Column("recorded_by", sa.String(255), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("touchpoint_number", name="uq_factory_attribution_touchpoint_number"),
        sa.UniqueConstraint("tenant_id", "external_event_reference", name="uq_factory_attribution_tenant_event"),
    ); _indexes("factory_attribution_touchpoints")
    op.create_table(
        "factory_revenue_profit_bindings", *_tenant_columns(),
        sa.Column("binding_number", sa.String(100), nullable=False), sa.Column("binding_reference", sa.String(255), nullable=False),
        sa.Column("correlation_id", sa.String(100), nullable=False), sa.Column("account_reference", sa.String(255), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False), sa.Column("revenue_load_run_id", sa.String(100), nullable=False),
        sa.Column("revenue_run_number", sa.String(100), nullable=False), sa.Column("revenue_fact_id", sa.String(100), nullable=False),
        sa.Column("revenue_fact_number", sa.String(100), nullable=False), sa.Column("revenue_source_revision", sa.Integer(), nullable=False),
        sa.Column("quote_load_run_id", sa.String(100), nullable=False), sa.Column("quote_run_number", sa.String(100), nullable=False),
        sa.Column("quote_fact_id", sa.String(100), nullable=False), sa.Column("quote_fact_number", sa.String(100), nullable=False),
        sa.Column("quote_source_revision", sa.Integer(), nullable=False), sa.Column("status", sa.String(30), nullable=False, server_default="pending-verification"),
        sa.Column("created_by", sa.String(255), nullable=False), sa.Column("verified_by", sa.String(255), nullable=True),
        sa.Column("verification_reference", sa.String(500), nullable=True), sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"), sa.Column("updated_by", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True), sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("binding_number", name="uq_factory_revenue_profit_binding_number"),
        sa.UniqueConstraint("tenant_id", "binding_reference", name="uq_factory_revenue_profit_tenant_binding"),
        sa.UniqueConstraint("revenue_fact_id", "quote_fact_id", name="uq_factory_revenue_profit_fact_pair"),
    ); _indexes("factory_revenue_profit_bindings")
    op.create_table(
        "factory_revenue_profit_runs", *_tenant_columns(),
        sa.Column("run_number", sa.String(100), nullable=False), sa.Column("analysis_reference", sa.String(255), nullable=False),
        sa.Column("binding_id", sa.String(100), nullable=False), sa.Column("binding_number", sa.String(100), nullable=False),
        sa.Column("policy_id", sa.String(100), nullable=False), sa.Column("policy_version_id", sa.String(100), nullable=False),
        sa.Column("policy_version_number", sa.Integer(), nullable=False), sa.Column("policy_fingerprint", sa.String(64), nullable=False),
        sa.Column("model_type", sa.String(30), nullable=False), sa.Column("correlation_id", sa.String(100), nullable=False),
        sa.Column("account_reference", sa.String(255), nullable=False), sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("recognized_revenue", sa.Numeric(18, 2), nullable=False), sa.Column("governed_sales_cost", sa.Numeric(18, 2), nullable=False),
        sa.Column("marketing_spend", sa.Numeric(18, 2), nullable=False), sa.Column("contribution_margin", sa.Numeric(18, 2), nullable=False),
        sa.Column("contribution_margin_percent", sa.Numeric(9, 4), nullable=False), sa.Column("touchpoint_count", sa.Integer(), nullable=False),
        sa.Column("profit_classification", sa.String(60), nullable=False, server_default="management-contribution-estimate"),
        sa.Column("status", sa.String(30), nullable=False, server_default="calculated"), sa.Column("calculated_by", sa.String(255), nullable=False),
        sa.Column("calculated_at", sa.DateTime(timezone=True), nullable=False), sa.Column("verification_reference", sa.String(500), nullable=True),
        sa.Column("verification_note", sa.Text(), nullable=True), sa.Column("verified_by", sa.String(255), nullable=True),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True), sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("updated_by", sa.String(255), nullable=True), sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("run_number", name="uq_factory_revenue_profit_run_number"),
        sa.UniqueConstraint("tenant_id", "analysis_reference", name="uq_factory_revenue_profit_tenant_analysis"),
        sa.UniqueConstraint("binding_id", "policy_version_id", name="uq_factory_revenue_profit_binding_policy"),
    ); _indexes("factory_revenue_profit_runs")
    op.create_table(
        "factory_revenue_profit_allocations", *_tenant_columns(),
        sa.Column("allocation_number", sa.String(100), nullable=False), sa.Column("analysis_run_id", sa.String(100), nullable=False),
        sa.Column("run_number", sa.String(100), nullable=False), sa.Column("touchpoint_id", sa.String(100), nullable=False),
        sa.Column("touchpoint_number", sa.String(100), nullable=False), sa.Column("channel", sa.String(100), nullable=False),
        sa.Column("campaign_reference", sa.String(255), nullable=False), sa.Column("weight", sa.Numeric(9, 6), nullable=False),
        sa.Column("attributed_revenue", sa.Numeric(18, 2), nullable=False), sa.Column("attributed_sales_cost", sa.Numeric(18, 2), nullable=False),
        sa.Column("touchpoint_spend", sa.Numeric(18, 2), nullable=False), sa.Column("attributed_contribution", sa.Numeric(18, 2), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("allocation_number", name="uq_factory_revenue_profit_allocation_number"),
        sa.UniqueConstraint("analysis_run_id", "touchpoint_id", name="uq_factory_revenue_profit_run_touchpoint"),
    ); _indexes("factory_revenue_profit_allocations")
    op.create_table(
        "factory_revenue_profit_evidence", *_tenant_columns(),
        sa.Column("evidence_number", sa.String(100), nullable=False), sa.Column("subject_type", sa.String(40), nullable=False),
        sa.Column("subject_id", sa.String(100), nullable=False), sa.Column("subject_number", sa.String(100), nullable=False),
        sa.Column("evidence_type", sa.String(50), nullable=False), sa.Column("evidence_reference", sa.String(500), nullable=False),
        sa.Column("note", sa.Text(), nullable=False), sa.Column("recorded_by", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("evidence_number", name="uq_factory_revenue_profit_evidence_number"),
    ); _indexes("factory_revenue_profit_evidence")
    _update_permissions(remove=False)


def downgrade() -> None:
    _update_permissions(remove=True)
    for table in reversed(tuple(TABLE_INDEXES)):
        for column in reversed(TABLE_INDEXES[table]):
            op.drop_index(f"ix_{table}_{column}", table_name=table)
        op.drop_table(table)
