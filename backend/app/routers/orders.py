from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload
from app.schemas.order_status import OrderStatusUpdate
from app.services.dependencies import require_admin
from fastapi import HTTPException, status
from sqlalchemy import select
from app.models.order_status_history import OrderStatusHistory

from app.database import get_db
from app.models.order import Order
from app.models.user import User
from app.schemas.order import OrderCreate, OrderResponse
from app.services.dependencies import get_current_user
from app.services.order_service import (
    create_order,
    cancel_order,
    update_order_status,
) 


router = APIRouter(
    prefix="/api/orders",
    tags=["Orders"],
)


@router.post(
    "/",
    response_model=OrderResponse,
    status_code=status.HTTP_201_CREATED,
)
def place_order(
    order_data: OrderCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return create_order(
        user=current_user,
        order_data=order_data,
        db=db,
    )


@router.get(
    "/",
    response_model=list[OrderResponse],
)
def get_my_orders(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    orders = db.scalars(
        select(Order)
        .options(
            selectinload(Order.items)
        )
        .where(Order.user_id == current_user.id)
        .order_by(Order.created_at.desc())
    ).all()

    return orders

@router.patch(
    "/admin/{order_id}/status",
    response_model=OrderResponse,
)
def change_order_status(
    order_id: int,
    status_data: OrderStatusUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return update_order_status(
        order_id=order_id,
        new_status=status_data.status,
        note=status_data.note,
        admin=current_user,
        db=db,
    )

@router.get(
    "/{order_id}/history",
)
def get_order_status_history(
    order_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    order = db.scalar(
        select(Order).where(
            Order.id == order_id,
            Order.user_id == current_user.id,
        )
    )

    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found",
        )

    history = db.scalars(
        select(OrderStatusHistory)
        .where(
            OrderStatusHistory.order_id == order_id
        )
        .order_by(OrderStatusHistory.changed_at.asc())
    ).all()

    return history

@router.get(
    "/{order_id}",
    response_model=OrderResponse,
)
def get_my_order(
    order_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    order = db.scalar(
        select(Order)
        .options(
            selectinload(Order.items)
        )
        .where(
            Order.id == order_id,
            Order.user_id == current_user.id,
        )
    )

    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found",
        )

    return order

@router.post(
    "/{order_id}/cancel",
    response_model=OrderResponse,
)
def cancel_my_order(
    order_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return cancel_order(
        order_id=order_id,
        user=current_user,
        db=db,
    )

