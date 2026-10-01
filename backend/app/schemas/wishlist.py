from decimal import Decimal

from pydantic import BaseModel


class WishlistItemResponse(BaseModel):
    id: int
    product_id: int
    product_name: str
    price: Decimal
    image_url: str | None = None

    model_config = {
        "from_attributes": True
    }


class WishlistResponse(BaseModel):
    items: list[WishlistItemResponse]