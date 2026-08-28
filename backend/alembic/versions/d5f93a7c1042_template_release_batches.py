"""add durable template release batches

Revision ID: d5f93a7c1042
Revises: ce8f42a70113
Create Date: 2026-07-29
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d5f93a7c1042"
down_revision: Union[str, Sequence[str], None] = "ce8f42a70113"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "template_snapshot_release_batches",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("template_id", sa.String(length=100), nullable=False),
        sa.Column("template_version", sa.String(length=50), nullable=False),
        sa.Column("owner_scope", sa.String(length=50), nullable=False),
        sa.Column("status", sa.String(length=50), server_default="queued", nullable=False),
        sa.Column("total_targets", sa.Integer(), server_default="0", nullable=False),
        sa.Column("succeeded_targets", sa.Integer(), server_default="0", nullable=False),
        sa.Column("failed_targets", sa.Integer(), server_default="0", nullable=False),
        sa.Column("created_by", sa.String(length=255), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    for column in ("template_id", "template_version", "owner_scope", "status", "created_by"):
        op.create_index(f"ix_template_snapshot_release_batches_{column}", "template_snapshot_release_batches", [column], unique=False)

    op.create_table(
        "template_snapshot_release_targets",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("batch_id", sa.String(length=36), nullable=False),
        sa.Column("instance_id", sa.String(length=100), nullable=False),
        sa.Column("organization_id", sa.Integer(), nullable=True),
        sa.Column("project_id", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(length=50), server_default="pending", nullable=False),
        sa.Column("result_json", sa.Text(), nullable=True),
        sa.Column("error_message", sa.String(length=2000), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["batch_id"], ["template_snapshot_release_batches.id"]),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.ForeignKeyConstraint(["project_id"], ["projects_platform.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("batch_id", "instance_id", name="uq_template_snapshot_release_target"),
    )
    for column in ("id", "batch_id", "instance_id", "organization_id", "project_id", "status"):
        op.create_index(f"ix_template_snapshot_release_targets_{column}", "template_snapshot_release_targets", [column], unique=False)


def downgrade() -> None:
    for column in ("status", "project_id", "organization_id", "instance_id", "batch_id", "id"):
        op.drop_index(f"ix_template_snapshot_release_targets_{column}", table_name="template_snapshot_release_targets")
    op.drop_table("template_snapshot_release_targets")
    for column in ("created_by", "status", "owner_scope", "template_version", "template_id"):
        op.drop_index(f"ix_template_snapshot_release_batches_{column}", table_name="template_snapshot_release_batches")
    op.drop_table("template_snapshot_release_batches")
