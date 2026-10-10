from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING
from sqlalchemy import text

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.database import Base

if TYPE_CHECKING:
    from app.models.address import Address
    from app.models.order_item import OrderItem
    from app.models.payment import Payment
    from app.models.user import User

ORDER_STATUSES = (
    "pending",
    "confirmed",
    "processing",
    "shipped",
    "out_for_delivery",
    "delivered",
    "cancelled",
)

PAYMENT_STATUSES = (
    "pending",
    "paid",
    "failed",
    "refunded",
    "partially_refunded",
)

PAYMENT_METHODS = (
    "cod",
    "online",
    "razorpay",
    "upi",
    "card",
    "netbanking",
    "wallet",
)


def _in_list(values: tuple[str, ...]) -> str:
    return ", ".join(f"'{value}'" for value in values)


class Order(Base):
    __tablename__ = "orders"

    __table_args__ = (
        UniqueConstraint("user_id", "idempotency_key", name="uq_orders_user_idem_key"),
        Index("ix_orders_user_created", "user_id", "created_at"),
        Index("ix_orders_status_created", "order_status", "created_at"),
        CheckConstraint(
            f"order_status IN ({_in_list(ORDER_STATUSES)})",
            name="ck_orders_order_status",
        ),
        CheckConstraint(
            f"payment_status IN ({_in_list(PAYMENT_STATUSES)})",
            name="ck_orders_payment_status",
        ),
        CheckConstraint(
            f"payment_method IN ({_in_list(PAYMENT_METHODS)})",
            name="ck_orders_payment_method",
        ),
        CheckConstraint("subtotal >= 0", name="ck_orders_subtotal_non_negative"),
        CheckConstraint("discount_amount >= 0", name="ck_orders_discount_non_negative"),
        CheckConstraint(
            "discount_amount <= subtotal",
            name="ck_orders_discount_within_subtotal",
        ),
        CheckConstraint("shipping_fee >= 0", name="ck_orders_shipping_fee_non_negative"),
        CheckConstraint("total_amount >= 0", name="ck_orders_total_non_negative"),
        CheckConstraint(
            "total_amount = subtotal - discount_amount + shipping_fee",
            name="ck_orders_total_matches_parts",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)

    order_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )

    idempotency_key: Mapped[str | None] = mapped_column(String(64), nullable=True)


    shipping_address_id: Mapped[int | None] = mapped_column(
        ForeignKey("addresses.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    shipping_name: Mapped[str | None] = mapped_column(String(200), nullable=True)

    shipping_phone: Mapped[str | None] = mapped_column(String(20), nullable=True)

    contact_email: Mapped[str | None] = mapped_column(String(255), nullable=True)

    shipping_address_line1: Mapped[str] = mapped_column(String(255), nullable=False)

    shipping_address_line2: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )

    shipping_city: Mapped[str] = mapped_column(String(100), nullable=False)

    shipping_state: Mapped[str] = mapped_column(String(100), nullable=False)

    shipping_postal_code: Mapped[str] = mapped_column(String(20), nullable=False)

    shipping_country: Mapped[str] = mapped_column(String(100), nullable=False)

    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)

    discount_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
        default=Decimal("0"),
        server_default=text("0"),
    )

    shipping_fee: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
        default=Decimal("0"),
        server_default=text("0"),
    )

    total_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)


    order_status: Mapped[str] = mapped_column(
        String(30), nullable=False, default="pending", server_default="pending"
    )

    payment_status: Mapped[str] = mapped_column(
        String(30), nullable=False, default="pending", server_default="pending"
    )

    payment_method: Mapped[str] = mapped_column(
        String(30), nullable=False, default="cod", server_default="cod"
    )

    delivered_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    cancelled_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    user: Mapped["User"] = relationship(back_populates="orders")

    shipping_address: Mapped["Address | None"] = relationship()

    items: Mapped[list["OrderItem"]] = relationship(
        back_populates="order",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    payment: Mapped["Payment | None"] = relationship(
        back_populates="order",
        uselist=False,
    )