"""pin appearance-only sections on durable template release batches

Revision ID: b17e6c4a9d20
Revises: a02b3c4d5e6f
Create Date: 2026-08-21

Rollback drops only the new release-control columns.  It refuses to run while
any batch is non-terminal or any section-only release exists, because removing
``sections_json`` could otherwise reinterpret an appearance-only retry as a
legacy full-template rollout.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b17e6c4a9d20"
down_revision: Union[str, Sequence[str], None] = "a02b3c4d5e6f"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "template_snapshot_release_batches",
        sa.Column("sections_json", sa.Text(), server_default="[]", nullable=False),
    )
    op.add_column(
        "template_snapshot_release_targets",
        sa.Column("attempt_count", sa.Integer(), server_default="0", nullable=False),
    )
    op.add_column(
        "template_snapshot_release_targets",
        sa.Column("lease_expires_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_template_snapshot_release_targets_lease_expires_at",
        "template_snapshot_release_targets",
        ["lease_expires_at"],
        unique=False,
    )


def downgrade() -> None:
    bind = op.get_bind()
    unsafe_batches = bind.execute(
        sa.text(
            """
            SELECT COUNT(*)
            FROM template_snapshot_release_batches
            WHERE status <> 'completed'
               OR COALESCE(sections_json, '[]') <> '[]'
            """
        )
    ).scalar_one()
    if unsafe_batches:
        raise RuntimeError(
            "Cannot downgrade release controls while a batch is non-terminal or retains section-only semantics"
        )
    op.drop_index(
        "ix_template_snapshot_release_targets_lease_expires_at",
        table_name="template_snapshot_release_targets",
    )
    op.drop_column("template_snapshot_release_targets", "lease_expires_at")
    op.drop_column("template_snapshot_release_targets", "attempt_count")
    op.drop_column("template_snapshot_release_batches", "sections_json")
