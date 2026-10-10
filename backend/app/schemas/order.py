from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.address import AddressResponse
from app.schemas.payment import PaymentResponse

AdminOrderStatus = Literal[
    "confirmed",
    "processing",
    "shipped",
    "out_for_delivery",
    "delivered",
    "cancelled",
]


class OrderCreate(BaseModel):
    shipping_address_id: int = Field(gt=0)
    coupon_code: str | None = Field(default=None, max_length=50)
    payment_method: Literal["cod", "upi"] = "cod"
    idempotency_key: str | None = Field(
        default=None,
        min_length=16,
        max_length=64,
    )


    @field_validator("coupon_code")
    @classmethod
    def normalize_coupon_code(cls, value: str | None) -> str | None:
        return (value or "").strip().upper() or None


class OrderItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    product_name: str
    quantity: int
    unit_price: Decimal
    discount_amount: Decimal
    final_price: Decimal


class OrderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    order_number: str
    user_id: int
    shipping_address_id: int | None

    subtotal: Decimal
    discount_amount: Decimal
    shipping_fee: Decimal
    total_amount: Decimal

    order_status: str
    payment_status: str
    payment_method: str | None = None

    created_at: datetime
    updated_at: datetime

    shipping_address_line1: str
    shipping_address_line2: str | None
    shipping_city: str
    shipping_state: str
    shipping_postal_code: str
    shipping_country: str

    items: list[OrderItemResponse]


class AdminOrderUserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    first_name: str
    last_name: str | None
    email: str
    phone_number: str


class AdminOrderHistoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    order_id: int
    status: str
    note: str | None
    changed_at: datetime


class AdminOrderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    order_number: str
    user_id: int
    shipping_address_id: int | None

    subtotal: Decimal
    discount_amount: Decimal
    shipping_fee: Decimal
    total_amount: Decimal

    order_status: str
    payment_status: str
    payment_method: str | None = None

    created_at: datetime
    updated_at: datetime

    shipping_address_line1: str
    shipping_address_line2: str | None
    shipping_city: str
    shipping_state: str
    shipping_postal_code: str
    shipping_country: str

    items: list[OrderItemResponse]
    user: AdminOrderUserResponse
    shipping_address: AddressResponse | None
    payment: PaymentResponse | None
    status_history: list[AdminOrderHistoryResponse] = []


class AdminOrderListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    order_number: str
    user_id: int

    subtotal: Decimal
    discount_amount: Decimal
    shipping_fee: Decimal
    total_amount: Decimal

    order_status: str
    payment_status: str
    payment_method: str | None = None

    created_at: datetime
    updated_at: datetime

    user: AdminOrderUserResponse


class AdminOrderStatusUpdate(BaseModel):
    status: AdminOrderStatus
    note: str | None = Field(default=None, max_length=500)

    @field_validator("note")
    @classmethod
    def clean_note(cls, value: str | None) -> str | None:
        return (value or "").strip() or None


class AdminOrderListPaginatedResponse(BaseModel):
    orders: list[AdminOrderListResponse]
    total: int
    page: int
    limit: int
    total_pages: int