from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.brand import Brand
    from app.models.category import Category
    from app.models.discount import Discount
    from app.models.inventory import Inventory
    from app.models.product_image import ProductImage
    from app.models.review import Review


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Product(Base):
    __tablename__ = "products"

    __table_args__ = (
        CheckConstraint("price >= 0", name="ck_products_price_nonneg"),
        CheckConstraint("stock >= 0", name="ck_products_stock_nonneg"),
        CheckConstraint("rating >= 0 AND rating <= 5", name="ck_products_rating_range"),
        CheckConstraint("review_count >= 0", name="ck_products_review_count_nonneg"),

        CheckConstraint("slug = lower(slug)", name="ck_products_slug_lowercase"),

        Index("ix_products_category_active", "category_id", "is_active"),
        Index("ix_products_active_created", "is_active", "created_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)

    name: Mapped[str] = mapped_column(String(200), nullable=False)


    slug: Mapped[str] = mapped_column(String(200), unique=True, nullable=False)

    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    brand_id: Mapped[int | None] = mapped_column(
        ForeignKey("brands.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )

    category_id: Mapped[int] = mapped_column(
        ForeignKey("categories.id", ondelete="RESTRICT"),
        nullable=False,
    )

    price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)


    stock: Mapped[int] = mapped_column(
        nullable=False,
        default=0,
        server_default=text("0"),
    )

    rating: Mapped[Decimal] = mapped_column(
        Numeric(3, 2),
        nullable=False,
        default=Decimal("0"),
        server_default=text("0"),
    )

    review_count: Mapped[int] = mapped_column(
        nullable=False,
        default=0,
        server_default=text("0"),
    )

    is_active: Mapped[bool] = mapped_column(
        nullable=False,
        default=True,
        server_default=text("true"),
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


    category: Mapped["Category"] = relationship(back_populates="products")

    brand_record: Mapped["Brand | None"] = relationship(back_populates="products")

    discounts: Mapped[list["Discount"]] = relationship(
        back_populates="product",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    images: Mapped[list["ProductImage"]] = relationship(
        back_populates="product",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="ProductImage.display_order, ProductImage.id",
    )

    inventory: Mapped["Inventory | None"] = relationship(
        back_populates="product",
        uselist=False,
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    reviews: Mapped[list["Review"]] = relationship(
        back_populates="product",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


    @property
    def brand(self) -> str | None:
        return self.brand_record.name if self.brand_record else None

    @property
    def brand_logo_url(self) -> str | None:
        return self.brand_record.logo_url if self.brand_record else None