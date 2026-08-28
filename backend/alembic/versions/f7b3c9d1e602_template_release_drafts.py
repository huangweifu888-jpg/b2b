"""separate mutable template drafts from released configurations

Revision ID: f7b3c9d1e602
Revises: e7a4c1d8f502
Create Date: 2026-07-30
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f7b3c9d1e602"
down_revision: Union[str, Sequence[str], None] = "e7a4c1d8f502"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("template_snapshot_templates", sa.Column("draft_config_json", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("template_snapshot_templates", "draft_config_json")
