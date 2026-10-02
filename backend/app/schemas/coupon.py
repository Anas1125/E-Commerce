from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class CouponCreate(BaseModel):
    code: str = Field(min_length=3, max_length=50)
    name: str = Field(min_length=1, max_length=150)

    discount_type: str = Field(
        pattern="^(percentage|fixed)$"
    )

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


class CouponResponse(BaseModel):
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

    model_config = {
        "from_attributes": True
    }

class CouponValidate(BaseModel):
    code: str = Field(min_length=3, max_length=50)


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

    model_config = {
        "from_attributes": True
    }