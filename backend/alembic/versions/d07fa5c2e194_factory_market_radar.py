"""governed market radar commercial availability

Revision ID: d07fa5c2e194
Revises: cf6e9a4b1d83
Create Date: 2026-08-03

Rollback removes only market-radar projections, permissions and contract
registrations; it never changes product, connector or external-source data.
"""
import json
from alembic import op
import sqlalchemy as sa

revision = "d07fa5c2e194"
down_revision = "cf6e9a4b1d83"
branch_labels = None
depends_on = None
PERMISSIONS = ("factory.identity.market-radar.manage", "factory.identity.market-radar.signal.verify", "factory.identity.market-radar.decision.review", "factory.identity.market-radar.release.approve")
TABLES = ("factory_market_scans", "factory_market_signals", "factory_market_entry_decisions", "factory_market_radar_releases", "factory_market_radar_evidence")

def tenant_columns(): return [sa.Column("id", sa.String(100), primary_key=True), sa.Column("project_id", sa.Integer(), nullable=False), sa.Column("agent_path", sa.String(255), nullable=False), sa.Column("tenant_id", sa.String(128), nullable=False), sa.Column("client_id", sa.String(128), nullable=False), sa.Column("plan_id", sa.String(128), nullable=False)]
def indexes(table, extra=()):
    for column in ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", *extra): op.create_index(f"ix_{table}_{column}", table, [column])
def update_permissions(remove):
    bind = op.get_bind(); rows = bind.execute(sa.text("SELECT id, permissions_json FROM roles_platform WHERE is_system=1 AND scope IN ('client','project')")).mappings().all()
    for row in rows:
        try: values = json.loads(row["permissions_json"] or "[]")
        except (TypeError, ValueError): values = []
        values = [v for v in values if v not in PERMISSIONS] if remove else list(dict.fromkeys([*values, *PERMISSIONS]))
        bind.execute(sa.text("UPDATE roles_platform SET permissions_json=:p WHERE id=:id"), {"p": json.dumps(values, ensure_ascii=False), "id": row["id"]})

def upgrade():
    op.create_table("factory_market_scans", *tenant_columns(), sa.Column("scan_number", sa.String(96), nullable=False), sa.Column("product_reference", sa.String(180), nullable=False), sa.Column("product_name", sa.String(180), nullable=False), sa.Column("target_country", sa.String(8), nullable=False), sa.Column("target_channel", sa.String(64), nullable=False), sa.Column("objective", sa.Text(), nullable=False), sa.Column("status", sa.String(32), nullable=False, server_default="gathering"), sa.Column("created_by", sa.String(128), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False), sa.Column("revision", sa.Integer(), nullable=False, server_default="1"), sa.UniqueConstraint("scan_number", name="uq_factory_market_scan_number"))
    indexes("factory_market_scans", ("scan_number", "product_reference", "target_country", "status"))
    op.create_table("factory_market_signals", *tenant_columns(), sa.Column("signal_number", sa.String(96), nullable=False), sa.Column("scan_id", sa.String(100), nullable=False), sa.Column("scan_number", sa.String(96), nullable=False), sa.Column("signal_type", sa.String(32), nullable=False), sa.Column("normalized_score", sa.Numeric(6,2), nullable=False), sa.Column("raw_value", sa.Numeric(18,4), nullable=False), sa.Column("measurement_unit", sa.String(32), nullable=False), sa.Column("source_system", sa.String(64), nullable=False), sa.Column("source_reference", sa.String(255), nullable=False), sa.Column("source_revision", sa.String(96), nullable=False), sa.Column("source_observed_at", sa.DateTime(timezone=True), nullable=False), sa.Column("source_hash", sa.String(64), nullable=False), sa.Column("status", sa.String(32), nullable=False, server_default="pending-verification"), sa.Column("recorded_by", sa.String(128), nullable=False), sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False), sa.Column("verified_by", sa.String(128)), sa.Column("verified_at", sa.DateTime(timezone=True)), sa.Column("verification_reference", sa.String(255)), sa.Column("revision", sa.Integer(), nullable=False, server_default="1"), sa.UniqueConstraint("signal_number", name="uq_factory_market_signal_number"), sa.UniqueConstraint("scan_id", "signal_type", name="uq_factory_market_scan_signal"))
    indexes("factory_market_signals", ("signal_number", "scan_id", "signal_type", "status"))
    op.create_table("factory_market_entry_decisions", *tenant_columns(), sa.Column("decision_number", sa.String(96), nullable=False), sa.Column("scan_id", sa.String(100), nullable=False), sa.Column("scan_number", sa.String(96), nullable=False), sa.Column("input_snapshot_json", sa.JSON(), nullable=False), sa.Column("input_hash", sa.String(64), nullable=False), sa.Column("opportunity_score", sa.Numeric(6,2), nullable=False), sa.Column("entry_recommendation", sa.String(16), nullable=False), sa.Column("entry_gate_note", sa.Text(), nullable=False), sa.Column("status", sa.String(24), nullable=False, server_default="pending-review"), sa.Column("authored_by", sa.String(128), nullable=False), sa.Column("authored_at", sa.DateTime(timezone=True), nullable=False), sa.Column("reviewed_by", sa.String(128)), sa.Column("reviewed_at", sa.DateTime(timezone=True)), sa.Column("review_reference", sa.String(255)), sa.Column("revision", sa.Integer(), nullable=False, server_default="1"), sa.UniqueConstraint("decision_number", name="uq_factory_market_decision_number"), sa.UniqueConstraint("scan_id", name="uq_factory_market_scan_decision"))
    indexes("factory_market_entry_decisions", ("decision_number", "scan_id", "status"))
    op.create_table("factory_market_radar_releases", *tenant_columns(), sa.Column("release_number", sa.String(96), nullable=False), sa.Column("application_id", sa.String(100), nullable=False), sa.Column("release_version", sa.String(64), nullable=False), sa.Column("scan_id", sa.String(100), nullable=False), sa.Column("decision_id", sa.String(100), nullable=False), sa.Column("manifest_json", sa.JSON(), nullable=False), sa.Column("manifest_hash", sa.String(64), nullable=False), sa.Column("support_owner", sa.String(128), nullable=False), sa.Column("support_until", sa.DateTime(timezone=True), nullable=False), sa.Column("customer_trial_reference", sa.String(255), nullable=False), sa.Column("role_training_reference", sa.String(255), nullable=False), sa.Column("issue_closure_reference", sa.String(255), nullable=False), sa.Column("monitoring_reference", sa.String(255), nullable=False), sa.Column("rollback_reference", sa.String(255), nullable=False), sa.Column("status", sa.String(24), nullable=False, server_default="pending-approval"), sa.Column("available", sa.Boolean(), nullable=False, server_default="0"), sa.Column("prepared_by", sa.String(128), nullable=False), sa.Column("prepared_at", sa.DateTime(timezone=True), nullable=False), sa.Column("approved_by", sa.String(128)), sa.Column("approved_at", sa.DateTime(timezone=True)), sa.Column("approval_reference", sa.String(255)), sa.Column("revision", sa.Integer(), nullable=False, server_default="1"), sa.UniqueConstraint("release_number", name="uq_factory_market_release_number"), sa.UniqueConstraint("project_id", "release_version", name="uq_factory_market_radar_version"), sa.UniqueConstraint("decision_id", name="uq_factory_market_decision_release"))
    indexes("factory_market_radar_releases", ("release_number", "application_id", "decision_id", "status", "available"))
    op.create_table("factory_market_radar_evidence", *tenant_columns(), sa.Column("evidence_number", sa.String(96), nullable=False), sa.Column("subject_type", sa.String(40), nullable=False), sa.Column("subject_id", sa.String(100), nullable=False), sa.Column("subject_number", sa.String(96), nullable=False), sa.Column("evidence_type", sa.String(64), nullable=False), sa.Column("evidence_reference", sa.String(255), nullable=False), sa.Column("note", sa.Text()), sa.Column("recorded_by", sa.String(128), nullable=False), sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False), sa.UniqueConstraint("evidence_number", name="uq_factory_market_evidence_number"))
    indexes("factory_market_radar_evidence", ("evidence_number", "subject_type", "subject_id"))
    bind = op.get_bind()
    bind.execute(sa.text("INSERT INTO factory_core_object_contracts (id,sequence,label,system_of_record,identity_rule,minimum_fields_json,lifecycle_status,schema_version,revision,updated_by) SELECT 'market-entry-scan',24,'市场进入扫描','identity','租户、产品与目标国家共同确定不可变扫描身份','[\"tenantId\",\"scanId\",\"productReference\",\"targetCountry\",\"status\",\"version\"]','frozen',1,1,'migration' WHERE NOT EXISTS (SELECT 1 FROM factory_core_object_contracts WHERE id='market-entry-scan')"))
    bind.execute(sa.text("INSERT INTO factory_core_event_contracts (id,sequence,label,subject_id,producer,consumers_json,required_fields_json,compatibility,lifecycle_status,schema_version,revision,updated_by) SELECT 'market-entry-released',16,'市场进入发布','market-entry-scan','identity','[\"content\",\"lead\",\"decision\"]','[\"eventId\",\"tenantId\",\"eventType\",\"occurredAt\",\"source\",\"subjectId\",\"version\",\"correlationId\"]','backward','frozen',1,1,'migration' WHERE NOT EXISTS (SELECT 1 FROM factory_core_event_contracts WHERE id='market-entry-released')"))
    update_permissions(False)

def downgrade():
    update_permissions(True); bind = op.get_bind(); bind.execute(sa.text("DELETE FROM factory_core_event_contracts WHERE id='market-entry-released'")); bind.execute(sa.text("DELETE FROM factory_core_object_contracts WHERE id='market-entry-scan'"))
    for table in reversed(TABLES): op.drop_table(table)
