from datetime import datetime

from sqlalchemy import DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class CouponUsage(Base):
    __tablename__ = "coupon_usages"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        index=True
    )

    coupon_id: Mapped[int] = mapped_column(
        ForeignKey("coupons.id"),
        nullable=False
    )

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        nullable=False
    )

    order_id: Mapped[int] = mapped_column(
        ForeignKey("orders.id"),
        nullable=False
    )

    used_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow
    )

    coupon: Mapped["Coupon"] = relationship(
        back_populates="usages"
    )

    user: Mapped["User"] = relationship()

    order: Mapped["Order"] = relationship()