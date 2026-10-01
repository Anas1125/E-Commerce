from pydantic import BaseModel, Field
from datetime import datetime

class OrderStatusUpdate(BaseModel):
    status: str = Field(
        pattern="^(confirmed|processing|shipped|out_for_delivery|delivered|cancelled)$"
    )
    note: str | None = Field(
        default=None,
        max_length=500,
    )


class OrderStatusHistoryResponse(BaseModel):
    id: int
    order_id: int
    status: str
    note: str | None
    changed_at: datetime

    model_config = {
        "from_attributes": True
    }