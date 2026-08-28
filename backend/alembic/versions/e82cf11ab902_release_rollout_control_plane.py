"""release rollout control plane

Revision ID: e82cf11ab902
Revises: d91be72fa016
Create Date: 2026-07-28
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e82cf11ab902"
down_revision: Union[str, Sequence[str], None] = "d91be72fa016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "release_rollouts_platform",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("version", sa.String(length=100), nullable=False),
        sa.Column("release_role", sa.String(length=50), nullable=False),
        sa.Column("deployment_id", sa.String(length=100), nullable=False),
        sa.Column("manifest_sha256", sa.String(length=64), nullable=False),
        sa.Column("change_summary", sa.String(length=2000), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="draft"),
        sa.Column("current_stage", sa.String(length=50), nullable=True),
        sa.Column("rollback_reason", sa.String(length=1000), nullable=True),
        sa.Column("created_by", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("version", "deployment_id", name="uq_release_rollout_version_deployment"),
    )
    for column in ("id", "version", "release_role", "deployment_id", "status", "created_by"):
        op.create_index(op.f(f"ix_release_rollouts_platform_{column}"), "release_rollouts_platform", [column], unique=False)
    op.create_table(
        "release_rollout_stages_platform",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("rollout_id", sa.Integer(), nullable=False),
        sa.Column("stage_key", sa.String(length=50), nullable=False),
        sa.Column("stage_label", sa.String(length=100), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="pending"),
        sa.Column("note", sa.String(length=2000), nullable=True),
        sa.Column("acted_by", sa.String(length=255), nullable=True),
        sa.Column("acted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("rollout_id", "stage_key", name="uq_release_rollout_stage"),
    )
    for column in ("id", "rollout_id", "stage_key", "status", "acted_by"):
        op.create_index(op.f(f"ix_release_rollout_stages_platform_{column}"), "release_rollout_stages_platform", [column], unique=False)


def downgrade() -> None:
    for column in ("acted_by", "status", "stage_key", "rollout_id", "id"):
        op.drop_index(op.f(f"ix_release_rollout_stages_platform_{column}"), table_name="release_rollout_stages_platform")
    op.drop_table("release_rollout_stages_platform")
    for column in ("created_by", "status", "deployment_id", "release_role", "version", "id"):
        op.drop_index(op.f(f"ix_release_rollouts_platform_{column}"), table_name="release_rollouts_platform")
    op.drop_table("release_rollouts_platform")
