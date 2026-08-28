"""add social compliance policies

Revision ID: c2f7a9d4e106
Revises: f1d8a6b3c209
Create Date: 2026-07-31
Rollback note: downgrade removes retained policy metadata only.  It never
deletes social provider data because external deletion is intentionally out of
scope for this default-disabled implementation.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c2f7a9d4e106"
down_revision: Union[str, Sequence[str], None] = "f1d8a6b3c209"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "social_compliance_policies",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects_platform.id"), nullable=False, unique=True),
        sa.Column("agent_path", sa.String(length=512), nullable=False),
        sa.Column("tenant_id", sa.String(length=80), nullable=False),
        sa.Column("client_id", sa.String(length=80), nullable=False),
        sa.Column("plan_id", sa.String(length=80), nullable=False),
        sa.Column("retention_days", sa.Integer(), nullable=False, server_default="180"),
        sa.Column("deletion_status", sa.String(length=40), nullable=False, server_default="active"),
        sa.Column("deletion_requested_by", sa.String(length=255), nullable=True),
        sa.Column("deletion_requested_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deletion_reviewed_by", sa.String(length=255), nullable=True),
        sa.Column("deletion_reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    for column in ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", "deletion_status"):
        op.create_index(f"ix_social_compliance_policies_{column}", "social_compliance_policies", [column])


def downgrade() -> None:
    for column in ("deletion_status", "plan_id", "client_id", "tenant_id", "agent_path", "project_id"):
        op.drop_index(f"ix_social_compliance_policies_{column}", table_name="social_compliance_policies")
    op.drop_table("social_compliance_policies")
