from decimal import Decimal

from pydantic import BaseModel, Field


class ProductCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    slug: str = Field(min_length=1, max_length=200)
    description: str | None = None
    brand: str | None = Field(default=None, max_length=100)
    price: Decimal = Field(gt=0, max_digits=10, decimal_places=2)
    category_id: int
    stock: int = Field(default=0, ge=0)


class ProductResponse(BaseModel):
    id: int
    name: str
    slug: str
    description: str | None
    brand: str | None
    price: Decimal
    category_id: int
    stock: int
    available_stock: int = 0
    rating: Decimal
    is_active: bool

    model_config = {
        "from_attributes": True
    }
