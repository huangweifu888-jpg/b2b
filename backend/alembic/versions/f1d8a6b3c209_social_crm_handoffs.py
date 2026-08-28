"""add reviewed social CRM handoffs

Revision ID: f1d8a6b3c209
Revises: e6c3b2a1d904
Create Date: 2026-07-31
Rollback note: downgrade removes internal handoff metadata only. No external CRM
record is created by this migration or the default blocked workflow.
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "f1d8a6b3c209"
down_revision: Union[str, Sequence[str], None] = "e6c3b2a1d904"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "social_crm_handoffs",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects_platform.id"), nullable=False),
        sa.Column("agent_path", sa.String(length=512), nullable=False),
        sa.Column("tenant_id", sa.String(length=80), nullable=False),
        sa.Column("client_id", sa.String(length=80), nullable=False),
        sa.Column("plan_id", sa.String(length=80), nullable=False),
        sa.Column("provider", sa.String(length=80), nullable=False),
        sa.Column("contact_reference", sa.String(length=160), nullable=False),
        sa.Column("lead_summary", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=40), nullable=False, server_default="pending_manual_review"),
        sa.Column("submitted_by", sa.String(length=255), nullable=False),
        sa.Column("reviewed_by", sa.String(length=255), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("review_note", sa.Text(), nullable=True),
        sa.Column("dispatched_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    for column in ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", "provider", "status", "submitted_by"):
        op.create_index(f"ix_social_crm_handoffs_{column}", "social_crm_handoffs", [column])


def downgrade() -> None:
    for column in ("submitted_by", "status", "provider", "plan_id", "client_id", "tenant_id", "agent_path", "project_id"):
        op.drop_index(f"ix_social_crm_handoffs_{column}", table_name="social_crm_handoffs")
    op.drop_table("social_crm_handoffs")
