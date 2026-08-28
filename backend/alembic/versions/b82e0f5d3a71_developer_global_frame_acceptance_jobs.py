"""persist trusted developer global-frame acceptance jobs

Revision ID: b82e0f5d3a71
Revises: a71d9e4c2f60
Create Date: 2026-08-23

Upgrade fails closed if legacy acceptance artifacts already exist: they cannot
be truthfully backfilled with a trusted worker job. Downgrade fails closed once
any job, event, or job-linked artifact exists because removing that history
would break the publication evidence chain.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b82e0f5d3a71"
down_revision: Union[str, Sequence[str], None] = "a71d9e4c2f60"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    legacy_artifacts = bind.execute(
        sa.text("SELECT COUNT(*) FROM developer_global_frame_acceptance_artifacts")
    ).scalar_one()
    if legacy_artifacts:
        raise RuntimeError(
            "Cannot enable acceptance jobs while unbound acceptance artifacts exist; "
            "archive the database or rerun trusted acceptance through the job workflow"
        )

    op.create_table(
        "developer_global_frame_acceptance_jobs",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("schema_version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("template_id", sa.String(length=100), nullable=False),
        sa.Column("source_scope", sa.String(length=50), nullable=False),
        sa.Column("base_draft_hash", sa.String(length=64), nullable=False),
        sa.Column("frame_section_hash", sa.String(length=64), nullable=False),
        sa.Column("visual_draft_id", sa.String(length=200), nullable=False),
        sa.Column("recovery_point_id", sa.String(length=200), nullable=False),
        sa.Column("frame_section_json", sa.Text(), nullable=False),
        sa.Column("page_registry_hash", sa.String(length=64), nullable=False),
        sa.Column("adapter_registry_hash", sa.String(length=64), nullable=False),
        sa.Column("isolation_policy_hash", sa.String(length=64), nullable=False),
        sa.Column("test_spec_hash", sa.String(length=64), nullable=False),
        sa.Column("source_build_digest", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=30), server_default="pending", nullable=False),
        sa.Column("attempt_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("max_attempts", sa.Integer(), server_default="3", nullable=False),
        sa.Column("worker_issuer", sa.String(length=100), nullable=True),
        sa.Column("worker_key_id", sa.String(length=100), nullable=True),
        sa.Column("claim_nonce", sa.String(length=100), nullable=True),
        sa.Column("claimed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("lease_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("acceptance_artifact_id", sa.String(length=36), nullable=True),
        sa.Column("report_hash", sa.String(length=64), nullable=True),
        sa.Column("last_error_code", sa.String(length=100), nullable=True),
        sa.Column("last_error_message", sa.String(length=1000), nullable=True),
        sa.Column("requested_by", sa.String(length=255), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "status IN ('pending', 'running', 'succeeded', 'failed', 'expired')",
            name="ck_dgf_acceptance_job_status",
        ),
        sa.CheckConstraint(
            "attempt_count >= 0 AND attempt_count <= max_attempts AND max_attempts > 0",
            name="ck_dgf_acceptance_job_attempts",
        ),
        sa.ForeignKeyConstraint(
            ["acceptance_artifact_id"],
            ["developer_global_frame_acceptance_artifacts.id"],
            name="fk_dgf_acceptance_job_artifact",
        ),
        sa.ForeignKeyConstraint(
            ["requested_by"],
            ["users.id"],
            name="fk_dgf_acceptance_job_requested_by",
        ),
        sa.ForeignKeyConstraint(
            ["template_id"],
            ["template_snapshot_templates.template_id"],
            name="fk_dgf_acceptance_job_template",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("acceptance_artifact_id", name="uq_dgf_acceptance_job_artifact"),
    )
    for column in (
        "template_id",
        "source_scope",
        "base_draft_hash",
        "frame_section_hash",
        "visual_draft_id",
        "recovery_point_id",
        "source_build_digest",
        "status",
        "claim_nonce",
        "lease_expires_at",
        "acceptance_artifact_id",
        "report_hash",
        "requested_by",
        "expires_at",
        "created_at",
    ):
        op.create_index(
            f"ix_dgf_acceptance_job_{column}",
            "developer_global_frame_acceptance_jobs",
            [column],
            unique=False,
        )

    op.create_table(
        "developer_global_frame_acceptance_job_events",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("job_id", sa.String(length=36), nullable=False),
        sa.Column("event_type", sa.String(length=40), nullable=False),
        sa.Column("from_status", sa.String(length=30), nullable=True),
        sa.Column("to_status", sa.String(length=30), nullable=False),
        sa.Column("attempt_count", sa.Integer(), nullable=False),
        sa.Column("worker_issuer", sa.String(length=100), nullable=True),
        sa.Column("worker_key_id", sa.String(length=100), nullable=True),
        sa.Column("worker_nonce", sa.String(length=100), nullable=True),
        sa.Column("error_code", sa.String(length=100), nullable=True),
        sa.Column("error_message", sa.String(length=1000), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "to_status IN ('pending', 'running', 'succeeded', 'failed', 'expired')",
            name="ck_dgf_acceptance_job_event_status",
        ),
        sa.ForeignKeyConstraint(
            ["job_id"],
            ["developer_global_frame_acceptance_jobs.id"],
            name="fk_dgf_acceptance_job_event_job",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "worker_nonce",
            name="uq_developer_global_frame_acceptance_job_event_nonce",
        ),
    )
    for column in ("job_id", "event_type", "created_at"):
        op.create_index(
            f"ix_dgf_acceptance_job_event_{column}",
            "developer_global_frame_acceptance_job_events",
            [column],
            unique=False,
        )

    op.create_table(
        "developer_global_frame_acceptance_worker_nonces",
        sa.Column("nonce", sa.String(length=100), nullable=False),
        sa.Column("action", sa.String(length=40), nullable=False),
        sa.Column("issuer", sa.String(length=100), nullable=False),
        sa.Column("key_id", sa.String(length=100), nullable=False),
        sa.Column("source_scope", sa.String(length=50), nullable=False),
        sa.Column("job_id", sa.String(length=36), nullable=True),
        sa.Column("issued_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "action IN ('claim', 'claim-next', 'heartbeat', 'fail')",
            name="ck_dgf_acceptance_worker_nonce_action",
        ),
        sa.CheckConstraint(
            "source_scope = 'client_source'",
            name="ck_dgf_acceptance_worker_nonce_scope",
        ),
        sa.ForeignKeyConstraint(
            ["job_id"],
            ["developer_global_frame_acceptance_jobs.id"],
            name="fk_dgf_acceptance_worker_nonce_job",
        ),
        sa.PrimaryKeyConstraint("nonce"),
    )
    for column in ("action", "issuer", "key_id", "source_scope", "job_id", "created_at"):
        op.create_index(
            f"ix_dgf_acceptance_worker_nonce_{column}",
            "developer_global_frame_acceptance_worker_nonces",
            [column],
            unique=False,
        )

    with op.batch_alter_table("developer_global_frame_acceptance_artifacts") as batch_op:
        batch_op.add_column(sa.Column("acceptance_job_id", sa.String(length=36), nullable=False))
        batch_op.create_foreign_key(
            "fk_dgf_acceptance_artifact_job",
            "developer_global_frame_acceptance_jobs",
            ["acceptance_job_id"],
            ["id"],
        )
        batch_op.create_unique_constraint(
            "uq_dgf_acceptance_artifact_job",
            ["acceptance_job_id"],
        )
        batch_op.create_index(
            "ix_dgf_acceptance_artifact_job",
            ["acceptance_job_id"],
            unique=False,
        )


def downgrade() -> None:
    bind = op.get_bind()
    job_rows = bind.execute(
        sa.text("SELECT COUNT(*) FROM developer_global_frame_acceptance_jobs")
    ).scalar_one()
    event_rows = bind.execute(
        sa.text("SELECT COUNT(*) FROM developer_global_frame_acceptance_job_events")
    ).scalar_one()
    nonce_rows = bind.execute(
        sa.text("SELECT COUNT(*) FROM developer_global_frame_acceptance_worker_nonces")
    ).scalar_one()
    linked_artifacts = bind.execute(
        sa.text(
            "SELECT COUNT(*) FROM developer_global_frame_acceptance_artifacts "
            "WHERE acceptance_job_id IS NOT NULL"
        )
    ).scalar_one()
    if job_rows or event_rows or nonce_rows or linked_artifacts:
        raise RuntimeError(
            "Cannot downgrade acceptance jobs while trusted job, event, or linked artifact history exists"
        )

    with op.batch_alter_table("developer_global_frame_acceptance_artifacts") as batch_op:
        batch_op.drop_index("ix_dgf_acceptance_artifact_job")
        batch_op.drop_constraint("uq_dgf_acceptance_artifact_job", type_="unique")
        batch_op.drop_constraint("fk_dgf_acceptance_artifact_job", type_="foreignkey")
        batch_op.drop_column("acceptance_job_id")

    for column in reversed(("action", "issuer", "key_id", "source_scope", "job_id", "created_at")):
        op.drop_index(
            f"ix_dgf_acceptance_worker_nonce_{column}",
            table_name="developer_global_frame_acceptance_worker_nonces",
        )
    op.drop_table("developer_global_frame_acceptance_worker_nonces")

    for column in reversed(("job_id", "event_type", "created_at")):
        op.drop_index(
            f"ix_dgf_acceptance_job_event_{column}",
            table_name="developer_global_frame_acceptance_job_events",
        )
    op.drop_table("developer_global_frame_acceptance_job_events")

    for column in reversed(
        (
            "template_id",
            "source_scope",
            "base_draft_hash",
            "frame_section_hash",
            "visual_draft_id",
            "recovery_point_id",
            "source_build_digest",
            "status",
            "claim_nonce",
            "lease_expires_at",
            "acceptance_artifact_id",
            "report_hash",
            "requested_by",
            "expires_at",
            "created_at",
        )
    ):
        op.drop_index(
            f"ix_dgf_acceptance_job_{column}",
            table_name="developer_global_frame_acceptance_jobs",
        )
    op.drop_table("developer_global_frame_acceptance_jobs")
