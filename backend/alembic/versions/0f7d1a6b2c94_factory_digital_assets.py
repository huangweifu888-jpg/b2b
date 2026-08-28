"""governed AI site-plan and digital-asset handoff

Revision ID: 0f7d1a6b2c94
Revises: f31c7a9b2d60

Rollback removes only digital-asset workflow projections, permissions and contracts.
It never purchases, binds, transfers or deletes a domain, and never publishes or
overwrites a site, template or protected customer configuration.
"""

import json

from alembic import op
import sqlalchemy as sa

revision = "0f7d1a6b2c94"
down_revision = "f31c7a9b2d60"
branch_labels = None
depends_on = None

PERMISSIONS = (
    "factory.identity.digital-assets.manage",
    "factory.identity.digital-assets.suggestion.review",
    "factory.identity.digital-assets.asset.approve",
    "factory.identity.digital-assets.plan.approve",
    "factory.identity.digital-assets.handoff.approve",
)
TABLES = (
    "factory_digital_asset_plans", "factory_digital_asset_suggestions", "factory_digital_asset_registers",
    "factory_digital_asset_handoffs", "factory_digital_asset_evidence",
)


def tenant_columns():
    return [sa.Column("id", sa.String(100), primary_key=True), sa.Column("project_id", sa.Integer(), nullable=False), sa.Column("agent_path", sa.String(255), nullable=False), sa.Column("tenant_id", sa.String(128), nullable=False), sa.Column("client_id", sa.String(128), nullable=False), sa.Column("plan_id", sa.String(128), nullable=False)]


def indexes(table: str, extra: tuple[str, ...] = ()):
    for column in ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", *extra):
        op.create_index(f"ix_{table}_{column}", table, [column])


def permissions(remove: bool):
    bind = op.get_bind()
    rows = bind.execute(sa.text("SELECT id, permissions_json FROM roles_platform WHERE is_system=1 AND scope IN ('client','project')")).mappings().all()
    for row in rows:
        try:
            values = json.loads(row["permissions_json"] or "[]")
        except (TypeError, ValueError):
            values = []
        values = [item for item in values if item not in PERMISSIONS] if remove else list(dict.fromkeys([*values, *PERMISSIONS]))
        bind.execute(sa.text("UPDATE roles_platform SET permissions_json=:permissions WHERE id=:id"), {"permissions": json.dumps(values, ensure_ascii=False), "id": row["id"]})


def upgrade():
    op.create_table("factory_digital_asset_plans", *tenant_columns(), sa.Column("plan_number", sa.String(96), nullable=False), sa.Column("business_goal", sa.Text(), nullable=False), sa.Column("target_market", sa.String(120), nullable=False), sa.Column("target_audience", sa.Text(), nullable=False), sa.Column("site_scope", sa.Text(), nullable=False), sa.Column("status", sa.String(32), nullable=False, server_default="draft"), sa.Column("authored_by", sa.String(128), nullable=False), sa.Column("approved_by", sa.String(128)), sa.Column("approved_at", sa.DateTime(timezone=True)), sa.Column("approval_reference", sa.String(255)), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False), sa.Column("revision", sa.Integer(), nullable=False, server_default="1"), sa.UniqueConstraint("plan_number", name="uq_factory_digital_asset_plan_number")); indexes("factory_digital_asset_plans", ("plan_number", "status"))
    op.create_table("factory_digital_asset_suggestions", *tenant_columns(), sa.Column("suggestion_number", sa.String(96), nullable=False), sa.Column("source_plan_id", sa.String(100), nullable=False), sa.Column("plan_number", sa.String(96), nullable=False), sa.Column("suggestion_type", sa.String(64), nullable=False), sa.Column("recommendation_json", sa.JSON(), nullable=False), sa.Column("source_reference", sa.String(255), nullable=False), sa.Column("suggestion_hash", sa.String(64), nullable=False), sa.Column("status", sa.String(32), nullable=False, server_default="pending-review"), sa.Column("generated_by", sa.String(128), nullable=False), sa.Column("generated_at", sa.DateTime(timezone=True), nullable=False), sa.Column("reviewed_by", sa.String(128)), sa.Column("reviewed_at", sa.DateTime(timezone=True)), sa.Column("review_reference", sa.String(255)), sa.Column("revision", sa.Integer(), nullable=False, server_default="1"), sa.UniqueConstraint("suggestion_number", name="uq_factory_digital_asset_suggestion_number"), sa.UniqueConstraint("source_plan_id", "suggestion_hash", name="uq_factory_digital_asset_suggestion_hash")); indexes("factory_digital_asset_suggestions", ("suggestion_number", "source_plan_id", "status"))
    op.create_table("factory_digital_asset_registers", *tenant_columns(), sa.Column("asset_number", sa.String(96), nullable=False), sa.Column("source_plan_id", sa.String(100), nullable=False), sa.Column("plan_number", sa.String(96), nullable=False), sa.Column("asset_kind", sa.String(32), nullable=False), sa.Column("asset_identifier", sa.String(255), nullable=False), sa.Column("ownership_reference", sa.String(255), nullable=False), sa.Column("rights_scope", sa.Text(), nullable=False), sa.Column("registrar_secret_stored", sa.Boolean(), nullable=False, server_default="0"), sa.Column("status", sa.String(32), nullable=False, server_default="pending-approval"), sa.Column("registered_by", sa.String(128), nullable=False), sa.Column("registered_at", sa.DateTime(timezone=True), nullable=False), sa.Column("approved_by", sa.String(128)), sa.Column("approved_at", sa.DateTime(timezone=True)), sa.Column("approval_reference", sa.String(255)), sa.Column("revision", sa.Integer(), nullable=False, server_default="1"), sa.UniqueConstraint("asset_number", name="uq_factory_digital_asset_asset_number"), sa.UniqueConstraint("project_id", "asset_kind", "asset_identifier", name="uq_factory_digital_asset_identifier")); indexes("factory_digital_asset_registers", ("asset_number", "source_plan_id", "status"))
    op.create_table("factory_digital_asset_handoffs", *tenant_columns(), sa.Column("handoff_number", sa.String(96), nullable=False), sa.Column("application_id", sa.String(100), nullable=False), sa.Column("source_plan_id", sa.String(100), nullable=False), sa.Column("plan_number", sa.String(96), nullable=False), sa.Column("release_version", sa.String(64), nullable=False), sa.Column("manifest_json", sa.JSON(), nullable=False), sa.Column("manifest_hash", sa.String(64), nullable=False), sa.Column("support_owner", sa.String(128), nullable=False), sa.Column("support_until", sa.DateTime(timezone=True), nullable=False), *[sa.Column(name, sa.String(255), nullable=False) for name in ("customer_trial_reference", "role_training_reference", "issue_closure_reference", "monitoring_reference", "rollback_reference")], sa.Column("status", sa.String(32), nullable=False, server_default="pending-approval"), sa.Column("available", sa.Boolean(), nullable=False, server_default="0"), sa.Column("prepared_by", sa.String(128), nullable=False), sa.Column("prepared_at", sa.DateTime(timezone=True), nullable=False), sa.Column("approved_by", sa.String(128)), sa.Column("approved_at", sa.DateTime(timezone=True)), sa.Column("approval_reference", sa.String(255)), sa.Column("revision", sa.Integer(), nullable=False, server_default="1"), sa.UniqueConstraint("handoff_number", name="uq_factory_digital_asset_handoff_number"), sa.UniqueConstraint("source_plan_id", "release_version", name="uq_factory_digital_asset_release_version")); indexes("factory_digital_asset_handoffs", ("handoff_number", "source_plan_id", "status", "available"))
    op.create_table("factory_digital_asset_evidence", *tenant_columns(), sa.Column("evidence_number", sa.String(96), nullable=False), sa.Column("subject_type", sa.String(40), nullable=False), sa.Column("subject_id", sa.String(100), nullable=False), sa.Column("subject_number", sa.String(96), nullable=False), sa.Column("evidence_type", sa.String(64), nullable=False), sa.Column("evidence_reference", sa.String(255), nullable=False), sa.Column("note", sa.Text()), sa.Column("recorded_by", sa.String(128), nullable=False), sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False), sa.UniqueConstraint("evidence_number", name="uq_factory_digital_asset_evidence_number")); indexes("factory_digital_asset_evidence", ("evidence_number", "subject_type", "subject_id"))
    bind = op.get_bind()
    bind.execute(sa.text("INSERT INTO factory_core_object_contracts (id,sequence,label,system_of_record,identity_rule,minimum_fields_json,lifecycle_status,schema_version,revision,updated_by) SELECT 'digital-asset-plan',27,'Digital asset plan','identity','tenant and plan','[\"tenantId\",\"planId\",\"assetId\",\"rightsStatus\"]','frozen',1,1,'migration' WHERE NOT EXISTS (SELECT 1 FROM factory_core_object_contracts WHERE id='digital-asset-plan')"))
    bind.execute(sa.text("INSERT INTO factory_core_event_contracts (id,sequence,label,subject_id,producer,consumers_json,required_fields_json,compatibility,lifecycle_status,schema_version,revision,updated_by) SELECT 'digital-assets-released',19,'Digital assets released','digital-asset-plan','identity','[\"content\",\"lead\"]','[\"eventId\",\"tenantId\",\"eventType\",\"subjectId\",\"version\"]','backward','frozen',1,1,'migration' WHERE NOT EXISTS (SELECT 1 FROM factory_core_event_contracts WHERE id='digital-assets-released')"))
    permissions(False)


def downgrade():
    permissions(True)
    bind = op.get_bind()
    bind.execute(sa.text("DELETE FROM factory_core_event_contracts WHERE id='digital-assets-released'"))
    bind.execute(sa.text("DELETE FROM factory_core_object_contracts WHERE id='digital-asset-plan'"))
    for table in reversed(TABLES):
        op.drop_table(table)
