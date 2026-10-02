from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.order import Order
from app.models.payment import Payment
from app.models.refund import Refund
from app.models.user import User

from datetime import datetime


def request_refund(
    order_id: int,
    amount: Decimal,
    reason: str | None,
    user: User,
    db: Session,
) -> Refund:
    order = db.scalar(
        select(Order).where(
            Order.id == order_id,
            Order.user_id == user.id,
        )
    )

    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found",
        )

    if order.payment_status != "paid":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only paid orders can be refunded",
        )

    if order.order_status != "delivered":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only delivered orders can be refunded",
        )

    if order.order_status == "cancelled":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Order is already cancelled",
        )

    payment = db.scalar(
        select(Payment).where(
            Payment.order_id == order.id,
            Payment.status == "paid",
        )
    )

    if payment is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Paid payment not found",
        )

    existing_refunds = db.scalars(
        select(Refund).where(
            Refund.order_id == order.id,
            Refund.status.in_(
                ["requested", "approved", "processing", "completed"]
            ),
        )
    ).all()

    refunded_amount = sum(
        (refund.amount for refund in existing_refunds),
        Decimal("0.00"),
    )

    if refunded_amount + amount > payment.amount:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Refund amount exceeds available refundable amount",
        )

    refund = Refund(
        order_id=order.id,
        payment_id=payment.id,
        amount=amount,
        reason=reason,
        status="requested",
    )

    db.add(refund)
    db.commit()
    db.refresh(refund)

    return refund


def approve_refund(
    refund_id: int,
    admin: User,
    db: Session,
) -> Refund:
    refund = db.scalar(
        select(Refund).where(
            Refund.id == refund_id
        )
    )

    if refund is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Refund not found",
        )

    if refund.status != "requested":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only requested refunds can be approved",
        )

    refund.status = "approved"

    db.commit()
    db.refresh(refund)

    return refund

def complete_refund(
    refund_id: int,
    gateway_refund_id: str,
    admin: User,
    db: Session,
) -> Refund:
    refund = db.scalar(
        select(Refund).where(
            Refund.id == refund_id
        )
    )

    if refund is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Refund not found",
        )

    if refund.status != "approved":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only approved refunds can be completed",
        )

    payment = db.scalar(
        select(Payment).where(
            Payment.id == refund.payment_id
        )
    )

    if payment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found",
        )

    refund.status = "completed"
    refund.gateway_refund_id = gateway_refund_id
    refund.completed_at = datetime.utcnow()

    db.flush()

    completed_refunds = db.scalars(
        select(Refund).where(
            Refund.payment_id == payment.id,
            Refund.status == "completed",
        )
    ).all()

    total_refunded = sum(
        (item.amount for item in completed_refunds),
        Decimal("0.00"),
    )

    if total_refunded >= payment.amount:
        payment.status = "refunded"

    db.commit()
    db.refresh(refund)

    return refund