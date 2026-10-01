from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class RefundCreate(BaseModel):
    order_id: int
    amount: Decimal = Field(
        gt=0,
        max_digits=12,
        decimal_places=2,
    )
    reason: str | None = Field(
        default=None,
        max_length=500,
    )


class RefundResponse(BaseModel):
    id: int
    order_id: int
    payment_id: int
    amount: Decimal
    reason: str | None
    status: str
    gateway_refund_id: str | None
    requested_at: datetime
    completed_at: datetime | None

    model_config = {
        "from_attributes": True
    }