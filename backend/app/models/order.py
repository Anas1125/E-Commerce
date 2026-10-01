from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        index=True
    )

    order_number: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False,
        index=True
    )

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        nullable=False
    )

    shipping_address_id: Mapped[int] = mapped_column(
        ForeignKey("addresses.id"),
        nullable=False
    )

    # Shipping address snapshot
    shipping_address_line1: Mapped[str] = mapped_column(
        String(255),
        nullable=False
    )

    shipping_address_line2: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True
    )

    shipping_city: Mapped[str] = mapped_column(
        String(100),
        nullable=False
    )

    shipping_state: Mapped[str] = mapped_column(
        String(100),
        nullable=False
    )

    shipping_postal_code: Mapped[str] = mapped_column(
        String(20),
        nullable=False
    )

    shipping_country: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    subtotal: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False
    )

    discount_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
        default=0
    )

    shipping_fee: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
        default=0
    )

    total_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False
    )

    order_status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="pending"
    )

    payment_status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="pending"
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )

    user: Mapped["User"] = relationship(
        back_populates="orders"
    )

    shipping_address: Mapped["Address"] = relationship()

    items: Mapped[list["OrderItem"]] = relationship(
        back_populates="order",
        cascade="all, delete-orphan"
    )

    payment: Mapped["Payment | None"] = relationship(
        back_populates="order",
        uselist=False,
        cascade="all, delete-orphan"
    )