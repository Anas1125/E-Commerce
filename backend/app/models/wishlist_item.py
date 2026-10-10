from __future__ import annotations

from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Index, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.product import Product
    from app.models.user import User


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class WishlistItem(Base):
    __tablename__ = "wishlist_items"

    __table_args__ = (
        UniqueConstraint("user_id", "product_id", name="uq_user_product_wishlist"),
        Index("ix_wishlist_items_user_created", "user_id", "created_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utcnow,
        server_default=func.now(),
    )

    user: Mapped["User"] = relationship(back_populates="wishlist_items")

    product: Mapped["Product"] = relationship()