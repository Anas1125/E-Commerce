"""add order payment method

Revision ID: afb1acb70944
Revises: 7ec8cb706254
Create Date: 2026-10-01 16:30:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "afb1acb70944"
down_revision: Union[str, Sequence[str], None] = "7ec8cb706254"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "orders",
        sa.Column("payment_method", sa.String(length=30), nullable=False, server_default="cod"),
    )


def downgrade() -> None:
    op.drop_column("orders", "payment_method")
