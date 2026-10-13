from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.order import Order
from app.models.payment import Payment
from app.database import get_db
from app.models.user import User
from app.schemas.payment import (
    PaymentCreate,
    PaymentComplete,
    PaymentFail,
    PaymentResponse,
    PaymentStatusCheck,
    PendingCheckoutRecoveryResponse,
)
from app.services.dependencies import get_current_user
from app.services.payment_service import (
    create_payment,
    complete_payment,
    fail_payment,
    reconcile_payment_status,
    retry_payment,
)

router = APIRouter(
    prefix="/api/payments",
    tags=["Payments"],
)

@router.get(
    "/pending-checkout",
    response_model=PendingCheckoutRecoveryResponse | None,
)
def get_pending_checkout_recovery(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    order = db.scalar(
        select(Order)
        .join(Payment, Payment.order_id == Order.id)
        .options(selectinload(Order.payment))
        .where(
            Order.user_id == current_user.id,
            Order.payment_method == "upi",
            Order.order_status == "pending",
            Payment.payment_gateway == "razorpay",
        )
        .order_by(Order.created_at.asc(), Order.id.asc())
        .limit(1)
    )

    if order is None or order.payment is None:
        return None

    payment = order.payment

    return PendingCheckoutRecoveryResponse(
        order_id=order.id,
        order_number=order.order_number,
        payment_id=payment.id,
        gateway_order_id=payment.gateway_order_id,
        gateway_order_creation_state=(
            payment.gateway_order_creation_state
        ),
        amount=payment.amount,
        currency=payment.currency,
        status=payment.status,
        order_payment_status=order.payment_status,
    )

@router.post(
    "/",
    response_model=PaymentResponse,
    status_code=201,
)
def create_order_payment(
    payment_data: PaymentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return create_payment(
        order_id=payment_data.order_id,
        user=current_user,
        db=db,
    )


@router.post(
    "/complete",
    response_model=PaymentResponse,
)
def complete_order_payment(
    payment_data: PaymentComplete,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return complete_payment(
        payment_id=payment_data.payment_id,
        gateway_order_id=payment_data.gateway_order_id,
        gateway_payment_id=payment_data.gateway_payment_id,
        gateway_signature=payment_data.gateway_signature,
        payment_method=payment_data.payment_method,
        user=current_user,
        db=db,
    )


@router.post(
    "/fail",
    response_model=PaymentResponse,
)
def fail_order_payment(
    payment_data: PaymentFail,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return fail_payment(
        payment_id=payment_data.payment_id,
        user=current_user,
        db=db,
    )

@router.post("/status", response_model=PaymentResponse)
def check_order_payment_status(
    payment_data: PaymentStatusCheck,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return reconcile_payment_status(
        payment_id=payment_data.payment_id,
        user=current_user,
        db=db,
    )


@router.post("/retry", response_model=PaymentResponse)
def retry_order_payment(
    payment_data: PaymentStatusCheck,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return retry_payment(
        payment_id=payment_data.payment_id,
        user=current_user,
        db=db,
    )
