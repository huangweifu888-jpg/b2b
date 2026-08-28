"""add tenant-scoped QMS inspections and quality findings

Revision ID: fb3d7e9a2c14
Revises: fa2e6c8d1b03

Rollback removes only QMS inspection/finding records, copied evidence references
and QMS permission grants. It never deletes orders, production batches, customer
assets, product passports, source inspection documents, inventory, invoices or
payments.
"""

import json

from alembic import op
import sqlalchemy as sa


revision = "fb3d7e9a2c14"
down_revision = "fa2e6c8d1b03"
branch_labels = None
depends_on = None

PERMISSIONS = (
    "factory.fulfillment.quality.inspect",
    "factory.fulfillment.quality.resolve",
    "factory.fulfillment.quality.release",
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
        values = (
            [value for value in values if value not in PERMISSIONS]
            if remove
            else list(dict.fromkeys([*values, *PERMISSIONS]))
        )
        bind.execute(
            sa.text("UPDATE roles_platform SET permissions_json = :permissions WHERE id = :id"),
            {"permissions": json.dumps(values, ensure_ascii=False), "id": row["id"]},
        )


def upgrade() -> None:
    op.create_table(
        "factory_quality_inspections",
        sa.Column("id", sa.String(length=100), primary_key=True),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("agent_path", sa.String(length=500), nullable=False),
        sa.Column("tenant_id", sa.String(length=100), nullable=False),
        sa.Column("client_id", sa.String(length=100), nullable=False),
        sa.Column("plan_id", sa.String(length=100), nullable=False),
        sa.Column("inspection_number", sa.String(length=100), nullable=False),
        sa.Column("inspection_reference", sa.String(length=255), nullable=False),
        sa.Column("order_id", sa.String(length=100), nullable=False),
        sa.Column("order_number", sa.String(length=100), nullable=False),
        sa.Column("product_reference", sa.String(length=255), nullable=False),
        sa.Column("sku_reference", sa.String(length=255), nullable=False),
        sa.Column("work_order_reference", sa.String(length=255), nullable=False),
        sa.Column("batch_reference", sa.String(length=255), nullable=False),
        sa.Column("inspection_type", sa.String(length=50), nullable=False, server_default="final"),
        sa.Column("sample_size", sa.Integer(), nullable=False),
        sa.Column("accepted_quantity", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("rejected_quantity", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("lifecycle_status", sa.String(length=40), nullable=False, server_default="draft"),
        sa.Column("inspector", sa.String(length=255), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("check_results_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("approval_reference", sa.String(length=255), nullable=True),
        sa.Column("release_note", sa.Text(), nullable=True),
        sa.Column("released_by", sa.String(length=255), nullable=True),
        sa.Column("released_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("emitted_events_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("updated_by", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("inspection_number", name="uq_factory_quality_inspection_number"),
        sa.UniqueConstraint(
            "tenant_id", "inspection_reference",
            name="uq_factory_quality_tenant_inspection_reference",
        ),
    )
    inspection_indexes = (
        "project_id", "agent_path", "tenant_id", "client_id", "plan_id", "inspection_number",
        "inspection_reference", "order_id", "order_number", "product_reference", "sku_reference",
        "work_order_reference", "batch_reference", "inspection_type", "lifecycle_status", "inspector",
        "released_by", "updated_by",
    )
    for column in inspection_indexes:
        op.create_index(f"ix_factory_quality_inspections_{column}", "factory_quality_inspections", [column])

    op.create_table(
        "factory_quality_findings",
        sa.Column("id", sa.String(length=100), primary_key=True),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("agent_path", sa.String(length=500), nullable=False),
        sa.Column("tenant_id", sa.String(length=100), nullable=False),
        sa.Column("client_id", sa.String(length=100), nullable=False),
        sa.Column("plan_id", sa.String(length=100), nullable=False),
        sa.Column("finding_number", sa.String(length=100), nullable=False),
        sa.Column("inspection_id", sa.String(length=100), nullable=False),
        sa.Column("inspection_number", sa.String(length=100), nullable=False),
        sa.Column("check_code", sa.String(length=50), nullable=False),
        sa.Column("severity", sa.String(length=20), nullable=False),
        sa.Column("description", sa.String(length=1000), nullable=False),
        sa.Column("affected_quantity", sa.Integer(), nullable=False),
        sa.Column("lifecycle_status", sa.String(length=40), nullable=False, server_default="open"),
        sa.Column("disposition", sa.String(length=40), nullable=True),
        sa.Column("root_cause", sa.Text(), nullable=True),
        sa.Column("corrective_action", sa.Text(), nullable=True),
        sa.Column("resolution_evidence_reference", sa.String(length=500), nullable=True),
        sa.Column("resolved_by", sa.String(length=255), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("updated_by", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("finding_number", name="uq_factory_quality_finding_number"),
    )
    finding_indexes = (
        "project_id", "agent_path", "tenant_id", "client_id", "plan_id", "finding_number",
        "inspection_id", "inspection_number", "check_code", "severity", "lifecycle_status",
        "disposition", "resolved_by", "updated_by",
    )
    for column in finding_indexes:
        op.create_index(f"ix_factory_quality_findings_{column}", "factory_quality_findings", [column])

    _update_permissions(remove=False)


def downgrade() -> None:
    _update_permissions(remove=True)
    for column in (
        "updated_by", "resolved_by", "disposition", "lifecycle_status", "severity", "check_code",
        "inspection_number", "inspection_id", "finding_number", "plan_id", "client_id", "tenant_id",
        "agent_path", "project_id",
    ):
        op.drop_index(f"ix_factory_quality_findings_{column}", table_name="factory_quality_findings")
    op.drop_table("factory_quality_findings")
    for column in (
        "updated_by", "released_by", "inspector", "lifecycle_status", "inspection_type", "batch_reference",
        "work_order_reference", "sku_reference", "product_reference", "order_number", "order_id",
        "inspection_reference", "inspection_number", "plan_id", "client_id", "tenant_id", "agent_path",
        "project_id",
    ):
        op.drop_index(f"ix_factory_quality_inspections_{column}", table_name="factory_quality_inspections")
    op.drop_table("factory_quality_inspections")
