from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Address(Base):
    __tablename__ = "addresses"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        index=True
    )

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        nullable=False
    )

    address_line1: Mapped[str] = mapped_column(
        String(255),
        nullable=False
    )

    address_line2: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True
    )

    city: Mapped[str] = mapped_column(
        String(100),
        nullable=False
    )

    state: Mapped[str] = mapped_column(
        String(100),
        nullable=False
    )

    postal_code: Mapped[str] = mapped_column(
        String(20),
        nullable=False
    )

    country: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        default="India"
    )

    is_default: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False
    )

    user: Mapped["User"] = relationship(
        back_populates="addresses"
    )