"""add a confirmed Product Market factory-default pointer

Revision ID: d04a7c2e9b31
Revises: c93f1a6e4b20
Create Date: 2026-08-27

Rollback note: downgrade is fail closed after any template has promoted a
factory default.  Clearing the pointer while tenant instances depend on its
immutable version would silently change provisioning and recovery semantics.
No business data, tenant content, uploaded assets or formal backups are stored
in these columns.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d04a7c2e9b31"
down_revision: Union[str, Sequence[str], None] = "c93f1a6e4b20"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("template_snapshot_templates") as batch_op:
        batch_op.add_column(sa.Column("factory_default_version", sa.String(length=50), nullable=True))
        batch_op.add_column(sa.Column("factory_default_release_batch_id", sa.String(length=36), nullable=True))
        batch_op.add_column(sa.Column("factory_default_contract_version", sa.String(length=50), nullable=True))
        batch_op.add_column(sa.Column("factory_default_promoted_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("factory_default_promoted_by", sa.String(length=255), nullable=True))
        batch_op.create_foreign_key(
            "fk_template_snapshot_factory_default_batch",
            "template_snapshot_release_batches",
            ["factory_default_release_batch_id"],
            ["id"],
        )
        batch_op.create_foreign_key(
            "fk_template_snapshot_factory_default_user",
            "users",
            ["factory_default_promoted_by"],
            ["id"],
        )
        batch_op.create_check_constraint(
            "ck_template_snapshot_factory_default_pointer_complete",
            "(factory_default_version IS NULL AND factory_default_release_batch_id IS NULL "
            "AND factory_default_contract_version IS NULL AND factory_default_promoted_at IS NULL) OR "
            "(factory_default_version IS NOT NULL AND factory_default_release_batch_id IS NOT NULL "
            "AND factory_default_contract_version IS NOT NULL AND factory_default_promoted_at IS NOT NULL)",
        )
        batch_op.create_index(
            "ix_template_snapshot_templates_factory_default_version",
            ["factory_default_version"],
            unique=False,
        )
        batch_op.create_index(
            "ix_template_snapshot_templates_factory_default_release_batch_id",
            ["factory_default_release_batch_id"],
            unique=False,
        )
        batch_op.create_index(
            "ix_template_snapshot_templates_factory_default_promoted_at",
            ["factory_default_promoted_at"],
            unique=False,
        )
        batch_op.create_index(
            "ix_template_snapshot_templates_factory_default_promoted_by",
            ["factory_default_promoted_by"],
            unique=False,
        )


def downgrade() -> None:
    bind = op.get_bind()
    promoted = bind.execute(
        sa.text(
            "SELECT COUNT(*) FROM template_snapshot_templates "
            "WHERE factory_default_version IS NOT NULL "
            "OR factory_default_release_batch_id IS NOT NULL"
        )
    ).scalar_one()
    if promoted:
        raise RuntimeError(
            "Cannot downgrade Product Market factory defaults while confirmed pointers exist"
        )
    with op.batch_alter_table("template_snapshot_templates") as batch_op:
        batch_op.drop_index("ix_template_snapshot_templates_factory_default_promoted_by")
        batch_op.drop_index("ix_template_snapshot_templates_factory_default_promoted_at")
        batch_op.drop_index("ix_template_snapshot_templates_factory_default_release_batch_id")
        batch_op.drop_index("ix_template_snapshot_templates_factory_default_version")
        batch_op.drop_constraint("fk_template_snapshot_factory_default_user", type_="foreignkey")
        batch_op.drop_constraint("fk_template_snapshot_factory_default_batch", type_="foreignkey")
        batch_op.drop_constraint("ck_template_snapshot_factory_default_pointer_complete", type_="check")
        batch_op.drop_column("factory_default_promoted_by")
        batch_op.drop_column("factory_default_promoted_at")
        batch_op.drop_column("factory_default_contract_version")
        batch_op.drop_column("factory_default_release_batch_id")
        batch_op.drop_column("factory_default_version")
