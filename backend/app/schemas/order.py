from datetime import datetime
from decimal import Decimal
from app.schemas.address import AddressResponse
from app.schemas.payment import PaymentResponse

from pydantic import BaseModel, Field


class OrderCreate(BaseModel):
    shipping_address_id: int
    coupon_code: str | None = Field(default=None, max_length=50)


class OrderItemResponse(BaseModel):
    id: int
    product_id: int
    product_name: str
    quantity: int
    unit_price: Decimal
    discount_amount: Decimal
    final_price: Decimal

    model_config = {
        "from_attributes": True
    }


class OrderResponse(BaseModel):
    id: int
    order_number: str
    user_id: int
    shipping_address_id: int
    subtotal: Decimal
    discount_amount: Decimal
    shipping_fee: Decimal
    total_amount: Decimal
    order_status: str
    payment_status: str
    created_at: datetime
    updated_at: datetime
    items: list[OrderItemResponse]

    model_config = {
        "from_attributes": True
    }

class AdminOrderUserResponse(BaseModel):
    id: int
    first_name: str
    last_name: str | None
    email: str
    phone_number: str

    model_config = {"from_attributes": True}


class AdminOrderHistoryResponse(BaseModel):
    id: int
    order_id: int
    status: str
    note: str | None
    changed_at: datetime

    model_config = {"from_attributes": True}


class AdminOrderResponse(BaseModel):
    id: int
    order_number: str
    user_id: int
    shipping_address_id: int

    subtotal: Decimal
    discount_amount: Decimal
    shipping_fee: Decimal
    total_amount: Decimal

    order_status: str
    payment_status: str

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
    shipping_address: "AddressResponse | None"
    payment: "PaymentResponse | None"
    status_history: list[AdminOrderHistoryResponse] = []

    model_config = {"from_attributes": True}

class AdminOrderListResponse(BaseModel):
    id: int
    order_number: str
    user_id: int

    subtotal: Decimal
    discount_amount: Decimal
    shipping_fee: Decimal
    total_amount: Decimal

    order_status: str
    payment_status: str

    created_at: datetime
    updated_at: datetime

    user: AdminOrderUserResponse

    model_config = {"from_attributes": True}

class AdminOrderStatusUpdate(BaseModel):
    status: str
    note: str | None = None

class AdminOrderListPaginatedResponse(BaseModel):
    orders: list[AdminOrderListResponse]
    total: int
    page: int
    limit: int
    total_pages: int