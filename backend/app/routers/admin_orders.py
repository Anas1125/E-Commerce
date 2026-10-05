from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.orm import Session, selectinload
from app.schemas.order import (
    AdminOrderResponse,
    AdminOrderListPaginatedResponse,
    AdminOrderStatusUpdate,
)

from app.database import get_db
from app.models.order import Order
from app.models.user import User
from app.models.order_item import OrderItem
from app.services.dependencies import require_admin
from fastapi import HTTPException, status
from app.models.order_status_history import OrderStatusHistory
from app.services.order_service import update_order_status
from app.models.payment import Payment


router = APIRouter(
    prefix="/api/admin/orders",
    tags=["Admin Orders"],
)


@router.get(
    "/",
    response_model=AdminOrderListPaginatedResponse,
)
def get_all_orders(
    order_status: str | None = Query(default=None),
    payment_status: str | None = Query(default=None),
    search: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    query = (
        select(Order)
        .options(
            selectinload(Order.items),
            selectinload(Order.user),
        )
        .order_by(Order.created_at.desc())
    )

    count_query = select(Order)

    if order_status:
        query = query.where(
            Order.order_status == order_status
        )
        count_query = count_query.where(
            Order.order_status == order_status
        )

    if payment_status:
        query = query.where(
            Order.payment_status == payment_status
        )
        count_query = count_query.where(
            Order.payment_status == payment_status
        )

    if search and search.strip():
        search_term = f"%{search.strip()}%"

        search_filter = (
            Order.order_number.ilike(search_term)
            | Order.user.has(
                User.first_name.ilike(search_term)
            )
            | Order.user.has(
                User.last_name.ilike(search_term)
            )
            | Order.user.has(
                User.email.ilike(search_term)
            )
            | Order.user.has(
                User.phone_number.ilike(search_term)
            )
            | Order.items.any(
                OrderItem.product_name.ilike(search_term)
            )
        )

        query = query.where(search_filter)
        count_query = count_query.where(search_filter)

    total = db.scalar(
        select(func.count())
        .select_from(count_query.subquery())
    ) or 0

    offset = (page - 1) * limit

    orders = db.scalars(
        query
        .offset(offset)
        .limit(limit)
    ).all()

    return {
        "orders": orders,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": (
            (total + limit - 1) // limit
        ),
    }

@router.get("/{order_id}", response_model=AdminOrderResponse)
def get_admin_order(
    order_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    order = db.scalar(
        select(Order)
        .options(
            selectinload(Order.items),
            selectinload(Order.user),
            selectinload(Order.shipping_address),
            selectinload(Order.payment),
        )
        .where(Order.id == order_id)
    )

    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found",
        )

    history = db.scalars(
        select(OrderStatusHistory)
        .where(
            OrderStatusHistory.order_id == order.id
        )
        .order_by(OrderStatusHistory.changed_at.asc())
    ).all()

    order.status_history = history
    return order

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

    order = db.scalar(
        select(Order)
        .options(
            selectinload(Order.items),
            selectinload(Order.user),
            selectinload(Order.shipping_address),
            selectinload(Order.payment),
        )
        .where(Order.id == order_id)
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

@router.patch("/{order_id}/complete-test")
def complete_test_order(
    order_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    order = db.scalar(
        select(Order)
        .options(selectinload(Order.payment))
        .where(Order.id == order_id)
    )

    if order is None:
        raise HTTPException(
            status_code=404,
            detail="Order not found",
        )

    if order.payment_method == "cod":
        if order.payment is None:
            raise HTTPException(
                status_code=400,
                detail="COD payment record not found",
            )

        order.payment.status = "paid"
        order.payment_status = "paid"

    order.order_status = "delivered"

    db.commit()
    db.refresh(order)

    return {
        "message": "Test order completed successfully",
        "order_id": order.id,
        "order_status": order.order_status,
        "payment_status": order.payment_status,
        "payment_record_status": (
            order.payment.status
            if order.payment
            else None
        ),
    }