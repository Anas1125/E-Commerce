from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Index, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.database import Base

if TYPE_CHECKING:
    from app.models.coupon import Coupon  
    from app.models.order import Order
    from app.models.user import User


class CouponUsage(Base):
    __tablename__ = "coupon_usages"

    id: Mapped[int] = mapped_column(primary_key=True)

    coupon_id: Mapped[int] = mapped_column(
        ForeignKey("coupons.id", ondelete="RESTRICT"),
        nullable=False,
    )

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    order_id: Mapped[int] = mapped_column(
        ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    used_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    coupon: Mapped["Coupon"] = relationship(back_populates="usages")

    user: Mapped["User"] = relationship()

    order: Mapped["Order"] = relationship()

    __table_args__ = (
        UniqueConstraint("coupon_id", "order_id", name="uq_coupon_usages_coupon_order"),
        Index("ix_coupon_usages_coupon_user", "coupon_id", "user_id"),
    )