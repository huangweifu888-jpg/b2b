"""persist server-attested developer global-frame preflight evidence

Revision ID: e31a7c9d4b20
Revises: c28f7d5a9e31
Create Date: 2026-08-23

Rollback is fail closed once any evidence or linked immutable version exists.
Dropping these rows would otherwise make an already admitted frame release look
as though it had never passed the target-isolation gate.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e31a7c9d4b20"
down_revision: Union[str, Sequence[str], None] = "c28f7d5a9e31"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "developer_global_frame_preflight_evidence",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("template_id", sa.String(length=100), nullable=False),
        sa.Column("source_scope", sa.String(length=50), nullable=False),
        sa.Column("base_draft_hash", sa.String(length=64), nullable=False),
        sa.Column("saved_draft_hash", sa.String(length=64), nullable=False),
        sa.Column("artifact_hash", sa.String(length=64), nullable=False),
        sa.Column("compatible_target_page_ids_json", sa.Text(), server_default="[]", nullable=False),
        sa.Column("isolated_page_ids_json", sa.Text(), server_default="[]", nullable=False),
        sa.Column("recovery_point_id", sa.String(length=200), nullable=False),
        sa.Column("checked_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("evidence_hash", sa.String(length=64), nullable=False),
        sa.Column("created_by", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("evidence_hash"),
        sa.UniqueConstraint(
            "template_id",
            "artifact_hash",
            "saved_draft_hash",
            name="uq_developer_global_frame_preflight_artifact",
        ),
    )
    for column in ("template_id", "source_scope", "saved_draft_hash", "artifact_hash", "checked_at", "evidence_hash", "created_by"):
        op.create_index(
            f"ix_developer_global_frame_preflight_evidence_{column}",
            "developer_global_frame_preflight_evidence",
            [column],
            unique=False,
        )
    op.add_column(
        "template_snapshot_versions",
        sa.Column("preflight_evidence_id", sa.String(length=36), nullable=True),
    )
    op.create_index(
        "ix_template_snapshot_versions_preflight_evidence_id",
        "template_snapshot_versions",
        ["preflight_evidence_id"],
        unique=False,
    )


def downgrade() -> None:
    bind = op.get_bind()
    linked_versions = bind.execute(
        sa.text(
            "SELECT COUNT(*) FROM template_snapshot_versions "
            "WHERE preflight_evidence_id IS NOT NULL"
        )
    ).scalar_one()
    evidence_rows = bind.execute(
        sa.text("SELECT COUNT(*) FROM developer_global_frame_preflight_evidence")
    ).scalar_one()
    if linked_versions or evidence_rows:
        raise RuntimeError(
            "Cannot downgrade durable preflight evidence while evidence or linked release history exists"
        )
    op.drop_index(
        "ix_template_snapshot_versions_preflight_evidence_id",
        table_name="template_snapshot_versions",
    )
    op.drop_column("template_snapshot_versions", "preflight_evidence_id")
    for column in reversed(("template_id", "source_scope", "saved_draft_hash", "artifact_hash", "checked_at", "evidence_hash", "created_by")):
        op.drop_index(
            f"ix_developer_global_frame_preflight_evidence_{column}",
            table_name="developer_global_frame_preflight_evidence",
        )
    op.drop_table("developer_global_frame_preflight_evidence")
