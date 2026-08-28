"""add governed website build programs

Revision ID: a01b2c3d4e5f
Revises: ff7b1d3e6a58

Rollback removes only website-build planning records, gate evidence, related
permission grants and contracts. It never deletes a site, content version,
publication, public site, domain, registrar record or source asset.
"""

import json

from alembic import op
import sqlalchemy as sa


revision = "a01b2c3d4e5f"
down_revision = "ff7b1d3e6a58"
branch_labels = None
depends_on = None

PERMISSIONS = (
    "factory.content.website-build.program.manage",
    "factory.content.website-build.gate.verify",
    "factory.content.website-build.activate",
)


def scoped_columns():
    return [
        sa.Column("id", sa.String(100), primary_key=True),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("agent_path", sa.String(255), nullable=False),
        sa.Column("tenant_id", sa.String(128), nullable=False),
        sa.Column("client_id", sa.String(128), nullable=False),
        sa.Column("plan_id", sa.String(128), nullable=False),
    ]


def permission_grants(remove: bool = False):
    bind = op.get_bind()
    rows = bind.execute(sa.text("SELECT id, permissions_json FROM roles_platform WHERE is_system=1 AND scope IN ('client', 'project')")).mappings()
    for row in rows:
        try:
            permissions = json.loads(row["permissions_json"] or "[]")
        except (TypeError, ValueError):
            permissions = []
        permissions = [item for item in permissions if item not in PERMISSIONS] if remove else list(dict.fromkeys([*permissions, *PERMISSIONS]))
        bind.execute(sa.text("UPDATE roles_platform SET permissions_json=:permissions WHERE id=:id"), {"id": row["id"], "permissions": json.dumps(permissions, ensure_ascii=False)})


def upgrade():
    op.create_table(
        "factory_website_build_programs",
        *scoped_columns(),
        sa.Column("program_number", sa.String(96), nullable=False, unique=True),
        sa.Column("program_key", sa.String(100), nullable=False),
        sa.Column("program_name", sa.String(200), nullable=False),
        sa.Column("site_id", sa.String(100)),
        sa.Column("site_mode", sa.String(24), nullable=False),
        sa.Column("market_scope", sa.String(24), nullable=False),
        sa.Column("locales_json", sa.JSON(), nullable=False),
        sa.Column("route_strategy", sa.String(24), nullable=False),
        sa.Column("brief_json", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="draft"),
        sa.Column("current_phase", sa.String(40), nullable=False, server_default="brief"),
        sa.Column("created_by", sa.String(128), nullable=False),
        sa.Column("activated_by", sa.String(128)),
        sa.Column("activation_reference", sa.String(255)),
        sa.Column("activated_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.UniqueConstraint("project_id", "program_key", name="uq_factory_website_build_program_key"),
    )
    op.create_table(
        "factory_website_build_gates",
        *scoped_columns(),
        sa.Column("program_id", sa.String(100), nullable=False),
        sa.Column("gate_key", sa.String(40), nullable=False),
        sa.Column("gate_label", sa.String(100), nullable=False),
        sa.Column("status", sa.String(24), nullable=False, server_default="pending"),
        sa.Column("evidence_reference", sa.String(255)),
        sa.Column("passed_by", sa.String(128)),
        sa.Column("passed_at", sa.DateTime(timezone=True)),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.UniqueConstraint("program_id", "gate_key", name="uq_factory_website_build_gate_key"),
    )
    for table, columns in (
        ("factory_website_build_programs", ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", "program_number", "program_key", "site_id", "status", "current_phase")),
        ("factory_website_build_gates", ("project_id", "program_id", "gate_key", "status")),
    ):
        for column in columns:
            op.create_index(f"ix_{table}_{column}", table, [column])
    bind = op.get_bind()
    bind.execute(sa.text("INSERT INTO factory_core_object_contracts (id,sequence,label,system_of_record,identity_rule,minimum_fields_json,lifecycle_status,schema_version,revision,updated_by) SELECT 'website-build-program',79,'Website build program','content','tenant project and program key','[\"tenantId\",\"projectId\",\"programKey\",\"siteMode\",\"marketScope\",\"locales\",\"routeStrategy\",\"brief\"]','frozen',1,1,'migration' WHERE NOT EXISTS (SELECT 1 FROM factory_core_object_contracts WHERE id='website-build-program')"))
    bind.execute(sa.text("INSERT INTO factory_core_event_contracts (id,sequence,label,subject_id,producer,consumers_json,required_fields_json,compatibility,lifecycle_status,schema_version,revision,updated_by) SELECT 'website-build-activated',63,'Website build activated','website-build-program','content','[\"site-management\",\"operations\",\"analytics\"]','[\"eventId\",\"tenantId\",\"subjectId\",\"sitePublicationId\",\"activationReference\",\"directPublicSiteMutation\"]','backward','frozen',1,1,'migration' WHERE NOT EXISTS (SELECT 1 FROM factory_core_event_contracts WHERE id='website-build-activated')"))
    permission_grants()


def downgrade():
    permission_grants(remove=True)
    bind = op.get_bind()
    bind.execute(sa.text("DELETE FROM factory_core_event_contracts WHERE id='website-build-activated'"))
    bind.execute(sa.text("DELETE FROM factory_core_object_contracts WHERE id='website-build-program'"))
    for table, columns in (
        ("factory_website_build_gates", ("status", "gate_key", "program_id", "project_id")),
        ("factory_website_build_programs", ("current_phase", "status", "site_id", "program_key", "program_number", "plan_id", "client_id", "tenant_id", "agent_path", "project_id")),
    ):
        for column in columns:
            op.drop_index(f"ix_{table}_{column}", table_name=table)
    op.drop_table("factory_website_build_gates")
    op.drop_table("factory_website_build_programs")
