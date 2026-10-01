from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Review(Base):
    __tablename__ = "reviews"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        index=True
    )

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        nullable=False
    )

    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id"),
        nullable=False
    )

    rating: Mapped[int] = mapped_column(
        nullable=False
    )

    title: Mapped[str | None] = mapped_column(
        String(200),
        nullable=True
    )

    comment: Mapped[str | None] = mapped_column(
        Text,
        nullable=True
    )

    is_verified_purchase: Mapped[bool] = mapped_column(
        nullable=False,
        default=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow
    )

    user: Mapped["User"] = relationship()

    product: Mapped["Product"] = relationship(
        back_populates="reviews"
    )

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "product_id",
            name="uq_user_product_review",
        ),
        CheckConstraint(
            "rating >= 1 AND rating <= 5",
            name="ck_review_rating",
        ),
    )