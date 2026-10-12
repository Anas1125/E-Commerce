
"""add manual refund reference

Revision ID: c4b1e98496e7
Revises: 875c37451e3a
Create Date: 2026-10-12 13:55:04.355634
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c4b1e98496e7"
down_revision: Union[str, Sequence[str], None] = "875c37451e3a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "refunds",
        sa.Column("manual_refund_reference", sa.String(length=255), nullable=True),
    )
    op.create_unique_constraint(
        "uq_refunds_manual_refund_reference",
        "refunds",
        ["manual_refund_reference"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_refunds_manual_refund_reference",
        "refunds",
        type_="unique",
    )
    op.drop_column("refunds", "manual_refund_reference")
