from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        index=True
    )

    order_id: Mapped[int] = mapped_column(
        ForeignKey("orders.id"),
        nullable=False
    )

    payment_gateway: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="razorpay"
    )

    gateway_order_id: Mapped[str | None] = mapped_column(
        String(255),
        unique=True,
        nullable=True
    )

    gateway_payment_id: Mapped[str | None] = mapped_column(
        String(255),
        unique=True,
        nullable=True
    )

    payment_method: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True
    )

    amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False
    )

    currency: Mapped[str] = mapped_column(
        String(3),
        nullable=False,
        default="INR"
    )

    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="pending"
    )

    paid_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow
    )

    order: Mapped["Order"] = relationship(
        back_populates="payment"
    )