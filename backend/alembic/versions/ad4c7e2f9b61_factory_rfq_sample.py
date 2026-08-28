"""governed RFQ clarification and sample lifecycle

Revision ID: ad4c7e2f9b61
Revises: 9d3f6b1c8e50
Create Date: 2026-08-03

Rollback removes only RFQ cases, requirements, sample-management records,
customer feedback, evidence and permissions. It never changes the authoritative
revenue flow, logistics, finance, CRM or order records. Export evidence before
rollback when it is needed for contractual traceability.
"""
import json

from alembic import op
import sqlalchemy as sa


revision = "ad4c7e2f9b61"
down_revision = "9d3f6b1c8e50"
branch_labels = None
depends_on = None
PERMISSIONS = (
    "factory.convert.rfq.manage",
    "factory.convert.rfq.requirement.approve",
    "factory.convert.rfq.sample.approve",
    "factory.convert.rfq.sample.dispatch",
    "factory.convert.rfq.feedback.record",
    "factory.convert.rfq.feedback.acknowledge",
)
TABLES = (
    "factory_rfq_cases",
    "factory_rfq_requirements",
    "factory_sample_tasks",
    "factory_sample_feedback",
    "factory_rfq_evidence",
)


def tenant_columns():
    return [
        sa.Column("id", sa.String(100), primary_key=True),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("agent_path", sa.String(255), nullable=False),
        sa.Column("tenant_id", sa.String(128), nullable=False),
        sa.Column("client_id", sa.String(128), nullable=False),
        sa.Column("plan_id", sa.String(128), nullable=False),
    ]


def indexes(table, extra=()):
    for column in ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", *extra):
        op.create_index(f"ix_{table}_{column}", table, [column])


def permissions(remove):
    bind = op.get_bind()
    roles = bind.execute(sa.text(
        "SELECT id, permissions_json FROM roles_platform "
        "WHERE is_system=1 AND scope IN ('client','project')"
    )).mappings().all()
    for role in roles:
        try:
            current = json.loads(role["permissions_json"] or "[]")
        except (TypeError, ValueError):
            current = []
        current = (
            [item for item in current if item not in PERMISSIONS]
            if remove
            else list(dict.fromkeys([*current, *PERMISSIONS]))
        )
        bind.execute(
            sa.text("UPDATE roles_platform SET permissions_json=:permissions WHERE id=:id"),
            {"permissions": json.dumps(current, ensure_ascii=False), "id": role["id"]},
        )


def upgrade():
    op.create_table(
        "factory_rfq_cases", *tenant_columns(),
        sa.Column("rfq_number", sa.String(96), nullable=False),
        sa.Column("source_flow_id", sa.String(100), nullable=False),
        sa.Column("source_correlation_id", sa.String(100), nullable=False),
        sa.Column("source_revision", sa.Integer(), nullable=False),
        sa.Column("source_stage", sa.String(50), nullable=False),
        sa.Column("source_snapshot_json", sa.JSON(), nullable=False),
        sa.Column("source_fingerprint", sa.String(64), nullable=False),
        sa.Column("account_reference_hash", sa.String(64), nullable=False),
        sa.Column("product_reference", sa.String(255), nullable=False),
        sa.Column("objective", sa.String(255), nullable=False),
        sa.Column("status", sa.String(24), nullable=False, server_default="clarifying"),
        sa.Column("created_by", sa.String(128), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.UniqueConstraint("rfq_number", name="uq_factory_rfq_number"),
        sa.UniqueConstraint("project_id", "source_flow_id", name="uq_factory_rfq_project_flow"),
    )
    indexes("factory_rfq_cases", ("rfq_number", "source_flow_id", "status"))
    op.create_table(
        "factory_rfq_requirements", *tenant_columns(),
        sa.Column("requirement_number", sa.String(96), nullable=False),
        sa.Column("case_id", sa.String(100), nullable=False),
        sa.Column("rfq_number", sa.String(96), nullable=False),
        sa.Column("requirement_code", sa.String(64), nullable=False),
        sa.Column("requirement_name", sa.String(180), nullable=False),
        sa.Column("specification", sa.Text(), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("target_date", sa.Date(), nullable=False),
        sa.Column("critical", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(24), nullable=False, server_default="pending-review"),
        sa.Column("authored_by", sa.String(128), nullable=False),
        sa.Column("approved_by", sa.String(128)),
        sa.Column("approved_at", sa.DateTime(timezone=True)),
        sa.Column("approval_reference", sa.String(255)),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("requirement_number", name="uq_factory_rfq_requirement_number"),
        sa.UniqueConstraint("case_id", "requirement_code", name="uq_factory_rfq_case_requirement"),
    )
    indexes("factory_rfq_requirements", ("requirement_number", "case_id", "status"))
    op.create_table(
        "factory_sample_tasks", *tenant_columns(),
        sa.Column("sample_number", sa.String(96), nullable=False),
        sa.Column("case_id", sa.String(100), nullable=False),
        sa.Column("rfq_number", sa.String(96), nullable=False),
        sa.Column("sample_code", sa.String(64), nullable=False),
        sa.Column("requirement_ids_json", sa.JSON(), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("unit_cost", sa.Numeric(18, 2), nullable=False),
        sa.Column("currency", sa.String(8), nullable=False),
        sa.Column("promised_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(24), nullable=False, server_default="pending-approval"),
        sa.Column("created_by", sa.String(128), nullable=False),
        sa.Column("approved_by", sa.String(128)),
        sa.Column("approval_reference", sa.String(255)),
        sa.Column("shipping_reference", sa.String(255)),
        sa.Column("dispatched_by", sa.String(128)),
        sa.Column("dispatched_at", sa.DateTime(timezone=True)),
        sa.Column("received_at", sa.DateTime(timezone=True)),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("sample_number", name="uq_factory_sample_number"),
        sa.UniqueConstraint("case_id", "sample_code", name="uq_factory_rfq_case_sample"),
    )
    indexes("factory_sample_tasks", ("sample_number", "case_id", "status"))
    op.create_table(
        "factory_sample_feedback", *tenant_columns(),
        sa.Column("feedback_number", sa.String(96), nullable=False),
        sa.Column("case_id", sa.String(100), nullable=False),
        sa.Column("sample_id", sa.String(100), nullable=False),
        sa.Column("sample_number", sa.String(96), nullable=False),
        sa.Column("outcome", sa.String(24), nullable=False),
        sa.Column("quality_score", sa.Integer(), nullable=False),
        sa.Column("feedback_note", sa.Text(), nullable=False),
        sa.Column("conversion_intent", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("feedback_hash", sa.String(64), nullable=False),
        sa.Column("status", sa.String(24), nullable=False, server_default="pending-acknowledgement"),
        sa.Column("recorded_by", sa.String(128), nullable=False),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("acknowledged_by", sa.String(128)),
        sa.Column("acknowledged_at", sa.DateTime(timezone=True)),
        sa.Column("acknowledgement_reference", sa.String(255)),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.UniqueConstraint("feedback_number", name="uq_factory_sample_feedback_number"),
        sa.UniqueConstraint("sample_id", name="uq_factory_sample_feedback_task"),
    )
    indexes("factory_sample_feedback", ("feedback_number", "case_id", "sample_id", "status"))
    op.create_table(
        "factory_rfq_evidence", *tenant_columns(),
        sa.Column("evidence_number", sa.String(96), nullable=False),
        sa.Column("subject_type", sa.String(40), nullable=False),
        sa.Column("subject_id", sa.String(100), nullable=False),
        sa.Column("subject_number", sa.String(96), nullable=False),
        sa.Column("evidence_type", sa.String(48), nullable=False),
        sa.Column("evidence_reference", sa.String(255), nullable=False),
        sa.Column("note", sa.Text()),
        sa.Column("recorded_by", sa.String(128), nullable=False),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("evidence_number", name="uq_factory_rfq_evidence_number"),
    )
    indexes("factory_rfq_evidence", ("evidence_number", "subject_type", "subject_id"))
    permissions(False)


def downgrade():
    permissions(True)
    for table in reversed(TABLES):
        op.drop_table(table)
