"""secure content download intake

Revision ID: a84d6c21e35f
Revises: 52f927590325
Create Date: 2026-07-28
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a84d6c21e35f"
down_revision: Union[str, Sequence[str], None] = "52f927590325"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("content_download_assets", sa.Column("size_bytes", sa.Integer(), server_default="0", nullable=False))
    op.add_column("content_download_assets", sa.Column("sha256", sa.String(length=64), nullable=True))
    op.add_column(
        "content_download_assets",
        sa.Column("scan_status", sa.String(length=50), server_default="pending", nullable=False),
    )
    op.add_column("content_download_assets", sa.Column("scan_detail", sa.String(length=1000), nullable=True))
    op.add_column("content_download_assets", sa.Column("scanned_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index(op.f("ix_content_download_assets_scan_status"), "content_download_assets", ["scan_status"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_content_download_assets_scan_status"), table_name="content_download_assets")
    op.drop_column("content_download_assets", "scanned_at")
    op.drop_column("content_download_assets", "scan_detail")
    op.drop_column("content_download_assets", "scan_status")
    op.drop_column("content_download_assets", "sha256")
    op.drop_column("content_download_assets", "size_bytes")
