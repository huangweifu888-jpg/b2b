"""add one-time member invitations and default tenant roles

Revision ID: ce8f42a70113
Revises: ab6d2f4e9102
Create Date: 2026-07-29
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "ce8f42a70113"
down_revision: Union[str, Sequence[str], None] = "ab6d2f4e9102"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "membership_invites_platform",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("code_hash", sa.String(length=64), nullable=False),
        sa.Column("org_id", sa.Integer(), nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=True),
        sa.Column("role_id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("status", sa.String(length=50), server_default="pending", nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("invited_by", sa.String(length=255), nullable=True),
        sa.Column("accepted_by", sa.String(length=255), nullable=True),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"]),
        sa.ForeignKeyConstraint(["project_id"], ["projects_platform.id"]),
        sa.ForeignKeyConstraint(["role_id"], ["roles_platform.id"]),
        sa.ForeignKeyConstraint(["invited_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["accepted_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code_hash", name="uq_membership_invite_code_hash"),
    )
    for name, columns in (
        ("ix_membership_invites_platform_id", ["id"]),
        ("ix_membership_invites_platform_code_hash", ["code_hash"]),
        ("ix_membership_invites_platform_org_id", ["org_id"]),
        ("ix_membership_invites_platform_project_id", ["project_id"]),
        ("ix_membership_invites_platform_role_id", ["role_id"]),
        ("ix_membership_invites_platform_email", ["email"]),
        ("ix_membership_invites_platform_status", ["status"]),
        ("ix_membership_invites_platform_expires_at", ["expires_at"]),
    ):
        op.create_index(name, "membership_invites_platform", columns, unique=False)

    op.execute(
        """
        INSERT INTO roles_platform (org_id, scope, name, description, permissions_json, is_system, created_at, updated_at)
        SELECT o.id, 'agency', '代理管理员', '管理本代理及其下级代理、客户和成员',
               '["agency.manage_sub_agencies", "agency.manage_clients", "agency.manage_invites", "agency.view_reports", "tenant.manage_members"]',
               1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        FROM organizations o
        WHERE o.org_type IN ('agency', 'sub_agency')
          AND NOT EXISTS (SELECT 1 FROM roles_platform r WHERE r.org_id = o.id AND r.name = '代理管理员')
        """
    )
    op.execute(
        """
        INSERT INTO roles_platform (org_id, scope, name, description, permissions_json, is_system, created_at, updated_at)
        SELECT o.id, 'client', '客户管理员', '管理客户成员、计划和客户级设置',
               '["client.manage_projects", "client.manage_site", "client.view_all_project_stats", "tenant.manage_members"]',
               1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        FROM organizations o
        WHERE o.org_type = 'client'
          AND NOT EXISTS (SELECT 1 FROM roles_platform r WHERE r.org_id = o.id AND r.name = '客户管理员')
        """
    )
    op.execute(
        """
        INSERT INTO roles_platform (org_id, scope, name, description, permissions_json, is_system, created_at, updated_at)
        SELECT o.id, 'project', '计划管理员', '管理获授权计划的内容和站点',
               '["project.view_stats", "project.edit_site", "project.manage_content", "project.use_ai_builder"]',
               1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        FROM organizations o
        WHERE o.org_type = 'client'
          AND NOT EXISTS (SELECT 1 FROM roles_platform r WHERE r.org_id = o.id AND r.name = '计划管理员')
        """
    )


def downgrade() -> None:
    for name in (
        "ix_membership_invites_platform_expires_at", "ix_membership_invites_platform_status",
        "ix_membership_invites_platform_email", "ix_membership_invites_platform_role_id",
        "ix_membership_invites_platform_project_id", "ix_membership_invites_platform_org_id",
        "ix_membership_invites_platform_code_hash", "ix_membership_invites_platform_id",
    ):
        op.drop_index(name, table_name="membership_invites_platform")
    op.drop_table("membership_invites_platform")
