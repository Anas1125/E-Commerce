from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models.cart import Cart
from app.models.cart_item import CartItem
from app.models.coupon import Coupon
from app.models.coupon_usage import CouponUsage
from app.models.order import Order
from app.models.user import User
from app.schemas.coupon import (
    CouponCreate,
    CouponResponse,
    CouponValidate,
    CouponValidateResponse,
    CouponAvailableResponse,
)
from app.services.dependencies import get_current_user, require_admin


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

@router.post(
    "/validate",
    response_model=CouponValidateResponse,
)
def validate_coupon(
    coupon_data: CouponValidate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    coupon_code = coupon_data.code.strip().upper()

    coupon = db.scalar(
        select(Coupon).where(
            Coupon.code == coupon_code,
            Coupon.is_active == True,
        )
    )

    if coupon is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or inactive coupon",
        )

    now = datetime.utcnow()

    if now < coupon.start_date or now > coupon.end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Coupon is expired or not yet active",
        )

    if (
        coupon.usage_limit is not None
        and coupon.used_count >= coupon.usage_limit
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Coupon usage limit has been reached",
        )

    user_coupon_usage_count = db.scalar(
        select(func.count(CouponUsage.id)).where(
            CouponUsage.coupon_id == coupon.id,
            CouponUsage.user_id == current_user.id,
        )
    ) or 0

    if (
        coupon.per_user_limit is not None
        and user_coupon_usage_count >= coupon.per_user_limit
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have reached the usage limit for this coupon",
        )

    if coupon.first_order_only:
        existing_order = db.scalar(
            select(Order.id)
            .where(Order.user_id == current_user.id)
            .limit(1)
        )

        if existing_order is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This coupon is valid for your first order only",
            )

    cart = db.scalar(
        select(Cart)
        .options(
            selectinload(Cart.items)
            .selectinload(CartItem.product)
        )
        .where(Cart.user_id == current_user.id)
    )

    if cart is None or not cart.items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cart is empty",
        )

    subtotal = Decimal("0.00")

    for cart_item in cart.items:
        product = cart_item.product

        if not product.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Product '{product.name}' is no longer available",
            )

        subtotal += (
            product.price * cart_item.quantity
        )

    if subtotal < coupon.minimum_order_amount:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Minimum order amount for this coupon is "
                f"₹{coupon.minimum_order_amount}"
            ),
        )

    if coupon.discount_type == "percentage":
        discount_amount = (
            subtotal * coupon.value / Decimal("100")
        )

        if coupon.maximum_discount is not None:
            discount_amount = min(
                discount_amount,
                coupon.maximum_discount,
            )
    else:
        discount_amount = coupon.value

    discount_amount = min(
        discount_amount,
        subtotal,
    )

    discount_amount = discount_amount.quantize(
        Decimal("0.01"),
        rounding=ROUND_HALF_UP,
    )

    total_after_coupon = (
        subtotal - discount_amount
    ).quantize(
        Decimal("0.01"),
        rounding=ROUND_HALF_UP,
    )

    return CouponValidateResponse(
        code=coupon.code,
        name=coupon.name,
        discount_type=coupon.discount_type,
        value=coupon.value,
        discount_amount=discount_amount,
        subtotal=subtotal,
        total_after_coupon=total_after_coupon,
        first_order_only=coupon.first_order_only,
    )

@router.get(
    "/available",
    response_model=list[CouponAvailableResponse],
)
def get_available_coupons(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    now = datetime.utcnow()

    cart = db.scalar(
        select(Cart)
        .options(
            selectinload(Cart.items)
            .selectinload(CartItem.product)
        )
        .where(Cart.user_id == current_user.id)
    )

    subtotal = Decimal("0.00")

    if cart and cart.items:
        for cart_item in cart.items:
            product = cart_item.product

            if product.is_active:
                subtotal += (
                    product.price * cart_item.quantity
                )

    existing_order = db.scalar(
        select(Order.id)
        .where(Order.user_id == current_user.id)
        .limit(1)
    )

    # Get all active coupons.
    # Eligibility is calculated below so customers can
    # see why a coupon cannot currently be used.
    coupons = db.scalars(
        select(Coupon)
        .where(Coupon.is_active == True)
        .order_by(Coupon.id.desc())
    ).all()

    results = []

    for coupon in coupons:
        eligible = True
        reason = "Eligible for this order"

        # Date validation
        if now < coupon.start_date:
            eligible = False
            reason = "This coupon is not active yet"

        elif now > coupon.end_date:
            eligible = False
            reason = "This coupon has expired"

        # Global usage limit
        elif (
            coupon.usage_limit is not None
            and coupon.used_count >= coupon.usage_limit
        ):
            eligible = False
            reason = "This coupon has reached its usage limit"

        # Per-user usage limit
        if eligible:
            user_usage_count = db.scalar(
                select(func.count(CouponUsage.id)).where(
                    CouponUsage.coupon_id == coupon.id,
                    CouponUsage.user_id == current_user.id,
                )
            ) or 0

            if (
                coupon.per_user_limit is not None
                and user_usage_count >= coupon.per_user_limit
            ):
                eligible = False
                reason = "You have already used this coupon"

        # First order only
        if eligible and coupon.first_order_only:
            if existing_order is not None:
                eligible = False
                reason = "Valid for first order only"

        # Minimum order amount
        if eligible and subtotal < coupon.minimum_order_amount:
            eligible = False

            remaining = (
                coupon.minimum_order_amount - subtotal
            ).quantize(
                Decimal("0.01"),
                rounding=ROUND_HALF_UP,
            )

            reason = (
                f"Add ₹{remaining} more to use this coupon"
            )

        results.append(
            CouponAvailableResponse(
                id=coupon.id,
                code=coupon.code,
                name=coupon.name,
                discount_type=coupon.discount_type,
                value=coupon.value,
                minimum_order_amount=coupon.minimum_order_amount,
                maximum_discount=coupon.maximum_discount,
                first_order_only=coupon.first_order_only,
                eligible=eligible,
                reason=reason,
            )
        )

    return results

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
        first_order_only=coupon_data.first_order_only,
        start_date=coupon_data.start_date,
        end_date=coupon_data.end_date,
        is_active=coupon_data.is_active,
    )

    db.add(coupon)
    db.commit()
    db.refresh(coupon)

    return coupon

@router.put(
    "/{coupon_id}",
    response_model=CouponResponse,
)
def update_coupon(
    coupon_id: int,
    coupon_data: CouponCreate,
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

    code = coupon_data.code.strip().upper()

    existing_coupon = db.scalar(
        select(Coupon).where(
            Coupon.code == code,
            Coupon.id != coupon_id,
        )
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

    coupon.code = code
    coupon.name = coupon_data.name
    coupon.discount_type = coupon_data.discount_type
    coupon.value = coupon_data.value
    coupon.minimum_order_amount = coupon_data.minimum_order_amount
    coupon.maximum_discount = coupon_data.maximum_discount
    coupon.usage_limit = coupon_data.usage_limit
    coupon.per_user_limit = coupon_data.per_user_limit
    coupon.first_order_only = coupon_data.first_order_only
    coupon.start_date = coupon_data.start_date
    coupon.end_date = coupon_data.end_date
    coupon.is_active = coupon_data.is_active

    db.commit()
    db.refresh(coupon)

    return coupon

@router.patch(
    "/{coupon_id}/status",
    response_model=CouponResponse,
)
def update_coupon_status(
    coupon_id: int,
    is_active: bool,
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

    coupon.is_active = is_active

    db.commit()
    db.refresh(coupon)

    return coupon

@router.delete(
    "/{coupon_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_coupon(
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

    if coupon.used_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Used coupons cannot be deleted. Deactivate the coupon instead.",
        )

    db.delete(coupon)
    db.commit()

    return None