"""add first order only to coupons

Revision ID: ef5206395ee7
Revises: a34b94d1e8f2
Create Date: 2026-10-02 11:32:40.273898

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ef5206395ee7'
down_revision: Union[str, Sequence[str], None] = 'a34b94d1e8f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "coupons",
        sa.Column(
            "first_order_only",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )

    op.alter_column(
        "coupons",
        "first_order_only",
        server_default=None,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("coupons", "first_order_only")
