import logging
from datetime import datetime, timezone
from decimal import ROUND_HALF_UP, Decimal
from html import escape

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.order import Order
from app.models.payment import Payment
from app.models.refund import Refund
from app.models.user import User
from app.services.notifications import send_admin_notification
from app.services.payment_service import get_razorpay_client

logger = logging.getLogger(__name__)

_CENT = Decimal("0.01")

_REFUNDABLE_STATUSES = ("paid", "partially_refunded")

_ACTIVE_REFUND_STATUSES = ("requested", "approved", "processing", "completed")


def _to_paise(amount) -> int:
    return int(
        (Decimal(str(amount)) * Decimal("100")).quantize(
            Decimal("1"),
            rounding=ROUND_HALF_UP,
        )
    )


def _notify_refund_requested(
    *,
    order_number: str,
    payment_method: str,
    customer_name: str,
    email: str,
    phone: str,
    amount: Decimal,
    reason: str | None,
) -> None:
    try:
        send_admin_notification(
            subject=f"💰 TerraLens refund requested — {escape(order_number)}",
            html=f"""
            <div style="font-family: Arial, sans-serif; max-width: 680px; margin: 0 auto; padding: 28px; color: #1F2521;">
                <div style="padding-bottom: 20px; border-bottom: 1px solid #E3E5DF;">
                    <h2 style="margin: 0; color: #486B57;">💰 Refund Requested</h2>
                    <p style="margin: 8px 0 0; color: #737A74;">
                        A customer has submitted a refund request.
                    </p>
                </div>

                <div style="padding: 22px 0;">
                    <p><strong>Order:</strong> {escape(order_number)}</p>
                    <p><strong>Customer:</strong> {escape(customer_name)}</p>
                    <p><strong>Email:</strong> {escape(email)}</p>
                    <p><strong>Phone:</strong> {escape(phone)}</p>
                    <p><strong>Payment:</strong> {escape(payment_method.upper())}</p>
                </div>

                <div style="margin-top: 10px; padding: 18px; background: #F8F9F6; border-radius: 10px;">
                    <p style="margin: 0 0 8px;">
                        <strong>Refund amount:</strong> ₹{amount:,.2f}
                    </p>
                    <p style="margin: 0;"><strong>Status:</strong> Pending approval</p>
                </div>

                <div style="margin-top: 20px; padding: 18px; background: #FFF8E8; border-radius: 10px;">
                    <p style="margin: 0 0 8px; font-weight: 700;">Refund reason</p>
                    <p style="margin: 0; white-space: pre-line; color: #4A4F4B;">
                        {escape(reason or "No reason provided.")}
                    </p>
                </div>

                <p style="margin-top: 24px; font-size: 13px; color: #737A74;">
                    Review this refund request from the TerraLens admin panel.
                </p>
            </div>
            """,
        )
    except Exception:
        logger.exception(
            "Failed to send refund notification for order %s", order_number
        )


def request_refund(
    order_id: int,
    amount: Decimal,
    reason: str | None,
    user: User,
    db: Session,
) -> Refund:
    try:
        if amount is None or amount <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Refund amount must be greater than zero",
            )

        if amount != amount.quantize(_CENT):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Refund amount can have at most two decimal places",
            )

        order = db.scalar(
            select(Order)
            .where(
                Order.id == order_id,
                Order.user_id == user.id,
            )
            .with_for_update()
            .execution_options(populate_existing=True)
        )

        if order is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Order not found",
            )

        if order.payment_status not in _REFUNDABLE_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only paid orders can be refunded",
            )

        if order.order_status != "delivered":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only delivered orders can be refunded",
            )

        payment = db.scalar(
            select(Payment)
            .where(
                Payment.order_id == order.id,
                Payment.status.in_(_REFUNDABLE_STATUSES),
            )
            .with_for_update()
            .execution_options(populate_existing=True)
        )

        if payment is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Paid payment not found",
            )

        existing_refunds = db.scalars(
            select(Refund).where(
                Refund.order_id == order.id,
                Refund.status.in_(_ACTIVE_REFUND_STATUSES),
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

        order_number = order.order_number
        payment_method = order.payment_method
        customer_name = (
            " ".join(part for part in [user.first_name, user.last_name] if part)
            .strip()
            or "Customer"
        )
        email = user.email or ""
        phone = str(user.phone_number) if user.phone_number else "Not provided"

        db.add(refund)
        db.commit()
        db.refresh(refund)

    except HTTPException:
        db.rollback()
        raise

    except Exception as exc:
        db.rollback()
        logger.exception("Unexpected error while requesting refund")

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to create refund request",
        ) from exc

    _notify_refund_requested(
        order_number=order_number,
        payment_method=payment_method,
        customer_name=customer_name,
        email=email,
        phone=phone,
        amount=amount,
        reason=reason,
    )

    return refund


def approve_refund(
    refund_id: int,
    admin: User,
    db: Session,
) -> Refund:
    try:
        refund = db.scalar(
            select(Refund)
            .where(Refund.id == refund_id)
            .with_for_update()
            .execution_options(populate_existing=True)
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

    except HTTPException:
        db.rollback()
        raise

    except Exception as exc:
        db.rollback()
        logger.exception("Unexpected error while approving refund")

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to approve refund",
        ) from exc

    logger.info("Refund %s approved by admin %s", refund_id, admin.id)

    return refund


def _verify_gateway_refund(
    refund: Refund,
    payment: Payment,
    gateway_refund_id: str,
) -> None:
    if not payment.gateway_payment_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Payment has no Razorpay payment ID to verify against",
        )

    client = get_razorpay_client()

    try:
        gateway_refund = client.refund.fetch(gateway_refund_id)
    except Exception as exc:
        logger.exception("Unable to fetch Razorpay refund")

        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(
                "Unable to verify the refund with Razorpay. "
                "Check the refund ID and try again."
            ),
        ) from exc

    if (
        gateway_refund.get("id") != gateway_refund_id
        or gateway_refund.get("payment_id") != payment.gateway_payment_id
        or gateway_refund.get("amount") != _to_paise(refund.amount)
        or gateway_refund.get("currency") not in (None, payment.currency)
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Razorpay refund does not match this refund request",
        )

    if gateway_refund.get("status") != "processed":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Razorpay has not finished processing this refund yet",
        )


def complete_refund(
    refund_id: int,
    gateway_refund_id: str,
    admin: User,
    db: Session,
) -> Refund:
    try:
        ids = db.execute(
            select(Refund.order_id, Refund.payment_id).where(
                Refund.id == refund_id
            )
        ).first()

        if ids is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Refund not found",
            )

        order = db.scalar(
            select(Order)
            .where(Order.id == ids.order_id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )

        payment = db.scalar(
            select(Payment)
            .where(Payment.id == ids.payment_id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )

        refund = db.scalar(
            select(Refund)
            .where(Refund.id == refund_id)
            .with_for_update()
            .execution_options(populate_existing=True)
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

        if payment is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Payment not found",
            )

        if order is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Order not found",
            )

        duplicate = db.scalar(
            select(Refund.id).where(
                Refund.gateway_refund_id == gateway_refund_id,
                Refund.id != refund.id,
            )
        )

        if duplicate is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This gateway refund ID is already used by another refund",
            )

        if payment.payment_gateway == "razorpay":
            _verify_gateway_refund(refund, payment, gateway_refund_id)

        refund.status = "completed"
        refund.gateway_refund_id = gateway_refund_id
        refund.completed_at = datetime.now(timezone.utc)

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
            order.payment_status = "refunded"
        else:
            payment.status = "partially_refunded"
            order.payment_status = "partially_refunded"

        db.commit()
        db.refresh(refund)

    except HTTPException:
        db.rollback()
        raise

    except Exception as exc:
        db.rollback()
        logger.exception("Unexpected error while completing refund")

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to complete refund",
        ) from exc

    logger.info(
        "Refund %s completed by admin %s (gateway refund %s)",
        refund_id,
        admin.id,
        gateway_refund_id,
    )

    return refund