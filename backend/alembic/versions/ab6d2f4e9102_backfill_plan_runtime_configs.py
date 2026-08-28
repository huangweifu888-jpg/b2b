"""backfill runtime routing for existing client plans

Revision ID: ab6d2f4e9102
Revises: f6a2c9b8e401
Create Date: 2026-07-29
"""

from typing import Sequence, Union

from alembic import op


revision: str = "ab6d2f4e9102"
down_revision: Union[str, Sequence[str], None] = "f6a2c9b8e401"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Make every pre-existing plan explicitly routable before multi-stamp rollout."""
    op.execute(
        """
        INSERT INTO plan_runtime_configs (
            project_id, deployment_id, database_id, base_client_version,
            template_version, enabled_modules_json, overrides_json, status,
            created_at, updated_at
        )
        SELECT
            p.id, 'shared-stamp-a', 'shared-client-db-a', '0.1.0',
            'v1.0.0', '["00-product-market", "02-content"]',
            '{"content_download": false}', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        FROM projects_platform AS p
        WHERE NOT EXISTS (
            SELECT 1 FROM plan_runtime_configs AS runtime WHERE runtime.project_id = p.id
        )
        """
    )


def downgrade() -> None:
    """Do not erase runtime records during downgrade; they are operational data."""
    pass
