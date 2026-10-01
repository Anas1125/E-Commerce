"""add shipping address snapshot to orders

Revision ID: 7ec8cb706254
Revises: c6ae98947fa3
Create Date: 2026-10-01 14:28:21.840003

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "7ec8cb706254"
down_revision: Union[str, Sequence[str], None] = "c6ae98947fa3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add columns as nullable first because existing orders
    # need to be populated before we enforce NOT NULL.

    op.add_column(
        "orders",
        sa.Column(
            "shipping_address_line1",
            sa.String(length=255),
            nullable=True,
        ),
    )

    op.add_column(
        "orders",
        sa.Column(
            "shipping_address_line2",
            sa.String(length=255),
            nullable=True,
        ),
    )

    op.add_column(
        "orders",
        sa.Column(
            "shipping_city",
            sa.String(length=100),
            nullable=True,
        ),
    )

    op.add_column(
        "orders",
        sa.Column(
            "shipping_state",
            sa.String(length=100),
            nullable=True,
        ),
    )

    op.add_column(
        "orders",
        sa.Column(
            "shipping_postal_code",
            sa.String(length=20),
            nullable=True,
        ),
    )

    op.add_column(
        "orders",
        sa.Column(
            "shipping_country",
            sa.String(length=100),
            nullable=True,
        ),
    )

    # Copy the existing address data into each order's snapshot.
    op.execute(
        """
        UPDATE orders
        SET
            shipping_address_line1 = addresses.address_line1,
            shipping_address_line2 = addresses.address_line2,
            shipping_city = addresses.city,
            shipping_state = addresses.state,
            shipping_postal_code = addresses.postal_code,
            shipping_country = addresses.country
        FROM addresses
        WHERE orders.shipping_address_id = addresses.id
        """
    )

    # Existing orders should now have all required address fields.
    op.alter_column(
        "orders",
        "shipping_address_line1",
        existing_type=sa.String(length=255),
        nullable=False,
    )

    op.alter_column(
        "orders",
        "shipping_city",
        existing_type=sa.String(length=100),
        nullable=False,
    )

    op.alter_column(
        "orders",
        "shipping_state",
        existing_type=sa.String(length=100),
        nullable=False,
    )

    op.alter_column(
        "orders",
        "shipping_postal_code",
        existing_type=sa.String(length=20),
        nullable=False,
    )

    op.alter_column(
        "orders",
        "shipping_country",
        existing_type=sa.String(length=100),
        nullable=False,
    )


def downgrade() -> None:
    op.drop_column("orders", "shipping_country")
    op.drop_column("orders", "shipping_postal_code")
    op.drop_column("orders", "shipping_state")
    op.drop_column("orders", "shipping_city")
    op.drop_column("orders", "shipping_address_line2")
    op.drop_column("orders", "shipping_address_line1")