"""merge website-build and marketing migration heads

Revision ID: a02b3c4d5e6f
Revises: a01b2c3d4e5f, e8b4c1d9a507

This merge carries no schema operation. It restores one deterministic Alembic
head so local and deployment startup may safely use ``upgrade head``.
"""

revision = "a02b3c4d5e6f"
down_revision = ("a01b2c3d4e5f", "e8b4c1d9a507")
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
