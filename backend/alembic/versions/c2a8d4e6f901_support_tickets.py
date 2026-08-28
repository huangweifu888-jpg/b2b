"""add tenant support tickets

Revision ID: c2a8d4e6f901
Revises: f4b2c91a7d55
Create Date: 2026-07-28

Downgrade removes the support-ticket table only after required operational
records have been exported under the customer-operations retention policy.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c2a8d4e6f901"
down_revision: Union[str, Sequence[str], None] = "f4b2c91a7d55"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "support_tickets",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("org_id", sa.Integer(), nullable=False), sa.Column("project_id", sa.Integer(), nullable=True),
        sa.Column("ticket_key", sa.String(length=100), nullable=False), sa.Column("subject", sa.String(length=500), nullable=False),
        sa.Column("severity", sa.String(length=20), nullable=False), sa.Column("status", sa.String(length=30), nullable=False, server_default="open"),
        sa.Column("assigned_to", sa.String(length=255), nullable=True), sa.Column("first_response_due_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("next_update_due_at", sa.DateTime(timezone=True), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), nullable=True), sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"]), sa.ForeignKeyConstraint(["project_id"], ["projects_platform.id"]), sa.ForeignKeyConstraint(["assigned_to"], ["users.id"]), sa.UniqueConstraint("ticket_key"),
    )
    for column in ("id", "org_id", "project_id", "ticket_key", "severity", "status", "assigned_to"):
        op.create_index(op.f(f"ix_support_tickets_{column}"), "support_tickets", [column], unique=False)


def downgrade() -> None:
    for column in ("assigned_to", "status", "severity", "ticket_key", "project_id", "org_id", "id"):
        op.drop_index(op.f(f"ix_support_tickets_{column}"), table_name="support_tickets")
    op.drop_table("support_tickets")
