"""add site name to site settings

Revision ID: 57405d055997
Revises: 2e10cf21e20d
Create Date: 2026-10-02 16:58:51.098742

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "57405d055997"
down_revision: Union[str, Sequence[str], None] = "2e10cf21e20d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "site_settings",
        sa.Column(
            "site_name",
            sa.String(length=150),
            nullable=False,
            server_default="TerraLens",
        ),
    )

    op.alter_column(
        "site_settings",
        "site_name",
        server_default=None,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("site_settings", "site_name")