"""add governed analytical warehouse copies and lineage

Revision ID: e4c06d8f2ba3
Revises: d3bf5c7e1a92

Rollback removes only warehouse source registrations, derived analytical fact
versions, run memberships, quality issues, lineage and evidence plus five
permissions. It never deletes or changes source orders, quotes, quality,
assets, revenue, VOC, customer, invoice, payment or operational records.
"""

import json

from alembic import op
import sqlalchemy as sa


revision = "e4c06d8f2ba3"
down_revision = "d3bf5c7e1a92"
branch_labels = None
depends_on = None

PERMISSIONS = (
    "factory.decision.data-warehouse.source.manage",
    "factory.decision.data-warehouse.source.approve",
    "factory.decision.data-warehouse.load.execute",
    "factory.decision.data-warehouse.load.validate",
    "factory.decision.data-warehouse.load.publish",
)
SOURCE_INDEXES = ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", "source_number", "source_reference", "source_code", "source_system", "source_table", "domain", "owner", "schema_fingerprint", "status", "activated_by", "last_load_run_id", "last_watermark_at", "last_published_at", "updated_by")
RUN_INDEXES = ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", "run_number", "load_reference", "source_id", "source_number", "source_code", "source_table", "status", "cutoff_at", "schema_fingerprint", "validated_by", "published_by", "updated_by")
FACT_INDEXES = ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", "fact_number", "first_load_run_id", "source_id", "source_code", "source_system", "source_table", "source_object_id", "source_object_number", "source_revision", "source_updated_at", "business_date", "observed_at", "content_hash", "quality_status")
ISSUE_INDEXES = ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", "issue_number", "load_run_id", "run_number", "source_object_id", "source_object_number", "rule_code", "severity", "status", "resolved_by", "updated_by")
LINEAGE_INDEXES = ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", "edge_number", "load_run_id", "run_number", "fact_id", "fact_number", "source_system", "source_table", "source_object_id")
EVIDENCE_INDEXES = ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", "evidence_number", "subject_type", "subject_id", "subject_number", "evidence_type", "recorded_by")


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
        bind.execute(sa.text("UPDATE roles_platform SET permissions_json=:permissions WHERE id=:id"), {"permissions": json.dumps(values, ensure_ascii=False), "id": row["id"]})


def _tenant_columns() -> list[sa.Column]:
    return [
        sa.Column("id", sa.String(length=100), primary_key=True),
        sa.Column("project_id", sa.Integer(), nullable=False), sa.Column("agent_path", sa.String(length=500), nullable=False),
        sa.Column("tenant_id", sa.String(length=100), nullable=False), sa.Column("client_id", sa.String(length=100), nullable=False),
        sa.Column("plan_id", sa.String(length=100), nullable=False),
    ]


def _indexes(table: str, columns: tuple[str, ...]) -> None:
    for column in columns:
        op.create_index(f"ix_{table}_{column}", table, [column])


def upgrade() -> None:
    op.create_table(
        "factory_warehouse_sources", *_tenant_columns(),
        sa.Column("source_number", sa.String(100), nullable=False), sa.Column("source_reference", sa.String(255), nullable=False),
        sa.Column("source_code", sa.String(50), nullable=False), sa.Column("source_system", sa.String(100), nullable=False),
        sa.Column("source_table", sa.String(100), nullable=False), sa.Column("domain", sa.String(50), nullable=False),
        sa.Column("owner", sa.String(255), nullable=False), sa.Column("purpose", sa.Text(), nullable=False),
        sa.Column("retention_days", sa.Integer(), nullable=False, server_default="730"),
        sa.Column("extraction_mode", sa.String(40), nullable=False, server_default="incremental-snapshot"),
        sa.Column("schema_contract_reference", sa.String(500), nullable=True), sa.Column("schema_fingerprint", sa.String(64), nullable=True),
        sa.Column("status", sa.String(30), nullable=False, server_default="draft"), sa.Column("activated_by", sa.String(255), nullable=True),
        sa.Column("activated_at", sa.DateTime(timezone=True), nullable=True), sa.Column("last_load_run_id", sa.String(100), nullable=True),
        sa.Column("last_watermark_at", sa.DateTime(timezone=True), nullable=True), sa.Column("last_published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"), sa.Column("updated_by", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True), sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("source_number", name="uq_factory_warehouse_source_number"),
        sa.UniqueConstraint("project_id", "source_code", name="uq_factory_warehouse_project_source"),
        sa.UniqueConstraint("tenant_id", "source_reference", name="uq_factory_warehouse_tenant_source_reference"),
    )
    _indexes("factory_warehouse_sources", SOURCE_INDEXES)

    op.create_table(
        "factory_warehouse_load_runs", *_tenant_columns(),
        sa.Column("run_number", sa.String(100), nullable=False), sa.Column("load_reference", sa.String(255), nullable=False),
        sa.Column("source_id", sa.String(100), nullable=False), sa.Column("source_number", sa.String(100), nullable=False),
        sa.Column("source_code", sa.String(50), nullable=False), sa.Column("source_table", sa.String(100), nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="extracted"), sa.Column("cutoff_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("watermark_from", sa.DateTime(timezone=True), nullable=True), sa.Column("watermark_to", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rows_read", sa.Integer(), nullable=False, server_default="0"), sa.Column("rows_accepted", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("rows_rejected", sa.Integer(), nullable=False, server_default="0"), sa.Column("reused_fact_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("quality_score", sa.Numeric(7, 2), nullable=False, server_default="0"), sa.Column("schema_fingerprint", sa.String(64), nullable=False),
        sa.Column("validation_reference", sa.String(500), nullable=True), sa.Column("validated_by", sa.String(255), nullable=True),
        sa.Column("validated_at", sa.DateTime(timezone=True), nullable=True), sa.Column("publication_reference", sa.String(500), nullable=True),
        sa.Column("published_by", sa.String(255), nullable=True), sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("failure_reason", sa.Text(), nullable=True), sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("updated_by", sa.String(255), nullable=True), sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("run_number", name="uq_factory_warehouse_run_number"),
        sa.UniqueConstraint("tenant_id", "load_reference", name="uq_factory_warehouse_tenant_load_reference"),
    )
    _indexes("factory_warehouse_load_runs", RUN_INDEXES)

    op.create_table(
        "factory_warehouse_fact_versions", *_tenant_columns(),
        sa.Column("fact_number", sa.String(100), nullable=False), sa.Column("first_load_run_id", sa.String(100), nullable=False),
        sa.Column("source_id", sa.String(100), nullable=False), sa.Column("source_code", sa.String(50), nullable=False),
        sa.Column("source_system", sa.String(100), nullable=False), sa.Column("source_table", sa.String(100), nullable=False),
        sa.Column("source_object_id", sa.String(100), nullable=False), sa.Column("source_object_number", sa.String(255), nullable=False),
        sa.Column("source_revision", sa.Integer(), nullable=False), sa.Column("source_updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("business_date", sa.DateTime(timezone=True), nullable=False), sa.Column("observed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("payload_json", sa.Text(), nullable=False), sa.Column("content_hash", sa.String(64), nullable=False),
        sa.Column("quality_status", sa.String(30), nullable=False, server_default="accepted"), sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("fact_number", name="uq_factory_warehouse_fact_number"),
        sa.UniqueConstraint("tenant_id", "source_code", "source_object_id", "source_revision", name="uq_factory_warehouse_fact_source_version"),
    )
    _indexes("factory_warehouse_fact_versions", FACT_INDEXES)

    op.create_table(
        "factory_warehouse_quality_issues", *_tenant_columns(),
        sa.Column("issue_number", sa.String(100), nullable=False), sa.Column("load_run_id", sa.String(100), nullable=False),
        sa.Column("run_number", sa.String(100), nullable=False), sa.Column("source_object_id", sa.String(100), nullable=True),
        sa.Column("source_object_number", sa.String(255), nullable=True), sa.Column("rule_code", sa.String(100), nullable=False),
        sa.Column("severity", sa.String(20), nullable=False), sa.Column("description", sa.Text(), nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="open"), sa.Column("resolution_reference", sa.String(500), nullable=True),
        sa.Column("resolution_note", sa.Text(), nullable=True), sa.Column("resolved_by", sa.String(255), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True), sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("updated_by", sa.String(255), nullable=True), sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("issue_number", name="uq_factory_warehouse_issue_number"),
    )
    _indexes("factory_warehouse_quality_issues", ISSUE_INDEXES)

    op.create_table(
        "factory_warehouse_lineage_edges", *_tenant_columns(),
        sa.Column("edge_number", sa.String(100), nullable=False), sa.Column("load_run_id", sa.String(100), nullable=False),
        sa.Column("run_number", sa.String(100), nullable=False), sa.Column("fact_id", sa.String(100), nullable=False),
        sa.Column("fact_number", sa.String(100), nullable=False), sa.Column("source_system", sa.String(100), nullable=False),
        sa.Column("source_table", sa.String(100), nullable=False), sa.Column("source_object_id", sa.String(100), nullable=False),
        sa.Column("source_revision", sa.Integer(), nullable=False), sa.Column("transformation_reference", sa.String(500), nullable=False),
        sa.Column("observed_at", sa.DateTime(timezone=True), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("edge_number", name="uq_factory_warehouse_edge_number"),
        sa.UniqueConstraint("load_run_id", "fact_id", name="uq_factory_warehouse_run_fact_lineage"),
    )
    _indexes("factory_warehouse_lineage_edges", LINEAGE_INDEXES)

    op.create_table(
        "factory_warehouse_evidence", *_tenant_columns(),
        sa.Column("evidence_number", sa.String(100), nullable=False), sa.Column("subject_type", sa.String(40), nullable=False),
        sa.Column("subject_id", sa.String(100), nullable=False), sa.Column("subject_number", sa.String(100), nullable=False),
        sa.Column("evidence_type", sa.String(50), nullable=False), sa.Column("evidence_reference", sa.String(500), nullable=False),
        sa.Column("note", sa.Text(), nullable=False), sa.Column("recorded_by", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("evidence_number", name="uq_factory_warehouse_evidence_number"),
    )
    _indexes("factory_warehouse_evidence", EVIDENCE_INDEXES)
    _update_permissions(remove=False)


def downgrade() -> None:
    _update_permissions(remove=True)
    for table, columns in (
        ("factory_warehouse_evidence", EVIDENCE_INDEXES), ("factory_warehouse_lineage_edges", LINEAGE_INDEXES),
        ("factory_warehouse_quality_issues", ISSUE_INDEXES), ("factory_warehouse_fact_versions", FACT_INDEXES),
        ("factory_warehouse_load_runs", RUN_INDEXES), ("factory_warehouse_sources", SOURCE_INDEXES),
    ):
        for column in reversed(columns):
            op.drop_index(f"ix_{table}_{column}", table_name=table)
        op.drop_table(table)
