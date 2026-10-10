
from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    ForeignKey,
    Numeric,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.order_item import OrderItem
    from app.models.refund import Refund


class RefundItem(Base):
    __tablename__ = "refund_items"

    __table_args__ = (
        UniqueConstraint(
            "refund_id",
            "order_item_id",
            name="uq_refund_items_refund_order_item",
        ),
        CheckConstraint(
            "quantity > 0",
            name="ck_refund_items_quantity_positive",
        ),
        CheckConstraint(
            "amount > 0",
            name="ck_refund_items_amount_positive",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)

    refund_id: Mapped[int] = mapped_column(
        ForeignKey("refunds.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    order_item_id: Mapped[int] = mapped_column(
        ForeignKey("order_items.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    product_name: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
    )

    quantity: Mapped[int] = mapped_column(nullable=False)

    amount: Mapped[float] = mapped_column(
        Numeric(12, 2),
        nullable=False,
    )

    refund: Mapped["Refund"] = relationship(
        back_populates="refund_items",
    )

    order_item: Mapped["OrderItem"] = relationship()
