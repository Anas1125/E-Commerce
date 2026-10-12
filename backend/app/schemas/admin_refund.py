from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.refund import RefundItemResponse


class AdminRefundResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    order_id: int
    payment_id: int
    amount: Decimal
    reason: str | None
    status: str
    gateway_refund_id: str | None
    requested_at: datetime
    completed_at: datetime | None
    decision_note: str | None = None
    customer_name: str
    customer_email: str
    customer_phone: str
    payment_method: str | None = None
    gateway_payment_id: str | None = None
    refund_items: list[RefundItemResponse] = Field(
        default_factory=list
    )


class RefundRejectRequest(BaseModel):
    reason: str | None = Field(default=None, max_length=1000)
