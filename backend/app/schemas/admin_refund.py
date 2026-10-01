from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel


class AdminRefundResponse(BaseModel):
    id: int
    order_id: int
    payment_id: int
    amount: Decimal
    reason: str | None
    status: str
    gateway_refund_id: str | None
    requested_at: datetime
    completed_at: datetime | None

    model_config = {"from_attributes": True}