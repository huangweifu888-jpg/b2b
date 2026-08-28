"""add customer assets, service tickets and care permissions

Revision ID: f8d1c4a7b902
Revises: f4c7a9d2e608

Rollback removes only customer-asset registrations, service tickets, renewal
signals and their event copies. It never deletes orders, product facts,
external service records, invoices, payments or customer identities.
"""

import json

from alembic import op
import sqlalchemy as sa


revision = "f8d1c4a7b902"
down_revision = "f4c7a9d2e608"
branch_labels = None
depends_on = None

PERMISSIONS = (
    "factory.care.asset.register",
    "factory.care.service.manage",
    "factory.care.renewal.manage",
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
        values = [value for value in values if value not in PERMISSIONS] if remove else list(dict.fromkeys([*values, *PERMISSIONS]))
        bind.execute(sa.text("UPDATE roles_platform SET permissions_json = :permissions WHERE id = :id"), {"permissions": json.dumps(values, ensure_ascii=False), "id": row["id"]})


def upgrade() -> None:
    op.create_table(
        "factory_customer_assets",
        sa.Column("id", sa.String(length=100), primary_key=True),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("agent_path", sa.String(length=500), nullable=False),
        sa.Column("tenant_id", sa.String(length=100), nullable=False),
        sa.Column("client_id", sa.String(length=100), nullable=False),
        sa.Column("plan_id", sa.String(length=100), nullable=False),
        sa.Column("asset_number", sa.String(length=100), nullable=False),
        sa.Column("order_id", sa.String(length=100), nullable=False),
        sa.Column("order_number", sa.String(length=100), nullable=False),
        sa.Column("account_reference", sa.String(length=255), nullable=False),
        sa.Column("product_reference", sa.String(length=255), nullable=False),
        sa.Column("sku_reference", sa.String(length=255), nullable=False),
        sa.Column("serial_number", sa.String(length=255), nullable=False),
        sa.Column("installation_location", sa.String(length=500), nullable=False),
        sa.Column("installed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("warranty_until", sa.DateTime(timezone=True), nullable=False),
        sa.Column("next_service_due_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(length=40), nullable=False, server_default="active"),
        sa.Column("renewal_status", sa.String(length=40), nullable=False, server_default="monitoring"),
        sa.Column("renewal_owner", sa.String(length=255), nullable=True),
        sa.Column("renewal_action", sa.Text(), nullable=True),
        sa.Column("service_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_service_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("emitted_events_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("updated_by", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("asset_number", name="uq_factory_customer_asset_number"),
        sa.UniqueConstraint("tenant_id", "serial_number", name="uq_factory_customer_asset_tenant_serial"),
    )
    for column in ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", "asset_number", "order_id", "order_number", "account_reference", "product_reference", "sku_reference", "serial_number", "installed_at", "warranty_until", "next_service_due_at", "status", "renewal_status", "renewal_owner", "updated_by"):
        op.create_index(f"ix_factory_customer_assets_{column}", "factory_customer_assets", [column])

    op.create_table(
        "factory_asset_service_tickets",
        sa.Column("id", sa.String(length=100), primary_key=True),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("agent_path", sa.String(length=500), nullable=False),
        sa.Column("tenant_id", sa.String(length=100), nullable=False),
        sa.Column("client_id", sa.String(length=100), nullable=False),
        sa.Column("plan_id", sa.String(length=100), nullable=False),
        sa.Column("ticket_number", sa.String(length=100), nullable=False),
        sa.Column("asset_id", sa.String(length=100), nullable=False),
        sa.Column("asset_number", sa.String(length=100), nullable=False),
        sa.Column("issue_summary", sa.String(length=1000), nullable=False),
        sa.Column("severity", sa.String(length=20), nullable=False),
        sa.Column("status", sa.String(length=40), nullable=False, server_default="open"),
        sa.Column("sla_due_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("assigned_to", sa.String(length=255), nullable=True),
        sa.Column("scheduled_for", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolution_reference", sa.String(length=255), nullable=True),
        sa.Column("resolution_note", sa.Text(), nullable=True),
        sa.Column("emitted_events_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("updated_by", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("ticket_number", name="uq_factory_asset_service_ticket_number"),
    )
    for column in ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", "ticket_number", "asset_id", "asset_number", "severity", "status", "sla_due_at", "assigned_to", "updated_by"):
        op.create_index(f"ix_factory_asset_service_tickets_{column}", "factory_asset_service_tickets", [column])
    _update_permissions(remove=False)


def downgrade() -> None:
    _update_permissions(remove=True)
    for column in ("updated_by", "assigned_to", "sla_due_at", "status", "severity", "asset_number", "asset_id", "ticket_number", "plan_id", "client_id", "tenant_id", "agent_path", "project_id"):
        op.drop_index(f"ix_factory_asset_service_tickets_{column}", table_name="factory_asset_service_tickets")
    op.drop_table("factory_asset_service_tickets")
    for column in ("updated_by", "renewal_owner", "renewal_status", "status", "next_service_due_at", "warranty_until", "installed_at", "serial_number", "sku_reference", "product_reference", "account_reference", "order_number", "order_id", "asset_number", "plan_id", "client_id", "tenant_id", "agent_path", "project_id"):
        op.drop_index(f"ix_factory_customer_assets_{column}", table_name="factory_customer_assets")
    op.drop_table("factory_customer_assets")
