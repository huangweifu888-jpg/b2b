"""add tenant-scoped social publish jobs

Revision ID: d4a1e9c7f812
Revises: c8e2f4a9b715
Create Date: 2026-07-31
Rollback note: downgrade removes internal publish job records only. These jobs
are guard records and never contain credentials or external post payloads.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d4a1e9c7f812"
down_revision: Union[str, Sequence[str], None] = "c8e2f4a9b715"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "social_publish_jobs",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects_platform.id"), nullable=False),
        sa.Column("agent_path", sa.String(length=512), nullable=False),
        sa.Column("tenant_id", sa.String(length=80), nullable=False),
        sa.Column("client_id", sa.String(length=80), nullable=False),
        sa.Column("plan_id", sa.String(length=80), nullable=False),
        sa.Column("content_review_id", sa.String(length=64), sa.ForeignKey("social_content_reviews.id"), nullable=False),
        sa.Column("provider", sa.String(length=80), nullable=False),
        sa.Column("idempotency_key", sa.String(length=128), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="blocked"),
        sa.Column("block_reasons_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("requested_by", sa.String(length=255), nullable=False),
        sa.Column("scheduled_for", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("project_id", "idempotency_key", name="uq_social_publish_jobs_project_idempotency"),
    )
    for column in ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", "content_review_id", "provider", "status", "requested_by"):
        op.create_index(f"ix_social_publish_jobs_{column}", "social_publish_jobs", [column])


def downgrade() -> None:
    for column in ("requested_by", "status", "provider", "content_review_id", "plan_id", "client_id", "tenant_id", "agent_path", "project_id"):
        op.drop_index(f"ix_social_publish_jobs_{column}", table_name="social_publish_jobs")
    op.drop_table("social_publish_jobs")
