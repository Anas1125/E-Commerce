from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ProductCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=200)
    slug: str = Field(
        min_length=1,
        max_length=200,
        pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", 
    )
    description: str | None = Field(default=None, max_length=10_000)
    brand: str | None = Field(default=None, max_length=100)
    brand_id: int | None = Field(default=None, ge=1)
    price: Decimal = Field(gt=0, max_digits=10, decimal_places=2)
    category_id: int = Field(ge=1)
    stock: int = Field(default=0, ge=0, le=1_000_000)


class ProductResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    description: str | None = None
    brand_id: int | None = None
    brand: str | None = None
    brand_logo_url: str | None = None
    price: Decimal
    category_id: int
    stock: int
    available_stock: int | None = None
    rating: Decimal | None = None
    is_active: bool

    primary_image_url: str | None = None
    created_at: datetime | None = None

    @model_validator(mode="after")
    def default_available_stock(self):
        if self.available_stock is None:
            self.available_stock = self.stock

        self.available_stock = max(0, self.available_stock)

        return self