"""add tenant plan runtime and content download metadata

Revision ID: f3a92d1b7c10
Revises: 8ad26049dd3e
Create Date: 2026-07-28
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f3a92d1b7c10"
down_revision: Union[str, Sequence[str], None] = "8ad26049dd3e"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "plan_runtime_configs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("deployment_id", sa.String(length=100), server_default="shared-stamp-a", nullable=False),
        sa.Column("database_id", sa.String(length=100), server_default="shared-client-db-a", nullable=False),
        sa.Column("base_client_version", sa.String(length=100), server_default="0.1.0", nullable=False),
        sa.Column("template_version", sa.String(length=100), server_default="0.1.0", nullable=False),
        sa.Column("enabled_modules_json", sa.Text(), server_default="[]", nullable=False),
        sa.Column("overrides_json", sa.Text(), server_default="{}", nullable=False),
        sa.Column("status", sa.String(length=50), server_default="active", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["project_id"], ["projects_platform.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("project_id", name="uq_plan_runtime_project"),
    )
    op.create_index(op.f("ix_plan_runtime_configs_id"), "plan_runtime_configs", ["id"], unique=False)
    op.create_index(op.f("ix_plan_runtime_configs_project_id"), "plan_runtime_configs", ["project_id"], unique=False)
    op.create_table(
        "content_download_assets",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("client_org_id", sa.Integer(), nullable=False),
        sa.Column("storage_key", sa.String(length=1000), nullable=False),
        sa.Column("display_name", sa.String(length=500), nullable=False),
        sa.Column("media_type", sa.String(length=255), nullable=True),
        sa.Column("visibility", sa.String(length=50), server_default="authenticated", nullable=False),
        sa.Column("enabled", sa.Boolean(), server_default=sa.text("1"), nullable=False),
        sa.Column("created_by", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["client_org_id"], ["organizations.id"]),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["project_id"], ["projects_platform.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("project_id", "storage_key", name="uq_content_download_project_key"),
    )
    op.create_index(op.f("ix_content_download_assets_id"), "content_download_assets", ["id"], unique=False)
    op.create_index(op.f("ix_content_download_assets_project_id"), "content_download_assets", ["project_id"], unique=False)
    op.create_index(op.f("ix_content_download_assets_client_org_id"), "content_download_assets", ["client_org_id"], unique=False)
    op.create_index(op.f("ix_content_download_assets_created_by"), "content_download_assets", ["created_by"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_content_download_assets_created_by"), table_name="content_download_assets")
    op.drop_index(op.f("ix_content_download_assets_client_org_id"), table_name="content_download_assets")
    op.drop_index(op.f("ix_content_download_assets_project_id"), table_name="content_download_assets")
    op.drop_index(op.f("ix_content_download_assets_id"), table_name="content_download_assets")
    op.drop_table("content_download_assets")
    op.drop_index(op.f("ix_plan_runtime_configs_project_id"), table_name="plan_runtime_configs")
    op.drop_index(op.f("ix_plan_runtime_configs_id"), table_name="plan_runtime_configs")
    op.drop_table("plan_runtime_configs")
