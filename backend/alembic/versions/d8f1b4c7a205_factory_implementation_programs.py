"""add tenant scoped factory implementation programs

Revision ID: d8f1b4c7a205
Revises: b3d5f7a9c124

Rollback removes only implementation control records and their evidence index.
It does not delete tenant business data, source-system records or exported files.
"""

from alembic import op
import sqlalchemy as sa


revision = "d8f1b4c7a205"
down_revision = "b3d5f7a9c124"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "factory_implementation_programs",
        sa.Column("id", sa.String(length=100), primary_key=True),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("agent_path", sa.String(length=500), nullable=False),
        sa.Column("tenant_id", sa.String(length=100), nullable=False),
        sa.Column("client_id", sa.String(length=100), nullable=False),
        sa.Column("plan_id", sa.String(length=100), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("golden_flow", sa.String(length=50), nullable=False),
        sa.Column("baseline_summary", sa.Text(), nullable=False),
        sa.Column("target_outcome", sa.Text(), nullable=False),
        sa.Column("current_stage", sa.String(length=50), nullable=False, server_default="day-7"),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="active"),
        sa.Column("artifacts_json", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("blockers_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("next_action", sa.Text(), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("updated_by", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    for column in ("project_id", "agent_path", "tenant_id", "client_id", "plan_id", "golden_flow", "current_stage", "status", "updated_by"):
        op.create_index(f"ix_factory_implementation_programs_{column}", "factory_implementation_programs", [column])


def downgrade() -> None:
    for column in ("updated_by", "status", "current_stage", "golden_flow", "plan_id", "client_id", "tenant_id", "agent_path", "project_id"):
        op.drop_index(f"ix_factory_implementation_programs_{column}", table_name="factory_implementation_programs")
    op.drop_table("factory_implementation_programs")
