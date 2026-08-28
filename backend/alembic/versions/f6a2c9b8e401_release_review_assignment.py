"""add release reviewer assignment and due time

Revision ID: f6a2c9b8e401
Revises: e3b8a7c4d901
Create Date: 2026-07-29

Rollback note: downgrade removes review assignment and due-time metadata only.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
revision: str = "f6a2c9b8e401"
down_revision: Union[str, Sequence[str], None] = "e3b8a7c4d901"
branch_labels = None
depends_on = None
def upgrade() -> None:
    op.add_column("template_snapshot_versions", sa.Column("review_assignee", sa.String(length=100), nullable=True))
    op.add_column("template_snapshot_versions", sa.Column("review_due_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_template_snapshot_versions_review_assignee", "template_snapshot_versions", ["review_assignee"])
    op.create_index("ix_template_snapshot_versions_review_due_at", "template_snapshot_versions", ["review_due_at"])
def downgrade() -> None:
    op.drop_index("ix_template_snapshot_versions_review_due_at", table_name="template_snapshot_versions")
    op.drop_index("ix_template_snapshot_versions_review_assignee", table_name="template_snapshot_versions")
    op.drop_column("template_snapshot_versions", "review_due_at")
    op.drop_column("template_snapshot_versions", "review_assignee")
