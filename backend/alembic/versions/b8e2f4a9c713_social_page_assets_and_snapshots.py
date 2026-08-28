"""add tenant-scoped social page assets and metric snapshots

Revision ID: b8e2f4a9c713
Revises: c2f7a9d4e106
Create Date: 2026-07-31
Rollback note: downgrade removes internal page asset, metric snapshot and sync
request metadata only. It never removes data from any external social platform
and these tables do not contain platform credentials or OAuth tokens.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b8e2f4a9c713"
down_revision: Union[str, Sequence[str], None] = "c2f7a9d4e106"
branch_labels = None
depends_on = None


def _tenant_columns() -> list[sa.Column]:
    return [
        sa.Column("agent_path", sa.String(length=512), nullable=False),
        sa.Column("tenant_id", sa.String(length=80), nullable=False),
        sa.Column("client_id", sa.String(length=80), nullable=False),
        sa.Column("plan_id", sa.String(length=80), nullable=False),
    ]


def upgrade() -> None:
    op.create_table(
        "social_page_assets",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects_platform.id"), nullable=False),
        *_tenant_columns(),
        sa.Column("authorization_request_id", sa.String(length=64), sa.ForeignKey("social_authorization_requests.id"), nullable=True),
        sa.Column("provider", sa.String(length=80), nullable=False),
        sa.Column("display_name", sa.String(length=255), nullable=False),
        sa.Column("page_url", sa.String(length=1000), nullable=False),
        sa.Column("asset_reference", sa.String(length=255), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="awaiting_oauth"),
        sa.Column("created_by", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    for column in ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", "authorization_request_id", "provider", "status", "created_by"):
        op.create_index(f"ix_social_page_assets_{column}", "social_page_assets", [column])

    op.create_table(
        "social_page_metric_snapshots",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects_platform.id"), nullable=False),
        sa.Column("page_asset_id", sa.String(length=64), sa.ForeignKey("social_page_assets.id"), nullable=False),
        *_tenant_columns(),
        sa.Column("source", sa.String(length=32), nullable=False),
        sa.Column("captured_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("followers", sa.Integer(), nullable=True),
        sa.Column("impressions", sa.Integer(), nullable=True),
        sa.Column("engagements", sa.Integer(), nullable=True),
        sa.Column("views", sa.Integer(), nullable=True),
        sa.Column("clicks", sa.Integer(), nullable=True),
        sa.Column("recorded_by", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )
    for column in ("project_id", "page_asset_id", "agent_path", "tenant_id", "client_id", "plan_id", "source", "captured_at", "recorded_by"):
        op.create_index(f"ix_social_page_metric_snapshots_{column}", "social_page_metric_snapshots", [column])

    op.create_table(
        "social_page_sync_requests",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects_platform.id"), nullable=False),
        sa.Column("page_asset_id", sa.String(length=64), sa.ForeignKey("social_page_assets.id"), nullable=False),
        *_tenant_columns(),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="blocked_configuration"),
        sa.Column("block_reasons_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("requested_by", sa.String(length=255), nullable=False),
        sa.Column("requested_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    for column in ("project_id", "page_asset_id", "agent_path", "tenant_id", "client_id", "plan_id", "status", "requested_by"):
        op.create_index(f"ix_social_page_sync_requests_{column}", "social_page_sync_requests", [column])


def downgrade() -> None:
    for column in ("requested_by", "status", "plan_id", "client_id", "tenant_id", "agent_path", "page_asset_id", "project_id"):
        op.drop_index(f"ix_social_page_sync_requests_{column}", table_name="social_page_sync_requests")
    op.drop_table("social_page_sync_requests")
    for column in ("recorded_by", "captured_at", "source", "plan_id", "client_id", "tenant_id", "agent_path", "page_asset_id", "project_id"):
        op.drop_index(f"ix_social_page_metric_snapshots_{column}", table_name="social_page_metric_snapshots")
    op.drop_table("social_page_metric_snapshots")
    for column in ("created_by", "status", "provider", "authorization_request_id", "plan_id", "client_id", "tenant_id", "agent_path", "project_id"):
        op.drop_index(f"ix_social_page_assets_{column}", table_name="social_page_assets")
    op.drop_table("social_page_assets")
