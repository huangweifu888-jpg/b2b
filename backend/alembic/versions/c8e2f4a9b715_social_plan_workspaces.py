"""add tenant-scoped social plan workspaces

Revision ID: c8e2f4a9b715
Revises: b4e7c1d9a804
Create Date: 2026-07-31
Rollback note: downgrade removes only internal social workflow state. It never
contains OAuth tokens, passwords, cookies, authorization codes or API keys.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c8e2f4a9b715"
down_revision: Union[str, Sequence[str], None] = "b4e7c1d9a804"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "social_plan_workspaces",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects_platform.id"), nullable=False),
        sa.Column("agent_path", sa.String(length=512), nullable=False),
        sa.Column("tenant_id", sa.String(length=80), nullable=False),
        sa.Column("client_id", sa.String(length=80), nullable=False),
        sa.Column("plan_id", sa.String(length=80), nullable=False),
        sa.Column("state_json", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("updated_by", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("project_id", name="uq_social_plan_workspaces_project_id"),
    )
    for column in ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", "updated_by"):
        op.create_index(f"ix_social_plan_workspaces_{column}", "social_plan_workspaces", [column])


def downgrade() -> None:
    for column in ("updated_by", "plan_id", "client_id", "tenant_id", "agent_path", "project_id"):
        op.drop_index(f"ix_social_plan_workspaces_{column}", table_name="social_plan_workspaces")
    op.drop_table("social_plan_workspaces")
