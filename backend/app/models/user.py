from __future__ import annotations

from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, CheckConstraint, DateTime, String, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.address import Address
    from app.models.cart import Cart
    from app.models.order import Order
    from app.models.password_reset_token import PasswordResetToken
    from app.models.wishlist_item import WishlistItem


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


USER_ROLES = ("customer", "admin")


class User(Base):
    __tablename__ = "users"

    __table_args__ = (
        CheckConstraint(
            "email = lower(email)",
            name="ck_users_email_lowercase",
        ),
        CheckConstraint(
            "length(trim(first_name)) > 0",
            name="ck_users_first_name_not_blank",
        ),
        CheckConstraint(
            "role IN (" + ", ".join(f"'{role}'" for role in USER_ROLES) + ")",
            name="ck_users_role",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)

    first_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    last_name: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        nullable=False,
    )

    phone_number: Mapped[str] = mapped_column(
        String(20),
        unique=True,
        nullable=False,
    )

    password_hash: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default=text("true"),
    )

    role: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="customer",
        server_default="customer",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utcnow,
        server_default=func.now(),
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utcnow,
        onupdate=func.now(),
        server_default=func.now(),
    )

    addresses: Mapped[list["Address"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )

    cart: Mapped["Cart | None"] = relationship(
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )

    wishlist_items: Mapped[list["WishlistItem"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )

    orders: Mapped[list["Order"]] = relationship(
        back_populates="user",
    )

    password_reset_tokens: Mapped[list["PasswordResetToken"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )