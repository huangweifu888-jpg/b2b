"""add governed partner voice, academy and advocacy workflows

Revision ID: c2ae4b6d9f81
Revises: b19d3f5a8c70

Rollback removes only partner/VOC/academy snapshots, append-only evidence and
six permission grants. It never deletes CRM contacts, customer assets, orders,
service records, source feedback, published media, invoices or payments.
"""

import json

from alembic import op
import sqlalchemy as sa


revision = "c2ae4b6d9f81"
down_revision = "b19d3f5a8c70"
branch_labels = None
depends_on = None

PERMISSIONS = (
    "factory.care.partner-voice.partner.manage",
    "factory.care.partner-voice.partner.approve",
    "factory.care.partner-voice.voice.manage",
    "factory.care.partner-voice.voice.resolve",
    "factory.care.partner-voice.academy.manage",
    "factory.care.partner-voice.advocacy.publish",
)
PARTNER_INDEXES = ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", "partner_number", "external_reference", "legal_name", "partner_type", "country_code", "account_reference", "status", "activated_by", "updated_by")
ACADEMY_INDEXES = ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", "enrollment_number", "enrollment_reference", "partner_id", "partner_number", "course_code", "course_version", "planned_completion_at", "status", "certification_expires_at", "certified_by", "updated_by")
VOICE_INDEXES = ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", "voice_number", "feedback_reference", "source_type", "partner_id", "partner_number", "account_reference", "related_order_id", "related_order_number", "related_asset_id", "related_asset_number", "category", "severity", "sentiment", "lifecycle_status", "owner", "due_at", "resolved_by", "closed_by", "advocacy_status", "published_by", "updated_by")
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
        bind.execute(sa.text("UPDATE roles_platform SET permissions_json = :permissions WHERE id = :id"), {"permissions": json.dumps(values, ensure_ascii=False), "id": row["id"]})


def upgrade() -> None:
    op.create_table(
        "factory_partner_accounts",
        sa.Column("id", sa.String(length=100), primary_key=True),
        sa.Column("project_id", sa.Integer(), nullable=False), sa.Column("agent_path", sa.String(length=500), nullable=False),
        sa.Column("tenant_id", sa.String(length=100), nullable=False), sa.Column("client_id", sa.String(length=100), nullable=False),
        sa.Column("plan_id", sa.String(length=100), nullable=False), sa.Column("partner_number", sa.String(length=100), nullable=False),
        sa.Column("external_reference", sa.String(length=255), nullable=False), sa.Column("legal_name", sa.String(length=500), nullable=False),
        sa.Column("partner_type", sa.String(length=40), nullable=False), sa.Column("country_code", sa.String(length=2), nullable=False),
        sa.Column("territory", sa.String(length=500), nullable=False), sa.Column("product_scope_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("account_reference", sa.String(length=255), nullable=True), sa.Column("primary_contact_reference", sa.String(length=500), nullable=False),
        sa.Column("relationship_evidence_reference", sa.String(length=500), nullable=False), sa.Column("agreement_reference", sa.String(length=500), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="draft"), sa.Column("activated_by", sa.String(length=255), nullable=True),
        sa.Column("activated_at", sa.DateTime(timezone=True), nullable=True), sa.Column("suspension_reason", sa.Text(), nullable=True),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"), sa.Column("updated_by", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True), sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("partner_number", name="uq_factory_partner_number"),
        sa.UniqueConstraint("tenant_id", "external_reference", name="uq_factory_partner_tenant_external"),
    )
    for column in PARTNER_INDEXES: op.create_index(f"ix_factory_partner_accounts_{column}", "factory_partner_accounts", [column])

    op.create_table(
        "factory_partner_academy_enrollments",
        sa.Column("id", sa.String(length=100), primary_key=True),
        sa.Column("project_id", sa.Integer(), nullable=False), sa.Column("agent_path", sa.String(length=500), nullable=False),
        sa.Column("tenant_id", sa.String(length=100), nullable=False), sa.Column("client_id", sa.String(length=100), nullable=False),
        sa.Column("plan_id", sa.String(length=100), nullable=False), sa.Column("enrollment_number", sa.String(length=100), nullable=False),
        sa.Column("enrollment_reference", sa.String(length=255), nullable=False), sa.Column("partner_id", sa.String(length=100), nullable=False),
        sa.Column("partner_number", sa.String(length=100), nullable=False), sa.Column("learner_reference", sa.String(length=500), nullable=False),
        sa.Column("course_code", sa.String(length=100), nullable=False), sa.Column("course_title", sa.String(length=500), nullable=False),
        sa.Column("course_version", sa.String(length=100), nullable=False), sa.Column("passing_score", sa.Integer(), nullable=False, server_default="80"),
        sa.Column("planned_completion_at", sa.DateTime(timezone=True), nullable=False), sa.Column("status", sa.String(length=30), nullable=False, server_default="enrolled"),
        sa.Column("assessment_score", sa.Numeric(7, 2), nullable=True), sa.Column("completion_evidence_reference", sa.String(length=500), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True), sa.Column("certification_reference", sa.String(length=500), nullable=True),
        sa.Column("certification_expires_at", sa.DateTime(timezone=True), nullable=True), sa.Column("certified_by", sa.String(length=255), nullable=True),
        sa.Column("certified_at", sa.DateTime(timezone=True), nullable=True), sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("updated_by", sa.String(length=255), nullable=True), sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("enrollment_number", name="uq_factory_academy_enrollment_number"),
        sa.UniqueConstraint("tenant_id", "enrollment_reference", name="uq_factory_academy_tenant_reference"),
        sa.UniqueConstraint("tenant_id", "partner_id", "course_code", "course_version", name="uq_factory_academy_partner_course"),
    )
    for column in ACADEMY_INDEXES: op.create_index(f"ix_factory_partner_academy_enrollments_{column}", "factory_partner_academy_enrollments", [column])

    op.create_table(
        "factory_voice_of_customer_cases",
        sa.Column("id", sa.String(length=100), primary_key=True),
        sa.Column("project_id", sa.Integer(), nullable=False), sa.Column("agent_path", sa.String(length=500), nullable=False),
        sa.Column("tenant_id", sa.String(length=100), nullable=False), sa.Column("client_id", sa.String(length=100), nullable=False),
        sa.Column("plan_id", sa.String(length=100), nullable=False), sa.Column("voice_number", sa.String(length=100), nullable=False),
        sa.Column("feedback_reference", sa.String(length=255), nullable=False), sa.Column("source_type", sa.String(length=30), nullable=False),
        sa.Column("partner_id", sa.String(length=100), nullable=True), sa.Column("partner_number", sa.String(length=100), nullable=True),
        sa.Column("account_reference", sa.String(length=255), nullable=False), sa.Column("related_order_id", sa.String(length=100), nullable=True),
        sa.Column("related_order_number", sa.String(length=100), nullable=True), sa.Column("related_asset_id", sa.String(length=100), nullable=True),
        sa.Column("related_asset_number", sa.String(length=100), nullable=True), sa.Column("category", sa.String(length=50), nullable=False),
        sa.Column("severity", sa.String(length=20), nullable=False), sa.Column("score", sa.Integer(), nullable=True),
        sa.Column("sentiment", sa.String(length=20), nullable=False), sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("lifecycle_status", sa.String(length=40), nullable=False, server_default="received"),
        sa.Column("triage_reference", sa.String(length=500), nullable=True), sa.Column("owner", sa.String(length=255), nullable=True),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=True), sa.Column("root_cause", sa.Text(), nullable=True),
        sa.Column("action_plan", sa.Text(), nullable=True), sa.Column("action_reference", sa.String(length=500), nullable=True),
        sa.Column("resolution_reference", sa.String(length=500), nullable=True), sa.Column("resolution_note", sa.Text(), nullable=True),
        sa.Column("escalation_reference", sa.String(length=500), nullable=True), sa.Column("resolved_by", sa.String(length=255), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True), sa.Column("customer_confirmation_reference", sa.String(length=500), nullable=True),
        sa.Column("customer_confirmed_at", sa.DateTime(timezone=True), nullable=True), sa.Column("closed_by", sa.String(length=255), nullable=True),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True), sa.Column("advocacy_status", sa.String(length=30), nullable=False, server_default="not-eligible"),
        sa.Column("advocacy_invitation_reference", sa.String(length=500), nullable=True), sa.Column("advocacy_consent_reference", sa.String(length=500), nullable=True),
        sa.Column("advocacy_consent_scope", sa.Text(), nullable=True), sa.Column("advocacy_consent_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("case_study_reference", sa.String(length=500), nullable=True), sa.Column("publication_channel", sa.String(length=255), nullable=True),
        sa.Column("published_by", sa.String(length=255), nullable=True), sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("milestones_json", sa.Text(), nullable=False, server_default="[]"), sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("updated_by", sa.String(length=255), nullable=True), sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("voice_number", name="uq_factory_voice_number"),
        sa.UniqueConstraint("tenant_id", "feedback_reference", name="uq_factory_voc_tenant_feedback"),
    )
    for column in VOICE_INDEXES: op.create_index(f"ix_factory_voice_of_customer_cases_{column}", "factory_voice_of_customer_cases", [column])

    op.create_table(
        "factory_partner_voice_evidence",
        sa.Column("id", sa.String(length=100), primary_key=True),
        sa.Column("project_id", sa.Integer(), nullable=False), sa.Column("agent_path", sa.String(length=500), nullable=False),
        sa.Column("tenant_id", sa.String(length=100), nullable=False), sa.Column("client_id", sa.String(length=100), nullable=False),
        sa.Column("plan_id", sa.String(length=100), nullable=False), sa.Column("evidence_number", sa.String(length=100), nullable=False),
        sa.Column("subject_type", sa.String(length=40), nullable=False), sa.Column("subject_id", sa.String(length=100), nullable=False),
        sa.Column("subject_number", sa.String(length=100), nullable=False), sa.Column("evidence_type", sa.String(length=50), nullable=False),
        sa.Column("evidence_reference", sa.String(length=500), nullable=False), sa.Column("note", sa.Text(), nullable=False),
        sa.Column("recorded_by", sa.String(length=255), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("evidence_number", name="uq_factory_partner_voice_evidence_number"),
    )
    for column in EVIDENCE_INDEXES: op.create_index(f"ix_factory_partner_voice_evidence_{column}", "factory_partner_voice_evidence", [column])
    _update_permissions(remove=False)


def downgrade() -> None:
    _update_permissions(remove=True)
    for column in reversed(EVIDENCE_INDEXES): op.drop_index(f"ix_factory_partner_voice_evidence_{column}", table_name="factory_partner_voice_evidence")
    op.drop_table("factory_partner_voice_evidence")
    for column in reversed(VOICE_INDEXES): op.drop_index(f"ix_factory_voice_of_customer_cases_{column}", table_name="factory_voice_of_customer_cases")
    op.drop_table("factory_voice_of_customer_cases")
    for column in reversed(ACADEMY_INDEXES): op.drop_index(f"ix_factory_partner_academy_enrollments_{column}", table_name="factory_partner_academy_enrollments")
    op.drop_table("factory_partner_academy_enrollments")
    for column in reversed(PARTNER_INDEXES): op.drop_index(f"ix_factory_partner_accounts_{column}", table_name="factory_partner_accounts")
    op.drop_table("factory_partner_accounts")
