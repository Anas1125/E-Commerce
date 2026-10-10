from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


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