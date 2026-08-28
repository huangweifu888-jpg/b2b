"""persist validated developer global-frame factory-default receipts

Revision ID: f42b8d6a0c31
Revises: e31a7c9d4b20
Create Date: 2026-08-23

Rollback is fail closed once a receipt exists.  A receipt is an auditable
factory-default recovery pointer; silently dropping it would destroy recovery
history while instances may still depend on the recorded immutable version.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f42b8d6a0c31"
down_revision: Union[str, Sequence[str], None] = "e31a7c9d4b20"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "developer_global_frame_factory_default_receipts",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("schema_version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("template_id", sa.String(length=100), nullable=False),
        sa.Column("source_scope", sa.String(length=50), nullable=False),
        sa.Column("rollout_owner_scope", sa.String(length=50), nullable=False),
        sa.Column("published_version", sa.String(length=50), nullable=False),
        sa.Column("preflight_evidence_id", sa.String(length=36), nullable=False),
        sa.Column("artifact_hash", sa.String(length=64), nullable=False),
        sa.Column("draft_hash", sa.String(length=64), nullable=False),
        sa.Column("preflight_evidence_hash", sa.String(length=64), nullable=False),
        sa.Column("compatible_target_page_ids_json", sa.Text(), server_default="[]", nullable=False),
        sa.Column("isolated_page_ids_json", sa.Text(), server_default="[]", nullable=False),
        sa.Column("recovery_point_id", sa.String(length=200), nullable=False),
        sa.Column("rollout_batch_id", sa.String(length=36), nullable=False),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("receipt_hash", sa.String(length=64), nullable=False),
        sa.Column("recorded_by", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["template_id"],
            ["template_snapshot_templates.template_id"],
        ),
        sa.ForeignKeyConstraint(
            ["preflight_evidence_id"],
            ["developer_global_frame_preflight_evidence.id"],
        ),
        sa.ForeignKeyConstraint(
            ["rollout_batch_id"],
            ["template_snapshot_release_batches.id"],
        ),
        sa.ForeignKeyConstraint(["recorded_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "receipt_hash",
            name="uq_developer_global_frame_factory_default_receipt_hash",
        ),
    )
    for column in (
        "template_id",
        "source_scope",
        "rollout_owner_scope",
        "published_version",
        "preflight_evidence_id",
        "artifact_hash",
        "draft_hash",
        "preflight_evidence_hash",
        "rollout_batch_id",
        "recorded_at",
        "recorded_by",
    ):
        op.create_index(
            f"ix_dgf_factory_defaults_{column}",
            "developer_global_frame_factory_default_receipts",
            [column],
            unique=False,
        )


def downgrade() -> None:
    bind = op.get_bind()
    receipt_rows = bind.execute(
        sa.text("SELECT COUNT(*) FROM developer_global_frame_factory_default_receipts")
    ).scalar_one()
    if receipt_rows:
        raise RuntimeError(
            "Cannot downgrade developer global-frame factory defaults while receipt history exists"
        )
    for column in reversed(
        (
            "template_id",
            "source_scope",
            "rollout_owner_scope",
            "published_version",
            "preflight_evidence_id",
            "artifact_hash",
            "draft_hash",
            "preflight_evidence_hash",
            "rollout_batch_id",
            "recorded_at",
            "recorded_by",
        )
    ):
        op.drop_index(
            f"ix_dgf_factory_defaults_{column}",
            table_name="developer_global_frame_factory_default_receipts",
        )
    op.drop_table("developer_global_frame_factory_default_receipts")
