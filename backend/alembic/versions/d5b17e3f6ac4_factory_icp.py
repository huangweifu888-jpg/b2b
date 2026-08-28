"""factory ICP customer positioning

Revision ID: d5b17e3f6ac4
Revises: c4a06d2e5fb3
Create Date: 2026-08-02

Rollback removes only ICP definitions, buying roles, scenarios, pinned account
evidence, fit assessments, activation acknowledgements and ICP permissions.
It never changes CPQ, fulfillment, installed-asset, VOC, CRM or consumer data.
Export active ICP versions and acknowledged activation payloads before rollback.
"""

from __future__ import annotations

import json

from alembic import op
import sqlalchemy as sa


revision = "d5b17e3f6ac4"
down_revision = "c4a06d2e5fb3"
branch_labels = None
depends_on = None

PERMISSIONS = (
    "factory.identity.icp.profile.manage", "factory.identity.icp.profile.approve",
    "factory.identity.icp.evidence.capture", "factory.identity.icp.evidence.verify",
    "factory.identity.icp.fit.assess", "factory.identity.icp.fit.verify",
    "factory.identity.icp.activation.manage", "factory.identity.icp.activation.acknowledge",
)
TABLES = (
    "factory_icp_profiles", "factory_icp_versions", "factory_icp_buying_roles", "factory_icp_scenarios",
    "factory_icp_account_evidence", "factory_icp_fit_assessments", "factory_icp_activations", "factory_icp_evidence",
)


def tenant_columns():
    return [
        sa.Column("id", sa.String(100), primary_key=True), sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("agent_path", sa.String(255), nullable=False), sa.Column("tenant_id", sa.String(128), nullable=False),
        sa.Column("client_id", sa.String(128), nullable=False), sa.Column("plan_id", sa.String(128), nullable=False),
    ]


def base_indexes(table, extras=()):
    for column in ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", *extras):
        op.create_index(f"ix_{table}_{column}", table, [column])


def permissions(remove: bool):
    bind = op.get_bind()
    rows = bind.execute(sa.text("SELECT id,permissions_json FROM roles_platform WHERE is_system=1 AND scope IN ('client','project')")).mappings().all()
    for row in rows:
        try: values = json.loads(row["permissions_json"] or "[]")
        except (TypeError, ValueError): values = []
        if not isinstance(values, list): values = []
        values = [x for x in values if x not in PERMISSIONS] if remove else list(dict.fromkeys([*values, *PERMISSIONS]))
        bind.execute(sa.text("UPDATE roles_platform SET permissions_json=:permissions WHERE id=:id"), {"permissions": json.dumps(values, ensure_ascii=False), "id": row["id"]})


def upgrade():
    op.create_table(
        "factory_icp_profiles", *tenant_columns(),
        sa.Column("profile_number", sa.String(96), nullable=False), sa.Column("profile_code", sa.String(64), nullable=False),
        sa.Column("profile_name", sa.String(180), nullable=False), sa.Column("market_mode", sa.String(32), nullable=False),
        sa.Column("customer_type", sa.String(16), nullable=False), sa.Column("objective", sa.Text(), nullable=False),
        sa.Column("current_version", sa.Integer(), nullable=False, server_default="0"), sa.Column("status", sa.String(24), nullable=False, server_default="draft"),
        sa.Column("authored_by", sa.String(128), nullable=False), sa.Column("approved_by", sa.String(128)),
        sa.Column("approved_at", sa.DateTime(timezone=True)), sa.Column("approval_reference", sa.String(255)),
        sa.Column("retired_by", sa.String(128)), sa.Column("retired_at", sa.DateTime(timezone=True)), sa.Column("retirement_reference", sa.String(255)),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"), sa.Column("updated_by", sa.String(128), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("profile_number", name="uq_factory_icp_profile_number"),
        sa.UniqueConstraint("project_id", "tenant_id", "profile_code", name="uq_factory_icp_profile_code"),
    ); base_indexes("factory_icp_profiles", ("profile_number", "status"))
    op.create_table(
        "factory_icp_versions", *tenant_columns(),
        sa.Column("version_reference", sa.String(96), nullable=False), sa.Column("profile_id", sa.String(100), nullable=False),
        sa.Column("profile_number", sa.String(96), nullable=False), sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("countries_json", sa.JSON(), nullable=False), sa.Column("industries_json", sa.JSON(), nullable=False),
        sa.Column("company_size_bands_json", sa.JSON(), nullable=False), sa.Column("product_references_json", sa.JSON(), nullable=False),
        sa.Column("required_roles_json", sa.JSON(), nullable=False), sa.Column("buying_triggers_json", sa.JSON(), nullable=False),
        sa.Column("minimum_potential_value", sa.Numeric(18, 2), nullable=False, server_default="0"), sa.Column("currency", sa.String(8), nullable=False, server_default="CNY"),
        sa.Column("scoring_weights_json", sa.JSON(), nullable=False), sa.Column("definition_hash", sa.String(64), nullable=False),
        sa.Column("status", sa.String(24), nullable=False, server_default="draft"), sa.Column("created_by", sa.String(128), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False), sa.Column("activated_by", sa.String(128)), sa.Column("activated_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("version_reference", name="uq_factory_icp_version_reference"), sa.UniqueConstraint("profile_id", "version_number", name="uq_factory_icp_profile_version"),
    ); base_indexes("factory_icp_versions", ("version_reference", "profile_id"))
    op.create_table(
        "factory_icp_buying_roles", *tenant_columns(),
        sa.Column("role_number", sa.String(96), nullable=False), sa.Column("profile_id", sa.String(100), nullable=False), sa.Column("profile_number", sa.String(96), nullable=False),
        sa.Column("role_code", sa.String(64), nullable=False), sa.Column("role_name", sa.String(128), nullable=False), sa.Column("influence_type", sa.String(32), nullable=False),
        sa.Column("pains_json", sa.JSON(), nullable=False), sa.Column("proof_requirements_json", sa.JSON(), nullable=False), sa.Column("preferred_channels_json", sa.JSON(), nullable=False),
        sa.Column("created_by", sa.String(128), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("role_number", name="uq_factory_icp_role_number"), sa.UniqueConstraint("profile_id", "role_code", name="uq_factory_icp_profile_role"),
    ); base_indexes("factory_icp_buying_roles", ("profile_id",))
    op.create_table(
        "factory_icp_scenarios", *tenant_columns(),
        sa.Column("scenario_number", sa.String(96), nullable=False), sa.Column("profile_id", sa.String(100), nullable=False), sa.Column("profile_number", sa.String(96), nullable=False),
        sa.Column("scenario_code", sa.String(64), nullable=False), sa.Column("scenario_name", sa.String(128), nullable=False), sa.Column("job_to_be_done", sa.Text(), nullable=False),
        sa.Column("buying_trigger", sa.String(255), nullable=False), sa.Column("product_references_json", sa.JSON(), nullable=False), sa.Column("success_outcomes_json", sa.JSON(), nullable=False),
        sa.Column("disqualifiers_json", sa.JSON(), nullable=False), sa.Column("created_by", sa.String(128), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("scenario_number", name="uq_factory_icp_scenario_number"), sa.UniqueConstraint("profile_id", "scenario_code", name="uq_factory_icp_profile_scenario"),
    ); base_indexes("factory_icp_scenarios", ("profile_id",))
    op.create_table(
        "factory_icp_account_evidence", *tenant_columns(),
        sa.Column("evidence_number", sa.String(96), nullable=False), sa.Column("profile_id", sa.String(100), nullable=False), sa.Column("profile_number", sa.String(96), nullable=False),
        sa.Column("account_reference", sa.String(180), nullable=False), sa.Column("source_type", sa.String(40), nullable=False), sa.Column("source_id", sa.String(100), nullable=False),
        sa.Column("source_number", sa.String(96), nullable=False), sa.Column("source_revision", sa.Integer(), nullable=False), sa.Column("source_status", sa.String(32), nullable=False),
        sa.Column("source_snapshot_json", sa.JSON(), nullable=False), sa.Column("firmographic_country", sa.String(64)), sa.Column("firmographic_industry", sa.String(128)),
        sa.Column("firmographic_company_size", sa.String(64)), sa.Column("firmographic_evidence_reference", sa.String(255)),
        sa.Column("observed_roles_json", sa.JSON(), nullable=False), sa.Column("observed_triggers_json", sa.JSON(), nullable=False), sa.Column("observed_products_json", sa.JSON(), nullable=False),
        sa.Column("potential_value", sa.Numeric(18, 2), nullable=False, server_default="0"), sa.Column("currency", sa.String(8), nullable=False, server_default="CNY"),
        sa.Column("verification_status", sa.String(24), nullable=False, server_default="pending"), sa.Column("captured_by", sa.String(128), nullable=False),
        sa.Column("captured_at", sa.DateTime(timezone=True), nullable=False), sa.Column("verified_by", sa.String(128)), sa.Column("verified_at", sa.DateTime(timezone=True)),
        sa.Column("verification_reference", sa.String(255)), sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.UniqueConstraint("evidence_number", name="uq_factory_icp_account_evidence_number"), sa.UniqueConstraint("profile_id", "source_type", "source_id", name="uq_factory_icp_profile_source"),
    ); base_indexes("factory_icp_account_evidence", ("evidence_number", "profile_id", "account_reference"))
    op.create_table(
        "factory_icp_fit_assessments", *tenant_columns(),
        sa.Column("assessment_number", sa.String(96), nullable=False), sa.Column("profile_id", sa.String(100), nullable=False), sa.Column("profile_number", sa.String(96), nullable=False),
        sa.Column("profile_version", sa.Integer(), nullable=False), sa.Column("definition_hash", sa.String(64), nullable=False),
        sa.Column("account_evidence_id", sa.String(100), nullable=False), sa.Column("account_evidence_number", sa.String(96), nullable=False), sa.Column("account_reference", sa.String(180), nullable=False),
        sa.Column("score_components_json", sa.JSON(), nullable=False), sa.Column("total_score", sa.Numeric(5, 2), nullable=False), sa.Column("fit_tier", sa.String(16), nullable=False),
        sa.Column("explanation", sa.Text(), nullable=False), sa.Column("disqualified", sa.Boolean(), nullable=False, server_default="0"), sa.Column("status", sa.String(24), nullable=False, server_default="pending"),
        sa.Column("assessed_by", sa.String(128), nullable=False), sa.Column("assessed_at", sa.DateTime(timezone=True), nullable=False), sa.Column("verified_by", sa.String(128)),
        sa.Column("verified_at", sa.DateTime(timezone=True)), sa.Column("verification_reference", sa.String(255)), sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.UniqueConstraint("assessment_number", name="uq_factory_icp_assessment_number"), sa.UniqueConstraint("profile_id", "account_evidence_id", name="uq_factory_icp_profile_assessment"),
    ); base_indexes("factory_icp_fit_assessments", ("assessment_number", "profile_id", "account_evidence_id", "account_reference"))
    op.create_table(
        "factory_icp_activations", *tenant_columns(),
        sa.Column("activation_number", sa.String(96), nullable=False), sa.Column("profile_id", sa.String(100), nullable=False), sa.Column("profile_number", sa.String(96), nullable=False),
        sa.Column("profile_version", sa.Integer(), nullable=False), sa.Column("definition_hash", sa.String(64), nullable=False), sa.Column("consumer", sa.String(64), nullable=False),
        sa.Column("minimum_fit_tier", sa.String(16), nullable=False), sa.Column("delivery_reference", sa.String(255), nullable=False), sa.Column("status", sa.String(24), nullable=False, server_default="pending"),
        sa.Column("created_by", sa.String(128), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False), sa.Column("acknowledged_by", sa.String(128)),
        sa.Column("acknowledged_at", sa.DateTime(timezone=True)), sa.Column("acknowledgement_reference", sa.String(255)), sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.UniqueConstraint("activation_number", name="uq_factory_icp_activation_number"), sa.UniqueConstraint("profile_id", "consumer", name="uq_factory_icp_profile_consumer"),
    ); base_indexes("factory_icp_activations", ("activation_number", "profile_id"))
    op.create_table(
        "factory_icp_evidence", *tenant_columns(),
        sa.Column("event_number", sa.String(96), nullable=False), sa.Column("subject_type", sa.String(40), nullable=False), sa.Column("subject_id", sa.String(100), nullable=False),
        sa.Column("subject_number", sa.String(96), nullable=False), sa.Column("evidence_type", sa.String(48), nullable=False), sa.Column("reference", sa.String(255), nullable=False),
        sa.Column("note", sa.Text()), sa.Column("recorded_by", sa.String(128), nullable=False), sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("event_number", name="uq_factory_icp_event_number"),
    ); base_indexes("factory_icp_evidence", ("event_number", "subject_type", "subject_id"))
    permissions(False)


def downgrade():
    permissions(True)
    for table in reversed(TABLES):
        bind = op.get_bind()
        indexes = [row[1] for row in bind.execute(sa.text(f"PRAGMA index_list('{table}')")).fetchall()] if bind.dialect.name == "sqlite" else []
        for name in indexes:
            if name.startswith("ix_"): op.drop_index(name, table_name=table)
        op.drop_table(table)
