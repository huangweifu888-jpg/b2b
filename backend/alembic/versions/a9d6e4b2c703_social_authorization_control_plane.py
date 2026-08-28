"""add social authorization control-plane records

Revision ID: a9d6e4b2c703
Revises: f7b3c9d1e602
Create Date: 2026-07-30
Rollback note: downgrade removes only authorization-control metadata. It does
not affect external platform accounts because no token or platform data is
stored by this migration.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a9d6e4b2c703"
down_revision: Union[str, Sequence[str], None] = "f7b3c9d1e602"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "social_oauth_applications",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("provider", sa.String(length=80), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="draft"),
        sa.Column("client_id_reference", sa.String(length=255), nullable=True),
        sa.Column("secret_reference", sa.String(length=255), nullable=True),
        sa.Column("redirect_uri", sa.String(length=1000), nullable=True),
        sa.Column("approved_scopes_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("configured_by", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("provider", name="uq_social_oauth_applications_provider"),
    )
    op.create_index("ix_social_oauth_applications_provider", "social_oauth_applications", ["provider"])
    op.create_index("ix_social_oauth_applications_status", "social_oauth_applications", ["status"])
    op.create_table(
        "social_authorization_requests",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects_platform.id"), nullable=False),
        sa.Column("agent_path", sa.String(length=512), nullable=False),
        sa.Column("tenant_id", sa.String(length=80), nullable=False),
        sa.Column("client_id", sa.String(length=80), nullable=False),
        sa.Column("plan_id", sa.String(length=80), nullable=False),
        sa.Column("provider", sa.String(length=80), nullable=False),
        sa.Column("account_label", sa.String(length=255), nullable=False),
        sa.Column("market", sa.String(length=20), nullable=False),
        sa.Column("requested_scopes_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("status", sa.String(length=40), nullable=False, server_default="awaiting_headquarters_app"),
        sa.Column("requested_by", sa.String(length=255), nullable=False),
        sa.Column("cancelled_by", sa.String(length=255), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    for column in ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", "provider", "status", "requested_by"):
        op.create_index(f"ix_social_authorization_requests_{column}", "social_authorization_requests", [column])


def downgrade() -> None:
    for column in ("requested_by", "status", "provider", "plan_id", "client_id", "tenant_id", "agent_path", "project_id"):
        op.drop_index(f"ix_social_authorization_requests_{column}", table_name="social_authorization_requests")
    op.drop_table("social_authorization_requests")
    op.drop_index("ix_social_oauth_applications_status", table_name="social_oauth_applications")
    op.drop_index("ix_social_oauth_applications_provider", table_name="social_oauth_applications")
    op.drop_table("social_oauth_applications")
