"""add tenant-scoped warranty and RMA evidence chain

Revision ID: a08c2e4f7b69
Revises: ff7b1d3e6a58

Rollback removes only RMA case snapshots, append-only return evidence and five
permission grants. It never deletes customer assets, service tickets, orders,
warehouse receipts, QMS records, inventory, invoices, refunds or payments.
"""

import json

from alembic import op
import sqlalchemy as sa


revision = "a08c2e4f7b69"
down_revision = "ff7b1d3e6a58"
branch_labels = None
depends_on = None

PERMISSIONS = (
    "factory.care.rma.manage",
    "factory.care.rma.authorize",
    "factory.care.rma.receive",
    "factory.care.rma.inspect",
    "factory.care.rma.disposition",
)

CASE_INDEXES = (
    "project_id", "agent_path", "tenant_id", "client_id", "plan_id", "rma_number",
    "claim_reference", "asset_id", "asset_number", "service_ticket_id",
    "service_ticket_number", "order_id", "order_number", "account_reference",
    "product_reference", "sku_reference", "serial_number", "warranty_until",
    "eligibility_status", "requested_remedy", "lifecycle_status", "authorized_by",
    "return_shipment_reference", "warehouse_receipt_reference", "received_by",
    "inspection_reference", "inspection_result", "quality_evidence_reference",
    "inspected_by", "disposition", "responsibility", "disposition_by", "closed_by",
    "updated_by",
)
EVIDENCE_INDEXES = (
    "project_id", "agent_path", "tenant_id", "client_id", "plan_id",
    "evidence_number", "rma_case_id", "rma_number", "evidence_type", "recorded_by",
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
        "factory_warranty_rma_cases",
        sa.Column("id", sa.String(length=100), primary_key=True),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("agent_path", sa.String(length=500), nullable=False),
        sa.Column("tenant_id", sa.String(length=100), nullable=False),
        sa.Column("client_id", sa.String(length=100), nullable=False),
        sa.Column("plan_id", sa.String(length=100), nullable=False),
        sa.Column("rma_number", sa.String(length=100), nullable=False),
        sa.Column("claim_reference", sa.String(length=255), nullable=False),
        sa.Column("asset_id", sa.String(length=100), nullable=False),
        sa.Column("asset_number", sa.String(length=100), nullable=False),
        sa.Column("service_ticket_id", sa.String(length=100), nullable=False),
        sa.Column("service_ticket_number", sa.String(length=100), nullable=False),
        sa.Column("order_id", sa.String(length=100), nullable=False),
        sa.Column("order_number", sa.String(length=100), nullable=False),
        sa.Column("account_reference", sa.String(length=255), nullable=False),
        sa.Column("product_reference", sa.String(length=255), nullable=False),
        sa.Column("sku_reference", sa.String(length=255), nullable=False),
        sa.Column("serial_number", sa.String(length=255), nullable=False),
        sa.Column("warranty_until", sa.DateTime(timezone=True), nullable=False),
        sa.Column("eligibility_status", sa.String(length=30), nullable=False, server_default="unchecked"),
        sa.Column("claim_summary", sa.Text(), nullable=False),
        sa.Column("requested_remedy", sa.String(length=30), nullable=False),
        sa.Column("lifecycle_status", sa.String(length=40), nullable=False, server_default="draft"),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("authorization_reference", sa.String(length=500), nullable=True),
        sa.Column("goodwill_reference", sa.String(length=500), nullable=True),
        sa.Column("return_instructions", sa.Text(), nullable=True),
        sa.Column("authorized_by", sa.String(length=255), nullable=True),
        sa.Column("authorized_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("return_shipment_reference", sa.String(length=500), nullable=True),
        sa.Column("shipped_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("warehouse_receipt_reference", sa.String(length=500), nullable=True),
        sa.Column("received_condition", sa.Text(), nullable=True),
        sa.Column("received_by", sa.String(length=255), nullable=True),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("inspection_reference", sa.String(length=500), nullable=True),
        sa.Column("inspection_result", sa.String(length=40), nullable=True),
        sa.Column("inspection_note", sa.Text(), nullable=True),
        sa.Column("quality_evidence_reference", sa.String(length=500), nullable=True),
        sa.Column("inspected_by", sa.String(length=255), nullable=True),
        sa.Column("inspected_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("disposition", sa.String(length=40), nullable=True),
        sa.Column("responsibility", sa.String(length=40), nullable=True),
        sa.Column("disposition_approval_reference", sa.String(length=500), nullable=True),
        sa.Column("currency", sa.String(length=10), nullable=False, server_default="USD"),
        sa.Column("estimated_parts_cost", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("estimated_labor_cost", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("estimated_logistics_cost", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("estimated_total_cost", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("finance_followup_reference", sa.String(length=500), nullable=True),
        sa.Column("supplier_recovery_reference", sa.String(length=500), nullable=True),
        sa.Column("disposition_by", sa.String(length=255), nullable=True),
        sa.Column("disposition_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("remedy_evidence_reference", sa.String(length=500), nullable=True),
        sa.Column("customer_acknowledgement_reference", sa.String(length=500), nullable=True),
        sa.Column("closed_by", sa.String(length=255), nullable=True),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("milestones_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("updated_by", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("rma_number", name="uq_factory_rma_number"),
        sa.UniqueConstraint("tenant_id", "claim_reference", name="uq_factory_rma_tenant_claim_reference"),
        sa.UniqueConstraint("tenant_id", "service_ticket_id", name="uq_factory_rma_tenant_service_ticket"),
    )
    for column in CASE_INDEXES:
        op.create_index(f"ix_factory_warranty_rma_cases_{column}", "factory_warranty_rma_cases", [column])

    op.create_table(
        "factory_rma_evidence",
        sa.Column("id", sa.String(length=100), primary_key=True),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("agent_path", sa.String(length=500), nullable=False),
        sa.Column("tenant_id", sa.String(length=100), nullable=False),
        sa.Column("client_id", sa.String(length=100), nullable=False),
        sa.Column("plan_id", sa.String(length=100), nullable=False),
        sa.Column("evidence_number", sa.String(length=100), nullable=False),
        sa.Column("rma_case_id", sa.String(length=100), nullable=False),
        sa.Column("rma_number", sa.String(length=100), nullable=False),
        sa.Column("evidence_type", sa.String(length=50), nullable=False),
        sa.Column("evidence_reference", sa.String(length=500), nullable=False),
        sa.Column("note", sa.Text(), nullable=False),
        sa.Column("recorded_by", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("evidence_number", name="uq_factory_rma_evidence_number"),
    )
    for column in EVIDENCE_INDEXES:
        op.create_index(f"ix_factory_rma_evidence_{column}", "factory_rma_evidence", [column])
    _update_permissions(remove=False)


def downgrade() -> None:
    _update_permissions(remove=True)
    for column in reversed(EVIDENCE_INDEXES):
        op.drop_index(f"ix_factory_rma_evidence_{column}", table_name="factory_rma_evidence")
    op.drop_table("factory_rma_evidence")
    for column in reversed(CASE_INDEXES):
        op.drop_index(f"ix_factory_warranty_rma_cases_{column}", table_name="factory_warranty_rma_cases")
    op.drop_table("factory_warranty_rma_cases")
