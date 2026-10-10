from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class RefundCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    order_id: int = Field(gt=0)

    amount: Decimal = Field(
        gt=0,
        max_digits=12,
        decimal_places=2,
    )

    reason: str | None = Field(
        default=None,
        max_length=500,
    )

    @field_validator("reason")
    @classmethod
    def blank_reason_to_none(cls, value: str | None) -> str | None:
        return value or None


class RefundResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    order_id: int
    payment_id: int
    amount: Decimal
    reason: str | None = None
    status: str
    gateway_refund_id: str | None = None
    requested_at: datetime
    completed_at: datetime | None = None