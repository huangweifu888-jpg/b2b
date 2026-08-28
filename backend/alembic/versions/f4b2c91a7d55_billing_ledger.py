"""add append-only billing ledger

Revision ID: f4b2c91a7d55
Revises: e82cf11ab902
Create Date: 2026-07-28

The downgrade removes only the newly introduced ledger table. Financial records
must be exported and retained under the applicable business policy before use.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f4b2c91a7d55"
down_revision: Union[str, Sequence[str], None] = "e82cf11ab902"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "billing_ledger_entries",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("org_id", sa.Integer(), nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=True),
        sa.Column("entry_key", sa.String(length=100), nullable=False),
        sa.Column("entry_type", sa.String(length=50), nullable=False),
        sa.Column("amount_minor", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(length=10), nullable=False),
        sa.Column("external_event_id", sa.String(length=255), nullable=False),
        sa.Column("payload_digest", sa.String(length=64), nullable=False),
        sa.Column("previous_hash", sa.String(length=64), nullable=True),
        sa.Column("entry_hash", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"]),
        sa.ForeignKeyConstraint(["project_id"], ["projects_platform.id"]),
        sa.UniqueConstraint("entry_key"),
        sa.UniqueConstraint("entry_hash"),
        sa.UniqueConstraint("org_id", "external_event_id", name="uq_billing_ledger_org_external_event"),
    )
    for column in ("id", "org_id", "project_id", "entry_key", "entry_type", "external_event_id", "entry_hash"):
        op.create_index(op.f(f"ix_billing_ledger_entries_{column}"), "billing_ledger_entries", [column], unique=False)


def downgrade() -> None:
    for column in ("entry_hash", "external_event_id", "entry_type", "entry_key", "project_id", "org_id", "id"):
        op.drop_index(op.f(f"ix_billing_ledger_entries_{column}"), table_name="billing_ledger_entries")
    op.drop_table("billing_ledger_entries")
