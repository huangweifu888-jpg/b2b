"""add supplier qualification and purchase-order control

Revision ID: fc4e8a0b3d25
Revises: fb3d7e9a2c14

Rollback removes only SRM supplier profiles, purchase-control copies, milestone
evidence references and procurement permission grants. It never deletes source
engineering versions, BOMs, demand orders, inventory receipts, QMS inspections,
supplier source documents, invoices or payments.
"""

import json

from alembic import op
import sqlalchemy as sa


revision = "fc4e8a0b3d25"
down_revision = "fb3d7e9a2c14"
branch_labels = None
depends_on = None

PERMISSIONS = (
    "factory.fulfillment.supplier.manage",
    "factory.fulfillment.purchase.manage",
    "factory.fulfillment.purchase.approve",
    "factory.fulfillment.receiving.record",
)


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
        values = [value for value in values if value not in PERMISSIONS] if remove else list(dict.fromkeys([*values, *PERMISSIONS]))
        bind.execute(sa.text("UPDATE roles_platform SET permissions_json = :permissions WHERE id = :id"), {
            "permissions": json.dumps(values, ensure_ascii=False), "id": row["id"],
        })


def upgrade() -> None:
    op.create_table(
        "factory_suppliers",
        sa.Column("id", sa.String(length=100), primary_key=True),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("agent_path", sa.String(length=500), nullable=False),
        sa.Column("tenant_id", sa.String(length=100), nullable=False),
        sa.Column("client_id", sa.String(length=100), nullable=False),
        sa.Column("plan_id", sa.String(length=100), nullable=False),
        sa.Column("supplier_number", sa.String(length=100), nullable=False),
        sa.Column("supplier_reference", sa.String(length=255), nullable=False),
        sa.Column("legal_name", sa.String(length=500), nullable=False),
        sa.Column("country_code", sa.String(length=2), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("standard_lead_time_days", sa.Integer(), nullable=False),
        sa.Column("qualified_materials_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("qualification_evidence_reference", sa.String(length=500), nullable=False),
        sa.Column("risk_level", sa.String(length=20), nullable=False, server_default="medium"),
        sa.Column("lifecycle_status", sa.String(length=30), nullable=False, server_default="draft"),
        sa.Column("approval_reference", sa.String(length=255), nullable=True),
        sa.Column("approval_note", sa.Text(), nullable=True),
        sa.Column("approved_by", sa.String(length=255), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("updated_by", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("supplier_number", name="uq_factory_supplier_number"),
        sa.UniqueConstraint("tenant_id", "supplier_reference", name="uq_factory_supplier_tenant_reference"),
    )
    for column in (
        "project_id", "agent_path", "tenant_id", "client_id", "plan_id", "supplier_number",
        "supplier_reference", "legal_name", "country_code", "risk_level", "lifecycle_status", "approved_by", "updated_by",
    ):
        op.create_index(f"ix_factory_suppliers_{column}", "factory_suppliers", [column])

    op.create_table(
        "factory_purchase_orders",
        sa.Column("id", sa.String(length=100), primary_key=True),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("agent_path", sa.String(length=500), nullable=False),
        sa.Column("tenant_id", sa.String(length=100), nullable=False),
        sa.Column("client_id", sa.String(length=100), nullable=False),
        sa.Column("plan_id", sa.String(length=100), nullable=False),
        sa.Column("purchase_order_number", sa.String(length=100), nullable=False),
        sa.Column("supplier_id", sa.String(length=100), nullable=False),
        sa.Column("supplier_number", sa.String(length=100), nullable=False),
        sa.Column("supplier_reference", sa.String(length=255), nullable=False),
        sa.Column("demand_order_id", sa.String(length=100), nullable=False),
        sa.Column("demand_order_number", sa.String(length=100), nullable=False),
        sa.Column("engineering_version_id", sa.String(length=100), nullable=False),
        sa.Column("engineering_number", sa.String(length=100), nullable=False),
        sa.Column("product_reference", sa.String(length=255), nullable=False),
        sa.Column("sku_reference", sa.String(length=255), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("lines_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("subtotal", sa.Numeric(18, 2), nullable=False),
        sa.Column("needed_by", sa.DateTime(timezone=True), nullable=False),
        sa.Column("lifecycle_status", sa.String(length=30), nullable=False, server_default="draft"),
        sa.Column("review_note", sa.Text(), nullable=True),
        sa.Column("approval_reference", sa.String(length=255), nullable=True),
        sa.Column("issue_document_reference", sa.String(length=500), nullable=True),
        sa.Column("acknowledgement_reference", sa.String(length=500), nullable=True),
        sa.Column("promised_delivery_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("receiving_reference", sa.String(length=500), nullable=True),
        sa.Column("received_quantities_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("milestones_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("updated_by", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("purchase_order_number", name="uq_factory_purchase_order_number"),
    )
    for column in (
        "project_id", "agent_path", "tenant_id", "client_id", "plan_id", "purchase_order_number",
        "supplier_id", "supplier_number", "supplier_reference", "demand_order_id", "demand_order_number",
        "engineering_version_id", "engineering_number", "product_reference", "sku_reference", "needed_by",
        "lifecycle_status", "promised_delivery_at", "updated_by",
    ):
        op.create_index(f"ix_factory_purchase_orders_{column}", "factory_purchase_orders", [column])
    _update_permissions(remove=False)


def downgrade() -> None:
    _update_permissions(remove=True)
    for column in (
        "updated_by", "promised_delivery_at", "lifecycle_status", "needed_by", "sku_reference", "product_reference",
        "engineering_number", "engineering_version_id", "demand_order_number", "demand_order_id", "supplier_reference",
        "supplier_number", "supplier_id", "purchase_order_number", "plan_id", "client_id", "tenant_id", "agent_path", "project_id",
    ):
        op.drop_index(f"ix_factory_purchase_orders_{column}", table_name="factory_purchase_orders")
    op.drop_table("factory_purchase_orders")
    for column in (
        "updated_by", "approved_by", "lifecycle_status", "risk_level", "country_code", "legal_name", "supplier_reference",
        "supplier_number", "plan_id", "client_id", "tenant_id", "agent_path", "project_id",
    ):
        op.drop_index(f"ix_factory_suppliers_{column}", table_name="factory_suppliers")
    op.drop_table("factory_suppliers")
