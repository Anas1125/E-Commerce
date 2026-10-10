from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models.order import Order
from app.models.order_status_history import OrderStatusHistory
from app.models.user import User
from app.schemas.order import OrderCreate, OrderResponse
from app.services.dependencies import get_current_user
from app.services.order_service import (
    cancel_order,
    create_order,
)


router = APIRouter(
    prefix="/api/orders",
    tags=["Orders"],
)


class OrderStatusHistoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    status: str
    note: str | None = None
    changed_at: datetime


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
    limit: int = Query(default=200, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return db.scalars(
        select(Order)
        .options(selectinload(Order.items))
        .where(Order.user_id == current_user.id)
        # Order.id breaks ties so ordering and paging are stable
        .order_by(Order.created_at.desc(), Order.id.desc())
        .offset(offset)
        .limit(limit)
    ).all()


@router.get(
    "/{order_id}/history",
    response_model=list[OrderStatusHistoryResponse],
)
def get_order_status_history(
    order_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    owns_order = db.scalar(
        select(Order.id).where(
            Order.id == order_id,
            Order.user_id == current_user.id,
        )
    )

    if owns_order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found",
        )

    return db.scalars(
        select(OrderStatusHistory)
        .where(OrderStatusHistory.order_id == order_id)
        .order_by(OrderStatusHistory.changed_at.asc())
    ).all()


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
        .options(selectinload(Order.items))
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