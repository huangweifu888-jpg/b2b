"""persist immutable template-version release sections

Revision ID: c28f7d5a9e31
Revises: b17e6c4a9d20
Create Date: 2026-08-21

``NULL`` preserves the legacy/full-template meaning.  Non-NULL metadata marks
a version as section-only and must never be discarded by a downgrade, because
doing so would reinterpret its full authoring snapshot as a full release.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c28f7d5a9e31"
down_revision: Union[str, Sequence[str], None] = "b17e6c4a9d20"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "template_snapshot_versions",
        sa.Column("release_sections_json", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    bind = op.get_bind()
    scoped_versions = bind.execute(
        sa.text(
            """
            SELECT COUNT(*)
            FROM template_snapshot_versions
            WHERE release_sections_json IS NOT NULL
            """
        )
    ).scalar_one()
    if scoped_versions:
        raise RuntimeError(
            "Cannot downgrade template version release sections while section-only history exists"
        )
    op.drop_column("template_snapshot_versions", "release_sections_json")
