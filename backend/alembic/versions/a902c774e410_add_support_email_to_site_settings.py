"""Add configurable support email, preserving the existing contact address."""
from alembic import op
import sqlalchemy as sa

revision = "a902c774e410"
down_revision = "da2fb9cabf94"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("site_settings", sa.Column("support_email", sa.String(320), nullable=True))
    op.execute("UPDATE site_settings SET support_email = 'hello@terralens.com' WHERE id = 1")


def downgrade():
    op.drop_column("site_settings", "support_email")
