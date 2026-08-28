"""add social credential references and revocation state

Revision ID: e6c3b2a1d904
Revises: d4a1e9c7f812
Create Date: 2026-07-31
Rollback note: downgrade removes only opaque credential references and status
metadata. It cannot delete or alter any value in the external secret manager.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e6c3b2a1d904"
down_revision: Union[str, Sequence[str], None] = "d4a1e9c7f812"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "social_credential_references",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects_platform.id"), nullable=False),
        sa.Column("agent_path", sa.String(length=512), nullable=False),
        sa.Column("tenant_id", sa.String(length=80), nullable=False),
        sa.Column("client_id", sa.String(length=80), nullable=False),
        sa.Column("plan_id", sa.String(length=80), nullable=False),
        sa.Column("authorization_request_id", sa.String(length=64), sa.ForeignKey("social_authorization_requests.id"), nullable=True),
        sa.Column("provider", sa.String(length=80), nullable=False),
        sa.Column("secret_reference", sa.String(length=255), nullable=False),
        sa.Column("scopes_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="active"),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revocation_requested_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.String(length=255), nullable=False),
        sa.Column("revoked_by", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("project_id", "provider", "secret_reference", name="uq_social_credential_reference_scope"),
    )
    for column in ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", "authorization_request_id", "provider", "status", "created_by"):
        op.create_index(f"ix_social_credential_references_{column}", "social_credential_references", [column])


def downgrade() -> None:
    for column in ("created_by", "status", "provider", "authorization_request_id", "plan_id", "client_id", "tenant_id", "agent_path", "project_id"):
        op.drop_index(f"ix_social_credential_references_{column}", table_name="social_credential_references")
    op.drop_table("social_credential_references")
