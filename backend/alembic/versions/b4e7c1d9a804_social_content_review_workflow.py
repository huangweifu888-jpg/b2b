"""add tenant-scoped social content review workflow

Revision ID: b4e7c1d9a804
Revises: a9d6e4b2c703
Create Date: 2026-07-30
Rollback note: downgrade removes only internal social-content drafts and review
metadata. It does not affect any external social-platform post because this
workflow never publishes to external channels.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b4e7c1d9a804"
down_revision: Union[str, Sequence[str], None] = "a9d6e4b2c703"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "social_content_reviews",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects_platform.id"), nullable=False),
        sa.Column("agent_path", sa.String(length=512), nullable=False),
        sa.Column("tenant_id", sa.String(length=80), nullable=False),
        sa.Column("client_id", sa.String(length=80), nullable=False),
        sa.Column("plan_id", sa.String(length=80), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("content_text", sa.Text(), nullable=False),
        sa.Column("channels_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("status", sa.String(length=40), nullable=False, server_default="pending_agency_review"),
        sa.Column("submitted_by", sa.String(length=255), nullable=False),
        sa.Column("agency_reviewed_by", sa.String(length=255), nullable=True),
        sa.Column("agency_reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("headquarters_reviewed_by", sa.String(length=255), nullable=True),
        sa.Column("headquarters_reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("review_note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    for column in ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", "status", "submitted_by"):
        op.create_index(f"ix_social_content_reviews_{column}", "social_content_reviews", [column])


def downgrade() -> None:
    for column in ("submitted_by", "status", "plan_id", "client_id", "tenant_id", "agent_path", "project_id"):
        op.drop_index(f"ix_social_content_reviews_{column}", table_name="social_content_reviews")
    op.drop_table("social_content_reviews")
