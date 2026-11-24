"""Add persistent API rate limit buckets."""
from alembic import op
import sqlalchemy as sa

revision = "b72d5c41a930"
down_revision = "a902c774e410"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "rate_limit_buckets",
        sa.Column("scope", sa.String(40), primary_key=True),
        sa.Column("client_key", sa.String(64), primary_key=True),
        sa.Column("window_start", sa.BigInteger(), primary_key=True),
        sa.Column("expires_at", sa.BigInteger(), nullable=False),
        sa.Column("hits", sa.Integer(), nullable=False),
    )
    op.create_index("ix_rate_limit_expires", "rate_limit_buckets", ["expires_at"])


def downgrade():
    op.drop_index("ix_rate_limit_expires", table_name="rate_limit_buckets")
    op.drop_table("rate_limit_buckets")
