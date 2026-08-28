"""add revocable refresh sessions

Revision ID: e3b8a7c4d901
Revises: d1f4e8a9c302
Create Date: 2026-07-29

Rollback note: downgrade removes only server-side refresh-session records;
existing users, OIDC state and access tokens remain unaffected.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "e3b8a7c4d901"
down_revision: Union[str, Sequence[str], None] = "d1f4e8a9c302"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.create_table("auth_refresh_sessions", sa.Column("id", sa.String(length=64), primary_key=True), sa.Column("user_id", sa.String(length=255), nullable=False), sa.Column("token_hash", sa.String(length=128), nullable=False), sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False), sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True), sa.Column("created_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_auth_refresh_sessions_user_id", "auth_refresh_sessions", ["user_id"])
    op.create_index("ix_auth_refresh_sessions_token_hash", "auth_refresh_sessions", ["token_hash"], unique=True)
    op.create_index("ix_auth_refresh_sessions_expires_at", "auth_refresh_sessions", ["expires_at"])

def downgrade() -> None:
    op.drop_index("ix_auth_refresh_sessions_expires_at", table_name="auth_refresh_sessions")
    op.drop_index("ix_auth_refresh_sessions_token_hash", table_name="auth_refresh_sessions")
    op.drop_index("ix_auth_refresh_sessions_user_id", table_name="auth_refresh_sessions")
    op.drop_table("auth_refresh_sessions")
