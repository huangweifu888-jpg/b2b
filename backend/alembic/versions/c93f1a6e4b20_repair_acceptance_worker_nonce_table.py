"""repair a partially applied trusted acceptance worker nonce table

Revision ID: c93f1a6e4b20
Revises: b82e0f5d3a71
Create Date: 2026-08-23

The original job migration creates this table on a clean database.  This
revision repairs installations whose Alembic version was stamped at the job
revision after only part of that schema had been installed.  A healthy fresh
database is validated and left unchanged.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c93f1a6e4b20"
down_revision: Union[str, Sequence[str], None] = "b82e0f5d3a71"
branch_labels = None
depends_on = None


_TABLE = "developer_global_frame_acceptance_worker_nonces"
_REQUIRED_COLUMNS = {
    "nonce",
    "action",
    "issuer",
    "key_id",
    "source_scope",
    "job_id",
    "issued_at",
    "created_at",
}


def _assert_prerequisites(inspector: sa.Inspector) -> None:
    required_tables = {
        "developer_global_frame_acceptance_jobs",
        "developer_global_frame_acceptance_job_events",
        "developer_global_frame_acceptance_artifacts",
    }
    missing = sorted(table for table in required_tables if not inspector.has_table(table))
    if missing:
        raise RuntimeError(
            "Cannot repair trusted acceptance worker nonce schema; missing prerequisite tables: "
            + ", ".join(missing)
        )


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    _assert_prerequisites(inspector)

    if inspector.has_table(_TABLE):
        columns = {column["name"] for column in inspector.get_columns(_TABLE)}
        missing_columns = sorted(_REQUIRED_COLUMNS - columns)
        if missing_columns:
            raise RuntimeError(
                "Trusted acceptance worker nonce table is malformed; missing columns: "
                + ", ".join(missing_columns)
            )
        return

    op.create_table(
        _TABLE,
        sa.Column("nonce", sa.String(length=100), nullable=False),
        sa.Column("action", sa.String(length=40), nullable=False),
        sa.Column("issuer", sa.String(length=100), nullable=False),
        sa.Column("key_id", sa.String(length=100), nullable=False),
        sa.Column("source_scope", sa.String(length=50), nullable=False),
        sa.Column("job_id", sa.String(length=36), nullable=True),
        sa.Column("issued_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "action IN ('claim', 'claim-next', 'heartbeat', 'fail')",
            name="ck_dgf_acceptance_worker_nonce_action",
        ),
        sa.CheckConstraint(
            "source_scope = 'client_source'",
            name="ck_dgf_acceptance_worker_nonce_scope",
        ),
        sa.ForeignKeyConstraint(
            ["job_id"],
            ["developer_global_frame_acceptance_jobs.id"],
            name="fk_dgf_acceptance_worker_nonce_job",
        ),
        sa.PrimaryKeyConstraint("nonce"),
    )
    for column in ("action", "issuer", "key_id", "source_scope", "job_id", "created_at"):
        op.create_index(
            f"ix_dgf_acceptance_worker_nonce_{column}",
            _TABLE,
            [column],
            unique=False,
        )


def downgrade() -> None:
    # b82e0f5d3a71 owns this table.  Downgrading only the repair marker must
    # preserve the schema that b82 promises, whether it was created there or
    # repaired here.
    return
