"""add tenant scoped governed CPQ quotes

Revision ID: f0b3d6a9c427
Revises: e9a2c5f8b316

Rollback removes only CPQ quote drafts, approvals, event evidence and order
intents. It never deletes products, confirmed orders, invoices or payments.
"""

from alembic import op
import sqlalchemy as sa


revision = "f0b3d6a9c427"
down_revision = "e9a2c5f8b316"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "factory_cpq_quotes",
        sa.Column("id", sa.String(length=100), primary_key=True),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("agent_path", sa.String(length=500), nullable=False),
        sa.Column("tenant_id", sa.String(length=100), nullable=False),
        sa.Column("client_id", sa.String(length=100), nullable=False),
        sa.Column("plan_id", sa.String(length=100), nullable=False),
        sa.Column("quote_number", sa.String(length=100), nullable=False),
        sa.Column("account_reference", sa.String(length=255), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False, server_default="USD"),
        sa.Column("exchange_rate", sa.Numeric(18, 6), nullable=False, server_default="1"),
        sa.Column("valid_until", sa.DateTime(timezone=True), nullable=False),
        sa.Column("lines_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("subtotal", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("cost_total", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("gross_margin_percent", sa.Numeric(9, 4), nullable=False, server_default="0"),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="draft"),
        sa.Column("approval_note", sa.Text(), nullable=True),
        sa.Column("order_intent_id", sa.String(length=100), nullable=True),
        sa.Column("emitted_events_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("updated_by", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("quote_number", name="uq_factory_cpq_quote_number"),
        sa.UniqueConstraint("order_intent_id", name="uq_factory_cpq_order_intent_id"),
    )
    for column in ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", "quote_number", "account_reference", "valid_until", "status", "order_intent_id", "updated_by"):
        op.create_index(f"ix_factory_cpq_quotes_{column}", "factory_cpq_quotes", [column])


def downgrade() -> None:
    for column in ("updated_by", "order_intent_id", "status", "valid_until", "account_reference", "quote_number", "plan_id", "client_id", "tenant_id", "agent_path", "project_id"):
        op.drop_index(f"ix_factory_cpq_quotes_{column}", table_name="factory_cpq_quotes")
    op.drop_table("factory_cpq_quotes")
