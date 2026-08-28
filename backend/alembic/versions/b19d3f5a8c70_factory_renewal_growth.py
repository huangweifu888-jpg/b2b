"""add tenant-scoped renewal growth opportunities

Revision ID: b19d3f5a8c70
Revises: a08c2e4f7b69

Rollback removes only renewal opportunity snapshots, append-only evidence and
five permission grants. It never deletes or changes customer assets, service
tickets, RMA cases, CPQ quotes, orders, inventory, invoices or payments.
"""

import json

from alembic import op
import sqlalchemy as sa


revision = "b19d3f5a8c70"
down_revision = "a08c2e4f7b69"
branch_labels = None
depends_on = None

PERMISSIONS = (
    "factory.care.renewal-growth.manage",
    "factory.care.renewal-growth.assess",
    "factory.care.renewal-growth.approve",
    "factory.care.renewal-growth.handoff",
    "factory.care.renewal-growth.confirm",
)

OPPORTUNITY_INDEXES = (
    "project_id", "agent_path", "tenant_id", "client_id", "plan_id",
    "opportunity_number", "opportunity_reference", "asset_id", "asset_number",
    "original_order_id", "original_order_number", "account_reference",
    "current_product_reference", "current_sku_reference", "serial_number",
    "warranty_until", "health_score", "risk_level", "lifecycle_status", "motion",
    "owner", "next_action_at", "recommended_product_reference",
    "recommended_sku_reference", "approved_by", "quote_id", "quote_number",
    "order_id", "order_number", "closed_by", "updated_by",
)
EVIDENCE_INDEXES = (
    "project_id", "agent_path", "tenant_id", "client_id", "plan_id",
    "evidence_number", "opportunity_id", "opportunity_number", "evidence_type",
    "recorded_by",
)


def _update_permissions(*, remove: bool) -> None:
    bind = op.get_bind()
    rows = bind.execute(sa.text(
        "SELECT id, permissions_json FROM roles_platform WHERE is_system = 1 AND scope IN ('client', 'project')"
    )).mappings().all()
    for row in rows:
        try:
            values = json.loads(row["permissions_json"] or "[]")
        except (TypeError, ValueError):
            values = []
        if not isinstance(values, list):
            values = []
        values = [value for value in values if value not in PERMISSIONS] if remove else list(dict.fromkeys([*values, *PERMISSIONS]))
        bind.execute(sa.text("UPDATE roles_platform SET permissions_json = :permissions WHERE id = :id"), {
            "permissions": json.dumps(values, ensure_ascii=False), "id": row["id"],
        })


def upgrade() -> None:
    op.create_table(
        "factory_renewal_growth_opportunities",
        sa.Column("id", sa.String(length=100), primary_key=True),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("agent_path", sa.String(length=500), nullable=False),
        sa.Column("tenant_id", sa.String(length=100), nullable=False),
        sa.Column("client_id", sa.String(length=100), nullable=False),
        sa.Column("plan_id", sa.String(length=100), nullable=False),
        sa.Column("opportunity_number", sa.String(length=100), nullable=False),
        sa.Column("opportunity_reference", sa.String(length=255), nullable=False),
        sa.Column("asset_id", sa.String(length=100), nullable=False),
        sa.Column("asset_number", sa.String(length=100), nullable=False),
        sa.Column("original_order_id", sa.String(length=100), nullable=False),
        sa.Column("original_order_number", sa.String(length=100), nullable=False),
        sa.Column("account_reference", sa.String(length=255), nullable=False),
        sa.Column("current_product_reference", sa.String(length=255), nullable=False),
        sa.Column("current_sku_reference", sa.String(length=255), nullable=False),
        sa.Column("serial_number", sa.String(length=255), nullable=False),
        sa.Column("warranty_until", sa.DateTime(timezone=True), nullable=False),
        sa.Column("service_count_snapshot", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("resolved_service_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("closed_rma_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("manufacturer_fault_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("health_score", sa.Integer(), nullable=True),
        sa.Column("risk_level", sa.String(length=20), nullable=True),
        sa.Column("source_snapshot_json", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("lifecycle_status", sa.String(length=40), nullable=False, server_default="draft"),
        sa.Column("motion", sa.String(length=30), nullable=True),
        sa.Column("owner", sa.String(length=255), nullable=False),
        sa.Column("next_action_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("value_evidence_reference", sa.String(length=500), nullable=True),
        sa.Column("customer_goal", sa.Text(), nullable=True),
        sa.Column("customer_confirmation_reference", sa.String(length=500), nullable=True),
        sa.Column("recommendation_reference", sa.String(length=500), nullable=True),
        sa.Column("recommended_product_reference", sa.String(length=255), nullable=True),
        sa.Column("recommended_sku_reference", sa.String(length=255), nullable=True),
        sa.Column("recommended_quantity", sa.Numeric(18, 4), nullable=True),
        sa.Column("currency", sa.String(length=3), nullable=True),
        sa.Column("estimated_unit_price", sa.Numeric(18, 2), nullable=True),
        sa.Column("estimated_unit_cost", sa.Numeric(18, 2), nullable=True),
        sa.Column("estimated_value", sa.Numeric(18, 2), nullable=True),
        sa.Column("estimated_margin_percent", sa.Numeric(9, 4), nullable=True),
        sa.Column("recommendation_rationale", sa.Text(), nullable=True),
        sa.Column("approval_reference", sa.String(length=500), nullable=True),
        sa.Column("approved_by", sa.String(length=255), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cpq_handoff_reference", sa.String(length=500), nullable=True),
        sa.Column("cpq_handoff_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("quote_id", sa.String(length=100), nullable=True),
        sa.Column("quote_number", sa.String(length=100), nullable=True),
        sa.Column("quote_value", sa.Numeric(18, 2), nullable=True),
        sa.Column("quote_accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("order_id", sa.String(length=100), nullable=True),
        sa.Column("order_number", sa.String(length=100), nullable=True),
        sa.Column("actual_value", sa.Numeric(18, 2), nullable=True),
        sa.Column("won_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("loss_reason", sa.Text(), nullable=True),
        sa.Column("closed_by", sa.String(length=255), nullable=True),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("milestones_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("updated_by", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("opportunity_number", name="uq_factory_renewal_opportunity_number"),
        sa.UniqueConstraint("tenant_id", "opportunity_reference", name="uq_factory_renewal_tenant_reference"),
        sa.UniqueConstraint("tenant_id", "quote_id", name="uq_factory_renewal_tenant_quote"),
        sa.UniqueConstraint("tenant_id", "order_id", name="uq_factory_renewal_tenant_order"),
    )
    for column in OPPORTUNITY_INDEXES:
        op.create_index(f"ix_factory_renewal_growth_opportunities_{column}", "factory_renewal_growth_opportunities", [column])

    op.create_table(
        "factory_renewal_growth_evidence",
        sa.Column("id", sa.String(length=100), primary_key=True),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("agent_path", sa.String(length=500), nullable=False),
        sa.Column("tenant_id", sa.String(length=100), nullable=False),
        sa.Column("client_id", sa.String(length=100), nullable=False),
        sa.Column("plan_id", sa.String(length=100), nullable=False),
        sa.Column("evidence_number", sa.String(length=100), nullable=False),
        sa.Column("opportunity_id", sa.String(length=100), nullable=False),
        sa.Column("opportunity_number", sa.String(length=100), nullable=False),
        sa.Column("evidence_type", sa.String(length=50), nullable=False),
        sa.Column("evidence_reference", sa.String(length=500), nullable=False),
        sa.Column("note", sa.Text(), nullable=False),
        sa.Column("recorded_by", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("evidence_number", name="uq_factory_renewal_growth_evidence_number"),
    )
    for column in EVIDENCE_INDEXES:
        op.create_index(f"ix_factory_renewal_growth_evidence_{column}", "factory_renewal_growth_evidence", [column])
    _update_permissions(remove=False)


def downgrade() -> None:
    _update_permissions(remove=True)
    for column in reversed(EVIDENCE_INDEXES):
        op.drop_index(f"ix_factory_renewal_growth_evidence_{column}", table_name="factory_renewal_growth_evidence")
    op.drop_table("factory_renewal_growth_evidence")
    for column in reversed(OPPORTUNITY_INDEXES):
        op.drop_index(f"ix_factory_renewal_growth_opportunities_{column}", table_name="factory_renewal_growth_opportunities")
    op.drop_table("factory_renewal_growth_opportunities")
