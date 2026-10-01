"""add persisted storefront site settings

Revision ID: dbc116341a20
Revises: c824b7d91e63
Create Date: 2026-10-01 12:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "dbc116341a20"
down_revision: Union[str, Sequence[str], None] = "c824b7d91e63"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "site_settings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("navbar_logo_url", sa.String(length=500), nullable=True),
        sa.Column("hero_image_url", sa.String(length=500), nullable=True),
        sa.Column("footer_logo_url", sa.String(length=500), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.bulk_insert(
        sa.table("site_settings", sa.column("id", sa.Integer())),
        [{"id": 1}],
    )


def downgrade() -> None:
    op.drop_table("site_settings")
