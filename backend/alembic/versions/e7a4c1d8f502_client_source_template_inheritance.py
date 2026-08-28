"""add parent template binding for client-source inheritance

Revision ID: e7a4c1d8f502
Revises: d5f93a7c1042
Rollback note: downgrade removes only the optional parent-template reference;
existing templates and runtime instances remain intact.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e7a4c1d8f502"
down_revision: Union[str, Sequence[str], None] = "d5f93a7c1042"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("template_snapshot_templates", sa.Column("parent_template_id", sa.String(length=100), nullable=True))
    op.create_index("ix_template_snapshot_templates_parent_template_id", "template_snapshot_templates", ["parent_template_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_template_snapshot_templates_parent_template_id", table_name="template_snapshot_templates")
    op.drop_column("template_snapshot_templates", "parent_template_id")
