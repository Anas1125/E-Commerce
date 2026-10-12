"""track Razorpay order creation state

Revision ID: 5127390d0d32
Revises: c4b1e98496e7
Create Date: 2026-10-12 15:23:02.173440
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "5127390d0d32"
down_revision: Union[str, Sequence[str], None] = "c4b1e98496e7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add temporarily nullable so existing rows can be classified safely.
    op.add_column(
        "payments",
        sa.Column(
            "gateway_order_creation_state",
            sa.String(length=20),
            nullable=True,
        ),
    )

    # Existing payments cannot safely be assumed never to have attempted
    # creation. Known gateway IDs are marked created; everything else is
    # unknown until reconciled.
    op.execute(
        """
        UPDATE payments
        SET gateway_order_creation_state = CASE
            WHEN gateway_order_id IS NOT NULL THEN 'created'
            ELSE 'unknown'
        END
        """
    )

    op.alter_column(
        "payments",
        "gateway_order_creation_state",
        existing_type=sa.String(length=20),
        nullable=False,
        server_default=sa.text("'unknown'"),
    )

    op.create_check_constraint(
        "ck_payments_gateway_order_creation_state",
        "payments",
        """
        gateway_order_creation_state IN
        ('not_started', 'attempting', 'created', 'unknown')
        """,
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_payments_gateway_order_creation_state",
        "payments",
        type_="check",
    )
    op.drop_column("payments", "gateway_order_creation_state")
