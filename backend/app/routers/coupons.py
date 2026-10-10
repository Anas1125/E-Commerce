from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models.cart import Cart
from app.models.cart_item import CartItem
from app.models.coupon import Coupon
from app.models.coupon_usage import CouponUsage
from app.models.order import Order
from app.models.user import User
from app.schemas.coupon import (
    CouponAvailableResponse,
    CouponCreate,
    CouponResponse,
    CouponValidate,
    CouponValidateResponse,
)
from app.services.dependencies import get_current_user, require_admin


router = APIRouter(
    prefix="/api/coupons",
    tags=["Coupons"],
)

AVAILABLE_COUPON_LIMIT = 100
CENT = Decimal("0.01")


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _to_naive_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)

    return value.astimezone(timezone.utc)


def _bad_request(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=detail,
    )


def _validate_coupon_rules(
    coupon_data: CouponCreate,
    start_date: datetime,
    end_date: datetime,
) -> None:
    if end_date <= start_date:
        raise _bad_request("End date must be after start date")

    if coupon_data.value <= 0:
        raise _bad_request("Discount value must be greater than zero")

    if coupon_data.discount_type == "percentage" and coupon_data.value > 100:
        raise _bad_request("Percentage discount cannot exceed 100")

    if (
        coupon_data.maximum_discount is not None
        and coupon_data.discount_type == "fixed"
    ):
        raise _bad_request(
            "Maximum discount is only valid for percentage coupons"
        )

    if (
        coupon_data.minimum_order_amount is not None
        and coupon_data.minimum_order_amount < 0
    ):
        raise _bad_request("Minimum order amount cannot be negative")


def _load_cart(db: Session, user_id: int) -> Cart | None:
    return db.scalar(
        select(Cart)
        .options(selectinload(Cart.items).selectinload(CartItem.product))
        .where(Cart.user_id == user_id)
    )


def _cart_subtotal(cart: Cart | None, *, strict: bool) -> Decimal:
    if cart is None or not cart.items:
        if strict:
            raise _bad_request("Cart is empty")
        return Decimal("0.00")

    subtotal = Decimal("0.00")

    for cart_item in cart.items:
        product = cart_item.product

        if product is None or not product.is_active:
            if strict:
                name = product.name if product is not None else "A product"
                raise _bad_request(f"Product '{name}' is no longer available")
            continue

        subtotal += product.price * cart_item.quantity

    return subtotal


def _ineligibility_reason(
    coupon: Coupon,
    *,
    now: datetime,
    user_usage_count: int,
    has_existing_order: bool,
) -> str | None:
    if now < coupon.start_date:
        return "This coupon is not active yet"

    if now > coupon.end_date:
        return "This coupon has expired"

    if (
        coupon.usage_limit is not None
        and coupon.used_count >= coupon.usage_limit
    ):
        return "This coupon has reached its usage limit"

    if (
        coupon.per_user_limit is not None
        and user_usage_count >= coupon.per_user_limit
    ):
        return "You have already used this coupon"

    if coupon.first_order_only and has_existing_order:
        return "This coupon is valid for your first order only"

    return None


def _calculate_discount(coupon: Coupon, subtotal: Decimal) -> Decimal:
    if coupon.discount_type == "percentage":
        discount_amount = subtotal * coupon.value / Decimal("100")

        if coupon.maximum_discount is not None:
            discount_amount = min(discount_amount, coupon.maximum_discount)
    else:
        discount_amount = coupon.value

    discount_amount = min(discount_amount, subtotal)

    return discount_amount.quantize(CENT, rounding=ROUND_HALF_UP)


def _has_existing_order(db: Session, user_id: int) -> bool:
    return (
        db.scalar(
            select(Order.id).where(Order.user_id == user_id).limit(1)
        )
        is not None
    )


def _get_coupon_or_404(db: Session, coupon_id: int) -> Coupon:
    coupon = db.scalar(select(Coupon).where(Coupon.id == coupon_id))

    if coupon is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Coupon not found",
        )

    return coupon

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
            Coupon.is_active.is_(True),
        )
    )

    if coupon is None:
        raise _bad_request("Invalid or inactive coupon")

    user_usage_count = (
        db.scalar(
            select(func.count(CouponUsage.id)).where(
                CouponUsage.coupon_id == coupon.id,
                CouponUsage.user_id == current_user.id,
            )
        )
        or 0
    )

    reason = _ineligibility_reason(
        coupon,
        now=_utcnow(),
        user_usage_count=user_usage_count,
        has_existing_order=(
            _has_existing_order(db, current_user.id)
            if coupon.first_order_only
            else False
        ),
    )

    if reason is not None:
        raise _bad_request(reason)

    subtotal = _cart_subtotal(_load_cart(db, current_user.id), strict=True)

    if subtotal < coupon.minimum_order_amount:
        raise _bad_request(
            f"Minimum order amount for this coupon is "
            f"₹{coupon.minimum_order_amount}"
        )

    discount_amount = _calculate_discount(coupon, subtotal)

    total_after_coupon = (subtotal - discount_amount).quantize(
        CENT,
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
    now = _utcnow()

    subtotal = _cart_subtotal(_load_cart(db, current_user.id), strict=False)
    has_order = _has_existing_order(db, current_user.id)

    coupons = db.scalars(
        select(Coupon)
        .where(Coupon.is_active.is_(True))
        .order_by(Coupon.id.desc())
        .limit(AVAILABLE_COUPON_LIMIT)
    ).all()

    usage_by_coupon = dict(
        db.execute(
            select(CouponUsage.coupon_id, func.count(CouponUsage.id))
            .where(CouponUsage.user_id == current_user.id)
            .group_by(CouponUsage.coupon_id)
        ).all()
    )

    results = []

    for coupon in coupons:
        reason = _ineligibility_reason(
            coupon,
            now=now,
            user_usage_count=usage_by_coupon.get(coupon.id, 0),
            has_existing_order=has_order,
        )

        if reason is None and subtotal < coupon.minimum_order_amount:
            remaining = (coupon.minimum_order_amount - subtotal).quantize(
                CENT,
                rounding=ROUND_HALF_UP,
            )
            reason = f"Add ₹{remaining} more to use this coupon"

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
                eligible=reason is None,
                reason=reason or "Eligible for this order",
            )
        )

    return results

@router.get(
    "/",
    response_model=list[CouponResponse],
    dependencies=[Depends(require_admin)],
)
def get_coupons(
    db: Session = Depends(get_db),
):
    return db.scalars(select(Coupon).order_by(Coupon.id.desc())).all()


@router.get(
    "/{coupon_id}",
    response_model=CouponResponse,
    dependencies=[Depends(require_admin)],
)
def get_coupon(
    coupon_id: int,
    db: Session = Depends(get_db),
):
    return _get_coupon_or_404(db, coupon_id)


@router.post(
    "/",
    response_model=CouponResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin)],
)
def create_coupon(
    coupon_data: CouponCreate,
    db: Session = Depends(get_db),
):
    code = coupon_data.code.strip().upper()
    start_date = _to_naive_utc(coupon_data.start_date)
    end_date = _to_naive_utc(coupon_data.end_date)

    existing_coupon = db.scalar(select(Coupon).where(Coupon.code == code))

    if existing_coupon is not None:
        raise _bad_request("Coupon code already exists")

    _validate_coupon_rules(coupon_data, start_date, end_date)

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
        start_date=start_date,
        end_date=end_date,
        is_active=coupon_data.is_active,
    )

    db.add(coupon)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise _bad_request("Coupon code already exists")

    db.refresh(coupon)

    return coupon


@router.put(
    "/{coupon_id}",
    response_model=CouponResponse,
    dependencies=[Depends(require_admin)],
)
def update_coupon(
    coupon_id: int,
    coupon_data: CouponCreate,
    db: Session = Depends(get_db),
):
    coupon = _get_coupon_or_404(db, coupon_id)

    code = coupon_data.code.strip().upper()
    start_date = _to_naive_utc(coupon_data.start_date)
    end_date = _to_naive_utc(coupon_data.end_date)

    existing_coupon = db.scalar(
        select(Coupon).where(
            Coupon.code == code,
            Coupon.id != coupon_id,
        )
    )

    if existing_coupon is not None:
        raise _bad_request("Coupon code already exists")

    _validate_coupon_rules(coupon_data, start_date, end_date)

    coupon.code = code
    coupon.name = coupon_data.name
    coupon.discount_type = coupon_data.discount_type
    coupon.value = coupon_data.value
    coupon.minimum_order_amount = coupon_data.minimum_order_amount
    coupon.maximum_discount = coupon_data.maximum_discount
    coupon.usage_limit = coupon_data.usage_limit
    coupon.per_user_limit = coupon_data.per_user_limit
    coupon.first_order_only = coupon_data.first_order_only
    coupon.start_date = start_date
    coupon.end_date = end_date
    coupon.is_active = coupon_data.is_active

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise _bad_request("Coupon code already exists")

    db.refresh(coupon)

    return coupon


@router.patch(
    "/{coupon_id}/status",
    response_model=CouponResponse,
    dependencies=[Depends(require_admin)],
)
def update_coupon_status(
    coupon_id: int,
    is_active: bool,
    db: Session = Depends(get_db),
):
    coupon = _get_coupon_or_404(db, coupon_id)

    coupon.is_active = is_active

    db.commit()
    db.refresh(coupon)

    return coupon


@router.delete(
    "/{coupon_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_admin)],
)
def delete_coupon(
    coupon_id: int,
    db: Session = Depends(get_db),
):
    coupon = _get_coupon_or_404(db, coupon_id)

    has_usage_rows = (
        db.scalar(
            select(CouponUsage.id)
            .where(CouponUsage.coupon_id == coupon_id)
            .limit(1)
        )
        is not None
    )

    if coupon.used_count > 0 or has_usage_rows:
        raise _bad_request(
            "Used coupons cannot be deleted. Deactivate the coupon instead."
        )

    db.delete(coupon)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise _bad_request(
            "This coupon is still referenced and cannot be deleted. "
            "Deactivate it instead."
        )

    return None