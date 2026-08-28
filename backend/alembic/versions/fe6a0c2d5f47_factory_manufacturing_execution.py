"""add tenant-scoped manufacturing execution

Revision ID: fe6a0c2d5f47
Revises: fd5f9b1c4e36

Rollback removes only MES work orders, operation reports, downtime evidence and
MES permission grants. It never deletes production plans, orders, engineering
BOMs, purchase receipts, QMS records, product passports, invoices or payments.
"""

import json

from alembic import op
import sqlalchemy as sa


revision = "fe6a0c2d5f47"
down_revision = "fd5f9b1c4e36"
branch_labels = None
depends_on = None

PERMISSIONS = (
    "factory.fulfillment.mes.manage",
    "factory.fulfillment.mes.operate",
    "factory.fulfillment.mes.supervise",
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


WORK_ORDER_INDEXES = (
    "project_id", "agent_path", "tenant_id", "client_id", "plan_id", "work_order_number",
    "production_plan_id", "production_plan_number", "work_order_intent_reference", "demand_order_id",
    "demand_order_number", "engineering_version_id", "engineering_number", "product_reference",
    "sku_reference", "resource_id", "resource_number", "batch_reference", "lifecycle_status",
    "current_operation_code", "updated_by",
)
OPERATION_INDEXES = (
    "project_id", "agent_path", "tenant_id", "client_id", "plan_id", "work_order_id",
    "work_order_number", "operation_sequence", "operation_code", "work_center_reference",
    "lifecycle_status", "operator_reference", "updated_by",
)
DOWNTIME_INDEXES = (
    "project_id", "agent_path", "tenant_id", "client_id", "plan_id", "downtime_number",
    "work_order_id", "work_order_number", "operation_id", "operation_code", "reason_code",
    "lifecycle_status", "updated_by",
)


def upgrade() -> None:
    op.create_table(
        "factory_manufacturing_work_orders",
        sa.Column("id", sa.String(length=100), primary_key=True),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("agent_path", sa.String(length=500), nullable=False),
        sa.Column("tenant_id", sa.String(length=100), nullable=False),
        sa.Column("client_id", sa.String(length=100), nullable=False),
        sa.Column("plan_id", sa.String(length=100), nullable=False),
        sa.Column("work_order_number", sa.String(length=100), nullable=False),
        sa.Column("production_plan_id", sa.String(length=100), nullable=False),
        sa.Column("production_plan_number", sa.String(length=100), nullable=False),
        sa.Column("work_order_intent_reference", sa.String(length=255), nullable=False),
        sa.Column("demand_order_id", sa.String(length=100), nullable=False),
        sa.Column("demand_order_number", sa.String(length=100), nullable=False),
        sa.Column("engineering_version_id", sa.String(length=100), nullable=False),
        sa.Column("engineering_number", sa.String(length=100), nullable=False),
        sa.Column("product_reference", sa.String(length=255), nullable=False),
        sa.Column("sku_reference", sa.String(length=255), nullable=False),
        sa.Column("resource_id", sa.String(length=100), nullable=False),
        sa.Column("resource_number", sa.String(length=100), nullable=False),
        sa.Column("batch_reference", sa.String(length=255), nullable=False),
        sa.Column("target_quantity", sa.Numeric(18, 4), nullable=False),
        sa.Column("completed_quantity", sa.Numeric(18, 4), nullable=False, server_default="0"),
        sa.Column("scrap_quantity", sa.Numeric(18, 4), nullable=False, server_default="0"),
        sa.Column("material_lots_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("lifecycle_status", sa.String(length=40), nullable=False, server_default="draft"),
        sa.Column("current_operation_code", sa.String(length=100), nullable=True),
        sa.Column("release_reference", sa.String(length=255), nullable=True),
        sa.Column("completion_reference", sa.String(length=255), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("milestones_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("updated_by", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("work_order_number", name="uq_factory_mes_work_order_number"),
        sa.UniqueConstraint("work_order_intent_reference", name="uq_factory_mes_work_order_intent"),
        sa.UniqueConstraint("tenant_id", "production_plan_id", name="uq_factory_mes_tenant_production_plan"),
        sa.UniqueConstraint("tenant_id", "batch_reference", name="uq_factory_mes_tenant_batch"),
    )
    for column in WORK_ORDER_INDEXES:
        op.create_index(f"ix_factory_manufacturing_work_orders_{column}", "factory_manufacturing_work_orders", [column])

    op.create_table(
        "factory_manufacturing_operations",
        sa.Column("id", sa.String(length=100), primary_key=True),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("agent_path", sa.String(length=500), nullable=False),
        sa.Column("tenant_id", sa.String(length=100), nullable=False),
        sa.Column("client_id", sa.String(length=100), nullable=False),
        sa.Column("plan_id", sa.String(length=100), nullable=False),
        sa.Column("work_order_id", sa.String(length=100), nullable=False),
        sa.Column("work_order_number", sa.String(length=100), nullable=False),
        sa.Column("operation_sequence", sa.Integer(), nullable=False),
        sa.Column("operation_code", sa.String(length=100), nullable=False),
        sa.Column("operation_name", sa.String(length=500), nullable=False),
        sa.Column("work_center_reference", sa.String(length=255), nullable=False),
        sa.Column("input_quantity", sa.Numeric(18, 4), nullable=False, server_default="0"),
        sa.Column("good_quantity", sa.Numeric(18, 4), nullable=False, server_default="0"),
        sa.Column("scrap_quantity", sa.Numeric(18, 4), nullable=False, server_default="0"),
        sa.Column("lifecycle_status", sa.String(length=40), nullable=False, server_default="pending"),
        sa.Column("operator_reference", sa.String(length=255), nullable=True),
        sa.Column("start_evidence_reference", sa.String(length=500), nullable=True),
        sa.Column("completion_evidence_reference", sa.String(length=500), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("updated_by", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("work_order_id", "operation_sequence", name="uq_factory_mes_work_order_operation_sequence"),
        sa.UniqueConstraint("work_order_id", "operation_code", name="uq_factory_mes_work_order_operation_code"),
    )
    for column in OPERATION_INDEXES:
        op.create_index(f"ix_factory_manufacturing_operations_{column}", "factory_manufacturing_operations", [column])

    op.create_table(
        "factory_manufacturing_downtimes",
        sa.Column("id", sa.String(length=100), primary_key=True),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("agent_path", sa.String(length=500), nullable=False),
        sa.Column("tenant_id", sa.String(length=100), nullable=False),
        sa.Column("client_id", sa.String(length=100), nullable=False),
        sa.Column("plan_id", sa.String(length=100), nullable=False),
        sa.Column("downtime_number", sa.String(length=100), nullable=False),
        sa.Column("work_order_id", sa.String(length=100), nullable=False),
        sa.Column("work_order_number", sa.String(length=100), nullable=False),
        sa.Column("operation_id", sa.String(length=100), nullable=False),
        sa.Column("operation_code", sa.String(length=100), nullable=False),
        sa.Column("reason_code", sa.String(length=100), nullable=False),
        sa.Column("reason_note", sa.Text(), nullable=False),
        sa.Column("lifecycle_status", sa.String(length=30), nullable=False, server_default="open"),
        sa.Column("resolution_note", sa.Text(), nullable=True),
        sa.Column("resolution_evidence_reference", sa.String(length=500), nullable=True),
        sa.Column("duration_minutes", sa.Integer(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("updated_by", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("downtime_number", name="uq_factory_mes_downtime_number"),
    )
    for column in DOWNTIME_INDEXES:
        op.create_index(f"ix_factory_manufacturing_downtimes_{column}", "factory_manufacturing_downtimes", [column])
    _update_permissions(remove=False)


def downgrade() -> None:
    _update_permissions(remove=True)
    for column in reversed(DOWNTIME_INDEXES):
        op.drop_index(f"ix_factory_manufacturing_downtimes_{column}", table_name="factory_manufacturing_downtimes")
    op.drop_table("factory_manufacturing_downtimes")
    for column in reversed(OPERATION_INDEXES):
        op.drop_index(f"ix_factory_manufacturing_operations_{column}", table_name="factory_manufacturing_operations")
    op.drop_table("factory_manufacturing_operations")
    for column in reversed(WORK_ORDER_INDEXES):
        op.drop_index(f"ix_factory_manufacturing_work_orders_{column}", table_name="factory_manufacturing_work_orders")
    op.drop_table("factory_manufacturing_work_orders")
