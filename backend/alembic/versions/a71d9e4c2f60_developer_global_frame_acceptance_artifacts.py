"""persist trusted developer global-frame acceptance artifacts

Revision ID: a71d9e4c2f60
Revises: f42b8d6a0c31
Create Date: 2026-08-23

Rollback is fail closed once an artifact or an artifact-bound preflight exists.
Dropping either would allow a reviewed release to lose the trusted 603-case
acceptance evidence that admitted it to publication.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a71d9e4c2f60"
down_revision: Union[str, Sequence[str], None] = "f42b8d6a0c31"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "developer_global_frame_acceptance_artifacts",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("schema_version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("run_id", sa.String(length=100), nullable=False),
        sa.Column("issuer", sa.String(length=100), nullable=False),
        sa.Column("key_id", sa.String(length=100), nullable=False),
        sa.Column("template_id", sa.String(length=100), nullable=False),
        sa.Column("source_scope", sa.String(length=50), nullable=False),
        sa.Column("base_draft_hash", sa.String(length=64), nullable=False),
        sa.Column("frame_section_hash", sa.String(length=64), nullable=False),
        sa.Column("visual_draft_id", sa.String(length=200), nullable=False),
        sa.Column("recovery_point_id", sa.String(length=200), nullable=False),
        sa.Column("page_registry_hash", sa.String(length=64), nullable=False),
        sa.Column("adapter_registry_hash", sa.String(length=64), nullable=False),
        sa.Column("isolation_policy_hash", sa.String(length=64), nullable=False),
        sa.Column("test_spec_hash", sa.String(length=64), nullable=False),
        sa.Column("source_build_digest", sa.String(length=64), nullable=False),
        sa.Column("issued_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("viewports_json", sa.Text(), nullable=False),
        sa.Column("compatible_target_page_ids_json", sa.Text(), nullable=False),
        sa.Column("isolated_page_ids_json", sa.Text(), nullable=False),
        sa.Column("case_results_json", sa.Text(), nullable=False),
        sa.Column("failure_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("flaky_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("skipped_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("report_hash", sa.String(length=64), nullable=False),
        sa.Column("signature", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["template_id"], ["template_snapshot_templates.template_id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("run_id", name="uq_developer_global_frame_acceptance_run"),
        sa.UniqueConstraint("report_hash", name="uq_developer_global_frame_acceptance_report"),
    )
    for column in (
        "run_id",
        "issuer",
        "key_id",
        "template_id",
        "source_scope",
        "base_draft_hash",
        "frame_section_hash",
        "visual_draft_id",
        "recovery_point_id",
        "source_build_digest",
        "issued_at",
        "expires_at",
        "created_at",
    ):
        op.create_index(
            f"ix_dgf_acceptance_{column}",
            "developer_global_frame_acceptance_artifacts",
            [column],
            unique=False,
        )
    with op.batch_alter_table("developer_global_frame_preflight_evidence") as batch_op:
        batch_op.add_column(sa.Column("acceptance_artifact_id", sa.String(length=36), nullable=True))
        batch_op.add_column(sa.Column("acceptance_artifact_hash", sa.String(length=64), nullable=True))
        batch_op.add_column(sa.Column("visual_draft_id", sa.String(length=200), nullable=True))
        batch_op.create_foreign_key(
            "fk_dgf_preflight_acceptance_artifact",
            "developer_global_frame_acceptance_artifacts",
            ["acceptance_artifact_id"],
            ["id"],
        )
        for column in ("acceptance_artifact_id", "acceptance_artifact_hash", "visual_draft_id"):
            batch_op.create_index(f"ix_dgf_preflight_{column}", [column], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    artifact_rows = bind.execute(
        sa.text("SELECT COUNT(*) FROM developer_global_frame_acceptance_artifacts")
    ).scalar_one()
    linked_evidence = bind.execute(
        sa.text(
            "SELECT COUNT(*) FROM developer_global_frame_preflight_evidence "
            "WHERE acceptance_artifact_id IS NOT NULL "
            "OR acceptance_artifact_hash IS NOT NULL OR visual_draft_id IS NOT NULL"
        )
    ).scalar_one()
    if artifact_rows or linked_evidence:
        raise RuntimeError(
            "Cannot downgrade trusted acceptance artifacts while artifact or linked preflight history exists"
        )
    with op.batch_alter_table("developer_global_frame_preflight_evidence") as batch_op:
        for column in reversed(("acceptance_artifact_id", "acceptance_artifact_hash", "visual_draft_id")):
            batch_op.drop_index(f"ix_dgf_preflight_{column}")
        batch_op.drop_constraint("fk_dgf_preflight_acceptance_artifact", type_="foreignkey")
        batch_op.drop_column("visual_draft_id")
        batch_op.drop_column("acceptance_artifact_hash")
        batch_op.drop_column("acceptance_artifact_id")
    for column in reversed(
        (
            "run_id",
            "issuer",
            "key_id",
            "template_id",
            "source_scope",
            "base_draft_hash",
            "frame_section_hash",
            "visual_draft_id",
            "recovery_point_id",
            "source_build_digest",
            "issued_at",
            "expires_at",
            "created_at",
        )
    ):
        op.drop_index(
            f"ix_dgf_acceptance_{column}",
            table_name="developer_global_frame_acceptance_artifacts",
        )
    op.drop_table("developer_global_frame_acceptance_artifacts")
