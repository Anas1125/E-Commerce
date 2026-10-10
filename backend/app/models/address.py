from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, Index, String, false, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.user import User 


class Address(Base):
    __tablename__ = "addresses"

    id: Mapped[int] = mapped_column(primary_key=True)

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    address_line1: Mapped[str] = mapped_column(String(255), nullable=False)

    address_line2: Mapped[str | None] = mapped_column(String(255), nullable=True)

    city: Mapped[str] = mapped_column(String(100), nullable=False)

    state: Mapped[str] = mapped_column(String(100), nullable=False)

    postal_code: Mapped[str] = mapped_column(String(20), nullable=False)

    country: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        default="India",
        server_default=text("India"),
    )

    is_default: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default=false(),
    )

    user: Mapped["User"] = relationship(back_populates="addresses")

    __table_args__ = (
        Index(
            "uq_addresses_one_default_per_user",
            "user_id",
            unique=True,
            postgresql_where=text("is_default"),
            sqlite_where=text("is_default"),
        ),
    )