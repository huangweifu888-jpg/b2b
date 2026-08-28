"""add review detail and staged approval metadata

Revision ID: d1f4e8a9c302
Revises: c7e5d0a2b611
Create Date: 2026-07-29

Rollback note: downgrade only removes review notes and staged approval counters;
immutable snapshot content and published pointers are retained.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d1f4e8a9c302"
down_revision: Union[str, Sequence[str], None] = "c7e5d0a2b611"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("template_snapshot_versions", sa.Column("review_note", sa.String(length=1000), nullable=True))
    op.add_column("template_snapshot_versions", sa.Column("review_step", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("template_snapshot_versions", sa.Column("required_review_steps", sa.Integer(), nullable=False, server_default="1"))


def downgrade() -> None:
    op.drop_column("template_snapshot_versions", "required_review_steps")
    op.drop_column("template_snapshot_versions", "review_step")
    op.drop_column("template_snapshot_versions", "review_note")
