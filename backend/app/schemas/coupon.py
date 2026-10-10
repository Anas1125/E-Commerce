import re
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

_CODE_PATTERN = re.compile(r"[A-Z0-9][A-Z0-9_-]*")


def _normalize_code(value: str) -> str:
    """Coupon codes are case-insensitive: store and look up in uppercase."""
    code = value.strip().upper()

    if not _CODE_PATTERN.fullmatch(code):
        raise ValueError(
            "Coupon code may only contain letters, numbers, hyphens and "
            "underscores, and must start with a letter or number"
        )

    return code


class CouponCreate(BaseModel):
    code: str = Field(min_length=3, max_length=50)
    name: str = Field(min_length=1, max_length=150)

    discount_type: Literal["percentage", "fixed"]

    value: Decimal = Field(
        gt=0,
        max_digits=12,
        decimal_places=2,
    )

    minimum_order_amount: Decimal = Field(
        default=Decimal("0.00"),
        ge=0,
        max_digits=12,
        decimal_places=2,
    )

    maximum_discount: Decimal | None = Field(
        default=None,
        gt=0,
        max_digits=12,
        decimal_places=2,
    )

    usage_limit: int | None = Field(
        default=None,
        gt=0,
    )

    per_user_limit: int = Field(
        default=1,
        gt=0,
    )

    first_order_only: bool = False

    start_date: datetime
    end_date: datetime

    is_active: bool = True

    @field_validator("code")
    @classmethod
    def normalize_code(cls, value: str) -> str:
        return _normalize_code(value)

    @field_validator("name")
    @classmethod
    def trim_name(cls, value: str) -> str:
        normalized = " ".join(value.split())

        if not normalized:
            raise ValueError("Coupon name cannot be empty")

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

        if (
            self.usage_limit is not None
            and self.per_user_limit > self.usage_limit
        ):
            raise ValueError(
                "Per-user limit cannot be higher than the total usage limit"
            )

        return self


class CouponResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    name: str
    discount_type: str
    value: Decimal
    minimum_order_amount: Decimal
    maximum_discount: Decimal | None
    usage_limit: int | None
    used_count: int
    per_user_limit: int
    first_order_only: bool
    start_date: datetime
    end_date: datetime
    is_active: bool


class CouponValidate(BaseModel):
    code: str = Field(min_length=3, max_length=50)

    @field_validator("code")
    @classmethod
    def normalize_code(cls, value: str) -> str:
        return _normalize_code(value)


class CouponValidateResponse(BaseModel):
    code: str
    name: str
    discount_type: str
    value: Decimal
    discount_amount: Decimal
    subtotal: Decimal
    total_after_coupon: Decimal
    first_order_only: bool


class CouponAvailableResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    name: str
    discount_type: str
    value: Decimal
    minimum_order_amount: Decimal
    maximum_discount: Decimal | None
    first_order_only: bool
    eligible: bool
    reason: str