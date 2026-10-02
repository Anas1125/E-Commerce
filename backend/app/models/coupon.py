from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Coupon(Base):
    __tablename__ = "coupons"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        index=True
    )

    code: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False,
        index=True
    )

    name: Mapped[str] = mapped_column(
        String(150),
        nullable=False
    )

    discount_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False
    )

    value: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False
    )

    minimum_order_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
        default=0
    )

    maximum_discount: Mapped[Decimal | None] = mapped_column(
        Numeric(12, 2),
        nullable=True
    )

    usage_limit: Mapped[int | None] = mapped_column(
        nullable=True
    )

    used_count: Mapped[int] = mapped_column(
        nullable=False,
        default=0
    )

    per_user_limit: Mapped[int] = mapped_column(
        nullable=False,
        default=1
    )

    first_order_only: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False
    )

    start_date: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False
    )

    end_date: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True
    )

    usages: Mapped[list["CouponUsage"]] = relationship(
        back_populates="coupon",
        cascade="all, delete-orphan"
    )