from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.refund import RefundCreate, RefundResponse
from app.services.dependencies import (
    get_current_user,
    require_admin,
)
from app.services.refund_service import (
    request_refund,
    approve_refund,
    complete_refund,
)


router = APIRouter(
    prefix="/api/refunds",
    tags=["Refunds"],
)


@router.post(
    "/",
    response_model=RefundResponse,
    status_code=201,
)
def create_refund_request(
    refund_data: RefundCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return request_refund(
        order_id=refund_data.order_id,
        amount=refund_data.amount,
        reason=refund_data.reason,
        user=current_user,
        db=db,
    )

@router.post(
    "/{refund_id}/approve",
    response_model=RefundResponse,
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
)
def complete_refund_request(
    refund_id: int,
    gateway_refund_id: str,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return complete_refund(
        refund_id=refund_id,
        gateway_refund_id=gateway_refund_id,
        admin=current_user,
        db=db,
    )