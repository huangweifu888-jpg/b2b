"""add tenant scoped factory revenue golden flow

Revision ID: b3d5f7a9c124
Revises: a2c4e6f8b013

Rollback removes only pilot flow traces. Source inquiries, quotes, orders,
invoices and payments owned by their business systems remain untouched.
"""

from alembic import op
import sqlalchemy as sa


revision = "b3d5f7a9c124"
down_revision = "a2c4e6f8b013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "factory_revenue_flow_runs",
        sa.Column("id", sa.String(length=100), primary_key=True),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("agent_path", sa.String(length=500), nullable=False),
        sa.Column("tenant_id", sa.String(length=100), nullable=False),
        sa.Column("client_id", sa.String(length=100), nullable=False),
        sa.Column("plan_id", sa.String(length=100), nullable=False),
        sa.Column("correlation_id", sa.String(length=100), nullable=False),
        sa.Column("product_reference", sa.String(length=255), nullable=False),
        sa.Column("account_reference", sa.String(length=255), nullable=False),
        sa.Column("currency", sa.String(length=10), nullable=False, server_default="USD"),
        sa.Column("quoted_amount", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("ordered_amount", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("invoiced_amount", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("paid_amount", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("current_stage", sa.String(length=50), nullable=False, server_default="product-selected"),
        sa.Column("emitted_events_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("updated_by", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("correlation_id", name="uq_factory_revenue_flow_correlation_id"),
    )
    for column in ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", "correlation_id", "current_stage", "updated_by"):
        op.create_index(f"ix_factory_revenue_flow_runs_{column}", "factory_revenue_flow_runs", [column])


def downgrade() -> None:
    for column in ("updated_by", "current_stage", "correlation_id", "plan_id", "client_id", "tenant_id", "agent_path", "project_id"):
        op.drop_index(f"ix_factory_revenue_flow_runs_{column}", table_name="factory_revenue_flow_runs")
    op.drop_table("factory_revenue_flow_runs")
