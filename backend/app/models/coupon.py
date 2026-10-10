import enum
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Enum,
    Numeric,
    String,
    false,
    true,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.coupon_usage import CouponUsage 


class DiscountType(str, enum.Enum):
    PERCENTAGE = "percentage"
    FIXED = "fixed"


class Coupon(Base):
    __tablename__ = "coupons"

    id: Mapped[int] = mapped_column(primary_key=True)

    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)

    name: Mapped[str] = mapped_column(String(150), nullable=False)

    discount_type: Mapped[DiscountType] = mapped_column(
        Enum(
            DiscountType,
            native_enum=False,
            length=20,
            values_callable=lambda e: [m.value for m in e],
        ),
        nullable=False,
    )

    value: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)

    minimum_order_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
        default=Decimal("0"),
        server_default="0",
    )

    maximum_discount: Mapped[Decimal | None] = mapped_column(
        Numeric(12, 2), nullable=True
    )

    usage_limit: Mapped[int | None] = mapped_column(nullable=True)

    used_count: Mapped[int] = mapped_column(
        nullable=False, default=0, server_default="0"
    )

    per_user_limit: Mapped[int] = mapped_column(
        nullable=False, default=1, server_default="1"
    )

    first_order_only: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=false()
    )

    start_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    end_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=true()
    )

    usages: Mapped[list["CouponUsage"]] = relationship(
        back_populates="coupon",
        passive_deletes=True,
    )

    __table_args__ = (
        CheckConstraint("value > 0", name="ck_coupons_value_positive"),
        CheckConstraint(
            "discount_type <> 'percentage' OR value <= 100",
            name="ck_coupons_percentage_max_100",
        ),
        CheckConstraint(
            "minimum_order_amount >= 0", name="ck_coupons_min_order_non_negative"
        ),
        CheckConstraint(
            "maximum_discount IS NULL OR maximum_discount > 0",
            name="ck_coupons_max_discount_positive",
        ),
        CheckConstraint(
            "usage_limit IS NULL OR usage_limit > 0",
            name="ck_coupons_usage_limit_positive",
        ),
        CheckConstraint(
            "used_count >= 0 AND (usage_limit IS NULL OR used_count <= usage_limit)",
            name="ck_coupons_used_count_valid",
        ),
        CheckConstraint("per_user_limit > 0", name="ck_coupons_per_user_limit_positive"),
        CheckConstraint("end_date > start_date", name="ck_coupons_dates_valid"),
    )