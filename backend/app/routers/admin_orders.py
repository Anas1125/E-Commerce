import os

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.order_status_history import OrderStatusHistory
from app.models.user import User
from app.schemas.order import (
    AdminOrderListPaginatedResponse,
    AdminOrderResponse,
    AdminOrderStatusUpdate,
)
from app.services.dependencies import require_admin
from app.services.order_service import update_order_status


router = APIRouter(
    prefix="/api/admin/orders",
    tags=["Admin Orders"],
)

LIKE_ESCAPE = "\\"

ENABLE_TEST_ENDPOINTS = os.getenv("ENABLE_TEST_ENDPOINTS", "").lower() in {
    "1",
    "true",
    "yes",
}


def _escape_like(value: str) -> str:
    """Escape LIKE wildcards so user input is matched literally."""
    return (
        value.replace("\\", "\\\\")
        .replace("%", "\\%")
        .replace("_", "\\_")
    )


def _load_admin_order(db: Session, order_id: int) -> Order:
    order = db.scalar(
        select(Order)
        .options(
            selectinload(Order.items),
            selectinload(Order.user),
            selectinload(Order.shipping_address),
            selectinload(Order.payment),
        )
        .where(Order.id == order_id)
        .execution_options(populate_existing=True)
    )

    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found",
        )

    history = db.scalars(
        select(OrderStatusHistory)
        .where(OrderStatusHistory.order_id == order.id)
        .order_by(OrderStatusHistory.changed_at.asc())
    ).all()

    order.status_history = history
    return order


@router.get(
    "/",
    response_model=AdminOrderListPaginatedResponse,
)
def get_all_orders(
    order_status: str | None = Query(default=None),
    payment_status: str | None = Query(default=None),
    search: str | None = Query(default=None, max_length=100),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    filters = []

    if order_status:
        filters.append(Order.order_status == order_status)

    if payment_status:
        filters.append(Order.payment_status == payment_status)

    if search and search.strip():
        term = f"%{_escape_like(search.strip())}%"

        full_name = User.first_name + " " + func.coalesce(User.last_name, "")

        filters.append(
            or_(
                Order.order_number.ilike(term, escape=LIKE_ESCAPE),
                Order.user.has(
                    or_(
                        User.first_name.ilike(term, escape=LIKE_ESCAPE),
                        User.last_name.ilike(term, escape=LIKE_ESCAPE),
                        full_name.ilike(term, escape=LIKE_ESCAPE),
                        User.email.ilike(term, escape=LIKE_ESCAPE),
                        User.phone_number.ilike(term, escape=LIKE_ESCAPE),
                    )
                ),
                Order.items.any(
                    OrderItem.product_name.ilike(term, escape=LIKE_ESCAPE)
                ),
            )
        )

    total = (
        db.scalar(select(func.count()).select_from(Order).where(*filters))
        or 0
    )

    orders = db.scalars(
        select(Order)
        .options(
            selectinload(Order.items),
            selectinload(Order.user),
        )
        .where(*filters)
        # Order.id breaks ties so pagination is stable
        .order_by(Order.created_at.desc(), Order.id.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    ).all()

    return {
        "orders": orders,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit,
    }


@router.get("/{order_id}", response_model=AdminOrderResponse)
def get_admin_order(
    order_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return _load_admin_order(db, order_id)


@router.patch("/{order_id}/status", response_model=AdminOrderResponse)
def update_admin_order_status(
    order_id: int,
    data: AdminOrderStatusUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    update_order_status(
        order_id=order_id,
        new_status=data.status,
        note=data.note,
        admin=current_user,
        db=db,
    )

    return _load_admin_order(db, order_id)


@router.patch("/{order_id}/complete-test")
def complete_test_order(
    order_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Testing helper only. Bypasses the normal status workflow, so it is
    disabled unless ENABLE_TEST_ENDPOINTS is set. Remove before launch."""
    if not ENABLE_TEST_ENDPOINTS:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Not found",
        )

    order = db.scalar(
        select(Order)
        .options(selectinload(Order.payment))
        .where(Order.id == order_id)
    )

    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found",
        )

    if order.order_status == "cancelled":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A cancelled order cannot be completed",
        )

    if order.payment_method == "cod":
        if order.payment is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="COD payment record not found",
            )

        order.payment.status = "paid"
        order.payment_status = "paid"

    order.order_status = "delivered"

    try:
        db.commit()
        db.refresh(order)
    except Exception:
        db.rollback()
        raise

    return {
        "message": "Test order completed successfully",
        "order_id": order.id,
        "order_status": order.order_status,
        "payment_status": order.payment_status,
        "payment_record_status": (
            order.payment.status if order.payment else None
        ),
    }