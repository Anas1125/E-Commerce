"""add category image URL

Revision ID: c824b7d91e63
Revises: afb1acb70944
Create Date: 2026-10-02 09:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c824b7d91e63"
down_revision: Union[str, Sequence[str], None] = "afb1acb70944"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("categories", sa.Column("image_url", sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column("categories", "image_url")
