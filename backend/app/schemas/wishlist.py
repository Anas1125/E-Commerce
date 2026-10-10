from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class WishlistItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    product_name: str
    price: Decimal
    image_url: str | None = None
    brand: str | None = None
    available_stock: int | None = Field(default=None, ge=0)
    is_active: bool = True


class WishlistResponse(BaseModel):
    items: list[WishlistItemResponse] = Field(default_factory=list)


class WishlistIdsResponse(BaseModel):

    product_ids: list[int] = Field(default_factory=list)