from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.order import Order
from app.models.refund import Refund
from app.models.user import User
from app.schemas.refund import RefundCreate, RefundResponse
from app.services.dependencies import (
    get_current_user,
    require_admin,
)
from app.services.refund_service import (
    approve_refund,
    complete_refund,
    request_refund,
)

router = APIRouter(
    prefix="/api/refunds",
    tags=["Refunds"],
)

_errors = {
    400: {"description": "Invalid amount or refund state"},
    401: {"description": "Not authenticated"},
    403: {"description": "Admin access required"},
    404: {"description": "Order or refund not found"},
    409: {"description": "Conflicts with the current order or refund state"},
}


@router.post(
    "",
    response_model=RefundResponse,
    status_code=201,
    summary="Request a refund for an order",
    responses=_errors,
)
def create_refund_request(
    refund_data: RefundCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return request_refund(
        order_id=refund_data.order_id,
        full_order=refund_data.full_order,
        items=refund_data.items,
        reason=refund_data.reason,
        user=current_user,
        db=db,
    )


@router.get(
    "/my",
    response_model=list[RefundResponse],
    summary="List the current user's refunds, newest first",
)
def get_my_refunds(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return db.scalars(
        select(Refund)
        .join(Order, Order.id == Refund.order_id)
        .where(Order.user_id == current_user.id)
        .order_by(Refund.id.desc())
        .offset(skip)
        .limit(limit)
    ).all()


@router.post(
    "/{refund_id}/approve",
    response_model=RefundResponse,
    summary="Approve a refund request (admin)",
    responses=_errors,
)
def approve_refund_request(
    refund_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return approve_refund(
        refund_id=refund_id,
        admin=current_user,
        db=db,
    )


@router.post(
    "/{refund_id}/complete",
    response_model=RefundResponse,
    summary="Mark an approved refund as completed (admin)",
    responses=_errors,
)
def complete_refund_request(
    refund_id: int,
    gateway_refund_id: str = Query(..., min_length=1, max_length=100),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return complete_refund(
        refund_id=refund_id,
        gateway_refund_id=gateway_refund_id,
        admin=current_user,
        db=db,
    )