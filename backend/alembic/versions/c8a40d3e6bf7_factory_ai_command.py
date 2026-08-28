"""factory governed AI command center

Revision ID: c8a40d3e6bf7
Revises: b7f39c2d5ae6
Create Date: 2026-08-02

Rollback removes only AI-command-owned records and permissions. Published health,
profit and forecast facts, and every target business-system record, remain intact.
"""

from __future__ import annotations

import json
from alembic import op
import sqlalchemy as sa


revision = "c8a40d3e6bf7"
down_revision = "b7f39c2d5ae6"
branch_labels = None
depends_on = None

PERMISSIONS = (
    "factory.decision.ai-command.query.execute",
    "factory.decision.ai-command.scenario.execute",
    "factory.decision.ai-command.recommendation.manage",
    "factory.decision.ai-command.recommendation.approve",
    "factory.decision.ai-command.handoff.manage",
)

INDEXES = {
    "factory_ai_command_queries": ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", "query_number", "query_reference", "intent", "engine_fingerprint", "classification", "status", "requested_by"),
    "factory_ai_command_citations": ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", "citation_number", "query_id", "query_number", "source_type", "source_id", "source_number", "content_fingerprint"),
    "factory_ai_command_scenarios": ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", "scenario_number", "scenario_reference", "base_forecast_run_id", "base_forecast_run_number", "engine_fingerprint", "status", "calculated_by"),
    "factory_ai_command_recommendations": ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", "recommendation_number", "query_id", "scenario_id", "target_system", "owner", "due_at", "risk_level", "status", "authored_by", "approved_by", "updated_by"),
    "factory_ai_command_handoffs": ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", "handoff_number", "recommendation_id", "recommendation_number", "target_system", "status", "handed_off_by", "closed_by"),
    "factory_ai_command_evidence": ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", "evidence_number", "subject_type", "subject_id", "subject_number", "evidence_type", "recorded_by"),
}


def _tenant_columns():
    return [
        sa.Column("id", sa.String(100), primary_key=True),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("agent_path", sa.String(500), nullable=False),
        sa.Column("tenant_id", sa.String(100), nullable=False),
        sa.Column("client_id", sa.String(100), nullable=False),
        sa.Column("plan_id", sa.String(100), nullable=False),
    ]


def _indexes(table):
    for column in INDEXES[table]:
        op.create_index(f"ix_{table}_{column}", table, [column])


def _update_permissions(*, remove):
    bind = op.get_bind()
    rows = bind.execute(sa.text(
        "SELECT id, permissions_json FROM roles_platform "
        "WHERE is_system = 1 AND scope IN ('client', 'project')"
    )).mappings().all()
    for row in rows:
        try: values = json.loads(row["permissions_json"] or "[]")
        except (TypeError, ValueError): values = []
        if not isinstance(values, list): values = []
        values = ([value for value in values if value not in PERMISSIONS] if remove
                  else list(dict.fromkeys([*values, *PERMISSIONS])))
        bind.execute(sa.text("UPDATE roles_platform SET permissions_json=:p WHERE id=:id"),
                     {"p": json.dumps(values, ensure_ascii=False), "id": row["id"]})


def upgrade():
    op.create_table(
        "factory_ai_command_queries", *_tenant_columns(),
        sa.Column("query_number", sa.String(100), nullable=False),
        sa.Column("query_reference", sa.String(255), nullable=False),
        sa.Column("question", sa.Text(), nullable=False), sa.Column("intent", sa.String(50), nullable=False),
        sa.Column("answer", sa.Text(), nullable=False), sa.Column("confidence", sa.Numeric(7, 4), nullable=False),
        sa.Column("verified_fact_count", sa.Integer(), nullable=False), sa.Column("engine_version", sa.String(50), nullable=False),
        sa.Column("engine_fingerprint", sa.String(64), nullable=False),
        sa.Column("classification", sa.String(60), nullable=False, server_default="governed-decision-assistance"),
        sa.Column("status", sa.String(30), nullable=False, server_default="answered"),
        sa.Column("requested_by", sa.String(255), nullable=False), sa.Column("requested_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"), sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("query_number", name="uq_factory_ai_query_number"),
        sa.UniqueConstraint("tenant_id", "query_reference", name="uq_factory_ai_query_tenant_reference"),
    ); _indexes("factory_ai_command_queries")
    op.create_table(
        "factory_ai_command_citations", *_tenant_columns(),
        sa.Column("citation_number", sa.String(100), nullable=False), sa.Column("query_id", sa.String(100), nullable=False),
        sa.Column("query_number", sa.String(100), nullable=False), sa.Column("source_type", sa.String(60), nullable=False),
        sa.Column("source_id", sa.String(100), nullable=False), sa.Column("source_number", sa.String(100), nullable=False),
        sa.Column("source_revision", sa.Integer(), nullable=False), sa.Column("source_status", sa.String(30), nullable=False),
        sa.Column("observed_at", sa.DateTime(timezone=True), nullable=False), sa.Column("content_fingerprint", sa.String(64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("citation_number", name="uq_factory_ai_citation_number"),
        sa.UniqueConstraint("query_id", "source_type", "source_id", name="uq_factory_ai_query_source"),
    ); _indexes("factory_ai_command_citations")
    op.create_table(
        "factory_ai_command_scenarios", *_tenant_columns(),
        sa.Column("scenario_number", sa.String(100), nullable=False), sa.Column("scenario_reference", sa.String(255), nullable=False),
        sa.Column("name", sa.String(255), nullable=False), sa.Column("base_forecast_run_id", sa.String(100), nullable=False),
        sa.Column("base_forecast_run_number", sa.String(100), nullable=False), sa.Column("base_forecast_revision", sa.Integer(), nullable=False),
        sa.Column("demand_change_percent", sa.Numeric(9, 4), nullable=False), sa.Column("capacity_change_percent", sa.Numeric(9, 4), nullable=False),
        sa.Column("cash_in_change_percent", sa.Numeric(9, 4), nullable=False), sa.Column("cash_out_change_percent", sa.Numeric(9, 4), nullable=False),
        sa.Column("simulated_order_value", sa.Numeric(18, 2), nullable=False), sa.Column("simulated_required_capacity", sa.Numeric(18, 4), nullable=False),
        sa.Column("simulated_available_capacity", sa.Numeric(18, 4), nullable=False), sa.Column("simulated_capacity_gap", sa.Numeric(18, 4), nullable=False),
        sa.Column("simulated_cash_in", sa.Numeric(18, 2), nullable=False), sa.Column("simulated_cash_out", sa.Numeric(18, 2), nullable=False),
        sa.Column("simulated_net_cash", sa.Numeric(18, 2), nullable=False), sa.Column("engine_version", sa.String(50), nullable=False),
        sa.Column("engine_fingerprint", sa.String(64), nullable=False), sa.Column("status", sa.String(30), nullable=False, server_default="calculated"),
        sa.Column("calculated_by", sa.String(255), nullable=False), sa.Column("calculated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"), sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("scenario_number", name="uq_factory_ai_scenario_number"),
        sa.UniqueConstraint("tenant_id", "scenario_reference", name="uq_factory_ai_scenario_tenant_reference"),
    ); _indexes("factory_ai_command_scenarios")
    op.create_table(
        "factory_ai_command_recommendations", *_tenant_columns(),
        sa.Column("recommendation_number", sa.String(100), nullable=False), sa.Column("query_id", sa.String(100), nullable=True),
        sa.Column("scenario_id", sa.String(100), nullable=True), sa.Column("title", sa.String(255), nullable=False),
        sa.Column("rationale", sa.Text(), nullable=False), sa.Column("target_system", sa.String(60), nullable=False),
        sa.Column("owner", sa.String(255), nullable=False), sa.Column("due_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("risk_level", sa.String(20), nullable=False), sa.Column("status", sa.String(30), nullable=False, server_default="pending-approval"),
        sa.Column("authored_by", sa.String(255), nullable=False), sa.Column("approval_reference", sa.String(500), nullable=True),
        sa.Column("approved_by", sa.String(255), nullable=True), sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"), sa.Column("updated_by", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True), sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("recommendation_number", name="uq_factory_ai_recommendation_number"),
    ); _indexes("factory_ai_command_recommendations")
    op.create_table(
        "factory_ai_command_handoffs", *_tenant_columns(),
        sa.Column("handoff_number", sa.String(100), nullable=False), sa.Column("recommendation_id", sa.String(100), nullable=False),
        sa.Column("recommendation_number", sa.String(100), nullable=False), sa.Column("target_system", sa.String(60), nullable=False),
        sa.Column("handoff_reference", sa.String(500), nullable=False), sa.Column("execution_reference", sa.String(500), nullable=True),
        sa.Column("status", sa.String(30), nullable=False, server_default="handed-off"), sa.Column("handed_off_by", sa.String(255), nullable=False),
        sa.Column("handed_off_at", sa.DateTime(timezone=True), nullable=False), sa.Column("closed_by", sa.String(255), nullable=True),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True), sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("handoff_number", name="uq_factory_ai_handoff_number"),
        sa.UniqueConstraint("recommendation_id", name="uq_factory_ai_recommendation_handoff"),
    ); _indexes("factory_ai_command_handoffs")
    op.create_table(
        "factory_ai_command_evidence", *_tenant_columns(),
        sa.Column("evidence_number", sa.String(100), nullable=False), sa.Column("subject_type", sa.String(40), nullable=False),
        sa.Column("subject_id", sa.String(100), nullable=False), sa.Column("subject_number", sa.String(100), nullable=False),
        sa.Column("evidence_type", sa.String(50), nullable=False), sa.Column("evidence_reference", sa.String(500), nullable=False),
        sa.Column("note", sa.Text(), nullable=False), sa.Column("recorded_by", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("evidence_number", name="uq_factory_ai_evidence_number"),
    ); _indexes("factory_ai_command_evidence")
    _update_permissions(remove=False)


def downgrade():
    _update_permissions(remove=True)
    for table in reversed(tuple(INDEXES)):
        for column in reversed(INDEXES[table]):
            op.drop_index(f"ix_{table}_{column}", table_name=table)
        op.drop_table(table)
