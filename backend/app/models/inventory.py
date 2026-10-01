from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Inventory(Base):
    __tablename__ = "inventory"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        index=True
    )

    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id"),
        unique=True,
        nullable=False
    )

    quantity: Mapped[int] = mapped_column(
        nullable=False,
        default=0
    )

    reserved_quantity: Mapped[int] = mapped_column(
        nullable=False,
        default=0
    )

    product: Mapped["Product"] = relationship(
        back_populates="inventory"
    )