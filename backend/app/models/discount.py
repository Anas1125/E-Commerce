from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Numeric,
    String,
    true,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.coupon import DiscountType

if TYPE_CHECKING:
    from app.models.product import Product 


class Discount(Base):
    __tablename__ = "discounts"

    id: Mapped[int] = mapped_column(primary_key=True)

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

    product_id: Mapped[int | None] = mapped_column(
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
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

    product: Mapped["Product | None"] = relationship(back_populates="discounts")

    __table_args__ = (
        CheckConstraint("value > 0", name="ck_discounts_value_positive"),
        CheckConstraint(
            "discount_type <> 'percentage' OR value <= 100",
            name="ck_discounts_percentage_max_100",
        ),
        CheckConstraint("end_date > start_date", name="ck_discounts_dates_valid"),
    )