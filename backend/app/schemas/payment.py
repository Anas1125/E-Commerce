from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class PaymentBase(BaseModel):

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")


class PaymentCreate(PaymentBase):
    order_id: int = Field(gt=0)


class PaymentComplete(PaymentBase):
    payment_id: int = Field(gt=0)
    gateway_order_id: str = Field(min_length=1, max_length=100)
    gateway_payment_id: str = Field(min_length=1, max_length=100)
    gateway_signature: str = Field(min_length=1, max_length=256)

    payment_method: str | None = Field(default=None, max_length=30)

    @field_validator("payment_method")
    @classmethod
    def normalize_payment_method(cls, value: str | None) -> str | None:
        return value.lower() if value else None

class PaymentStatusCheck(PaymentBase):
    payment_id: int = Field(gt=0)

class PaymentFail(PaymentBase):
    payment_id: int = Field(gt=0)


class PaymentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    order_id: int
    payment_gateway: str
    gateway_order_id: str | None = None
    gateway_payment_id: str | None = None
    payment_method: str | None = None
    amount: Decimal
    currency: str = Field(min_length=3, max_length=3)
    status: str
    paid_at: datetime | None = None
    created_at: datetime