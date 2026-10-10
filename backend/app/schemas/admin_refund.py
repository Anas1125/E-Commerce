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

    customer_name: str
    customer_email: str
    customer_phone: str

    refund_items: list[RefundItemResponse] = Field(
        default_factory=list
    )