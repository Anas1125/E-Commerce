"""add favicon URL to site settings

Revision ID: ed2f79a83a11
Revises: dbc116341a20
Create Date: 2026-10-02 10:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "ed2f79a83a11"
down_revision: Union[str, Sequence[str], None] = "dbc116341a20"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("site_settings", sa.Column("favicon_url", sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column("site_settings", "favicon_url")
