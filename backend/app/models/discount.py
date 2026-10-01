from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Discount(Base):
    __tablename__ = "discounts"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    name: Mapped[str] = mapped_column(
        String(150),
        nullable=False
    )

    discount_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False
    )

    value: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False
    )

    product_id: Mapped[int | None] = mapped_column(
        ForeignKey("products.id"),
        nullable=True
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

    product: Mapped["Product | None"] = relationship(
        back_populates="discounts"
    )