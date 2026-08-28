"""factory structured data center

Revision ID: 0a4c7e2d9f61
Revises: f7d39a5b8ce6
Create Date: 2026-08-02

Rollback removes only structured-data mappings, validation snapshots, immutable
JSON-LD releases, publications, evidence and permissions. It never deletes or
modifies knowledge graphs, product masters, content masters, websites or search
consumers. Export published document hashes and acknowledgements first.
"""
import json
from alembic import op
import sqlalchemy as sa

revision = "0a4c7e2d9f61"
down_revision = "f7d39a5b8ce6"
branch_labels = None
depends_on = None
PERMISSIONS = ("factory.recommend.structured.bundle.manage", "factory.recommend.structured.mapping.verify", "factory.recommend.structured.validation.execute", "factory.recommend.structured.publish", "factory.recommend.structured.handoff.acknowledge")
TABLES = ("factory_structured_data_bundles", "factory_structured_data_mappings", "factory_structured_data_validations", "factory_structured_data_releases", "factory_structured_data_publications", "factory_structured_data_evidence")


def tenant():
    return [sa.Column("id", sa.String(100), primary_key=True), sa.Column("project_id", sa.Integer(), nullable=False), sa.Column("agent_path", sa.String(255), nullable=False), sa.Column("tenant_id", sa.String(128), nullable=False), sa.Column("client_id", sa.String(128), nullable=False), sa.Column("plan_id", sa.String(128), nullable=False)]


def indexes(table, extras=()):
    for column in ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", *extras):
        op.create_index(f"ix_{table}_{column}", table, [column])


def permissions(remove):
    bind = op.get_bind()
    rows = bind.execute(sa.text("SELECT id,permissions_json FROM roles_platform WHERE is_system=1 AND scope IN ('client','project')")).mappings().all()
    for row in rows:
        try:
            values = json.loads(row["permissions_json"] or "[]")
        except (TypeError, ValueError):
            values = []
        if not isinstance(values, list):
            values = []
        values = [item for item in values if item not in PERMISSIONS] if remove else list(dict.fromkeys([*values, *PERMISSIONS]))
        bind.execute(sa.text("UPDATE roles_platform SET permissions_json=:permissions WHERE id=:id"), {"permissions": json.dumps(values, ensure_ascii=False), "id": row["id"]})


def upgrade():
    op.create_table("factory_structured_data_bundles", *tenant(), sa.Column("bundle_number", sa.String(96), nullable=False), sa.Column("bundle_code", sa.String(64), nullable=False), sa.Column("bundle_name", sa.String(180), nullable=False), sa.Column("target_site_reference", sa.String(180), nullable=False), sa.Column("default_locale", sa.String(16), nullable=False), sa.Column("graph_id", sa.String(100), nullable=False), sa.Column("graph_number", sa.String(96), nullable=False), sa.Column("graph_version_id", sa.String(100), nullable=False), sa.Column("graph_version_number", sa.Integer(), nullable=False), sa.Column("graph_manifest_hash", sa.String(64), nullable=False), sa.Column("status", sa.String(24), nullable=False, server_default="draft"), sa.Column("authored_by", sa.String(128), nullable=False), sa.Column("published_by", sa.String(128)), sa.Column("published_at", sa.DateTime(timezone=True)), sa.Column("revision", sa.Integer(), nullable=False, server_default="1"), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False), sa.UniqueConstraint("bundle_number", name="uq_factory_structured_bundle_number"), sa.UniqueConstraint("project_id", "bundle_code", name="uq_factory_structured_project_bundle")); indexes("factory_structured_data_bundles", ("bundle_number", "graph_id", "graph_version_id", "status"))
    op.create_table("factory_structured_data_mappings", *tenant(), sa.Column("mapping_number", sa.String(96), nullable=False), sa.Column("bundle_id", sa.String(100), nullable=False), sa.Column("bundle_number", sa.String(96), nullable=False), sa.Column("schema_type", sa.String(40), nullable=False), sa.Column("source_entity_type", sa.String(32), nullable=False), sa.Column("source_entity_id", sa.String(100), nullable=False), sa.Column("source_entity_number", sa.String(96), nullable=False), sa.Column("source_entity_revision", sa.Integer(), nullable=False), sa.Column("source_entity_fingerprint", sa.String(64), nullable=False), sa.Column("field_map_json", sa.JSON(), nullable=False), sa.Column("required_fields_json", sa.JSON(), nullable=False), sa.Column("status", sa.String(24), nullable=False, server_default="pending"), sa.Column("created_by", sa.String(128), nullable=False), sa.Column("verified_by", sa.String(128)), sa.Column("verified_at", sa.DateTime(timezone=True)), sa.Column("verification_reference", sa.String(255)), sa.Column("revision", sa.Integer(), nullable=False, server_default="1"), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False), sa.UniqueConstraint("mapping_number", name="uq_factory_structured_mapping_number"), sa.UniqueConstraint("bundle_id", "schema_type", name="uq_factory_structured_bundle_schema")); indexes("factory_structured_data_mappings", ("mapping_number", "bundle_id", "schema_type", "source_entity_id", "status"))
    op.create_table("factory_structured_data_validations", *tenant(), sa.Column("validation_number", sa.String(96), nullable=False), sa.Column("bundle_id", sa.String(100), nullable=False), sa.Column("bundle_number", sa.String(96), nullable=False), sa.Column("graph_manifest_hash", sa.String(64), nullable=False), sa.Column("mapping_count", sa.Integer(), nullable=False), sa.Column("error_count", sa.Integer(), nullable=False), sa.Column("warning_count", sa.Integer(), nullable=False), sa.Column("report_json", sa.JSON(), nullable=False), sa.Column("generated_document_json", sa.JSON(), nullable=False), sa.Column("generated_hash", sa.String(64), nullable=False), sa.Column("status", sa.String(24), nullable=False), sa.Column("executed_by", sa.String(128), nullable=False), sa.Column("executed_at", sa.DateTime(timezone=True), nullable=False), sa.UniqueConstraint("validation_number", name="uq_factory_structured_validation_number")); indexes("factory_structured_data_validations", ("validation_number", "bundle_id", "status"))
    op.create_table("factory_structured_data_releases", *tenant(), sa.Column("release_number", sa.String(96), nullable=False), sa.Column("bundle_id", sa.String(100), nullable=False), sa.Column("bundle_number", sa.String(96), nullable=False), sa.Column("validation_id", sa.String(100), nullable=False), sa.Column("validation_number", sa.String(96), nullable=False), sa.Column("version_number", sa.Integer(), nullable=False), sa.Column("document_json", sa.JSON(), nullable=False), sa.Column("document_hash", sa.String(64), nullable=False), sa.Column("schema_types_json", sa.JSON(), nullable=False), sa.Column("status", sa.String(24), nullable=False, server_default="published"), sa.Column("published_by", sa.String(128), nullable=False), sa.Column("published_at", sa.DateTime(timezone=True), nullable=False), sa.UniqueConstraint("release_number", name="uq_factory_structured_release_number"), sa.UniqueConstraint("bundle_id", "version_number", name="uq_factory_structured_bundle_version")); indexes("factory_structured_data_releases", ("release_number", "bundle_id", "validation_id", "status"))
    op.create_table("factory_structured_data_publications", *tenant(), sa.Column("publication_number", sa.String(96), nullable=False), sa.Column("bundle_id", sa.String(100), nullable=False), sa.Column("release_id", sa.String(100), nullable=False), sa.Column("release_number", sa.String(96), nullable=False), sa.Column("document_hash", sa.String(64), nullable=False), sa.Column("consumer", sa.String(32), nullable=False), sa.Column("deployment_reference", sa.String(255), nullable=False), sa.Column("consumer_mutated", sa.Boolean(), nullable=False, server_default="0"), sa.Column("status", sa.String(24), nullable=False, server_default="pending"), sa.Column("created_by", sa.String(128), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False), sa.Column("acknowledged_by", sa.String(128)), sa.Column("acknowledged_at", sa.DateTime(timezone=True)), sa.Column("acknowledgement_reference", sa.String(255)), sa.Column("revision", sa.Integer(), nullable=False, server_default="1"), sa.UniqueConstraint("publication_number", name="uq_factory_structured_publication_number"), sa.UniqueConstraint("release_id", "consumer", name="uq_factory_structured_release_consumer")); indexes("factory_structured_data_publications", ("publication_number", "bundle_id", "release_id", "status"))
    op.create_table("factory_structured_data_evidence", *tenant(), sa.Column("evidence_number", sa.String(96), nullable=False), sa.Column("subject_type", sa.String(40), nullable=False), sa.Column("subject_id", sa.String(100), nullable=False), sa.Column("subject_number", sa.String(96), nullable=False), sa.Column("evidence_type", sa.String(48), nullable=False), sa.Column("evidence_reference", sa.String(255), nullable=False), sa.Column("note", sa.Text()), sa.Column("recorded_by", sa.String(128), nullable=False), sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False), sa.UniqueConstraint("evidence_number", name="uq_factory_structured_evidence_number")); indexes("factory_structured_data_evidence", ("evidence_number", "subject_type", "subject_id"))
    permissions(False)


def downgrade():
    permissions(True)
    for table in reversed(TABLES):
        op.drop_table(table)
