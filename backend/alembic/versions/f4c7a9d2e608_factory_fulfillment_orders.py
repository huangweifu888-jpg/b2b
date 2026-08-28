"""add authoritative fulfillment orders and role permissions

Revision ID: f4c7a9d2e608
Revises: f0b3d6a9c427

Rollback removes only the fulfillment adapter's orders, validation snapshots,
milestone evidence and emitted-event copies. It never deletes CPQ quotes,
product facts, external OMS/ERP records, invoices or payments.
"""

import json

from alembic import op
import sqlalchemy as sa


revision = "f4c7a9d2e608"
down_revision = "f0b3d6a9c427"
branch_labels = None
depends_on = None

PERMISSIONS = (
    "factory.fulfillment.order.register",
    "factory.fulfillment.order.confirm",
    "factory.fulfillment.delivery.manage",
)


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
        if remove:
            values = [value for value in values if value not in PERMISSIONS]
        else:
            values = list(dict.fromkeys([*values, *PERMISSIONS]))
        bind.execute(sa.text("UPDATE roles_platform SET permissions_json = :permissions WHERE id = :id"), {"permissions": json.dumps(values, ensure_ascii=False), "id": row["id"]})


def upgrade() -> None:
    op.create_table(
        "factory_fulfillment_orders",
        sa.Column("id", sa.String(length=100), primary_key=True),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("agent_path", sa.String(length=500), nullable=False),
        sa.Column("tenant_id", sa.String(length=100), nullable=False),
        sa.Column("client_id", sa.String(length=100), nullable=False),
        sa.Column("plan_id", sa.String(length=100), nullable=False),
        sa.Column("order_number", sa.String(length=100), nullable=False),
        sa.Column("quote_id", sa.String(length=100), nullable=False),
        sa.Column("quote_number", sa.String(length=100), nullable=False),
        sa.Column("order_intent_id", sa.String(length=100), nullable=False),
        sa.Column("account_reference", sa.String(length=255), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("exchange_rate", sa.Numeric(18, 6), nullable=False),
        sa.Column("lines_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("order_total", sa.Numeric(18, 2), nullable=False),
        sa.Column("status", sa.String(length=40), nullable=False, server_default="pending-validation"),
        sa.Column("authority_source", sa.String(length=50), nullable=False, server_default="factory-oms"),
        sa.Column("validation_json", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("fulfillment_evidence_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("emitted_events_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("confirmed_by", sa.String(length=255), nullable=True),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("updated_by", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("order_number", name="uq_factory_fulfillment_order_number"),
        sa.UniqueConstraint("quote_id", name="uq_factory_fulfillment_quote_id"),
        sa.UniqueConstraint("order_intent_id", name="uq_factory_fulfillment_order_intent_id"),
    )
    for column in ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", "order_number", "quote_id", "quote_number", "order_intent_id", "account_reference", "status", "authority_source", "confirmed_by", "updated_by"):
        op.create_index(f"ix_factory_fulfillment_orders_{column}", "factory_fulfillment_orders", [column])
    _update_permissions(remove=False)


def downgrade() -> None:
    _update_permissions(remove=True)
    for column in ("updated_by", "confirmed_by", "authority_source", "status", "account_reference", "order_intent_id", "quote_number", "quote_id", "order_number", "plan_id", "client_id", "tenant_id", "agent_path", "project_id"):
        op.drop_index(f"ix_factory_fulfillment_orders_{column}", table_name="factory_fulfillment_orders")
    op.drop_table("factory_fulfillment_orders")
