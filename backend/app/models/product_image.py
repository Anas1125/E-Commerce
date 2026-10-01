from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ProductImage(Base):
    __tablename__ = "product_images"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        index=True
    )

    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id"),
        nullable=False
    )

    image_url: Mapped[str] = mapped_column(
        String(500),
        nullable=False
    )

    is_primary: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False
    )

    display_order: Mapped[int] = mapped_column(
        nullable=False,
        default=0
    )

    product: Mapped["Product"] = relationship(
        back_populates="images"
    )