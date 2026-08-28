"""add finite-capacity production planning

Revision ID: fd5f9b1c4e36
Revises: fc4e8a0b3d25

Rollback removes only planning-resource snapshots, production plans, computed
MRP copies, milestone evidence and planning permission grants. It never deletes
orders, engineering BOMs, purchase orders, inventory receipts, work orders,
QMS records, invoices or payments.
"""

import json

from alembic import op
import sqlalchemy as sa


revision = "fd5f9b1c4e36"
down_revision = "fc4e8a0b3d25"
branch_labels = None
depends_on = None

PERMISSIONS = (
    "factory.fulfillment.capacity.manage",
    "factory.fulfillment.planning.manage",
    "factory.fulfillment.planning.approve",
    "factory.fulfillment.planning.release",
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
        "factory_planning_resources",
        sa.Column("id", sa.String(length=100), primary_key=True),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("agent_path", sa.String(length=500), nullable=False),
        sa.Column("tenant_id", sa.String(length=100), nullable=False),
        sa.Column("client_id", sa.String(length=100), nullable=False),
        sa.Column("plan_id", sa.String(length=100), nullable=False),
        sa.Column("resource_number", sa.String(length=100), nullable=False),
        sa.Column("resource_reference", sa.String(length=255), nullable=False),
        sa.Column("resource_name", sa.String(length=500), nullable=False),
        sa.Column("daily_capacity", sa.Numeric(18, 4), nullable=False),
        sa.Column("shift_hours", sa.Numeric(9, 2), nullable=False),
        sa.Column("efficiency_percent", sa.Numeric(9, 4), nullable=False),
        sa.Column("calendar_evidence_reference", sa.String(length=500), nullable=False),
        sa.Column("lifecycle_status", sa.String(length=30), nullable=False, server_default="draft"),
        sa.Column("approval_reference", sa.String(length=255), nullable=True),
        sa.Column("approval_note", sa.Text(), nullable=True),
        sa.Column("approved_by", sa.String(length=255), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("updated_by", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("resource_number", name="uq_factory_planning_resource_number"),
        sa.UniqueConstraint("tenant_id", "resource_reference", name="uq_factory_planning_resource_tenant_reference"),
    )
    for column in (
        "project_id", "agent_path", "tenant_id", "client_id", "plan_id", "resource_number",
        "resource_reference", "resource_name", "lifecycle_status", "approved_by", "updated_by",
    ):
        op.create_index(f"ix_factory_planning_resources_{column}", "factory_planning_resources", [column])

    op.create_table(
        "factory_production_plans",
        sa.Column("id", sa.String(length=100), primary_key=True),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("agent_path", sa.String(length=500), nullable=False),
        sa.Column("tenant_id", sa.String(length=100), nullable=False),
        sa.Column("client_id", sa.String(length=100), nullable=False),
        sa.Column("plan_id", sa.String(length=100), nullable=False),
        sa.Column("production_plan_number", sa.String(length=100), nullable=False),
        sa.Column("demand_order_id", sa.String(length=100), nullable=False),
        sa.Column("demand_order_number", sa.String(length=100), nullable=False),
        sa.Column("engineering_version_id", sa.String(length=100), nullable=False),
        sa.Column("engineering_number", sa.String(length=100), nullable=False),
        sa.Column("product_reference", sa.String(length=255), nullable=False),
        sa.Column("sku_reference", sa.String(length=255), nullable=False),
        sa.Column("demand_quantity", sa.Numeric(18, 4), nullable=False),
        sa.Column("resource_id", sa.String(length=100), nullable=False),
        sa.Column("resource_number", sa.String(length=100), nullable=False),
        sa.Column("effective_daily_capacity", sa.Numeric(18, 4), nullable=False),
        sa.Column("capacity_days", sa.Integer(), nullable=False),
        sa.Column("planned_start_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("planned_end_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("material_requirements_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("shortage_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("material_readiness_status", sa.String(length=30), nullable=False, server_default="shortage"),
        sa.Column("schedule_status", sa.String(length=30), nullable=False, server_default="on-time"),
        sa.Column("lifecycle_status", sa.String(length=30), nullable=False, server_default="draft"),
        sa.Column("review_note", sa.Text(), nullable=True),
        sa.Column("approval_reference", sa.String(length=255), nullable=True),
        sa.Column("release_reference", sa.String(length=255), nullable=True),
        sa.Column("work_order_intent_reference", sa.String(length=255), nullable=True),
        sa.Column("milestones_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("updated_by", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("production_plan_number", name="uq_factory_production_plan_number"),
        sa.UniqueConstraint("work_order_intent_reference", name="uq_factory_production_plan_work_intent"),
    )
    for column in (
        "project_id", "agent_path", "tenant_id", "client_id", "plan_id", "production_plan_number",
        "demand_order_id", "demand_order_number", "engineering_version_id", "engineering_number",
        "product_reference", "sku_reference", "resource_id", "resource_number", "planned_start_at",
        "planned_end_at", "due_at", "material_readiness_status", "schedule_status", "lifecycle_status",
        "work_order_intent_reference", "updated_by",
    ):
        op.create_index(f"ix_factory_production_plans_{column}", "factory_production_plans", [column])
    _update_permissions(remove=False)


def downgrade() -> None:
    _update_permissions(remove=True)
    for column in (
        "updated_by", "work_order_intent_reference", "lifecycle_status", "schedule_status", "material_readiness_status",
        "due_at", "planned_end_at", "planned_start_at", "resource_number", "resource_id", "sku_reference",
        "product_reference", "engineering_number", "engineering_version_id", "demand_order_number", "demand_order_id",
        "production_plan_number", "plan_id", "client_id", "tenant_id", "agent_path", "project_id",
    ):
        op.drop_index(f"ix_factory_production_plans_{column}", table_name="factory_production_plans")
    op.drop_table("factory_production_plans")
    for column in (
        "updated_by", "approved_by", "lifecycle_status", "resource_name", "resource_reference", "resource_number",
        "plan_id", "client_id", "tenant_id", "agent_path", "project_id",
    ):
        op.drop_index(f"ix_factory_planning_resources_{column}", table_name="factory_planning_resources")
    op.drop_table("factory_planning_resources")
