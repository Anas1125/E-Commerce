from decimal import Decimal

from pydantic import BaseModel, Field


class CartItemCreate(BaseModel):
    product_id: int
    quantity: int = Field(gt=0)


class CartItemUpdate(BaseModel):
    quantity: int = Field(gt=0)


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