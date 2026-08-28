"""add tenant-scoped field service and SLA execution

Revision ID: ff7b1d3e6a58
Revises: fe6a0c2d5f47

Rollback removes only field technicians, visits, onsite work evidence and the
four permission grants. It never deletes customer assets, base service tickets,
orders, QMS records, stock records, invoices or payments.
"""

import json

from alembic import op
import sqlalchemy as sa


revision = "ff7b1d3e6a58"
down_revision = "fe6a0c2d5f47"
branch_labels = None
depends_on = None

PERMISSIONS = (
    "factory.care.field-service.manage",
    "factory.care.field-service.dispatch",
    "factory.care.field-service.execute",
    "factory.care.field-service.complete",
)

TECHNICIAN_INDEXES = (
    "project_id", "agent_path", "tenant_id", "client_id", "plan_id",
    "technician_number", "technician_reference", "technician_name",
    "lifecycle_status", "approved_by", "updated_by",
)
VISIT_INDEXES = (
    "project_id", "agent_path", "tenant_id", "client_id", "plan_id",
    "visit_number", "service_ticket_id", "service_ticket_number", "asset_id",
    "asset_number", "account_reference", "technician_id", "technician_number",
    "scheduled_for", "sla_due_at", "sla_status", "lifecycle_status", "updated_by",
)
ENTRY_INDEXES = (
    "project_id", "agent_path", "tenant_id", "client_id", "plan_id",
    "entry_number", "visit_id", "visit_number", "entry_type", "part_reference",
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
        "factory_field_service_technicians",
        sa.Column("id", sa.String(length=100), primary_key=True),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("agent_path", sa.String(length=500), nullable=False),
        sa.Column("tenant_id", sa.String(length=100), nullable=False),
        sa.Column("client_id", sa.String(length=100), nullable=False),
        sa.Column("plan_id", sa.String(length=100), nullable=False),
        sa.Column("technician_number", sa.String(length=100), nullable=False),
        sa.Column("technician_reference", sa.String(length=255), nullable=False),
        sa.Column("technician_name", sa.String(length=500), nullable=False),
        sa.Column("skills_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("service_regions_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("lifecycle_status", sa.String(length=30), nullable=False, server_default="draft"),
        sa.Column("approval_reference", sa.String(length=500), nullable=True),
        sa.Column("approved_by", sa.String(length=255), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("updated_by", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("technician_number", name="uq_factory_field_technician_number"),
        sa.UniqueConstraint("tenant_id", "technician_reference", name="uq_factory_field_technician_tenant_reference"),
    )
    for column in TECHNICIAN_INDEXES:
        op.create_index(f"ix_factory_field_service_technicians_{column}", "factory_field_service_technicians", [column])

    op.create_table(
        "factory_field_service_visits",
        sa.Column("id", sa.String(length=100), primary_key=True),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("agent_path", sa.String(length=500), nullable=False),
        sa.Column("tenant_id", sa.String(length=100), nullable=False),
        sa.Column("client_id", sa.String(length=100), nullable=False),
        sa.Column("plan_id", sa.String(length=100), nullable=False),
        sa.Column("visit_number", sa.String(length=100), nullable=False),
        sa.Column("service_ticket_id", sa.String(length=100), nullable=False),
        sa.Column("service_ticket_number", sa.String(length=100), nullable=False),
        sa.Column("asset_id", sa.String(length=100), nullable=False),
        sa.Column("asset_number", sa.String(length=100), nullable=False),
        sa.Column("account_reference", sa.String(length=255), nullable=False),
        sa.Column("technician_id", sa.String(length=100), nullable=False),
        sa.Column("technician_number", sa.String(length=100), nullable=False),
        sa.Column("technician_name", sa.String(length=500), nullable=False),
        sa.Column("scheduled_for", sa.DateTime(timezone=True), nullable=False),
        sa.Column("sla_due_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("sla_status", sa.String(length=30), nullable=False, server_default="pending"),
        sa.Column("lifecycle_status", sa.String(length=30), nullable=False, server_default="dispatched"),
        sa.Column("departure_reference", sa.String(length=500), nullable=True),
        sa.Column("arrival_reference", sa.String(length=500), nullable=True),
        sa.Column("arrival_location", sa.String(length=500), nullable=True),
        sa.Column("diagnosis_summary", sa.Text(), nullable=True),
        sa.Column("resolution_reference", sa.String(length=500), nullable=True),
        sa.Column("resolution_note", sa.Text(), nullable=True),
        sa.Column("customer_signer", sa.String(length=500), nullable=True),
        sa.Column("customer_signoff_reference", sa.String(length=500), nullable=True),
        sa.Column("escalation_reference", sa.String(length=500), nullable=True),
        sa.Column("total_labor_minutes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("parts_summary_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("departed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("arrived_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("milestones_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("updated_by", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("visit_number", name="uq_factory_field_visit_number"),
        sa.UniqueConstraint("tenant_id", "service_ticket_id", name="uq_factory_field_visit_tenant_ticket"),
    )
    for column in VISIT_INDEXES:
        op.create_index(f"ix_factory_field_service_visits_{column}", "factory_field_service_visits", [column])

    op.create_table(
        "factory_field_service_entries",
        sa.Column("id", sa.String(length=100), primary_key=True),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("agent_path", sa.String(length=500), nullable=False),
        sa.Column("tenant_id", sa.String(length=100), nullable=False),
        sa.Column("client_id", sa.String(length=100), nullable=False),
        sa.Column("plan_id", sa.String(length=100), nullable=False),
        sa.Column("entry_number", sa.String(length=100), nullable=False),
        sa.Column("visit_id", sa.String(length=100), nullable=False),
        sa.Column("visit_number", sa.String(length=100), nullable=False),
        sa.Column("entry_type", sa.String(length=30), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("labor_minutes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("part_reference", sa.String(length=255), nullable=True),
        sa.Column("quantity", sa.Numeric(18, 4), nullable=False, server_default="0"),
        sa.Column("unit", sa.String(length=50), nullable=True),
        sa.Column("stock_evidence_reference", sa.String(length=500), nullable=True),
        sa.Column("evidence_reference", sa.String(length=500), nullable=False),
        sa.Column("recorded_by", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("entry_number", name="uq_factory_field_entry_number"),
    )
    for column in ENTRY_INDEXES:
        op.create_index(f"ix_factory_field_service_entries_{column}", "factory_field_service_entries", [column])
    _update_permissions(remove=False)


def downgrade() -> None:
    _update_permissions(remove=True)
    for column in reversed(ENTRY_INDEXES):
        op.drop_index(f"ix_factory_field_service_entries_{column}", table_name="factory_field_service_entries")
    op.drop_table("factory_field_service_entries")
    for column in reversed(VISIT_INDEXES):
        op.drop_index(f"ix_factory_field_service_visits_{column}", table_name="factory_field_service_visits")
    op.drop_table("factory_field_service_visits")
    for column in reversed(TECHNICIAN_INDEXES):
        op.drop_index(f"ix_factory_field_service_technicians_{column}", table_name="factory_field_service_technicians")
    op.drop_table("factory_field_service_technicians")
