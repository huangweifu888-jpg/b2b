"""governed product intelligence commercial availability

Revision ID: cf6e9a4b1d83
Revises: be5d8f3a0c72
Create Date: 2026-08-03

Rollback removes only product-research projections, availability evidence,
their permissions and their two contract-registry entries. It never changes
PLM products, external market sources, connector credentials or customer data.
"""

import json
from alembic import op
import sqlalchemy as sa


revision = "cf6e9a4b1d83"
down_revision = "be5d8f3a0c72"
branch_labels = None
depends_on = None

PERMISSIONS = (
    "factory.identity.product-intelligence.manage",
    "factory.identity.product-intelligence.signal.verify",
    "factory.identity.product-intelligence.assessment.review",
    "factory.identity.product-intelligence.release.approve",
)
TABLES = (
    "factory_product_research_studies",
    "factory_product_research_signals",
    "factory_product_opportunity_assessments",
    "factory_product_intelligence_releases",
    "factory_product_intelligence_evidence",
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


def indexes(table: str, extra=()):
    for column in ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", *extra):
        op.create_index(f"ix_{table}_{column}", table, [column])


def update_permissions(remove: bool):
    bind = op.get_bind()
    rows = bind.execute(sa.text("SELECT id, permissions_json FROM roles_platform WHERE is_system=1 AND scope IN ('client','project')")).mappings().all()
    for row in rows:
        try:
            values = json.loads(row["permissions_json"] or "[]")
        except (TypeError, ValueError):
            values = []
        values = [value for value in values if value not in PERMISSIONS] if remove else list(dict.fromkeys([*values, *PERMISSIONS]))
        bind.execute(sa.text("UPDATE roles_platform SET permissions_json=:permissions WHERE id=:id"), {"permissions": json.dumps(values, ensure_ascii=False), "id": row["id"]})


def upgrade():
    op.create_table(
        "factory_product_research_studies", *tenant_columns(),
        sa.Column("study_number", sa.String(96), nullable=False),
        sa.Column("product_reference", sa.String(180), nullable=False),
        sa.Column("product_name", sa.String(180), nullable=False),
        sa.Column("business_objective", sa.Text(), nullable=False),
        sa.Column("base_currency", sa.String(8), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="gathering"),
        sa.Column("created_by", sa.String(128), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.UniqueConstraint("study_number", name="uq_factory_product_study_number"),
    )
    indexes("factory_product_research_studies", ("study_number", "product_reference", "status"))

    op.create_table(
        "factory_product_research_signals", *tenant_columns(),
        sa.Column("signal_number", sa.String(96), nullable=False),
        sa.Column("study_id", sa.String(100), nullable=False),
        sa.Column("study_number", sa.String(96), nullable=False),
        sa.Column("signal_type", sa.String(32), nullable=False),
        sa.Column("normalized_score", sa.Numeric(6, 2), nullable=False),
        sa.Column("raw_value", sa.Numeric(18, 4), nullable=False),
        sa.Column("measurement_unit", sa.String(32), nullable=False),
        sa.Column("region", sa.String(32), nullable=False),
        sa.Column("source_system", sa.String(64), nullable=False),
        sa.Column("source_reference", sa.String(255), nullable=False),
        sa.Column("source_revision", sa.String(96), nullable=False),
        sa.Column("source_observed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("source_hash", sa.String(64), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="pending-verification"),
        sa.Column("recorded_by", sa.String(128), nullable=False),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("verified_by", sa.String(128)),
        sa.Column("verified_at", sa.DateTime(timezone=True)),
        sa.Column("verification_reference", sa.String(255)),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.UniqueConstraint("signal_number", name="uq_factory_product_signal_number"),
        sa.UniqueConstraint("study_id", "signal_type", name="uq_factory_product_signal_type"),
    )
    indexes("factory_product_research_signals", ("signal_number", "study_id", "signal_type", "status"))

    op.create_table(
        "factory_product_opportunity_assessments", *tenant_columns(),
        sa.Column("assessment_number", sa.String(96), nullable=False),
        sa.Column("study_id", sa.String(100), nullable=False),
        sa.Column("study_number", sa.String(96), nullable=False),
        sa.Column("input_snapshot_json", sa.JSON(), nullable=False),
        sa.Column("input_hash", sa.String(64), nullable=False),
        sa.Column("opportunity_score", sa.Numeric(6, 2), nullable=False),
        sa.Column("recommendation", sa.String(16), nullable=False),
        sa.Column("assumptions", sa.Text(), nullable=False),
        sa.Column("status", sa.String(24), nullable=False, server_default="pending-review"),
        sa.Column("authored_by", sa.String(128), nullable=False),
        sa.Column("authored_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("reviewed_by", sa.String(128)),
        sa.Column("reviewed_at", sa.DateTime(timezone=True)),
        sa.Column("review_reference", sa.String(255)),
        sa.Column("review_note", sa.Text()),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.UniqueConstraint("assessment_number", name="uq_factory_product_assessment_number"),
        sa.UniqueConstraint("study_id", name="uq_factory_product_study_assessment"),
    )
    indexes("factory_product_opportunity_assessments", ("assessment_number", "study_id", "status"))

    op.create_table(
        "factory_product_intelligence_releases", *tenant_columns(),
        sa.Column("release_number", sa.String(96), nullable=False),
        sa.Column("application_id", sa.String(100), nullable=False),
        sa.Column("release_version", sa.String(64), nullable=False),
        sa.Column("study_id", sa.String(100), nullable=False),
        sa.Column("study_number", sa.String(96), nullable=False),
        sa.Column("assessment_id", sa.String(100), nullable=False),
        sa.Column("assessment_number", sa.String(96), nullable=False),
        sa.Column("assessment_hash", sa.String(64), nullable=False),
        sa.Column("manifest_json", sa.JSON(), nullable=False),
        sa.Column("manifest_hash", sa.String(64), nullable=False),
        sa.Column("tenant_scope", sa.String(255), nullable=False),
        sa.Column("region_scope_json", sa.JSON(), nullable=False),
        sa.Column("connector_scope_json", sa.JSON(), nullable=False),
        sa.Column("support_owner", sa.String(128), nullable=False),
        sa.Column("support_until", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_to_end_demo_reference", sa.String(255), nullable=False),
        sa.Column("role_training_reference", sa.String(255), nullable=False),
        sa.Column("issue_closure_reference", sa.String(255), nullable=False),
        sa.Column("pilot_report_reference", sa.String(255), nullable=False),
        sa.Column("runtime_monitoring_reference", sa.String(255), nullable=False),
        sa.Column("rollback_drill_reference", sa.String(255), nullable=False),
        sa.Column("status", sa.String(24), nullable=False, server_default="pending-approval"),
        sa.Column("available", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("prepared_by", sa.String(128), nullable=False),
        sa.Column("prepared_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("approved_by", sa.String(128)),
        sa.Column("approved_at", sa.DateTime(timezone=True)),
        sa.Column("approval_reference", sa.String(255)),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.UniqueConstraint("release_number", name="uq_factory_product_release_number"),
        sa.UniqueConstraint("project_id", "application_id", "release_version", name="uq_factory_product_app_version"),
        sa.UniqueConstraint("assessment_id", name="uq_factory_product_assessment_release"),
    )
    indexes("factory_product_intelligence_releases", ("release_number", "application_id", "assessment_id", "status", "available"))

    op.create_table(
        "factory_product_intelligence_evidence", *tenant_columns(),
        sa.Column("evidence_number", sa.String(96), nullable=False),
        sa.Column("subject_type", sa.String(40), nullable=False),
        sa.Column("subject_id", sa.String(100), nullable=False),
        sa.Column("subject_number", sa.String(96), nullable=False),
        sa.Column("evidence_type", sa.String(64), nullable=False),
        sa.Column("evidence_reference", sa.String(255), nullable=False),
        sa.Column("note", sa.Text()),
        sa.Column("recorded_by", sa.String(128), nullable=False),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("evidence_number", name="uq_factory_product_evidence_number"),
    )
    indexes("factory_product_intelligence_evidence", ("evidence_number", "subject_type", "subject_id"))

    bind = op.get_bind()
    bind.execute(sa.text("INSERT INTO factory_core_object_contracts (id,sequence,label,system_of_record,identity_rule,minimum_fields_json,lifecycle_status,schema_version,revision,updated_by) SELECT 'product-opportunity-study',23,'产品机会研究','identity','研究由租户、产品引用和不可变来源信号确定，不改写PLM事实。','[\"tenantId\",\"studyId\",\"productReference\",\"status\",\"version\"]','frozen',1,1,'migration' WHERE NOT EXISTS (SELECT 1 FROM factory_core_object_contracts WHERE id='product-opportunity-study')"))
    bind.execute(sa.text("INSERT INTO factory_core_event_contracts (id,sequence,label,subject_id,producer,consumers_json,required_fields_json,compatibility,lifecycle_status,schema_version,revision,updated_by) SELECT 'product-opportunity-released',15,'产品机会发布','product-opportunity-study','identity','[\"content\",\"lead\",\"decision\"]','[\"eventId\",\"tenantId\",\"eventType\",\"occurredAt\",\"source\",\"subjectId\",\"version\",\"correlationId\"]','backward','frozen',1,1,'migration' WHERE NOT EXISTS (SELECT 1 FROM factory_core_event_contracts WHERE id='product-opportunity-released')"))
    update_permissions(False)


def downgrade():
    update_permissions(True)
    bind = op.get_bind()
    bind.execute(sa.text("DELETE FROM factory_core_event_contracts WHERE id='product-opportunity-released'"))
    bind.execute(sa.text("DELETE FROM factory_core_object_contracts WHERE id='product-opportunity-study'"))
    for table in reversed(TABLES):
        op.drop_table(table)
