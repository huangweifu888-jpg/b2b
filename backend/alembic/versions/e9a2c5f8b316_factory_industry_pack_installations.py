"""add tenant scoped factory industry pack installations

Revision ID: e9a2c5f8b316
Revises: d8f1b4c7a205

Rollback removes only industry-pack configuration installations and evidence
indexes. It never deletes tenant products, quotes, orders, assets or tickets.
"""

from alembic import op
import sqlalchemy as sa


revision = "e9a2c5f8b316"
down_revision = "d8f1b4c7a205"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "factory_industry_pack_installations",
        sa.Column("id", sa.String(length=100), primary_key=True),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("agent_path", sa.String(length=500), nullable=False),
        sa.Column("tenant_id", sa.String(length=100), nullable=False),
        sa.Column("client_id", sa.String(length=100), nullable=False),
        sa.Column("plan_id", sa.String(length=100), nullable=False),
        sa.Column("pack_id", sa.String(length=100), nullable=False, server_default="machinery"),
        sa.Column("segment", sa.String(length=100), nullable=False),
        sa.Column("package_version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("configuration_json", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("evidence_json", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="draft"),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("updated_by", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    for column in ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", "pack_id", "segment", "status", "updated_by"):
        op.create_index(f"ix_factory_industry_pack_installations_{column}", "factory_industry_pack_installations", [column])


def downgrade() -> None:
    for column in ("updated_by", "status", "segment", "pack_id", "plan_id", "client_id", "tenant_id", "agent_path", "project_id"):
        op.drop_index(f"ix_factory_industry_pack_installations_{column}", table_name="factory_industry_pack_installations")
    op.drop_table("factory_industry_pack_installations")
