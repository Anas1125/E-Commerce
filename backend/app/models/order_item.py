from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING


from sqlalchemy import (
    CheckConstraint,
    ForeignKey,
    Numeric,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.order import Order
    from app.models.product import Product


class OrderItem(Base):
    """One line of an order. Written once at checkout and never edited."""

    __tablename__ = "order_items"

    __table_args__ = (
        UniqueConstraint("order_id", "product_id", name="uq_order_items_order_product"),
        CheckConstraint("quantity > 0", name="ck_order_items_quantity_positive"),
        CheckConstraint("unit_price >= 0", name="ck_order_items_unit_price_non_negative"),
        CheckConstraint(
            "discount_amount >= 0", name="ck_order_items_discount_non_negative"
        ),
        CheckConstraint(
            "final_price >= 0", name="ck_order_items_final_price_non_negative"
        ),
        CheckConstraint(
            "discount_amount <= unit_price * quantity",
            name="ck_order_items_discount_within_line",
        ),
        CheckConstraint(
            "final_price = unit_price * quantity - discount_amount",
            name="ck_order_items_final_matches_parts",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)

    order_id: Mapped[int] = mapped_column(
        ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False,
    )

    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    product_name: Mapped[str] = mapped_column(String(200), nullable=False)

    product_slug: Mapped[str | None] = mapped_column(String(200), nullable=True)

    image_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)

    quantity: Mapped[int] = mapped_column(nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)

    discount_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
        default=Decimal("0"),
        server_default=text("0"),
    )

    final_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)

    order: Mapped["Order"] = relationship(back_populates="items")

    product: Mapped["Product"] = relationship()