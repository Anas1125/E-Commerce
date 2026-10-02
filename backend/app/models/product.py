from decimal import Decimal

from sqlalchemy import ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(200), unique=True, nullable=False)

    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    brand_id: Mapped[int | None] = mapped_column(
        ForeignKey("brands.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )

    price: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False
    )

    category_id: Mapped[int] = mapped_column(
        ForeignKey("categories.id"),
        nullable=False
    )

    stock: Mapped[int] = mapped_column(nullable=False, default=0)

    rating: Mapped[Decimal] = mapped_column(
        Numeric(2, 1),
        nullable=False,
        default=0
    )

    is_active: Mapped[bool] = mapped_column(
        nullable=False,
        default=True
    )

    category: Mapped["Category"] = relationship(
        back_populates="products"
    )

    brand_record: Mapped["Brand | None"] = relationship(
        back_populates="products"
    )

    @property
    def brand(self) -> str | None:
        return self.brand_record.name if self.brand_record else None

    @property
    def brand_logo_url(self) -> str | None:
        return self.brand_record.logo_url if self.brand_record else None

    discounts: Mapped[list["Discount"]] = relationship(
        back_populates="product"
    )

    images: Mapped[list["ProductImage"]] = relationship(
        back_populates="product",
        cascade="all, delete-orphan"
    )

    inventory: Mapped["Inventory | None"] = relationship(
        back_populates="product",
        uselist=False,
        cascade="all, delete-orphan"
    )

    reviews: Mapped[list["Review"]] = relationship(
        back_populates="product",
        cascade="all, delete-orphan"
    )
