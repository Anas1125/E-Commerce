from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)


class DiscountCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    discount_type: Literal["percentage", "fixed"]
    value: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    product_id: int | None = Field(default=None, gt=0)
    start_date: datetime
    end_date: datetime
    is_active: bool = True

    @field_validator("name")
    @classmethod
    def trim_name(cls, value: str) -> str:
        normalized = " ".join(value.split())

        if not normalized:
            raise ValueError("Discount name cannot be empty")

        return normalized

    @field_validator("start_date", "end_date")
    @classmethod
    def require_timezone(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError(
                "Date must include a timezone, e.g. 2026-10-10T00:00:00+05:30"
            )

        return value

    @model_validator(mode="after")
    def validate_combination(self):
        if self.discount_type == "percentage" and self.value > 100:
            raise ValueError("A percentage discount cannot be more than 100")

        if self.end_date <= self.start_date:
            raise ValueError("End date must be after the start date")

        return self


class DiscountResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    discount_type: str
    value: Decimal
    product_id: int | None
    start_date: datetime
    end_date: datetime
    is_active: bool