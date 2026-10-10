
from datetime import datetime
from decimal import Decimal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)


class RefundItemSelection(BaseModel):
    model_config = ConfigDict(extra="forbid")

    order_item_id: int = Field(gt=0)
    quantity: int = Field(gt=0, le=1_000_000)


class RefundItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    order_item_id: int
    product_name: str
    quantity: int
    amount: Decimal


class RefundCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    order_id: int = Field(gt=0)
    full_order: bool = False
    items: list[RefundItemSelection] = Field(
        default_factory=list,
        max_length=100,
    )
    reason: str | None = Field(
        default=None,
        max_length=1000,
    )

    @field_validator("reason")
    @classmethod
    def blank_reason_to_none(cls, value: str | None) -> str | None:
        return value or None

    @model_validator(mode="after")
    def validate_selection(self):
        if self.full_order and self.items:
            raise ValueError(
                "A full-order refund cannot include a separate item selection."
            )

        if not self.full_order and not self.items:
            raise ValueError(
                "Select the full order or at least one item to refund."
            )

        item_ids = [item.order_item_id for item in self.items]
        if len(item_ids) != len(set(item_ids)):
            raise ValueError("Each order item can only be selected once.")

        return self


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
    refund_items: list[RefundItemResponse] = Field(default_factory=list)
