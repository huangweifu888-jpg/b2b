"""tenant-bound template snapshots

Revision ID: d91be72fa016
Revises: a84d6c21e35f
Create Date: 2026-07-28
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d91be72fa016"
down_revision: Union[str, Sequence[str], None] = "a84d6c21e35f"
branch_labels = None
depends_on = None


def upgrade() -> None:
    for table in ("template_snapshot_templates", "template_snapshot_instances"):
        op.add_column(table, sa.Column("organization_id", sa.Integer(), nullable=True))
        op.add_column(table, sa.Column("project_id", sa.Integer(), nullable=True))
        op.create_index(op.f(f"ix_{table}_organization_id"), table, ["organization_id"], unique=False)
        op.create_index(op.f(f"ix_{table}_project_id"), table, ["project_id"], unique=False)
    op.create_table(
        "template_snapshot_legacy_mappings",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("owner_scope", sa.String(length=50), nullable=False),
        sa.Column("legacy_owner_id", sa.String(length=100), nullable=False),
        sa.Column("organization_id", sa.Integer(), nullable=True),
        sa.Column("project_id", sa.Integer(), nullable=True),
        sa.Column("created_by", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("owner_scope", "legacy_owner_id", name="uq_template_snapshot_legacy_scope_owner"),
    )
    for column in ("owner_scope", "legacy_owner_id", "organization_id", "project_id", "created_by"):
        op.create_index(op.f(f"ix_template_snapshot_legacy_mappings_{column}"), "template_snapshot_legacy_mappings", [column], unique=False)


def downgrade() -> None:
    for column in ("created_by", "project_id", "organization_id", "legacy_owner_id", "owner_scope"):
        op.drop_index(op.f(f"ix_template_snapshot_legacy_mappings_{column}"), table_name="template_snapshot_legacy_mappings")
    op.drop_table("template_snapshot_legacy_mappings")
    for table in ("template_snapshot_instances", "template_snapshot_templates"):
        op.drop_index(op.f(f"ix_{table}_project_id"), table_name=table)
        op.drop_index(op.f(f"ix_{table}_organization_id"), table_name=table)
        op.drop_column(table, "project_id")
        op.drop_column(table, "organization_id")
