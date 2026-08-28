"""factory legal contract lifecycle

Revision ID: c4a06d2e5fb3
Revises: b3f95c1d4ea2
Create Date: 2026-08-02

Rollback removes only legal-party, immutable-template, business-contract,
legal-review, seal, signature, obligation evidence and related permissions.
It never deletes or changes CPQ, procurement, finance, people, recruiting,
ERP, or Approval Center records. Export active contracts, signature provider
evidence and open obligations before a production rollback.
"""

from __future__ import annotations

import json

from alembic import op
import sqlalchemy as sa


revision = "c4a06d2e5fb3"
down_revision = "b3f95c1d4ea2"
branch_labels = None
depends_on = None

PERMISSIONS = (
    "factory.operations.contracts.party.manage",
    "factory.operations.contracts.party.approve",
    "factory.operations.contracts.template.manage",
    "factory.operations.contracts.template.approve",
    "factory.operations.contracts.contract.manage",
    "factory.operations.contracts.contract.review",
    "factory.operations.contracts.seal.manage",
    "factory.operations.contracts.seal.approve",
    "factory.operations.contracts.signature.manage",
    "factory.operations.contracts.obligation.manage",
)
TABLES = (
    "factory_legal_parties",
    "factory_legal_templates",
    "factory_legal_template_versions",
    "factory_business_contracts",
    "factory_legal_reviews",
    "factory_seal_authorizations",
    "factory_signature_envelopes",
    "factory_contract_obligations",
    "factory_legal_evidence",
)
INDEXES = {
    "factory_legal_parties": ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", "party_number", "party_reference", "identity_fingerprint", "source_id", "status", "authored_by", "approved_by"),
    "factory_legal_templates": ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", "template_number", "template_code", "contract_type", "status", "authored_by", "approved_by"),
    "factory_legal_template_versions": ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", "version_reference", "template_id", "content_hash", "status", "created_by"),
    "factory_business_contracts": ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", "contract_number", "contract_reference", "party_id", "template_id", "source_id", "approval_handoff_id", "status", "expiry_date", "authored_by", "approved_by"),
    "factory_legal_reviews": ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", "review_number", "contract_id", "risk_level", "recommendation", "reviewed_by"),
    "factory_seal_authorizations": ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", "seal_number", "contract_id", "document_hash", "status", "requested_by", "approved_by"),
    "factory_signature_envelopes": ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", "envelope_number", "contract_id", "provider_envelope_reference", "status", "created_by"),
    "factory_contract_obligations": ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", "obligation_number", "contract_id", "owner_reference", "due_date", "status"),
    "factory_legal_evidence": ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", "evidence_number", "subject_type", "subject_id", "evidence_type", "recorded_by"),
}


def tenant_columns():
    return [
        sa.Column("id", sa.String(100), primary_key=True),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("agent_path", sa.String(500), nullable=False),
        sa.Column("tenant_id", sa.String(100), nullable=False),
        sa.Column("client_id", sa.String(100), nullable=False),
        sa.Column("plan_id", sa.String(100), nullable=False),
    ]


def indexes(table):
    for column in INDEXES[table]:
        op.create_index(f"ix_{table}_{column}", table, [column])


def permissions(remove):
    bind = op.get_bind()
    rows = bind.execute(sa.text(
        "SELECT id,permissions_json FROM roles_platform WHERE is_system=1 AND scope IN ('client','project')"
    )).mappings().all()
    for row in rows:
        try:
            values = json.loads(row["permissions_json"] or "[]")
        except (TypeError, ValueError):
            values = []
        if not isinstance(values, list):
            values = []
        values = [x for x in values if x not in PERMISSIONS] if remove else list(dict.fromkeys([*values, *PERMISSIONS]))
        bind.execute(
            sa.text("UPDATE roles_platform SET permissions_json=:permissions WHERE id=:id"),
            {"permissions": json.dumps(values, ensure_ascii=False), "id": row["id"]},
        )


def upgrade():
    op.create_table(
        "factory_legal_parties", *tenant_columns(),
        sa.Column("party_number", sa.String(100), nullable=False), sa.Column("party_reference", sa.String(255), nullable=False),
        sa.Column("party_type", sa.String(30), nullable=False), sa.Column("legal_name", sa.String(500), nullable=False),
        sa.Column("country_code", sa.String(2), nullable=False), sa.Column("identity_fingerprint", sa.String(64), nullable=False),
        sa.Column("registration_reference", sa.String(500), nullable=False), sa.Column("tax_profile_reference", sa.String(500), nullable=False),
        sa.Column("registered_address_reference", sa.String(500), nullable=False), sa.Column("source_type", sa.String(30), nullable=False),
        sa.Column("source_id", sa.String(100)), sa.Column("source_number", sa.String(100)), sa.Column("source_revision", sa.Integer()),
        sa.Column("kyb_evidence_reference", sa.String(500), nullable=False), sa.Column("sanctions_screening_reference", sa.String(500), nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="draft"), sa.Column("authored_by", sa.String(255), nullable=False),
        sa.Column("approved_by", sa.String(255)), sa.Column("approved_at", sa.DateTime(timezone=True)), sa.Column("approval_reference", sa.String(500)),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"), sa.Column("updated_by", sa.String(255)),
        sa.Column("created_at", sa.DateTime(timezone=True)), sa.Column("updated_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("party_number", name="uq_factory_legal_party_number"),
        sa.UniqueConstraint("tenant_id", "party_reference", name="uq_factory_legal_tenant_party_reference"),
        sa.UniqueConstraint("tenant_id", "identity_fingerprint", name="uq_factory_legal_tenant_identity_fingerprint"),
    ); indexes("factory_legal_parties")
    op.create_table(
        "factory_legal_templates", *tenant_columns(),
        sa.Column("template_number", sa.String(100), nullable=False), sa.Column("template_code", sa.String(100), nullable=False),
        sa.Column("template_name", sa.String(255), nullable=False), sa.Column("contract_type", sa.String(40), nullable=False),
        sa.Column("current_version", sa.Integer(), nullable=False, server_default="1"), sa.Column("status", sa.String(30), nullable=False, server_default="draft"),
        sa.Column("authored_by", sa.String(255), nullable=False), sa.Column("approved_by", sa.String(255)),
        sa.Column("approved_at", sa.DateTime(timezone=True)), sa.Column("approval_reference", sa.String(500)),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"), sa.Column("updated_by", sa.String(255)),
        sa.Column("created_at", sa.DateTime(timezone=True)), sa.Column("updated_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("template_number", name="uq_factory_legal_template_number"),
        sa.UniqueConstraint("tenant_id", "template_code", name="uq_factory_legal_tenant_template_code"),
    ); indexes("factory_legal_templates")
    op.create_table(
        "factory_legal_template_versions", *tenant_columns(),
        sa.Column("version_reference", sa.String(100), nullable=False), sa.Column("template_id", sa.String(100), nullable=False),
        sa.Column("template_number", sa.String(100), nullable=False), sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("language_code", sa.String(10), nullable=False), sa.Column("governing_law", sa.String(100), nullable=False),
        sa.Column("dispute_resolution", sa.String(255), nullable=False), sa.Column("clauses_json", sa.Text(), nullable=False),
        sa.Column("document_reference", sa.String(500), nullable=False), sa.Column("content_hash", sa.String(64), nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="draft"), sa.Column("created_by", sa.String(255), nullable=False),
        sa.Column("activated_by", sa.String(255)), sa.Column("activated_at", sa.DateTime(timezone=True)), sa.Column("created_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("version_reference", name="uq_factory_legal_version_reference"),
        sa.UniqueConstraint("template_id", "version_number", name="uq_factory_legal_template_version"),
    ); indexes("factory_legal_template_versions")
    op.create_table(
        "factory_business_contracts", *tenant_columns(),
        sa.Column("contract_number", sa.String(100), nullable=False), sa.Column("contract_reference", sa.String(255), nullable=False),
        sa.Column("contract_type", sa.String(40), nullable=False), sa.Column("party_id", sa.String(100), nullable=False),
        sa.Column("party_number", sa.String(100), nullable=False), sa.Column("party_revision", sa.Integer(), nullable=False),
        sa.Column("template_id", sa.String(100), nullable=False), sa.Column("template_number", sa.String(100), nullable=False),
        sa.Column("template_version_id", sa.String(100), nullable=False), sa.Column("template_version", sa.Integer(), nullable=False),
        sa.Column("template_content_hash", sa.String(64), nullable=False), sa.Column("source_type", sa.String(30), nullable=False),
        sa.Column("source_id", sa.String(100), nullable=False), sa.Column("source_number", sa.String(100), nullable=False),
        sa.Column("source_revision", sa.Integer(), nullable=False), sa.Column("source_snapshot_json", sa.Text(), nullable=False),
        sa.Column("approval_handoff_id", sa.String(100), nullable=False), sa.Column("approval_handoff_number", sa.String(100), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False), sa.Column("contract_value", sa.Numeric(18, 2), nullable=False),
        sa.Column("effective_date", sa.Date(), nullable=False), sa.Column("expiry_date", sa.Date(), nullable=False),
        sa.Column("auto_renew", sa.Boolean(), nullable=False, server_default="0"), sa.Column("notice_days", sa.Integer(), nullable=False),
        sa.Column("draft_document_reference", sa.String(500), nullable=False), sa.Column("status", sa.String(30), nullable=False, server_default="draft"),
        sa.Column("authored_by", sa.String(255), nullable=False), sa.Column("submitted_by", sa.String(255)), sa.Column("submitted_at", sa.DateTime(timezone=True)),
        sa.Column("legal_review_id", sa.String(100)), sa.Column("approved_by", sa.String(255)), sa.Column("approved_at", sa.DateTime(timezone=True)),
        sa.Column("activated_at", sa.DateTime(timezone=True)), sa.Column("terminated_by", sa.String(255)), sa.Column("terminated_at", sa.DateTime(timezone=True)),
        sa.Column("termination_reason", sa.Text()), sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("updated_by", sa.String(255)), sa.Column("created_at", sa.DateTime(timezone=True)), sa.Column("updated_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("contract_number", name="uq_factory_legal_contract_number"),
        sa.UniqueConstraint("tenant_id", "contract_reference", name="uq_factory_legal_tenant_contract_reference"),
        sa.UniqueConstraint("project_id", "source_type", "source_id", name="uq_factory_legal_project_source_contract"),
    ); indexes("factory_business_contracts")
    op.create_table(
        "factory_legal_reviews", *tenant_columns(),
        sa.Column("review_number", sa.String(100), nullable=False), sa.Column("contract_id", sa.String(100), nullable=False),
        sa.Column("contract_number", sa.String(100), nullable=False), sa.Column("risk_level", sa.String(20), nullable=False),
        sa.Column("deviations_json", sa.Text(), nullable=False), sa.Column("recommendation", sa.String(20), nullable=False),
        sa.Column("legal_comment", sa.Text(), nullable=False), sa.Column("review_evidence_reference", sa.String(500), nullable=False),
        sa.Column("reviewed_by", sa.String(255), nullable=False), sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True)), sa.UniqueConstraint("review_number", name="uq_factory_legal_review_number"),
        sa.UniqueConstraint("contract_id", name="uq_factory_legal_contract_review"),
    ); indexes("factory_legal_reviews")
    op.create_table(
        "factory_seal_authorizations", *tenant_columns(),
        sa.Column("seal_number", sa.String(100), nullable=False), sa.Column("contract_id", sa.String(100), nullable=False),
        sa.Column("contract_number", sa.String(100), nullable=False), sa.Column("seal_type", sa.String(30), nullable=False),
        sa.Column("document_hash", sa.String(64), nullable=False), sa.Column("purpose", sa.Text(), nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="pending-approval"), sa.Column("requested_by", sa.String(255), nullable=False),
        sa.Column("approved_by", sa.String(255)), sa.Column("approved_at", sa.DateTime(timezone=True)), sa.Column("approval_reference", sa.String(500)),
        sa.Column("used_by", sa.String(255)), sa.Column("used_at", sa.DateTime(timezone=True)), sa.Column("use_evidence_reference", sa.String(500)),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"), sa.Column("created_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("seal_number", name="uq_factory_legal_seal_number"), sa.UniqueConstraint("contract_id", name="uq_factory_legal_contract_seal"),
    ); indexes("factory_seal_authorizations")
    op.create_table(
        "factory_signature_envelopes", *tenant_columns(),
        sa.Column("envelope_number", sa.String(100), nullable=False), sa.Column("contract_id", sa.String(100), nullable=False),
        sa.Column("contract_number", sa.String(100), nullable=False), sa.Column("seal_authorization_id", sa.String(100), nullable=False),
        sa.Column("provider_reference", sa.String(255), nullable=False), sa.Column("provider_envelope_reference", sa.String(255), nullable=False),
        sa.Column("signers_json", sa.Text(), nullable=False), sa.Column("signatures_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("signed_document_reference", sa.String(500), nullable=False), sa.Column("status", sa.String(30), nullable=False, server_default="draft"),
        sa.Column("created_by", sa.String(255), nullable=False), sa.Column("sent_by", sa.String(255)), sa.Column("sent_at", sa.DateTime(timezone=True)),
        sa.Column("completed_at", sa.DateTime(timezone=True)), sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True)), sa.UniqueConstraint("envelope_number", name="uq_factory_legal_envelope_number"),
        sa.UniqueConstraint("contract_id", name="uq_factory_legal_contract_signature"),
        sa.UniqueConstraint("provider_envelope_reference", name="uq_factory_legal_provider_envelope_reference"),
    ); indexes("factory_signature_envelopes")
    op.create_table(
        "factory_contract_obligations", *tenant_columns(),
        sa.Column("obligation_number", sa.String(100), nullable=False), sa.Column("obligation_reference", sa.String(255), nullable=False),
        sa.Column("contract_id", sa.String(100), nullable=False), sa.Column("contract_number", sa.String(100), nullable=False),
        sa.Column("obligation_type", sa.String(30), nullable=False), sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False), sa.Column("owner_reference", sa.String(255), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=False), sa.Column("status", sa.String(30), nullable=False, server_default="open"),
        sa.Column("created_by", sa.String(255), nullable=False), sa.Column("completed_by", sa.String(255)), sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.Column("completion_evidence_reference", sa.String(500)), sa.Column("waived_by", sa.String(255)), sa.Column("waived_at", sa.DateTime(timezone=True)),
        sa.Column("waiver_reference", sa.String(500)), sa.Column("revision", sa.Integer(), nullable=False, server_default="1"), sa.Column("created_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("obligation_number", name="uq_factory_legal_obligation_number"),
        sa.UniqueConstraint("contract_id", "obligation_reference", name="uq_factory_legal_contract_obligation_reference"),
    ); indexes("factory_contract_obligations")
    op.create_table(
        "factory_legal_evidence", *tenant_columns(),
        sa.Column("evidence_number", sa.String(100), nullable=False), sa.Column("subject_type", sa.String(40), nullable=False),
        sa.Column("subject_id", sa.String(100), nullable=False), sa.Column("subject_number", sa.String(100), nullable=False),
        sa.Column("evidence_type", sa.String(50), nullable=False), sa.Column("evidence_reference", sa.String(500), nullable=False),
        sa.Column("note", sa.Text(), nullable=False), sa.Column("recorded_by", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True)), sa.UniqueConstraint("evidence_number", name="uq_factory_legal_evidence_number"),
    ); indexes("factory_legal_evidence")
    permissions(False)


def downgrade():
    permissions(True)
    for table in reversed(TABLES):
        for column in reversed(INDEXES[table]):
            op.drop_index(f"ix_{table}_{column}", table_name=table)
        op.drop_table(table)
