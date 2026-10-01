from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.coupon import Coupon
from app.models.user import User
from app.schemas.coupon import CouponCreate, CouponResponse
from app.services.dependencies import require_admin


router = APIRouter(
    prefix="/api/coupons",
    tags=["Coupons"],
)


@router.get(
    "/",
    response_model=list[CouponResponse],
)
def get_coupons(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    coupons = db.scalars(
        select(Coupon).order_by(Coupon.id.desc())
    ).all()

    return coupons


@router.get(
    "/{coupon_id}",
    response_model=CouponResponse,
)
def get_coupon(
    coupon_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    coupon = db.scalar(
        select(Coupon).where(Coupon.id == coupon_id)
    )

    if coupon is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Coupon not found",
        )

    return coupon


@router.post(
    "/",
    response_model=CouponResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_coupon(
    coupon_data: CouponCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    code = coupon_data.code.strip().upper()

    existing_coupon = db.scalar(
        select(Coupon).where(Coupon.code == code)
    )

    if existing_coupon is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Coupon code already exists",
        )

    if coupon_data.end_date <= coupon_data.start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="End date must be after start date",
        )

    if (
        coupon_data.discount_type == "percentage"
        and coupon_data.value > 100
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Percentage discount cannot exceed 100",
        )

    if (
        coupon_data.maximum_discount is not None
        and coupon_data.discount_type == "fixed"
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum discount is only valid for percentage coupons",
        )

    coupon = Coupon(
        code=code,
        name=coupon_data.name,
        discount_type=coupon_data.discount_type,
        value=coupon_data.value,
        minimum_order_amount=coupon_data.minimum_order_amount,
        maximum_discount=coupon_data.maximum_discount,
        usage_limit=coupon_data.usage_limit,
        used_count=0,
        per_user_limit=coupon_data.per_user_limit,
        start_date=coupon_data.start_date,
        end_date=coupon_data.end_date,
        is_active=coupon_data.is_active,
    )

    db.add(coupon)
    db.commit()
    db.refresh(coupon)

    return coupon