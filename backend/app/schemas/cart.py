from decimal import Decimal

from pydantic import BaseModel, Field

MAX_CART_ITEM_QUANTITY = 100


class CartItemCreate(BaseModel):
    product_id: int = Field(gt=0)
    quantity: int = Field(gt=0, le=MAX_CART_ITEM_QUANTITY)


class CartItemUpdate(BaseModel):
    quantity: int = Field(gt=0, le=MAX_CART_ITEM_QUANTITY)


class CartItemResponse(BaseModel):
    id: int
    product_id: int
    quantity: int
    product_name: str
    unit_price: Decimal
    line_total: Decimal


class CartResponse(BaseModel):
    id: int
    user_id: int
    items: list[CartItemResponse]
    subtotal: Decimal