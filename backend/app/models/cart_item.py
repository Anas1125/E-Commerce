from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class CartItem(Base):
    __tablename__ = "cart_items"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        index=True
    )

    cart_id: Mapped[int] = mapped_column(
        ForeignKey("carts.id"),
        nullable=False
    )

    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id"),
        nullable=False
    )

    quantity: Mapped[int] = mapped_column(
        nullable=False,
        default=1
    )

    cart: Mapped["Cart"] = relationship(
        back_populates="items"
    )

    product: Mapped["Product"] = relationship()