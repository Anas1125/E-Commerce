from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class DiscountCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    discount_type: str = Field(pattern="^(percentage|fixed)$")
    value: Decimal = Field(gt=0, max_digits=10, decimal_places=2)
    product_id: int | None = None
    start_date: datetime
    end_date: datetime
    is_active: bool = True


class DiscountResponse(BaseModel):
    id: int
    name: str
    discount_type: str
    value: Decimal
    product_id: int | None
    start_date: datetime
    end_date: datetime
    is_active: bool

    model_config = {
        "from_attributes": True
    }