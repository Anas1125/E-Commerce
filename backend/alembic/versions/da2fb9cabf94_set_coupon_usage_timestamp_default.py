"""set coupon usage timestamp default

Revision ID: da2fb9cabf94
Revises: 5127390d0d32
Create Date: 2026-10-13 14:30:54.749288

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'da2fb9cabf94'
down_revision: Union[str, Sequence[str], None] = '5127390d0d32'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "coupon_usages",
        "used_at",
        existing_type=sa.DateTime(timezone=True),
        existing_nullable=False,
        server_default=sa.text("now()"),
    )


def downgrade() -> None:
    op.alter_column(
        "coupon_usages",
        "used_at",
        existing_type=sa.DateTime(timezone=True),
        existing_nullable=False,
        server_default=None,
    )