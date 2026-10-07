from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel


class PaymentCreate(BaseModel):
    order_id: int


class PaymentComplete(BaseModel):
    payment_id: int
    gateway_order_id: str
    gateway_payment_id: str
    gateway_signature: str
    payment_method: str | None = "upi"


class PaymentFail(BaseModel):
    payment_id: int


class PaymentResponse(BaseModel):
    id: int
    order_id: int
    payment_gateway: str
    gateway_order_id: str | None
    gateway_payment_id: str | None
    payment_method: str | None
    amount: Decimal
    currency: str
    status: str
    paid_at: datetime | None
    created_at: datetime

    model_config = {
        "from_attributes": True
    }