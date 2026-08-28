"""add template release review lifecycle

Revision ID: c7e5d0a2b611
Revises: c2a8d4e6f901
Create Date: 2026-07-28

Rollback note: downgrade only removes release review metadata. Existing immutable
template snapshots and their published content are retained.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c7e5d0a2b611"
down_revision: Union[str, Sequence[str], None] = "c2a8d4e6f901"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("template_snapshot_versions", sa.Column("review_status", sa.String(length=30), nullable=False, server_default="published"))
    op.add_column("template_snapshot_versions", sa.Column("approved_by", sa.String(length=100), nullable=True))
    op.add_column("template_snapshot_versions", sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index(op.f("ix_template_snapshot_versions_review_status"), "template_snapshot_versions", ["review_status"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_template_snapshot_versions_review_status"), table_name="template_snapshot_versions")
    op.drop_column("template_snapshot_versions", "approved_at")
    op.drop_column("template_snapshot_versions", "approved_by")
    op.drop_column("template_snapshot_versions", "review_status")
